/**
 * workspace/agentRunner.ts — Der Hintergrund-Agent der Faltin-KI.
 * ─────────────────────────────────────────────────────────────────────────────
 * Läuft selbständig (Scheduler in instrumentation.ts, alle 10 min) und erledigt,
 * was ohne Menschen geht — nie etwas, das nach aussen wirkt:
 *   1. Neue Mails in request@ abholen und einordnen (nur lesen)
 *   2. Für dringende Kundenmails Antwortvorschläge vorbereiten (max. 2 pro Lauf)
 *   3. Erinnerungen berechnen und abgleichen (nudges.ts) → Glocke + Arbeitsplatz
 *   4. Genehmigende täglich per Mail erinnern, solange Abwesenheitsanträge offen sind
 * Jeder Lauf wird in ws_agent_runs protokolliert („Was die KI selbst erledigt hat“).
 * Abschaltbar über settings.ai.workspace_agent_enabled.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { dbAll, dbRun } from '../dbq';
import { getSettings } from '../settingsStore';
import { isGraphConfigured, sendGraphMail, getLoginBaseUrl } from '../graphMailer';
import { agentReminderEmailHtml } from '../emailTemplates';
import { getEmployee } from '../staffStore';
import { firstName } from '../vacationFormat';
import { siteConfig } from '../siteConfig';
import { ensureWorkspaceSchema, nowIso } from './schema';
import { isWorkspaceAiConfigured } from './claude';
import { syncInbox, suggestReply } from './mailTriage';
import { computeDesiredNudges, reconcileNudges } from './nudges';

export interface AgentRunSummary {
  started_at: string;
  finished_at: string;
  skipped?: string;
  mails_added: number;
  mails_triaged: number;
  drafts_prepared: number;
  nudges_created: number;
  nudges_resolved: number;
  notifications: number;
  reminder_mails: number;
  errors: string[];
}

let running: Promise<AgentRunSummary> | null = null;

export function isAgentEnabled(): boolean {
  return getSettings().ai.workspace_agent_enabled !== false;
}

function baseUrl(): string {
  return (getLoginBaseUrl() || process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url || 'https://next.faltintravel.com').replace(/\/+$/, '');
}

/** Einen Lauf ausführen (single-flight). `force` ignoriert den Schalter (manueller Start). */
export function runWorkspaceAgent(opts: { force?: boolean } = {}): Promise<AgentRunSummary> {
  if (!running) running = doRun(opts).finally(() => { running = null; });
  return running;
}

async function doRun(opts: { force?: boolean }): Promise<AgentRunSummary> {
  const s: AgentRunSummary = {
    started_at: nowIso(), finished_at: '', mails_added: 0, mails_triaged: 0, drafts_prepared: 0,
    nudges_created: 0, nudges_resolved: 0, notifications: 0, reminder_mails: 0, errors: [],
  };
  if (!opts.force && !isAgentEnabled()) {
    return { ...s, finished_at: nowIso(), skipped: 'Agent ist ausgeschaltet' };
  }
  await ensureWorkspaceSchema();

  // 1) + 2) Posteingang
  if (isGraphConfigured() && isWorkspaceAiConfigured()) {
    try {
      const r = await syncInbox({ fetch: 30, triageLimit: 16 });
      s.mails_added = r.added;
      s.mails_triaged = r.triaged;
      s.errors.push(...r.errors.map((e) => `Mail-Sortierung: ${e}`));
    } catch (e) { s.errors.push(`Mail-Sortierung: ${(e as Error).message}`); }
    try {
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const urgent = await dbAll<{ graph_id: string }>(
        `SELECT graph_id FROM ws_mail_triage
         WHERE status = 'offen' AND needs_reply = 1 AND priority = 'hoch' AND suggestion = '' AND triaged_at IS NOT NULL
           AND suggest_attempts < 2 AND received_at >= ?
         ORDER BY received_at DESC LIMIT 2`,
        [since],
      );
      for (const m of urgent) {
        await dbRun(`UPDATE ws_mail_triage SET suggest_attempts = suggest_attempts + 1 WHERE graph_id = ?`, [m.graph_id]);
        try {
          await suggestReply(m.graph_id, { name: 'Faltin-KI', signature: 'Ihr Faltin-Travel-Team\\nFaltin Travel AG' });
          s.drafts_prepared++;
        } catch (e) { s.errors.push(`Antwortvorschlag: ${(e as Error).message}`); }
      }
    } catch (e) { s.errors.push(`Antwortvorschläge: ${(e as Error).message}`); }
  }

  // 3) Erinnerungen
  try {
    const desired = await computeDesiredNudges();
    const r = await reconcileNudges(desired);
    s.nudges_created = r.created;
    s.nudges_resolved = r.resolved;
    s.notifications = r.notified;

    // 4) Tägliche Erinnerungsmail an Genehmigende (nur wenn gerade erinnert wurde)
    if (isGraphConfigured()) {
      for (const [employeeId, nudges] of r.vacationDue) {
        const emp = await getEmployee(employeeId);
        if (!emp?.email || !emp.active) continue;
        const res = await sendGraphMail({
          to: emp.email,
          toName: emp.name,
          subject: nudges.length === 1 ? `Erinnerung: ${nudges[0].title}` : `Erinnerung: ${nudges.length} Abwesenheitsanträge warten auf dich`,
          html: agentReminderEmailHtml({
            firstName: firstName(emp.name),
            items: nudges.map((n) => ({ title: n.title, body: n.body })),
            url: `${baseUrl()}/admin/urlaub`,
            buttonLabel: 'Jetzt entscheiden',
          }),
        }).catch((e) => ({ success: false, error: (e as Error).message }));
        if (res.success) s.reminder_mails++;
        else if (!('skipped' in res && res.skipped)) s.errors.push(`Erinnerungsmail an ${emp.name}: ${res.error || 'fehlgeschlagen'}`);
      }
    }
  } catch (e) { s.errors.push(`Erinnerungen: ${(e as Error).message}`); }

  s.finished_at = nowIso();
  await dbRun(`INSERT INTO ws_agent_runs (id, started_at, finished_at, summary) VALUES (?, ?, ?, ?)`,
    [crypto.randomUUID(), s.started_at, s.finished_at, JSON.stringify(s)]).catch(() => {});
  await dbRun(`DELETE FROM ws_agent_runs WHERE started_at < ?`, [new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString()]).catch(() => {});
  return s;
}

/** Tageszusammenfassung für den Arbeitsplatz. */
export async function agentTodaySummary(): Promise<{
  enabled: boolean; last_run: AgentRunSummary | null;
  today: { runs: number; mails_triaged: number; drafts_prepared: number; nudges_created: number; notifications: number; reminder_mails: number };
}> {
  await ensureWorkspaceSchema();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const rows = await dbAll<{ summary: string }>(`SELECT summary FROM ws_agent_runs WHERE started_at >= ? ORDER BY started_at DESC`, [since]);
  const runs = rows.map((r) => { try { return JSON.parse(r.summary) as AgentRunSummary; } catch { return null; } }).filter((x): x is AgentRunSummary => !!x);
  const sum = (k: keyof AgentRunSummary) => runs.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
  return {
    enabled: isAgentEnabled(),
    last_run: runs[0] || null,
    today: {
      runs: runs.length,
      mails_triaged: sum('mails_triaged'),
      drafts_prepared: sum('drafts_prepared'),
      nudges_created: sum('nudges_created'),
      notifications: sum('notifications'),
      reminder_mails: sum('reminder_mails'),
    },
  };
}
