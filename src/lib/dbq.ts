/**
 * dbq.ts — Datenbank-Abstraktion mit umschaltbarem Backend (DB_BACKEND=sqlite|postgres).
 * ─────────────────────────────────────────────────────────────────────────────
 * Ein Helper-Satz (dbGet/dbAll/dbRun/withTx), der intern entweder die synchrone
 * better-sqlite3-Verbindung ODER den asynchronen pg-Pool nutzt. Alle Store-Module
 * laufen über diese Helfer → ein Flip von DB_BACKEND schaltet das ganze System um.
 *
 * SQL-Konvention: weiterhin SQLite-Dialekt mit `?`-Platzhaltern schreiben.
 * Für Postgres wird zur Laufzeit übersetzt:
 *   - `?`                  → `$1, $2, …`
 *   - `datetime('now')`    → ISO-UTC-Text via to_char(now() …)
 *   - `INSERT OR IGNORE`   → `INSERT … ON CONFLICT DO NOTHING`
 * `instr()`/`COLLATE NOCASE` werden NICHT übersetzt — entsprechende Queries sind
 * in den Stores bereits backend-neutral formuliert (JS-Fallback bzw. lower()).
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { pgEnabled, getPool } from './pg';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'bookings.db');

/** Gemeinsame SQLite-Verbindung (auch im Postgres-Modus instanziiert, aber dann ungenutzt). */
export const sqlite = new Database(dbPath);
sqlite.pragma('busy_timeout = 15000');
const IS_BUILD = process.env.NEXT_PHASE === 'phase-production-build';
if (!IS_BUILD) {
  try { sqlite.pragma('journal_mode = WAL'); } catch { /* im pg-Modus egal */ }
}

/** Rückwärtskompatibler Alias — einige Module importieren `{ db }`. */
export const db = sqlite;

// ───────────────────────── SQL-Übersetzung sqlite → pg ─────────────────────────

const NOW_ISO_PG = `to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

/** Wandelt eine SELECT/UPDATE/DELETE-Query in pg-Syntax (Platzhalter + datetime). */
function toPgSql(sql: string): string {
  let i = 0;
  return sql
    .replace(/datetime\(\s*'now'\s*\)/gi, NOW_ISO_PG)
    .replace(/\?/g, () => `$${++i}`);
}

/** Wie toPgSql, aber übersetzt zusätzlich `INSERT OR IGNORE` → `… ON CONFLICT DO NOTHING`. */
function toPgRun(sql: string): string {
  let s = sql;
  let suffix = '';
  if (/insert\s+or\s+ignore/i.test(s)) {
    s = s.replace(/insert\s+or\s+ignore/i, 'INSERT');
    suffix = ' ON CONFLICT DO NOTHING';
  } else if (/insert\s+or\s+replace/i.test(s)) {
    // Aktuell nicht verwendet; defensiv ohne Konfliktziel.
    s = s.replace(/insert\s+or\s+replace/i, 'INSERT');
  }
  return toPgSql(s) + suffix;
}

// ───────────────────────── Query-Interface ─────────────────────────

export interface Q {
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
}

export async function dbGet<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  if (pgEnabled()) {
    const r = await getPool().query(toPgSql(sql), params);
    return r.rows[0] as T | undefined;
  }
  return sqlite.prepare(sql).get(...(params as never[])) as T | undefined;
}

export async function dbAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (pgEnabled()) {
    const r = await getPool().query(toPgSql(sql), params);
    return r.rows as T[];
  }
  return sqlite.prepare(sql).all(...(params as never[])) as T[];
}

export async function dbRun(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  if (pgEnabled()) {
    const r = await getPool().query(toPgRun(sql), params);
    return { changes: r.rowCount ?? 0 };
  }
  const info = sqlite.prepare(sql).run(...(params as never[]));
  return { changes: info.changes };
}

/** Standard-Query-Objekt (ohne Transaktion). */
export const dbq: Q = { get: dbGet, all: dbAll, run: dbRun };

/**
 * Transaktion. Im pg-Modus echte BEGIN/COMMIT-Transaktion auf dediziertem Client.
 * Im sqlite-Modus sequenziell (better-sqlite3 ist synchron/serialisiert; eine
 * async-Transaktion ist dort nicht möglich, die Operationen sind aber unkritisch).
 */
export async function withTx<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  if (pgEnabled()) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const q: Q = {
        get: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
          (await client.query(toPgSql(sql), params)).rows[0] as R | undefined,
        all: async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
          (await client.query(toPgSql(sql), params)).rows as R[],
        run: async (sql: string, params: unknown[] = []) => {
          const r = await client.query(toPgRun(sql), params);
          return { changes: r.rowCount ?? 0 };
        },
      };
      const res = await fn(q);
      await client.query('COMMIT');
      return res;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }
  return fn(dbq);
}

// ───────────────────────── Postgres-Schema-Ergänzung ─────────────────────────
// Die Tabellen+Daten kommen aus der Migration (pgMigrate). Hier ergänzen wir,
// was die generische Migration nicht abbildet: Defaults für Timestamp-Spalten,
// fehlende Unique-Constraints (für ON CONFLICT), Indizes und den updated_at-Trigger.
// Alles idempotent (try/catch bzw. IF NOT EXISTS).

const TS_DEFAULT_COLUMNS: Array<[string, string]> = [
  ['booking_requests', 'created_at'], ['booking_requests', 'updated_at'],
  ['invoices', 'created_at'],
  ['expenses', 'created_at'],
  ['booking_messages', 'created_at'],
  ['employees', 'created_at'], ['employees', 'last_login_at'],
  ['time_entries', 'created_at'],
  ['vacation_requests', 'created_at'],
  ['staff_tasks', 'created_at'], ['staff_tasks', 'updated_at'],
  ['tippspiel_users', 'created_at'], ['tippspiel_users', 'last_login_at'],
  ['tippspiel_tips', 'updated_at'],
  ['tippspiel_results', 'updated_at'],
  ['tippspiel_groups', 'created_at'],
  ['tippspiel_group_members', 'joined_at'],
  ['customers', 'created_at'], ['customers', 'updated_at'],
  ['customer_emails', 'created_at'],
];

const PG_INDEXES: string[] = [
  `CREATE INDEX IF NOT EXISTS idx_booking_requests_created_at ON booking_requests(created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_booking_requests_status ON booking_requests(status)`,
  `CREATE INDEX IF NOT EXISTS idx_booking_requests_email ON booking_requests(email)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_booking_id ON invoices(booking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_event_slug ON expenses(event_slug)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_booking_id ON expenses(booking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id ON booking_messages(booking_id)`,
  `CREATE INDEX IF NOT EXISTS idx_customer_emails_cid ON customer_emails(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON time_entries(employee_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_vacation_requests_employee ON vacation_requests(employee_id, start_date)`,
  `CREATE INDEX IF NOT EXISTS idx_staff_tasks_assignee ON staff_tasks(assignee_id, status)`,
  `CREATE INDEX IF NOT EXISTS idx_tippspiel_users_email ON tippspiel_users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_tippspiel_tips_user ON tippspiel_tips(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_tippspiel_group_members_user ON tippspiel_group_members(user_id)`,
];

// Unique-Constraints, die ON CONFLICT(<spalte>) in den Stores benötigt:
const PG_UNIQUE: Array<[string, string, string]> = [
  // [tabelle, constraint-name, spalten]
  ['tippspiel_users', 'uq_tippspiel_users_email', 'email'],
  ['invoices', 'uq_invoices_invoice_number', 'invoice_number'],
  ['tippspiel_groups', 'uq_tippspiel_groups_invite', 'invite_code'],
];

let pgSchemaEnsured = false;
let pgSchemaPromise: Promise<void> | null = null;

/**
 * Wendet die pg-Schema-Ergänzungen an (unabhängig von DB_BACKEND).
 * Wird sowohl vom Startup (ensurePgSchema) als auch vom Migrator aufgerufen,
 * damit die Tabellen schon VOR dem Umschalten korrekt aufgesetzt sind.
 */
export async function applyPgSchemaEnhancements(): Promise<void> {
  {
    const pool = getPool();
    // Getrennte Vor-/Nachname-Spalten am Kundenstamm (CRM)
    try { await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS first_name text DEFAULT ''`); } catch { /* ignore */ }
    try { await pool.query(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_name text DEFAULT ''`); } catch { /* ignore */ }
    // Reise-Meilensteine an der Buchung (für die Kundenportal-Timeline)
    try { await pool.query(`ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS offer_sent integer NOT NULL DEFAULT 0`); } catch { /* ignore */ }
    try { await pool.query(`ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS docs_ready integer NOT NULL DEFAULT 0`); } catch { /* ignore */ }
    try { await pool.query(`ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS booking_number text`); } catch { /* ignore */ }
    try { await pool.query(`ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS source text DEFAULT ''`); } catch { /* ignore */ }
    try { await pool.query(`ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS event_slug text DEFAULT ''`); } catch { /* ignore */ }
    try { await pool.query(`ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS package_slug text DEFAULT ''`); } catch { /* ignore */ }
    try { await pool.query(`ALTER TABLE booking_requests ADD COLUMN IF NOT EXISTS travel_period text DEFAULT ''`); } catch { /* ignore */ }
    // Tages-Briefing: Opt-out pro Mitarbeiter:in (TASK-00103)
    try { await pool.query(`ALTER TABLE employees ADD COLUMN IF NOT EXISTS briefing_opt_out integer NOT NULL DEFAULT 0`); } catch { /* ignore */ }
    // KI-Task-Assistent: Umsetzung durch KI angefragt (TASK-00098)
    try { await pool.query(`ALTER TABLE staff_tasks ADD COLUMN IF NOT EXISTS ai_requested integer NOT NULL DEFAULT 0`); } catch { /* ignore */ }
    try { await pool.query(`INSERT INTO counters (name, value) SELECT 'booking_number', 1000 WHERE NOT EXISTS (SELECT 1 FROM counters WHERE name = 'booking_number')`); } catch { /* ignore */ }

    // Kundenportal-Tabellen (in PG zusätzlich anlegen – Migration introspektiert nur Bestandstabellen).
    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS portal_login_tokens (
        token_hash text PRIMARY KEY,
        customer_id text NOT NULL,
        email text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        used integer NOT NULL DEFAULT 0
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_portal_tokens_cid ON portal_login_tokens(customer_id)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS booking_message_attachments (
        id text PRIMARY KEY,
        message_id text NOT NULL,
        filename text NOT NULL DEFAULT 'datei',
        mime text NOT NULL DEFAULT 'application/octet-stream',
        size integer NOT NULL DEFAULT 0,
        data_b64 text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_bma_message ON booking_message_attachments(message_id)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS customer_documents (
        id text PRIMARY KEY,
        customer_id text NOT NULL,
        booking_id text NOT NULL DEFAULT '',
        category text NOT NULL DEFAULT 'other',
        title text NOT NULL DEFAULT '',
        filename text NOT NULL DEFAULT 'datei',
        mime text NOT NULL DEFAULT 'application/octet-stream',
        size integer NOT NULL DEFAULT 0,
        data_b64 text NOT NULL DEFAULT '',
        visible integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by text NOT NULL DEFAULT ''
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cdoc_customer ON customer_documents(customer_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_cdoc_booking ON customer_documents(booking_id)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS incentive_plans (
        id text PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        title text NOT NULL DEFAULT 'Incentive',
        status text NOT NULL DEFAULT 'draft',
        brief text NOT NULL DEFAULT '',
        plan text NOT NULL DEFAULT ''
      )`);
      await pool.query(`ALTER TABLE incentive_plans ADD COLUMN IF NOT EXISTS error text NOT NULL DEFAULT ''`);
      await pool.query(`ALTER TABLE incentive_plans ADD COLUMN IF NOT EXISTS progress text NOT NULL DEFAULT ''`);
      await pool.query(`CREATE TABLE IF NOT EXISTS staff_task_subtasks (
        id text PRIMARY KEY,
        task_id text NOT NULL,
        title text NOT NULL,
        done integer NOT NULL DEFAULT 0,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_subtasks_task ON staff_task_subtasks(task_id)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS task_attachments (
        id text PRIMARY KEY,
        task_id text NOT NULL,
        filename text NOT NULL DEFAULT 'datei',
        mime text NOT NULL DEFAULT 'application/octet-stream',
        size integer NOT NULL DEFAULT 0,
        data_b64 text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by text NOT NULL DEFAULT ''
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_attach_task ON task_attachments(task_id)`);
      await pool.query(`CREATE TABLE IF NOT EXISTS task_time (
        id text PRIMARY KEY,
        task_id text NOT NULL,
        employee_id text,
        minutes integer NOT NULL DEFAULT 0,
        note text NOT NULL DEFAULT '',
        work_date text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query(`ALTER TABLE task_time ADD COLUMN IF NOT EXISTS work_date text NOT NULL DEFAULT ''`);
      await pool.query(`ALTER TABLE task_time ADD COLUMN IF NOT EXISTS report_id text`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_time_task ON task_time(task_id)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_time_report ON task_time(report_id)`);

      // Zeit-Rapporte (abrechenbare Ticket-Zeiten)
      await pool.query(`CREATE TABLE IF NOT EXISTS time_reports (
        id text PRIMARY KEY,
        report_number integer,
        title text NOT NULL DEFAULT '',
        period_from text NOT NULL DEFAULT '',
        period_to text NOT NULL DEFAULT '',
        hourly_rate double precision,
        currency text NOT NULL DEFAULT 'EUR',
        status text NOT NULL DEFAULT 'entwurf',
        note text NOT NULL DEFAULT '',
        created_by text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        finalized_at text
      )`);

      // Projekte (Zuordnung von Tickets/Zeiten für Rapporte und Übersichten)
      await pool.query(`CREATE TABLE IF NOT EXISTS projects (
        id text PRIMARY KEY,
        name text NOT NULL,
        description text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'aktiv',
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await pool.query(`ALTER TABLE staff_tasks ADD COLUMN IF NOT EXISTS project_id text`);

      // Ticket-System: fortlaufende Ticketnummer + Mail-Verlauf
      await pool.query(`ALTER TABLE staff_tasks ADD COLUMN IF NOT EXISTS ticket_number integer`);
      await pool.query(`CREATE TABLE IF NOT EXISTS task_messages (
        id text PRIMARY KEY,
        task_id text NOT NULL,
        direction text NOT NULL DEFAULT 'out',
        from_email text NOT NULL DEFAULT '',
        to_email text NOT NULL DEFAULT '',
        subject text NOT NULL DEFAULT '',
        body text NOT NULL DEFAULT '',
        graph_message_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by text NOT NULL DEFAULT ''
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_task_messages_task ON task_messages(task_id)`);
      // API-Keys (für externen Zugriff / MCP-Server)
      await pool.query(`CREATE TABLE IF NOT EXISTS api_keys (
        id text PRIMARY KEY,
        name text NOT NULL DEFAULT '',
        key_prefix text NOT NULL DEFAULT '',
        key_hash text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by text NOT NULL DEFAULT '',
        last_used_at timestamptz,
        revoked integer NOT NULL DEFAULT 0
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)`);
      // Benachrichtigungs-Center (Glocke im Admin)
      await pool.query(`CREATE TABLE IF NOT EXISTS admin_notifications (
        id text PRIMARY KEY,
        employee_id text NOT NULL,
        type text NOT NULL DEFAULT 'info',
        task_id text,
        title text NOT NULL DEFAULT '',
        body text NOT NULL DEFAULT '',
        is_read integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        created_by text NOT NULL DEFAULT ''
      )`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_admin_notifications_emp ON admin_notifications(employee_id, is_read)`);
      // Ticket-Status: Warte-Status ergänzen (alter CHECK – falls vorhanden – ersetzen)
      try {
        await pool.query(`ALTER TABLE staff_tasks DROP CONSTRAINT IF EXISTS staff_tasks_status_check`);
        await pool.query(`ALTER TABLE staff_tasks ADD CONSTRAINT staff_tasks_status_check
          CHECK (status IN ('offen','in_arbeit','warten_requester','warten_dritte','erledigt'))`);
      } catch (e) { console.warn('[pg] staff_tasks-Status-Constraint:', (e as Error).message); }
      // Backfill: bestehende Tasks ohne Nummer fortlaufend ab 10 nummerieren.
      await pool.query(`
        WITH ordered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id)
                 + COALESCE((SELECT MAX(ticket_number) FROM staff_tasks), 9) AS rn
          FROM staff_tasks WHERE ticket_number IS NULL
        )
        UPDATE staff_tasks t SET ticket_number = ordered.rn FROM ordered WHERE t.id = ordered.id
      `);
    } catch (e) { console.warn('[pg] Portal-Schema:', (e as Error).message); }

    // Defaults auf Timestamp-Spalten (damit Inserts ohne created_at/updated_at funktionieren)
    for (const [table, col] of TS_DEFAULT_COLUMNS) {
      try { await pool.query(`ALTER TABLE ${table} ALTER COLUMN ${col} SET DEFAULT ${NOW_ISO_PG}`); } catch { /* Tabelle/Spalte evtl. (noch) nicht da */ }
    }
    // Unique-Constraints für ON CONFLICT
    for (const [table, name, cols] of PG_UNIQUE) {
      try { await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT ${name} UNIQUE (${cols})`); } catch { /* existiert schon */ }
    }
    // Indizes
    for (const idx of PG_INDEXES) {
      try { await pool.query(idx); } catch { /* ignore */ }
    }
    // RQ-Zähler sicherstellen (Migration hat ihn i.d.R. schon kopiert)
    try { await pool.query(`INSERT INTO counters (name, value) VALUES ('request_number', 10000) ON CONFLICT DO NOTHING`); } catch { /* ignore */ }
    // updated_at-Trigger für booking_requests (ersetzt den SQLite-Trigger)
    try {
      await pool.query(`
        CREATE OR REPLACE FUNCTION ft_set_updated_at() RETURNS trigger AS $$
        BEGIN NEW.updated_at = ${NOW_ISO_PG}; RETURN NEW; END;
        $$ LANGUAGE plpgsql;`);
      await pool.query(`DROP TRIGGER IF EXISTS trg_booking_requests_updated_at ON booking_requests`);
      await pool.query(`
        CREATE TRIGGER trg_booking_requests_updated_at
        BEFORE UPDATE ON booking_requests
        FOR EACH ROW EXECUTE FUNCTION ft_set_updated_at()`);
    } catch { /* ignore */ }
  }
}

/** Ergänzt das pg-Schema beim Start (nur im pg-Modus, idempotent, einmal pro Prozess). */
export async function ensurePgSchema(force = false): Promise<void> {
  if (!pgEnabled()) return;
  if (pgSchemaEnsured && !force) return;
  if (pgSchemaPromise && !force) return pgSchemaPromise;
  pgSchemaPromise = applyPgSchemaEnhancements().then(() => { pgSchemaEnsured = true; });
  return pgSchemaPromise;
}

export default sqlite;
