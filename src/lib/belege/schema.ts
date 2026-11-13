/**
 * belege/schema.ts — Tabellen von Faltin Belege (belege.faltintravel.com).
 * ─────────────────────────────────────────────────────────────────────────────
 * Selbst-enthaltend wie files/schema.ts: `ensureBelegeSchema()` legt die Tabellen
 * idempotent an (SQLite UND Postgres), einmal pro Prozess.
 *
 *   bel_receipts  Ein Beleg (Foto/PDF) mit Erfassung, Kontierung, Zuordnung und Prüfung
 *   bel_log       Verlauf je Beleg (wer hat wann was getan) – für die Revision
 * Die Datei selbst liegt unter data/belege/<jahr>/<id>.<ext> (persistentes Volume).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { sqlite } from '../dbq';
import { pgEnabled, getPool } from '../pg';

const NOW_PG = `to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

const TABLES = [
  `CREATE TABLE IF NOT EXISTS bel_receipts (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'eingang',
    source TEXT NOT NULL DEFAULT 'handy',
    created_by TEXT NOT NULL DEFAULT '',
    created_by_name TEXT NOT NULL DEFAULT '',
    created_by_email TEXT NOT NULL DEFAULT '',
    file_name TEXT NOT NULL DEFAULT '',
    file_mime TEXT NOT NULL DEFAULT '',
    file_size BIGINT NOT NULL DEFAULT 0,
    file_hash TEXT NOT NULL DEFAULT '',
    file_path TEXT NOT NULL DEFAULT '',
    has_thumb INTEGER NOT NULL DEFAULT 0,
    receipt_date TEXT NOT NULL DEFAULT '',
    supplier TEXT NOT NULL DEFAULT '',
    supplier_vat_id TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    invoice_no TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    currency TEXT NOT NULL DEFAULT '',
    amount_gross DOUBLE PRECISION NOT NULL DEFAULT 0,
    vat_lines TEXT NOT NULL DEFAULT '[]',
    amount_chf DOUBLE PRECISION NOT NULL DEFAULT 0,
    fx_rate DOUBLE PRECISION NOT NULL DEFAULT 1,
    payment TEXT NOT NULL DEFAULT '',
    account TEXT NOT NULL DEFAULT '',
    contra_account TEXT NOT NULL DEFAULT '',
    vat_account TEXT NOT NULL DEFAULT '',
    event_slug TEXT NOT NULL DEFAULT '',
    booking_id TEXT NOT NULL DEFAULT '',
    booking_ref TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    ocr_text TEXT NOT NULL DEFAULT '',
    analysis_status TEXT NOT NULL DEFAULT 'offen',
    analysis_method TEXT NOT NULL DEFAULT '',
    analysis_error TEXT NOT NULL DEFAULT '',
    extraction TEXT NOT NULL DEFAULT '',
    user_fields TEXT NOT NULL DEFAULT '[]',
    duplicate_of TEXT NOT NULL DEFAULT '',
    reviewed_by TEXT NOT NULL DEFAULT '',
    reviewed_by_name TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT NOT NULL DEFAULT '',
    review_note TEXT NOT NULL DEFAULT '',
    expense_id TEXT NOT NULL DEFAULT '',
    exported_at TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT {NOW},
    updated_at TEXT NOT NULL DEFAULT {NOW}
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bel_receipts_status ON bel_receipts(status, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_bel_receipts_creator ON bel_receipts(created_by, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_bel_receipts_hash ON bel_receipts(file_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_bel_receipts_supplier ON bel_receipts(supplier)`,
  `CREATE TABLE IF NOT EXISTS bel_log (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL,
    at TEXT NOT NULL DEFAULT {NOW},
    actor TEXT NOT NULL DEFAULT '',
    actor_name TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bel_log_receipt ON bel_log(receipt_id, at)`,
];

let ensured: Promise<void> | null = null;

async function apply(): Promise<void> {
  if (pgEnabled()) {
    const pool = getPool();
    for (const ddl of TABLES) await pool.query(ddl.replace(/\{NOW\}/g, NOW_PG));
    return;
  }
  for (const ddl of TABLES) {
    sqlite.exec(
      ddl
        .replace(/\{NOW\}/g, `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
        .replace(/DOUBLE PRECISION/g, 'REAL'),
    );
  }
}

export function ensureBelegeSchema(): Promise<void> {
  if (!ensured) {
    ensured = apply().catch((e) => {
      ensured = null;
      throw e;
    });
  }
  return ensured;
}
