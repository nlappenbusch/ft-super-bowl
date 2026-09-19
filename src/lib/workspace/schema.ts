/**
 * workspace/schema.ts — Tabellen des KI-Arbeitsplatzes (/working-dashboard).
 * ─────────────────────────────────────────────────────────────────────────────
 * Bewusst selbst-enthaltend (statt in database.ts/dbq.ts): `ensureWorkspaceSchema()`
 * legt die Tabellen idempotent an — im SQLite- wie im Postgres-Modus — und wird
 * von allen Workspace-Stores vor dem ersten Zugriff aufgerufen (einmal pro Prozess).
 *
 *   ws_conversations  Chat-Verläufe je Mitarbeiter:in
 *   ws_messages       Nachrichten (Anthropic-Content-Blöcke als JSON, append-only)
 *   ws_files          Dateien im Chat / aus SharePoint (Anthropic-Files-API-ID + Bytes)
 *   ws_knowledge      Gemeinsames Teamwissen (von Menschen oder der KI festgehalten)
 *   ws_mail_triage    KI-Einordnung der Mails im Postfach (Kategorie, Priorität, Vorschlag)
 *   ws_nudges         Erinnerungen des Hintergrund-Agenten je Person (Urlaub, Aufgaben, Kunden)
 *   ws_agent_runs     Protokoll der Agent-Läufe (was die KI selbständig erledigt hat)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { sqlite } from '../dbq';
import { pgEnabled, getPool } from '../pg';

const NOW_PG = `to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** DDL in neutraler Form; `{NOW}` = Default-Zeitstempel, `{REAL}` = Gleitkomma. */
const TABLES = [
  `CREATE TABLE IF NOT EXISTS ws_conversations (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    system_prompt TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT {NOW},
    updated_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ws_conv_emp ON ws_conversations(employee_id, updated_at)`,
  `CREATE TABLE IF NOT EXISTS ws_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_ws_msg_conv_seq ON ws_messages(conversation_id, seq)`,
  `CREATE TABLE IF NOT EXISTS ws_files (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL DEFAULT '',
    conversation_id TEXT,
    filename TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT '',
    size INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'upload',
    source_ref TEXT NOT NULL DEFAULT '',
    block_type TEXT NOT NULL DEFAULT 'document',
    anthropic_file_id TEXT NOT NULL DEFAULT '',
    data_b64 TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ws_files_conv ON ws_files(conversation_id)`,
  `CREATE TABLE IF NOT EXISTS ws_knowledge (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    uses INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT '',
    created_by_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT {NOW},
    updated_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE TABLE IF NOT EXISTS ws_mail_triage (
    graph_id TEXT PRIMARY KEY,
    received_at TEXT NOT NULL DEFAULT '',
    from_address TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    preview TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'normal',
    summary TEXT NOT NULL DEFAULT '',
    next_step TEXT NOT NULL DEFAULT '',
    needs_reply INTEGER NOT NULL DEFAULT 0,
    request_number TEXT NOT NULL DEFAULT '',
    booking_id TEXT,
    status TEXT NOT NULL DEFAULT 'offen',
    handled_by TEXT NOT NULL DEFAULT '',
    handled_at TEXT,
    suggestion TEXT NOT NULL DEFAULT '',
    suggestion_at TEXT,
    draft_created_at TEXT,
    triaged_at TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ws_mail_received ON ws_mail_triage(received_at)`,
  `CREATE TABLE IF NOT EXISTS ws_nudges (
    id TEXT PRIMARY KEY,
    dedupe_key TEXT NOT NULL UNIQUE,
    employee_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    ref_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    action_url TEXT NOT NULL DEFAULT '',
    prompt TEXT NOT NULL DEFAULT '',
    priority TEXT NOT NULL DEFAULT 'normal',
    status TEXT NOT NULL DEFAULT 'offen',
    snooze_until TEXT,
    notify_count INTEGER NOT NULL DEFAULT 0,
    last_notified_at TEXT,
    last_seen_at TEXT,
    resolved_at TEXT,
    created_at TEXT NOT NULL DEFAULT {NOW},
    updated_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE INDEX IF NOT EXISTS idx_ws_nudges_emp ON ws_nudges(employee_id, status)`,
  `CREATE TABLE IF NOT EXISTS ws_agent_runs (
    id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    summary TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS ws_draft_actions (
    draft_id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    action TEXT NOT NULL,
    web_link TEXT NOT NULL DEFAULT '',
    by_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT {NOW}
  )`,
];

/** Nachträgliche Spalten (für Tabellen, die schon vor der Spalte angelegt wurden). */
const COLUMN_MIGRATIONS: Array<[string, string, string]> = [
  ['ws_mail_triage', 'attempts', 'INTEGER NOT NULL DEFAULT 0'],
];

let ensured: Promise<void> | null = null;

async function apply(): Promise<void> {
  if (pgEnabled()) {
    const pool = getPool();
    for (const ddl of TABLES) {
      await pool.query(ddl.replace(/\{NOW\}/g, NOW_PG));
    }
    for (const [table, col, def] of COLUMN_MIGRATIONS) {
      await pool.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${def}`);
    }
    return;
  }
  for (const ddl of TABLES) {
    sqlite.exec(ddl.replace(/\{NOW\}/g, `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`));
  }
  for (const [table, col, def] of COLUMN_MIGRATIONS) {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === col)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

/** Legt die Workspace-Tabellen einmal pro Prozess an (idempotent). */
export function ensureWorkspaceSchema(): Promise<void> {
  if (!ensured) {
    ensured = apply().catch((e) => {
      ensured = null; // nächster Aufruf versucht es erneut
      throw e;
    });
  }
  return ensured;
}

/** ISO-Zeitstempel (UTC) — für explizite Schreibzugriffe, identisch in beiden Backends. */
export function nowIso(): string {
  return new Date().toISOString();
}
