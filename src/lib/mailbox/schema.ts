/**
 * mailbox/schema.ts — Tabellen des Mail-Clients (mail.faltintravel.com).
 * Selbst-enthalten wie workspace/schema.ts: läuft in SQLite und Postgres,
 * wird einmal pro Prozess angelegt.
 *
 *   mail_templates  Vorlagen (kind='vorlage') und Textbausteine (kind='baustein')
 *   mail_prefs      persönliche Einstellungen je Person (Signaturen, KI-Standardaktion …)
 *   mail_links      Verknüpfung Mail ↔ Geschäftsobjekt (Anfrage, Ticket, Kunde)
 */
import { sqlite } from '../dbq';
import { pgEnabled, getPool } from '../pg';

const NOW_PG = `to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS mail_templates (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL DEFAULT 'vorlage',
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL DEFAULT 'de',
    subject TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    shortcut TEXT NOT NULL DEFAULT '',
    greeting TEXT NOT NULL DEFAULT '',
    owner TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0,
    uses INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT {NOW},
    updated_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE TABLE IF NOT EXISTS mail_prefs (
    owner TEXT PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE TABLE IF NOT EXISTS mail_links (
    id TEXT PRIMARY KEY,
    mailbox TEXT NOT NULL,
    message_id TEXT NOT NULL,
    internet_message_id TEXT NOT NULL DEFAULT '',
    conversation_id TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_label TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mail_links_conv ON mail_links (conversation_id)`,
  `CREATE INDEX IF NOT EXISTS idx_mail_links_target ON mail_links (target_type, target_id)`,
  // Spiegel (mirror.ts): nur Kopfdaten, je Postfach einmal (nicht je Person). Inhalte kommen live.
  `CREATE TABLE IF NOT EXISTS mail_sync_folders (
    mailbox TEXT NOT NULL,
    ref TEXT NOT NULL,
    real_id TEXT NOT NULL DEFAULT '',
    link TEXT NOT NULL DEFAULT '',
    since TEXT NOT NULL DEFAULT '',
    ready INTEGER NOT NULL DEFAULT 0,
    older INTEGER NOT NULL DEFAULT 0,
    last_sync TEXT NOT NULL DEFAULT '',
    last_used TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (mailbox, ref)
  )`,
  `CREATE TABLE IF NOT EXISTS mail_sync_msgs (
    mailbox TEXT NOT NULL,
    id TEXT NOT NULL,
    ref TEXT NOT NULL,
    folder_id TEXT NOT NULL DEFAULT '',
    conversation_id TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    from_addr TEXT NOT NULL DEFAULT '',
    to_json TEXT NOT NULL DEFAULT '[]',
    received_at TEXT NOT NULL DEFAULT '',
    preview TEXT NOT NULL DEFAULT '',
    is_read INTEGER NOT NULL DEFAULT 0,
    flagged INTEGER NOT NULL DEFAULT 0,
    has_attachments INTEGER NOT NULL DEFAULT 0,
    importance TEXT NOT NULL DEFAULT 'normal',
    is_draft INTEGER NOT NULL DEFAULT 0,
    categories TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (mailbox, id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_mail_sync_list ON mail_sync_msgs (mailbox, ref, received_at)`,
  `CREATE INDEX IF NOT EXISTS idx_mail_sync_conv ON mail_sync_msgs (mailbox, conversation_id)`,
];

let ensured: Promise<void> | null = null;

async function apply(): Promise<void> {
  if (pgEnabled()) {
    const pool = getPool();
    for (const ddl of TABLES) await pool.query(ddl.replace(/\{NOW\}/g, NOW_PG));
    return;
  }
  for (const ddl of TABLES) {
    sqlite.exec(ddl.replace(/\{NOW\}/g, `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`));
  }
}

export function ensureMailSchema(): Promise<void> {
  if (!ensured) {
    ensured = apply().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}
