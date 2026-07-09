// Präpariert data/bookings.db als "Alt-DB": task_time OHNE work_date/report_id
// (Stand vor den Rapport-Migrationen). initDatabase() muss darauf sauber laufen.
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(process.cwd(), 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'bookings.db');
for (const f of [dbPath, dbPath + '-wal', dbPath + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

const db = new Database(dbPath);
db.exec(`
  CREATE TABLE task_time (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    employee_id TEXT,
    minutes INTEGER NOT NULL DEFAULT 0,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX idx_task_time_task ON task_time(task_id);
  INSERT INTO task_time (id, task_id, minutes, note) VALUES ('t1', 'task-1', 30, 'alt-eintrag');
`);
db.close();
console.log('Alt-DB angelegt:', dbPath);
