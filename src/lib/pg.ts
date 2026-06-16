/**
 * pg.ts — PostgreSQL-Verbindung (Phase 1: bereitgestellt, aber nur aktiv, wenn DB_BACKEND=postgres).
 * Bewusst roh (node-postgres) wie zuvor better-sqlite3 — kein schwerer ORM.
 */
import { Pool, types } from 'pg';

// bigint (int8, oid 20) und numeric (oid 1700) als JS-Zahlen liefern statt als String,
// damit der App-Code (der von SQLite Zahlen gewohnt ist) unverändert funktioniert.
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

/** Ist Postgres als Backend aktiv? (Default: sqlite) */
export function pgEnabled(): boolean {
  return (process.env.DB_BACKEND || 'sqlite').toLowerCase() === 'postgres';
}

let pool: Pool | null = null;
export function getPool(): Pool {
  if (!pool) {
    // Diskrete Parameter statt connectionString: ein Passwort mit URL-Sonderzeichen
    // (z. B. "/", "@", ":") bricht sonst das URL-Parsing ("Invalid URL").
    pool = new Pool({
      host: process.env.PGHOST || 'db',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.POSTGRES_USER || 'faltin',
      password: process.env.POSTGRES_PASSWORD || 'faltin',
      database: process.env.POSTGRES_DB || 'faltin',
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return pool;
}

/** Leichter Health-Check (für /admin/status später nutzbar). */
export async function pgHealth(): Promise<{ ok: boolean; detail: string }> {
  if (!pgEnabled()) return { ok: false, detail: 'inaktiv (DB_BACKEND=sqlite)' };
  try {
    const r = await getPool().query('SELECT 1 AS ok');
    return { ok: r.rows?.[0]?.ok === 1, detail: 'verbunden' };
  } catch (e) {
    return { ok: false, detail: (e as Error).message };
  }
}
