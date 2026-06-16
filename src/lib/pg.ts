/**
 * pg.ts — PostgreSQL-Verbindung (Phase 1: bereitgestellt, aber nur aktiv, wenn DB_BACKEND=postgres).
 * Bewusst roh (node-postgres) wie zuvor better-sqlite3 — kein schwerer ORM.
 */
import { Pool } from 'pg';

/** Ist Postgres als Backend aktiv? (Default: sqlite) */
export function pgEnabled(): boolean {
  return (process.env.DB_BACKEND || 'sqlite').toLowerCase() === 'postgres';
}

let pool: Pool | null = null;
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
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
