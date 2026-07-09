// Lädt database.ts (Modul-Load ruft initDatabase()) gegen die präparierte Alt-DB
// und prüft, dass Migration + Index + alle Folge-Tabellen da sind.
import { db as sqlite } from '../src/lib/database';

const cols = sqlite.prepare(`PRAGMA table_info(task_time)`).all() as Array<{ name: string }>;
const hasReportId = cols.some((c) => c.name === 'report_id');
const hasWorkDate = cols.some((c) => c.name === 'work_date');
const idx = sqlite
  .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_task_time_report'`)
  .get();
const laterTables = ['time_reports', 'projects', 'task_messages', 'api_keys', 'admin_notifications', 'tippspiel_users'];
const missing = laterTables.filter(
  (t) => !sqlite.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t)
);
const oldRow = sqlite.prepare(`SELECT note FROM task_time WHERE id='t1'`).get() as { note: string } | undefined;

console.log('report_id-Spalte:', hasReportId ? 'OK' : 'FEHLT');
console.log('work_date-Spalte:', hasWorkDate ? 'OK' : 'FEHLT');
console.log('idx_task_time_report:', idx ? 'OK' : 'FEHLT');
console.log('Folge-Tabellen:', missing.length ? `FEHLEN: ${missing.join(', ')}` : 'OK');
console.log('Alt-Daten erhalten:', oldRow?.note === 'alt-eintrag' ? 'OK' : 'FEHLT');

if (!hasReportId || !hasWorkDate || !idx || missing.length || oldRow?.note !== 'alt-eintrag') {
  process.exit(1);
}
console.log('ALLES OK');
