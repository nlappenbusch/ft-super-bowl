/**
 * releaseNotes.ts (TASK-00096)
 * ─────────────────────────────────────────────────────────────────────────────
 * Release-Notes-Mail nach jedem Deploy: Beim Produktions-Start (= nach jedem
 * Deploy, da der Container neu startet) werden die seit dem letzten Lauf nach
 * main gemergten Pull Requests über die GitHub-API geholt und als
 * Entwickler-Changelog an alle aktiven Mitarbeitenden gemailt — mit Typ-Badge
 * (Feature/Bugfix/…), PR-Link, referenzierten TASK-Nummern und Kurzfassung.
 *
 * Gesteuert über settings.mail.release_notes_enabled; GitHub-Zugang kommt aus
 * den bestehenden GitHub-Settings (settings.github.token, Auto-Fix-Bot).
 * Watermark (merged_at) liegt in data/release-notes-state.json.
 * Manueller Test: POST /api/admin/release-notes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs';
import path from 'path';
import { getSettings } from './settingsStore';
import { getGithubConfig } from './autoFix';
import { listEmployees } from './staffStore';
import { releaseNotesEmailHtml, type ReleaseNoteItem } from './emailTemplates';

const STATE_PATH = path.join(process.cwd(), 'data', 'release-notes-state.json');
/** Erster Lauf ohne State: nur PRs der letzten 2 h ankündigen (kein Historien-Spam). */
const FIRST_RUN_WINDOW_MS = 2 * 3600 * 1000;
const MAX_ITEMS = 10;

export interface ReleaseNotesResult {
  /** false = Feature aus, Graph oder GitHub-Token fehlt. */
  configured: boolean;
  sent: number;
  errors: number;
  /** Angekündigte PR-Nummern. */
  prs: number[];
  reason?: string;
}

interface ReleaseState {
  /** ISO-Zeitpunkt des neuesten bereits angekündigten Merges. */
  last_merged_at?: string;
  last_run_at?: string;
  last_result?: Omit<ReleaseNotesResult, 'reason'>;
}

interface GithubPull {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  merged_at: string | null;
  user?: { login?: string } | null;
}

function readState(): ReleaseState {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')) as ReleaseState;
  } catch {
    return {};
  }
}

function writeState(state: ReleaseState): void {
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[release-notes] State konnte nicht geschrieben werden:', (e as Error).message);
  }
}

/** Typ aus Conventional-Commit-Präfix der PR-Titel ("feat(x): …" → feat). */
export function classifyPrType(title: string): ReleaseNoteItem['type'] {
  const m = /^\s*(feat|fix|chore|refactor|docs|perf|security|ci|build|test)\b/i.exec(title);
  const t = (m?.[1] || '').toLowerCase();
  if (t === 'feat') return 'feature';
  if (t === 'fix') return 'bugfix';
  if (t === 'perf') return 'performance';
  if (t === 'security') return 'security';
  if (t === 'refactor') return 'refactor';
  if (t) return 'chore';
  return 'other';
}

/** PR-Titel ohne Conventional-Commit-Präfix und ohne Ticket-Klammer am Ende. */
export function cleanPrTitle(title: string): string {
  return title
    .replace(/^\s*(feat|fix|chore|refactor|docs|perf|security|ci|build|test)(\([^)]*\))?\s*[:!]\s*/i, '')
    .replace(/\s*\(TASK-\d{3,}\)\s*$/i, '')
    .trim();
}

/** Alle referenzierten TASK-Nummern (Titel + Body), dedupliziert. */
export function extractTaskNos(...texts: Array<string | null | undefined>): string[] {
  const found = new Set<string>();
  for (const t of texts) {
    for (const m of (t || '').matchAll(/TASK-\d{3,}/gi)) found.add(m[0].toUpperCase());
  }
  return [...found];
}

/**
 * Kurzfassung aus dem PR-Body: erster Aufzählungspunkt bzw. erster Absatz,
 * Markdown grob entschärft (Links → Text, Code-Backticks/Fettung entfernt).
 */
export function summarizeBody(body: string | null | undefined): string {
  const text = (body || '')
    .replace(/\r/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_]/g, '');
  const lines = text.split('\n').map((l) => l.trim());
  const firstBullet = lines.find((l) => /^[-•]\s+\S/.test(l));
  const firstPara = lines.find((l) => l && !l.startsWith('#') && !/^🤖/.test(l));
  const raw = (firstBullet || firstPara || '').replace(/^[-•]\s+/, '');
  return raw.length > 220 ? raw.slice(0, 217).trimEnd() + '…' : raw;
}

async function fetchMergedPulls(sinceIso: string): Promise<GithubPull[] | null> {
  const cfg = getGithubConfig();
  if (!cfg.configured) return null;
  const res = await fetch(
    `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/pulls?state=closed&base=${encodeURIComponent(cfg.base)}&sort=updated&direction=desc&per_page=30`,
    {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ft-release-notes',
      },
    }
  );
  if (!res.ok) {
    console.warn('[release-notes] GitHub-API-Fehler:', res.status);
    return null;
  }
  const pulls = (await res.json()) as GithubPull[];
  return pulls
    .filter((p) => p.merged_at && p.merged_at > sinceIso)
    .sort((a, b) => (a.merged_at! < b.merged_at! ? -1 : 1));
}

let running = false;

/**
 * Kündigt neu gemergte PRs per Mail an. Läuft einmal pro Container-Start
 * (instrumentation.ts) — ohne neue Merges wird keine Mail verschickt.
 */
export async function runReleaseNotes(opts: { force?: boolean } = {}): Promise<ReleaseNotesResult> {
  const done = (over: Partial<ReleaseNotesResult>): ReleaseNotesResult =>
    ({ configured: true, sent: 0, errors: 0, prs: [], ...over });

  if (running) return done({ reason: 'Läuft bereits.' });
  const m = getSettings().mail;
  if (m.release_notes_enabled === false && !opts.force) return done({ configured: false, reason: 'Feature deaktiviert.' });

  const { isGraphConfigured, sendGraphMail } = await import('./graphMailer');
  if (!isGraphConfigured()) return done({ configured: false, reason: 'Microsoft Graph nicht konfiguriert.' });
  if (!getGithubConfig().configured) return done({ configured: false, reason: 'Kein GitHub-Token konfiguriert (Admin → Status/Auto-Fix).' });

  running = true;
  try {
    const state = readState();
    const since = state.last_merged_at || new Date(Date.now() - FIRST_RUN_WINDOW_MS).toISOString();
    const pulls = await fetchMergedPulls(since);
    if (pulls === null) return done({ configured: false, reason: 'GitHub-API nicht erreichbar.' });
    if (!pulls.length) {
      writeState({ ...state, last_run_at: new Date().toISOString() });
      return done({ reason: 'Keine neuen Merges.' });
    }

    const shown = pulls.slice(-MAX_ITEMS);
    const items: ReleaseNoteItem[] = shown.map((p) => ({
      type: classifyPrType(p.title),
      title: cleanPrTitle(p.title),
      prNumber: p.number,
      prUrl: p.html_url,
      taskNos: extractTaskNos(p.title, p.body),
      summary: summarizeBody(p.body),
      author: p.user?.login || undefined,
    }));

    const cfg = getGithubConfig();
    const base = (m.login_base_url || 'https://next.faltintravel.com').replace(/\/+$/, '');
    const dateLabel = new Intl.DateTimeFormat('de-CH', {
      timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date());
    const html = releaseNotesEmailHtml({
      dateLabel,
      siteHost: base.replace(/^https?:\/\//, ''),
      items,
      omittedCount: pulls.length - shown.length,
      repoUrl: `https://github.com/${cfg.owner}/${cfg.repo}`,
    });

    const features = items.filter((i) => i.type === 'feature').length;
    const fixes = items.filter((i) => i.type === 'bugfix').length;
    const parts = [
      features ? `${features} neue Funktion${features === 1 ? '' : 'en'}` : '',
      fixes ? `${fixes} Bugfix${fixes === 1 ? '' : 'es'}` : '',
      items.length - features - fixes ? `${items.length - features - fixes} weitere Änderung${items.length - features - fixes === 1 ? '' : 'en'}` : '',
    ].filter(Boolean).join(' · ');
    const subject = `🚀 Release ${dateLabel} — ${parts || `${items.length} Änderungen`}`;

    // Watermark VOR dem Versand setzen: ein Fehler mitten im Loop darf beim
    // nächsten Start keine Doppel-Mails an bereits Beliefert erzeugen.
    const newest = pulls[pulls.length - 1].merged_at!;
    writeState({ last_merged_at: newest, last_run_at: new Date().toISOString() });

    const result = done({ prs: shown.map((p) => p.number) });
    const recipients = (await listEmployees(false)).filter((e) => (e.email || '').trim());
    for (const emp of recipients) {
      const send = await sendGraphMail({ to: emp.email, toName: emp.name, subject, html })
        .catch((e) => ({ success: false, error: (e as Error).message }));
      if (send.success) result.sent++;
      else {
        result.errors++;
        console.warn('[release-notes] Versand fehlgeschlagen an', emp.email, (send as { error?: string }).error);
      }
    }

    writeState({
      last_merged_at: newest,
      last_run_at: new Date().toISOString(),
      last_result: { configured: true, sent: result.sent, errors: result.errors, prs: result.prs },
    });
    return result;
  } finally {
    running = false;
  }
}

/** Status für die Admin-UI. */
export function releaseNotesStatus(): {
  enabled: boolean;
  githubConfigured: boolean;
  last_merged_at: string | null;
  last_run_at: string | null;
  last_result: ReleaseState['last_result'] | null;
} {
  const m = getSettings().mail;
  const state = readState();
  return {
    enabled: m.release_notes_enabled !== false,
    githubConfigured: getGithubConfig().configured,
    last_merged_at: state.last_merged_at || null,
    last_run_at: state.last_run_at || null,
    last_result: state.last_result || null,
  };
}
