/**
 * pgMigrate.ts — Einmalige Datenmigration SQLite (bookings.db) -> PostgreSQL.
 * Generisch: introspektiert alle SQLite-Tabellen, legt passende PG-Tabellen an
 * und kopiert alle Zeilen. Non-destruktiv für SQLite (nur lesend).
 * Idempotent: PG-Tabellen werden vor dem Kopieren geleert (TRUNCATE).
 */
import Database from 'better-sqlite3';
import path from 'path';
import { getPool } from './pg';

function pgType(sqliteType: string): string {
  const t = (sqliteType || '').toUpperCase();
  if (t.includes('INT')) return 'bigint';
  if (t.includes('REAL') || t.includes('FLOA') || t.includes('DOUB') || t.includes('NUM') || t.includes('DEC')) return 'double precision';
  return 'text';
}

export interface MigrateResult {
  tables: { name: string; rows: number }[];
  errors: string[];
  durationMs: number;
}

export async function migrateSqliteToPg(sqlitePath?: string): Promise<MigrateResult> {
  const t0 = Date.now();
  const dbFile = sqlitePath || path.join(process.cwd(), 'data', 'bookings.db');
  const sqlite = new Database(dbFile, { readonly: true, fileMustExist: true });
  const pool = getPool();
  const errors: string[] = [];
  const out: { name: string; rows: number }[] = [];

  const tables = (sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).all() as { name: string }[]).map((r) => r.name);

  for (const t of tables) {
    try {
      const cols = sqlite.prepare(`PRAGMA table_info("${t}")`).all() as { name: string; type: string; pk: number }[];
      if (!cols.length) continue;
      const colDefs = cols.map((c) => `"${c.name}" ${pgType(c.type)}`);
      const pks = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => `"${c.name}"`);
      const ddl = `CREATE TABLE IF NOT EXISTS "${t}" (${colDefs.join(', ')}${pks.length ? `, PRIMARY KEY (${pks.join(', ')})` : ''})`;
      await pool.query(ddl);
      await pool.query(`TRUNCATE TABLE "${t}"`);

      const colNames = cols.map((c) => c.name);
      const rows = sqlite.prepare(`SELECT * FROM "${t}"`).all() as Record<string, unknown>[];
      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const slice = rows.slice(i, i + BATCH);
        const valuesSql: string[] = [];
        const params: unknown[] = [];
        let p = 1;
        for (const row of slice) {
          const ph = colNames.map(() => `$${p++}`);
          valuesSql.push(`(${ph.join(',')})`);
          for (const cn of colNames) {
            let v = row[cn];
            if (v === undefined) v = null;
            // SQLite speichert Bools/Flags als 0/1 (INTEGER) -> bleibt bigint, passt.
            params.push(v as never);
          }
        }
        await pool.query(`INSERT INTO "${t}" (${colNames.map((c) => `"${c}"`).join(', ')}) VALUES ${valuesSql.join(', ')}`, params);
      }
      out.push({ name: t, rows: rows.length });
    } catch (e) {
      errors.push(`${t}: ${(e as Error).message}`);
    }
  }
  sqlite.close();
  return { tables: out, errors, durationMs: Date.now() - t0 };
}
