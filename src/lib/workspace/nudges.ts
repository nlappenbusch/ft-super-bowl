/**
 * workspace/nudges.ts — Erinnerungen der Faltin-KI („nerven, bis es erledigt ist“).
 * ─────────────────────────────────────────────────────────────────────────────
 * Regelbasiert (keine KI-Kosten): Der Hintergrund-Agent berechnet bei jedem Lauf,
 * woran wer erinnert werden soll, und gleicht das mit ws_nudges ab:
 *   – neu            → anlegen + Glocke (in Arbeitszeiten)
 *   – weiterhin offen → täglich erneut erinnern (je Art, max. MAX_REMINDERS)
 *   – Bedingung weg   → automatisch erledigt (z.B. Antrag entschieden)
 *   – „Später“        → bis snooze_until still, danach wieder offen
 *   – „Erledigt“ von Hand → bleibt geschlossen, solange der Schlüssel gleich ist
 *
 * Regeln:
 *   urlaub_genehmigen   offener Abwesenheitsantrag → Genehmigende (nach 3 Tagen auch alle Admins)
 *   aufgabe_ueberfaellig eigene Aufgabe über Fälligkeit → Zuständige:r
 *   aufgabe_offen        Aufgabe seit >24 h ohne Zuständigkeit → Admins
 *   kunde_wartet         Kunde wartet >24 h auf Antwort → Zuständige:r bzw. Admins
 *   uebergabe            Abwesenheit beginnt in ≤3 Tagen, es gibt Offenes → die Person selbst
 *   vertretung           Zuständige:r heute abwesend, Aufgabe bald fällig → Stellvertretung bzw. Admins
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { dbAll, dbGet, dbRun } from '../dbq';
import {
  listEmployees, listStaffTasks, formatTicketNo, getVacationApprovers, listUpcomingAbsences, vacationConflicts,
  addNotification, type Employee, type VacationRequest,
} from '../staffStore';
import { listUnansweredBookingInbound } from '../database';
import { fmtRangeDe, fmtDaysDe, firstName, VACATION_TYPE_LABEL } from '../vacationFormat';
import { ensureWorkspaceSchema, nowIso } from './schema';
import { lastInboundKinds } from './inboundKind';

export const NUDGE_KINDS = ['urlaub_genehmigen', 'aufgabe_ueberfaellig', 'aufgabe_offen', 'kunde_wartet', 'uebergabe', 'vertretung'] as const;
export type NudgeKind = (typeof NUDGE_KINDS)[number];

export interface Nudge {
  id: string;
  dedupe_key: string;
  employee_id: string;
  kind: NudgeKind;
  ref_id: string;
  title: string;
  body: string;
  action_url: string;
  prompt: string;
  priority: 'hoch' | 'normal';
  status: 'offen' | 'zurueckgestellt' | 'erledigt' | 'verworfen';
  snooze_until: string | null;
  notify_count: number;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DesiredNudge {
  key: string;
  employee_id: string;
  kind: NudgeKind;
  ref_id: string;
  title: string;
  body: string;
  action_url: string;
  prompt: string;
  priority: 'hoch' | 'normal';
  /** Schon anderweitig benachrichtigt (z.B. Mail beim Anlegen des Antrags) → zählt als erste Erinnerung. */
  notified_at?: string;
}

const DAY_MS = 24 * 3600 * 1000;
/**
 * Team-Hinweise ohne feste Zuständigkeit (an alle Admins): nur im Arbeitsplatz sichtbar,
 * keine Glocke — sonst bekäme jede:r Admin jede Kleinigkeit einzeln gemeldet.
 */
const SILENT_KEY_PREFIXES = ['aufgabe_offen:', 'kunde_wartet_team:'];

/** Arten, an die täglich erneut erinnert wird, solange sie offen sind. */
const REMIND_DAILY: NudgeKind[] = ['urlaub_genehmigen', 'kunde_wartet', 'aufgabe_ueberfaellig'];
const MAX_REMINDERS = 5;

function ts(s?: string | null): number {
  if (!s) return 0;
  let v = s.includes('T') ? s : s.replace(' ', 'T');
  if (!/([zZ]|[+-]\d\d:?\d\d)$/.test(v)) v += 'Z';
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

function zurichParts(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), weekday: String(p.weekday) };
}

/** Benachrichtigt wird nur Mo–Fr 7–19 Uhr (Zürich); Erinnerungen bleiben sonst liegen. */
export function isWorkingHours(d = new Date()): boolean {
  const z = zurichParts(d);
  return !['Sat', 'Sun'].includes(z.weekday) && z.hour >= 7 && z.hour < 19;
}

function addDaysIso(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/* ── Regeln ────────────────────────────────────────────────────────────────── */

export async function computeDesiredNudges(): Promise<DesiredNudge[]> {
  const today = zurichParts().date;
  const now = Date.now();
  const out: DesiredNudge[] = [];
  const employees = await listEmployees(false);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const admins = employees.filter((e) => e.role === 'admin');

  // 1) Offene Abwesenheitsanträge → Genehmigende
  // Nur Anträge, deren Zeitraum noch nicht vorbei ist (alte, vergessene Anträge nicht wieder aufrollen).
  const pending = await dbAll<VacationRequest>(`SELECT * FROM vacation_requests WHERE status = 'beantragt' AND end_date >= ? ORDER BY created_at`, [today]);
  for (const v of pending) {
    const requester = byId.get(v.employee_id);
    if (!requester) continue;
    const approvers = await getVacationApprovers(v.employee_id);
    const ageDays = Math.floor((now - ts(v.created_at)) / DAY_MS);
    const recipients = new Map<string, Employee>(approvers.map((a) => [a.id, a]));
    if (ageDays >= 3) for (const a of admins) if (a.id !== v.employee_id) recipients.set(a.id, a);
    if (!recipients.size) continue;
    let warnings: string[] = [];
    try {
      const c = await vacationConflicts(v.employee_id, v.start_date, v.end_date, {
        substituteId: (v as VacationRequest & { substitute_id?: string | null }).substitute_id || null,
        type: v.type, halfDay: v.days === 0.5, excludeRequestId: v.id,
      });
      warnings = c.warnings;
    } catch { /* Konflikte sind nur Zusatzinfo */ }
    const label = VACATION_TYPE_LABEL[v.type] || 'Abwesenheit';
    for (const r of recipients.values()) {
      const designated = approvers.some((a) => a.id === r.id);
      out.push({
        key: `urlaub:${v.id}:${r.id}`,
        employee_id: r.id,
        kind: 'urlaub_genehmigen',
        ref_id: v.id,
        title: `${label} von ${firstName(requester.name)} wartet auf ${designated ? 'deine Entscheidung' : 'eine Entscheidung'}`,
        body: [
          `${fmtRangeDe(v.start_date, v.end_date)} · ${fmtDaysDe(v.days)} · beantragt ${ageDays === 0 ? 'heute' : `vor ${ageDays} Tag${ageDays === 1 ? '' : 'en'}`}`,
          v.comment ? `„${v.comment.slice(0, 140)}“` : '',
          warnings.length ? `Achtung: ${warnings.slice(0, 2).join(' ')}` : 'Keine Überschneidungen im Team.',
          !designated ? `Zuständig wäre: ${approvers.map((a) => a.name).join(', ') || 'Admins'} (wartet seit ${ageDays} Tagen).` : '',
        ].filter(Boolean).join('\n'),
        action_url: '/admin/urlaub',
        // Zuständige wurden beim Anlegen schon per Glocke + Mail informiert → nicht gleich nochmals.
        notified_at: designated && ageDays < 1 ? new Date(ts(v.created_at)).toISOString() : undefined,
        prompt: `Hilf mir beim Abwesenheitsantrag von ${requester.name} (${fmtRangeDe(v.start_date, v.end_date)}): Gibt es Überschneidungen oder offene Aufgaben/Anfragen, die in der Zeit kritisch werden? Was spricht für oder gegen die Genehmigung?`,
        priority: ageDays >= 2 || v.start_date <= addDaysIso(today, 7) ? 'hoch' : 'normal',
      });
    }
  }

  // 2) + 3) Aufgaben
  const tasks = (await listStaffTasks()).filter((t) => t.status !== 'erledigt');
  for (const t of tasks) {
    const due = (t.due_date || '').slice(0, 10);
    if (t.assignee_id && byId.has(t.assignee_id) && due && due < today) {
      out.push({
        key: `aufgabe_ueberfaellig:${t.id}:${t.assignee_id}`,
        employee_id: t.assignee_id,
        kind: 'aufgabe_ueberfaellig',
        ref_id: t.id,
        title: `${formatTicketNo(t.ticket_number)} ist überfällig`,
        body: `„${t.title}“ war fällig am ${fmtRangeDe(due, due)}. Neues Datum setzen, abschliessen oder abgeben?`,
        action_url: `/admin/aufgaben/${t.id}`,
        prompt: `${formatTicketNo(t.ticket_number)} „${t.title}“ (task_id ${t.id}) ist überfällig. Was ist der Stand und was ist der nächste Schritt? Schlag ein realistisches neues Fälligkeitsdatum vor.`,
        priority: 'hoch',
      });
    }
  }
  const unassigned = tasks
    .filter((t) => !t.assignee_id && t.status === 'offen' && !t.ai_requested && now - ts(t.created_at) > DAY_MS)
    .slice(0, 5);
  for (const t of unassigned) {
    for (const a of admins) {
      out.push({
        key: `aufgabe_offen:${t.id}:${a.id}`,
        employee_id: a.id,
        kind: 'aufgabe_offen',
        ref_id: t.id,
        title: `${formatTicketNo(t.ticket_number)} hat niemanden`,
        body: `„${t.title}“ liegt seit ${Math.floor((now - ts(t.created_at)) / DAY_MS)} Tagen ohne Zuständigkeit.`,
        action_url: `/admin/aufgaben/${t.id}`,
        prompt: `Worum geht es bei ${formatTicketNo(t.ticket_number)} „${t.title}“ (task_id ${t.id}) und wer im Team sollte das übernehmen?`,
        priority: t.priority === 'hoch' ? 'hoch' : 'normal',
      });
    }
  }

  // 4) Kunden warten >24 h
  const waiting = await listUnansweredBookingInbound().catch(() => []);
  const inboundKinds = await lastInboundKinds(waiting.map((w) => w.booking_id)).catch(() => new Map<string, string>());
  let unassignedWaiting = 0;
  for (const w of waiting) {
    if ((inboundKinds.get(w.booking_id) || 'kunde') !== 'kunde') continue; // Bounce/Abwesenheit: keine „Kunde wartet“-Erinnerung
    const days = Math.floor((now - ts(w.last_in_at)) / DAY_MS);
    if (days < 1) continue;
    const who = w.assigned_to && byId.has(w.assigned_to) ? [byId.get(w.assigned_to)!] : (unassignedWaiting++ < 5 ? admins : []);
    for (const e of who) {
      out.push({
        key: `${w.assigned_to ? 'kunde_wartet' : 'kunde_wartet_team'}:${w.booking_id}:${e.id}`,
        employee_id: e.id,
        kind: 'kunde_wartet',
        ref_id: w.booking_id,
        title: `${w.customer_name || w.email} wartet seit ${days} Tag${days === 1 ? '' : 'en'}`,
        body: `${w.request_number || 'Anfrage'} · ${w.package_title}${w.assigned_to ? '' : ' · niemand zuständig'}`,
        action_url: '/admin/crm',
        prompt: `Lies den Verlauf von ${w.request_number || w.booking_id} und entwirf eine Antwort an den Kunden.`,
        priority: days >= 2 ? 'hoch' : 'normal',
      });
    }
  }

  // 5) Übergabe vor Abwesenheit + 6) Vertretung bei heutiger Abwesenheit
  const absences = await listUpcomingAbsences(today, addDaysIso(today, 4));
  const bookingsByAssignee = new Map<string, number>();
  for (const w of waiting) if (w.assigned_to) bookingsByAssignee.set(w.assigned_to, (bookingsByAssignee.get(w.assigned_to) || 0) + 1);
  for (const a of absences) {
    if (a.status !== 'genehmigt' || !['urlaub', 'kompensation', 'sonstiges'].includes(a.type)) continue;
    const mine = tasks.filter((t) => t.assignee_id === a.employee_id);
    if (a.start_date > today && a.start_date <= addDaysIso(today, 3) && (mine.length || bookingsByAssignee.get(a.employee_id))) {
      out.push({
        key: `uebergabe:${a.id}`,
        employee_id: a.employee_id,
        kind: 'uebergabe',
        ref_id: a.id,
        title: `Du bist ab ${fmtRangeDe(a.start_date, a.start_date)} weg – Übergabe vorbereiten?`,
        body: `${mine.length} offene Aufgabe${mine.length === 1 ? '' : 'n'}${a.substitute_name ? ` · Vertretung: ${a.substitute_name}` : ' · keine Vertretung eingetragen'}. Denk an die Abwesenheitsnotiz in Outlook.`,
        action_url: '/admin/urlaub',
        prompt: `Ich bin ${fmtRangeDe(a.start_date, a.end_date)} abwesend${a.substitute_name ? `, ${a.substitute_name} vertritt mich` : ''}. Stell mir eine Übergabe zusammen: meine offenen Aufgaben und Anfragen mit Stand und nächstem Schritt. Was sollte ich vorher noch erledigen?`,
        priority: 'normal',
      });
    }
    if (a.start_date <= today && a.end_date >= today) {
      const soon = mine.filter((t) => {
        const due = (t.due_date || '').slice(0, 10);
        return (due && due <= addDaysIso(today, 2)) || t.priority === 'hoch';
      }).slice(0, 5);
      const subId = (a as VacationRequest & { substitute_id?: string | null }).substitute_id;
      const subAbsent = absences.some((b) => b.employee_id === subId && b.status === 'genehmigt' && b.start_date <= today && b.end_date >= today);
      const covers = subId && byId.has(subId) && !subAbsent ? [byId.get(subId)!] : admins.filter((x) => x.id !== a.employee_id);
      for (const t of soon) {
        for (const c of covers) {
          out.push({
            key: `vertretung:${t.id}:${c.id}`,
            employee_id: c.id,
            kind: 'vertretung',
            ref_id: t.id,
            title: `${firstName(a.employee_name)} ist abwesend – ${formatTicketNo(t.ticket_number)} braucht jemanden`,
            body: `„${t.title}“${t.due_date ? ` · fällig ${fmtRangeDe(t.due_date.slice(0, 10), t.due_date.slice(0, 10))}` : ''}${t.priority === 'hoch' ? ' · Priorität hoch' : ''}`,
            action_url: `/admin/aufgaben/${t.id}`,
            prompt: `${a.employee_name} ist abwesend. Fass mir ${formatTicketNo(t.ticket_number)} „${t.title}“ (task_id ${t.id}) zusammen: Stand, nächster Schritt, was ich als Vertretung tun sollte.`,
            priority: 'hoch',
          });
        }
      }
    }
  }
  return out;
}

/* ── Abgleich + Benachrichtigung ───────────────────────────────────────────── */

export interface ReconcileResult {
  created: number;
  updated: number;
  resolved: number;
  reopened: number;
  notified: number;
  /** Offene Urlaubs-Erinnerungen je Person (für die tägliche Erinnerungsmail). */
  vacationDue: Map<string, Nudge[]>;
}

export async function reconcileNudges(desired: DesiredNudge[]): Promise<ReconcileResult> {
  await ensureWorkspaceSchema();
  const res: ReconcileResult = { created: 0, updated: 0, resolved: 0, reopened: 0, notified: 0, vacationDue: new Map() };
  const now = nowIso();
  const working = isWorkingHours();
  const existing = await dbAll<Nudge>(`SELECT * FROM ws_nudges WHERE status IN ('offen', 'zurueckgestellt', 'erledigt', 'verworfen')`);
  const byKey = new Map(existing.map((n) => [n.dedupe_key, n]));
  const desiredKeys = new Set(desired.map((d) => d.key));

  for (const d of desired) {
    const cur = byKey.get(d.key);
    if (!cur) {
      await dbRun(
        `INSERT OR IGNORE INTO ws_nudges (id, dedupe_key, employee_id, kind, ref_id, title, body, action_url, prompt, priority, status,
           notify_count, last_notified_at, last_seen_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offen', ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), d.key, d.employee_id, d.kind, d.ref_id, d.title, d.body, d.action_url, d.prompt, d.priority,
          d.notified_at ? 1 : 0, d.notified_at || null, now, now, now],
      );
      res.created++;
      continue;
    }
    let status = cur.status;
    if (status === 'erledigt') { status = 'offen'; res.reopened++; } // Bedingung ist zurück (automatisch erledigte)
    if (status === 'zurueckgestellt' && cur.snooze_until && ts(cur.snooze_until) <= Date.now()) status = 'offen';
    await dbRun(
      `UPDATE ws_nudges SET title = ?, body = ?, prompt = ?, priority = ?, status = ?, last_seen_at = ?, updated_at = ?, resolved_at = CASE WHEN ? = 'offen' THEN NULL ELSE resolved_at END WHERE id = ?`,
      [d.title, d.body, d.prompt, d.priority, status, now, now, status, cur.id],
    );
    res.updated++;
  }

  // Bedingung weggefallen → automatisch erledigt (von Hand verworfene bleiben verworfen)
  for (const n of existing) {
    if (!desiredKeys.has(n.dedupe_key) && (n.status === 'offen' || n.status === 'zurueckgestellt')) {
      await dbRun(`UPDATE ws_nudges SET status = 'erledigt', resolved_at = ?, updated_at = ? WHERE id = ?`, [now, now, n.id]);
      res.resolved++;
    }
  }

  // Glocke: neue sofort (in Arbeitszeit), wiederkehrende täglich
  if (working) {
    const open = await dbAll<Nudge>(`SELECT * FROM ws_nudges WHERE status = 'offen'`);
    for (const n of open) {
      if (SILENT_KEY_PREFIXES.some((p) => n.dedupe_key.startsWith(p))) continue;
      const first = !n.last_notified_at;
      const again = !first && REMIND_DAILY.includes(n.kind) && n.notify_count < MAX_REMINDERS
        && Date.now() - ts(n.last_notified_at) > 20 * 3600 * 1000;
      if (!first && !again) continue;
      await addNotification({
        employee_id: n.employee_id,
        type: 'info',
        task_id: ['aufgabe_ueberfaellig', 'aufgabe_offen', 'vertretung'].includes(n.kind) ? n.ref_id : null,
        title: `${again ? 'Erinnerung: ' : ''}${n.title}`,
        body: `${n.body}\n\nIm KI-Arbeitsplatz: /working-dashboard`,
        created_by: 'Faltin-KI',
      }).catch(() => {});
      await dbRun(`UPDATE ws_nudges SET notify_count = notify_count + 1, last_notified_at = ? WHERE id = ?`, [now, n.id]);
      res.notified++;
      if (n.kind === 'urlaub_genehmigen') {
        const list = res.vacationDue.get(n.employee_id) || [];
        list.push(n);
        res.vacationDue.set(n.employee_id, list);
      }
    }
  }
  return res;
}

/* ── Für die Oberfläche ────────────────────────────────────────────────────── */

export async function listMyNudges(employeeId: string): Promise<Nudge[]> {
  await ensureWorkspaceSchema();
  const rows = await dbAll<Nudge>(
    `SELECT * FROM ws_nudges WHERE employee_id = ? AND status IN ('offen', 'zurueckgestellt') ORDER BY created_at DESC`,
    [employeeId],
  );
  const nowMs = Date.now();
  return rows
    .filter((n) => n.status === 'offen' || (n.snooze_until && ts(n.snooze_until) <= nowMs))
    .sort((a, b) => Number(b.priority === 'hoch') - Number(a.priority === 'hoch') || ts(b.created_at) - ts(a.created_at));
}

export async function getNudge(id: string): Promise<Nudge | null> {
  await ensureWorkspaceSchema();
  return (await dbGet<Nudge>(`SELECT * FROM ws_nudges WHERE id = ?`, [id])) ?? null;
}

/** „Später“ (bis morgen 8 Uhr) oder „Erledigt/Verwerfen“ durch die Person. */
export async function actOnNudge(id: string, action: 'snooze' | 'dismiss'): Promise<void> {
  const now = nowIso();
  if (action === 'snooze') {
    const tomorrow = addDaysIso(zurichParts().date, 1);
    await dbRun(`UPDATE ws_nudges SET status = 'zurueckgestellt', snooze_until = ?, updated_at = ? WHERE id = ?`, [`${tomorrow}T06:00:00.000Z`, now, id]);
  } else {
    await dbRun(`UPDATE ws_nudges SET status = 'verworfen', resolved_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
  }
}

/** Nach einer Aktion direkt im Arbeitsplatz (z.B. Urlaub genehmigt) sofort schliessen. */
export async function resolveNudgesForRef(refId: string): Promise<void> {
  await ensureWorkspaceSchema();
  const now = nowIso();
  await dbRun(`UPDATE ws_nudges SET status = 'erledigt', resolved_at = ?, updated_at = ? WHERE ref_id = ? AND status IN ('offen', 'zurueckgestellt')`, [now, now, refId]);
}
