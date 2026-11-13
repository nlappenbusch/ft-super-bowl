/**
 * files/schema.ts — Tabellen von Faltin Files (Filesharing, files.faltintravel.com).
 * ─────────────────────────────────────────────────────────────────────────────
 * Selbst-enthaltend wie workspace/schema.ts: `ensureFilesSchema()` legt die Tabellen
 * idempotent an (SQLite UND Postgres), einmal pro Prozess.
 *
 *   fs_shares  Eine Freigabe = ein Link (Token) mit 1..n Dateien, Ablaufdatum, optional Passwort
 *   fs_items   Die Dateien einer Freigabe (Bytes liegen unter data/files/<share>/<item>)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { sqlite } from '../dbq';
import { pgEnabled, getPool } from '../pg';

const NOW_PG = `to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS fs_shares (
    id TEXT PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL DEFAULT '',
    created_by_name TEXT NOT NULL DEFAULT '',
    created_by_email TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    expires_at TEXT NOT NULL,
    deleted_at TEXT,
    deleted_by TEXT NOT NULL DEFAULT '',
    downloads INTEGER NOT NULL DEFAULT 0,
    last_download_at TEXT,
    created_at TEXT NOT NULL DEFAULT {NOW},
    updated_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fs_shares_exp ON fs_shares(deleted_at, expires_at)`,
  `CREATE TABLE IF NOT EXISTS fs_items (
    id TEXT PRIMARY KEY,
    share_id TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    mime TEXT NOT NULL DEFAULT '',
    size BIGINT NOT NULL DEFAULT 0,
    received BIGINT NOT NULL DEFAULT 0,
    complete INTEGER NOT NULL DEFAULT 0,
    downloads INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE INDEX IF NOT EXISTS idx_fs_items_share ON fs_items(share_id)`,
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

export function ensureFilesSchema(): Promise<void> {
  if (!ensured) {
    ensured = apply().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}
