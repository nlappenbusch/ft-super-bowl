/**
 * staffStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mitarbeiter, Zeiterfassung, Urlaub & interne Tasks.
 * Läuft über die Backend-Abstraktion `dbq` (SQLite ODER Postgres je nach DB_BACKEND).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { dbGet, dbAll, dbRun, withTx, type Q } from './dbq';
import './database';
import {
  WeeklyHours, DEFAULT_WEEKLY_HOURS,
  targetHoursForDate, workingDaysBetween, zhHolidays,
} from './holidays';

// ==================== EMPLOYEES ====================

export interface Employee {
  id: string;
  created_at: string;
  last_login_at: string | null;
  name: string;
  email: string;
  role: 'admin' | 'mitarbeiter';
  active: boolean;
  weekly_hours: WeeklyHours;
  vacation_days_per_year: number;
  employment_start: string | null;
  notes: string;
}

interface EmployeeRow {
  id: string; created_at: string; last_login_at: string | null;
  name: string; email: string; role: 'admin' | 'mitarbeiter';
  active: number; weekly_hours: string; vacation_days_per_year: number;
  employment_start: string | null; notes: string;
}

function rowToEmployee(r: EmployeeRow): Employee {
  let weekly: WeeklyHours = DEFAULT_WEEKLY_HOURS;
  try {
    const parsed = JSON.parse(r.weekly_hours);
    if (Array.isArray(parsed) && parsed.length === 7) weekly = parsed as WeeklyHours;
  } catch { /* default */ }
  return { ...r, active: !!r.active, weekly_hours: weekly };
}

/** Upsert beim Microsoft-Login: legt Mitarbeiter an bzw. aktualisiert Name/E-Mail/Login-Zeit. */
export async function upsertEmployeeOnLogin(input: { id: string; name: string; email?: string }): Promise<Employee> {
  const now = new Date().toISOString();
  await dbRun(`
    INSERT INTO employees (id, name, email, last_login_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = CASE WHEN excluded.email != '' THEN excluded.email ELSE employees.email END,
      last_login_at = excluded.last_login_at
  `, [input.id, input.name, input.email || '', now]);
  return (await getEmployee(input.id))!;
}

export async function getEmployee(id: string): Promise<Employee | null> {
  const r = await dbGet<EmployeeRow>('SELECT * FROM employees WHERE id = ?', [id]);
  return r ? rowToEmployee(r) : null;
}

export async function listEmployees(includeInactive = true): Promise<Employee[]> {
  const rows = await dbAll<EmployeeRow>(
    `SELECT * FROM employees ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY lower(name)`
  );
  return rows.map(rowToEmployee);
}

export interface EmployeeUpdate {
  role?: 'admin' | 'mitarbeiter';
  active?: boolean;
  weekly_hours?: WeeklyHours;
  vacation_days_per_year?: number;
  employment_start?: string | null;
  notes?: string;
  name?: string;
}

export async function updateEmployee(id: string, u: EmployeeUpdate): Promise<Employee | null> {
  const cur = await getEmployee(id);
  if (!cur) return null;
  await dbRun(`
    UPDATE employees SET
      role = ?, active = ?, weekly_hours = ?, vacation_days_per_year = ?,
      employment_start = ?, notes = ?, name = ?
    WHERE id = ?
  `, [
    u.role ?? cur.role,
    (u.active ?? cur.active) ? 1 : 0,
    JSON.stringify(u.weekly_hours ?? cur.weekly_hours),
    u.vacation_days_per_year ?? cur.vacation_days_per_year,
    u.employment_start !== undefined ? u.employment_start : cur.employment_start,
    u.notes ?? cur.notes,
    u.name ?? cur.name,
    id,
  ]);
  return getEmployee(id);
}

// ==================== TIME TRACKING ====================

export interface TimeEntry {
  id: string;
  employee_id: string;
  created_at: string;
  date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  source: 'stamp' | 'manual';
  note: string;
}

function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Netto-Stunden eines Eintrags (0 wenn noch offen). */
export function entryHours(e: TimeEntry): number {
  if (!e.end_time) return 0;
  const mins = hhmmToMinutes(e.end_time) - hhmmToMinutes(e.start_time) - (e.break_minutes || 0);
  return Math.max(0, mins) / 60;
}

function nowLocal(): { date: string; time: string } {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const s = fmt.format(new Date());
  const [date, time] = s.split(' ');
  return { date, time };
}

/** Offener (laufender) Stempel-Eintrag eines Mitarbeiters. */
export async function getRunningEntry(employeeId: string): Promise<TimeEntry | null> {
  const r = await dbGet<TimeEntry>(
    `SELECT * FROM time_entries WHERE employee_id = ? AND end_time IS NULL ORDER BY date DESC, start_time DESC LIMIT 1`,
    [employeeId]
  );
  return r || null;
}

export async function stampIn(employeeId: string): Promise<TimeEntry> {
  const running = await getRunningEntry(employeeId);
  if (running) return running;
  const { date, time } = nowLocal();
  const id = crypto.randomUUID();
  await dbRun(`
    INSERT INTO time_entries (id, employee_id, date, start_time, end_time, source)
    VALUES (?, ?, ?, ?, NULL, 'stamp')
  `, [id, employeeId, date, time]);
  return (await dbGet<TimeEntry>('SELECT * FROM time_entries WHERE id = ?', [id]))!;
}

export async function stampOut(employeeId: string, breakMinutes = 0): Promise<TimeEntry | null> {
  const running = await getRunningEntry(employeeId);
  if (!running) return null;
  const { date, time } = nowLocal();
  const end = date === running.date ? time : '23:59';
  await dbRun('UPDATE time_entries SET end_time = ?, break_minutes = ? WHERE id = ?', [end, breakMinutes, running.id]);
  return (await dbGet<TimeEntry>('SELECT * FROM time_entries WHERE id = ?', [running.id]))!;
}

export interface TimeEntryInput {
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  note?: string;
}

export async function addManualEntry(input: TimeEntryInput): Promise<TimeEntry> {
  const id = crypto.randomUUID();
  await dbRun(`
    INSERT INTO time_entries (id, employee_id, date, start_time, end_time, break_minutes, source, note)
    VALUES (?, ?, ?, ?, ?, ?, 'manual', ?)
  `, [id, input.employee_id, input.date, input.start_time, input.end_time, input.break_minutes || 0, input.note || '']);
  return (await dbGet<TimeEntry>('SELECT * FROM time_entries WHERE id = ?', [id]))!;
}

export async function updateTimeEntry(id: string, u: Partial<TimeEntryInput>): Promise<TimeEntry | null> {
  const cur = await dbGet<TimeEntry>('SELECT * FROM time_entries WHERE id = ?', [id]);
  if (!cur) return null;
  await dbRun(`
    UPDATE time_entries SET date = ?, start_time = ?, end_time = ?, break_minutes = ?, note = ? WHERE id = ?
  `, [
    u.date ?? cur.date, u.start_time ?? cur.start_time, u.end_time ?? cur.end_time,
    u.break_minutes ?? cur.break_minutes, u.note ?? cur.note, id,
  ]);
  return (await dbGet<TimeEntry>('SELECT * FROM time_entries WHERE id = ?', [id])) ?? null;
}

export async function deleteTimeEntry(id: string): Promise<boolean> {
  return (await dbRun('DELETE FROM time_entries WHERE id = ?', [id])).changes > 0;
}

export async function listTimeEntries(employeeId: string, fromIso: string, toIso: string): Promise<TimeEntry[]> {
  return dbAll<TimeEntry>(
    `SELECT * FROM time_entries WHERE employee_id = ? AND date >= ? AND date <= ? ORDER BY date, start_time`,
    [employeeId, fromIso, toIso]
  );
}

export interface TimeSummary {
  from: string;
  to: string;
  target_hours: number;
  actual_hours: number;
  balance: number;
  entries: TimeEntry[];
}

/** Monats-/Zeitraumübersicht: Soll (Wochenplan minus ZH-Feiertage) vs. Ist. */
export async function timeSummary(employee: Employee, fromIso: string, toIso: string): Promise<TimeSummary> {
  const entries = await listTimeEntries(employee.id, fromIso, toIso);
  const today = nowLocal().date;
  const effectiveTo = toIso > today ? today : toIso;
  let target = 0;
  if (effectiveTo >= fromIso) {
    const d = new Date(`${fromIso}T00:00:00Z`);
    const end = new Date(`${effectiveTo}T00:00:00Z`);
    while (d.getTime() <= end.getTime()) {
      target += targetHoursForDate(d.toISOString().slice(0, 10), employee.weekly_hours);
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  const vacs = await dbAll<VacationRequest>(`
    SELECT * FROM vacation_requests
    WHERE employee_id = ? AND status = 'genehmigt' AND start_date <= ? AND end_date >= ?
  `, [employee.id, effectiveTo, fromIso]);
  for (const v of vacs) {
    const from = v.start_date > fromIso ? v.start_date : fromIso;
    const to = v.end_date < effectiveTo ? v.end_date : effectiveTo;
    if (to >= from) {
      const d = new Date(`${from}T00:00:00Z`);
      const end = new Date(`${to}T00:00:00Z`);
      while (d.getTime() <= end.getTime()) {
        target -= targetHoursForDate(d.toISOString().slice(0, 10), employee.weekly_hours);
        d.setUTCDate(d.getUTCDate() + 1);
      }
    }
  }
  target = Math.max(0, target);
  const actual = entries.reduce((s, e) => s + entryHours(e), 0);
  return {
    from: fromIso, to: toIso,
    target_hours: Math.round(target * 100) / 100,
    actual_hours: Math.round(actual * 100) / 100,
    balance: Math.round((actual - target) * 100) / 100,
    entries,
  };
}

// ==================== VACATION ====================

export interface VacationRequest {
  id: string;
  employee_id: string;
  created_at: string;
  start_date: string;
  end_date: string;
  days: number;
  type: 'urlaub' | 'krankheit' | 'kompensation' | 'sonstiges';
  status: 'beantragt' | 'genehmigt' | 'abgelehnt';
  comment: string;
  decided_by: string | null;
  decided_at: string | null;
}

export async function createVacationRequest(input: {
  employee_id: string; start_date: string; end_date: string;
  type?: VacationRequest['type']; comment?: string; half_day?: boolean;
}): Promise<VacationRequest | null> {
  const emp = await getEmployee(input.employee_id);
  if (!emp || input.end_date < input.start_date) return null;
  // Halbtag: nur sinnvoll für einen einzelnen Tag -> 0,5 Arbeitstage.
  const days = (input.half_day && input.start_date === input.end_date)
    ? 0.5
    : workingDaysBetween(input.start_date, input.end_date, emp.weekly_hours);
  const id = crypto.randomUUID();
  await dbRun(`
    INSERT INTO vacation_requests (id, employee_id, start_date, end_date, days, type, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [id, input.employee_id, input.start_date, input.end_date, days, input.type || 'urlaub', input.comment || '']);
  return (await dbGet<VacationRequest>('SELECT * FROM vacation_requests WHERE id = ?', [id])) ?? null;
}

export async function decideVacation(id: string, status: 'genehmigt' | 'abgelehnt', decidedBy: string): Promise<VacationRequest | null> {
  const r = await dbGet<VacationRequest>('SELECT * FROM vacation_requests WHERE id = ?', [id]);
  if (!r) return null;
  await dbRun(`UPDATE vacation_requests SET status = ?, decided_by = ?, decided_at = ? WHERE id = ?`, [status, decidedBy, new Date().toISOString(), id]);
  return (await dbGet<VacationRequest>('SELECT * FROM vacation_requests WHERE id = ?', [id])) ?? null;
}

export async function deleteVacationRequest(id: string): Promise<boolean> {
  return (await dbRun('DELETE FROM vacation_requests WHERE id = ?', [id])).changes > 0;
}

export async function listVacations(year: number, employeeId?: string): Promise<VacationRequest[]> {
  const from = `${year}-01-01`, to = `${year}-12-31`;
  if (employeeId) {
    return dbAll<VacationRequest>(
      `SELECT * FROM vacation_requests WHERE employee_id = ? AND end_date >= ? AND start_date <= ? ORDER BY start_date`,
      [employeeId, from, to]
    );
  }
  return dbAll<VacationRequest>(
    `SELECT * FROM vacation_requests WHERE end_date >= ? AND start_date <= ? ORDER BY start_date`,
    [from, to]
  );
}

export interface VacationBalance {
  year: number;
  entitlement: number;
  carryover: number; // Übertrag aus dem Vorjahr (nicht verbrauchter Rest)
  used: number;
  pending: number;
  sickDays: number;  // Krankheitstage – zählen NICHT gegen den Urlaub
  remaining: number; // entitlement + carryover - used
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Verbrauchte Tage eines Antrags im gegebenen Jahr – Halbtage (days=0.5) bleiben erhalten. */
function daysInYear(v: VacationRequest, year: number, weekly: WeeklyHours): number {
  const yStart = `${year}-01-01`, yEnd = `${year}-12-31`;
  if (v.start_date >= yStart && v.end_date <= yEnd) return v.days; // ganz im Jahr -> gespeicherter Wert (inkl. 0,5)
  const from = v.start_date < yStart ? yStart : v.start_date;
  const to = v.end_date > yEnd ? yEnd : v.end_date;
  return to >= from ? workingDaysBetween(from, to, weekly) : 0;
}

export async function vacationBalance(employee: Employee, year: number): Promise<VacationBalance> {
  const vacs = await listVacations(year, employee.id);
  const sum = (list: VacationRequest[]) => r2(list.reduce((s, v) => s + daysInYear(v, year, employee.weekly_hours), 0));

  const used = sum(vacs.filter((v) => v.type === 'urlaub' && v.status === 'genehmigt'));
  const pending = sum(vacs.filter((v) => v.type === 'urlaub' && v.status === 'beantragt'));
  const sickDays = sum(vacs.filter((v) => v.type === 'krankheit' && v.status !== 'abgelehnt'));

  // Übertrag = nicht verbrauchter Rest des Vorjahres (automatisch, ungekappt)
  const prev = await listVacations(year - 1, employee.id);
  const prevUsed = sum(prev.filter((v) => v.type === 'urlaub' && v.status === 'genehmigt'));
  const carryover = Math.max(0, r2(employee.vacation_days_per_year - prevUsed));

  const remaining = r2(employee.vacation_days_per_year + carryover - used);
  return { year, entitlement: employee.vacation_days_per_year, carryover, used, pending, sickDays, remaining };
}

/** Daten für den gemeinsamen Jahresplaner: alle Mitarbeiter, Abwesenheiten, ZH-Feiertage. */
export async function vacationPlanner(year: number) {
  const employees = await listEmployees(false);
  const employeesOut = [];
  for (const e of employees) {
    employeesOut.push({
      id: e.id, name: e.name,
      balance: await vacationBalance(e, year),
      vacations: await listVacations(year, e.id),
    });
  }
  return { year, holidays: zhHolidays(year), employees: employeesOut };
}

// ==================== STAFF TASKS ====================

/** Alle gültigen Ticket-Status (Reihenfolge = Board-Spalten). */
export const TASK_STATUS_VALUES = ['offen', 'in_arbeit', 'warten_requester', 'warten_dritte', 'erledigt'] as const;
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

export interface StaffTask {
  id: string;
  ticket_number: number | null;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  assignee_id: string | null;
  booking_id: string | null;
  due_date: string | null;
  priority: 'niedrig' | 'normal' | 'hoch';
  status: TaskStatus;
  created_by: string | null;
}

/** Formatiert die fortlaufende Ticketnummer, z.B. 10 → "TASK-00010". */
export function formatTicketNo(n: number | null | undefined): string {
  if (!n || n <= 0) return '';
  return `TASK-${String(n).padStart(5, '0')}`;
}

export async function createStaffTask(input: Partial<StaffTask> & { title: string }): Promise<StaffTask> {
  const id = crypto.randomUUID();
  // Fortlaufende Ticketnummer atomar vergeben (ab 10). withTx = echte Transaktion in PG.
  await withTx(async (q) => {
    const row = await q.get<{ n: number }>(`SELECT COALESCE(MAX(ticket_number), 9) + 1 AS n FROM staff_tasks`);
    const next = row?.n ?? 10;
    await q.run(`
      INSERT INTO staff_tasks (id, ticket_number, title, description, assignee_id, booking_id, due_date, priority, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, next, input.title, input.description || '', input.assignee_id || null,
      input.booking_id || null, input.due_date || null,
      input.priority || 'normal', input.status || 'offen', input.created_by || null]);
  });
  return (await dbGet<StaffTask>('SELECT * FROM staff_tasks WHERE id = ?', [id]))!;
}

/** Findet ein Ticket über seine fortlaufende Nummer (für Inbound-Mail-Zuordnung). */
export async function findTaskByTicketNumber(n: number): Promise<StaffTask | null> {
  return (await dbGet<StaffTask>('SELECT * FROM staff_tasks WHERE ticket_number = ?', [n])) ?? null;
}

export async function updateStaffTask(id: string, u: Partial<StaffTask>): Promise<StaffTask | null> {
  const cur = await dbGet<StaffTask>('SELECT * FROM staff_tasks WHERE id = ?', [id]);
  if (!cur) return null;
  await dbRun(`
    UPDATE staff_tasks SET
      title = ?, description = ?, assignee_id = ?, booking_id = ?, due_date = ?,
      priority = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [
    u.title ?? cur.title, u.description ?? cur.description,
    u.assignee_id !== undefined ? u.assignee_id : cur.assignee_id,
    u.booking_id !== undefined ? u.booking_id : cur.booking_id,
    u.due_date !== undefined ? u.due_date : cur.due_date,
    u.priority ?? cur.priority, u.status ?? cur.status, id,
  ]);
  return (await dbGet<StaffTask>('SELECT * FROM staff_tasks WHERE id = ?', [id])) ?? null;
}

export async function getStaffTask(id: string): Promise<StaffTask | null> {
  return (await dbGet<StaffTask>('SELECT * FROM staff_tasks WHERE id = ?', [id])) ?? null;
}

export async function deleteStaffTask(id: string): Promise<boolean> {
  return (await dbRun('DELETE FROM staff_tasks WHERE id = ?', [id])).changes > 0;
}

export async function listStaffTasks(filter?: { assignee_id?: string; status?: string; booking_id?: string }): Promise<StaffTask[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (filter?.assignee_id) { where.push('assignee_id = ?'); params.push(filter.assignee_id); }
  if (filter?.status) { where.push('status = ?'); params.push(filter.status); }
  if (filter?.booking_id) { where.push('booking_id = ?'); params.push(filter.booking_id); }
  const sql = `SELECT * FROM staff_tasks ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY CASE status WHEN 'erledigt' THEN 1 ELSE 0 END, due_date IS NULL, due_date, created_at DESC`;
  return dbAll<StaffTask>(sql, params);
}

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  done: number;
  sort_order: number;
  created_at: string;
}

export async function listSubtasks(taskId: string): Promise<Subtask[]> {
  return dbAll<Subtask>('SELECT * FROM staff_task_subtasks WHERE task_id = ? ORDER BY sort_order, created_at', [taskId]);
}

export async function addSubtask(taskId: string, title: string): Promise<Subtask> {
  const id = crypto.randomUUID();
  await dbRun('INSERT INTO staff_task_subtasks (id, task_id, title) VALUES (?, ?, ?)', [id, taskId, title]);
  return (await dbGet<Subtask>('SELECT * FROM staff_task_subtasks WHERE id = ?', [id]))!;
}

export async function setSubtaskDone(id: string, done: boolean): Promise<boolean> {
  return (await dbRun('UPDATE staff_task_subtasks SET done = ? WHERE id = ?', [done ? 1 : 0, id])).changes > 0;
}

export async function deleteSubtask(id: string): Promise<boolean> {
  return (await dbRun('DELETE FROM staff_task_subtasks WHERE id = ?', [id])).changes > 0;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  filename: string;
  mime: string;
  size: number;
  created_at: string;
  created_by: string;
}

export async function listTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  return dbAll<TaskAttachment>('SELECT id, task_id, filename, mime, size, created_at, created_by FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC', [taskId]);
}

export async function addTaskAttachment(taskId: string, a: { filename: string; mime: string; size: number; data_b64: string; created_by?: string }): Promise<TaskAttachment> {
  const id = crypto.randomUUID();
  await dbRun('INSERT INTO task_attachments (id, task_id, filename, mime, size, data_b64, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, taskId, a.filename, a.mime, a.size, a.data_b64, a.created_by || '']);
  return (await dbGet<TaskAttachment>('SELECT id, task_id, filename, mime, size, created_at, created_by FROM task_attachments WHERE id = ?', [id]))!;
}

export async function getTaskAttachment(id: string): Promise<{ filename: string; mime: string; data_b64: string } | null> {
  return (await dbGet<{ filename: string; mime: string; data_b64: string }>('SELECT filename, mime, data_b64 FROM task_attachments WHERE id = ?', [id])) ?? null;
}

export async function deleteTaskAttachment(id: string): Promise<boolean> {
  return (await dbRun('DELETE FROM task_attachments WHERE id = ?', [id])).changes > 0;
}

export interface TaskTime {
  id: string;
  task_id: string;
  employee_id: string | null;
  minutes: number;
  note: string;
  work_date: string;
  report_id: string | null;
  created_at: string;
}

/** Zeitbuchung inkl. Rapport-Kontext (offen vs. rapportiert). */
export interface TaskTimeEntry extends TaskTime {
  report_number: number | null;
  report_status: TimeReportStatus | null;
}

export async function listTaskTime(taskId: string): Promise<TaskTimeEntry[]> {
  return dbAll<TaskTimeEntry>(`
    SELECT t.*, r.report_number AS report_number, r.status AS report_status
    FROM task_time t
    LEFT JOIN time_reports r ON r.id = t.report_id
    WHERE t.task_id = ?
    ORDER BY t.work_date DESC, t.created_at DESC
  `, [taskId]);
}

export async function sumTaskMinutes(taskId: string): Promise<number> {
  const r = await dbGet<{ total: number }>('SELECT COALESCE(SUM(minutes), 0) AS total FROM task_time WHERE task_id = ?', [taskId]);
  return r?.total ?? 0;
}

export async function addTaskTime(taskId: string, minutes: number, note?: string, employeeId?: string | null, workDate?: string): Promise<TaskTime> {
  const id = crypto.randomUUID();
  const date = workDate || nowLocal().date; // Standard: heutiges Datum (Europe/Zurich)
  await dbRun('INSERT INTO task_time (id, task_id, employee_id, minutes, note, work_date) VALUES (?, ?, ?, ?, ?, ?)', [id, taskId, employeeId || null, minutes, note || '', date]);
  return (await dbGet<TaskTime>('SELECT * FROM task_time WHERE id = ?', [id]))!;
}

/** Löscht eine Zeitbuchung — rapportierte Einträge sind gesperrt (erst aus dem Rapport nehmen). */
export async function deleteTaskTime(id: string): Promise<boolean> {
  return (await dbRun('DELETE FROM task_time WHERE id = ? AND report_id IS NULL', [id])).changes > 0;
}

/**
 * Zeitbuchung nachträglich justieren (Mitarbeiter, Minuten, Leistungsdatum, Notiz).
 * Einträge in FINALISIERTEN Rapporten sind gesperrt; liegt der Eintrag in einem
 * Entwurf, wird dessen Zeitraum nach der Änderung neu berechnet.
 */
export async function updateTaskTime(
  id: string,
  u: { minutes?: number; note?: string; work_date?: string; employee_id?: string | null }
): Promise<TaskTime | { error: string } | null> {
  return withTx(async (q) => {
    const cur = await q.get<TaskTime & { report_status: TimeReportStatus | null }>(`
      SELECT t.*, r.status AS report_status
      FROM task_time t LEFT JOIN time_reports r ON r.id = t.report_id
      WHERE t.id = ?`, [id]);
    if (!cur) return null;
    if (cur.report_status === 'final') {
      return { error: 'Eintrag gehört zu einem finalisierten Rapport (erst auf Entwurf zurücksetzen)' };
    }
    const minutes = u.minutes !== undefined ? Math.round(Number(u.minutes)) : cur.minutes;
    if (!minutes || minutes <= 0) return { error: 'Minuten müssen größer 0 sein' };
    const workDate = u.work_date !== undefined ? String(u.work_date) : cur.work_date;
    if (workDate && !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return { error: 'Datum im Format JJJJ-MM-TT erwartet' };
    const note = u.note !== undefined ? String(u.note) : cur.note;
    const employeeId = u.employee_id !== undefined ? (u.employee_id || null) : cur.employee_id;
    if (u.employee_id !== undefined && employeeId) {
      const emp = await q.get<{ id: string }>('SELECT id FROM employees WHERE id = ?', [employeeId]);
      if (!emp) return { error: 'Mitarbeiter nicht gefunden' };
    }
    await q.run(
      'UPDATE task_time SET minutes = ?, note = ?, work_date = ?, employee_id = ? WHERE id = ?',
      [minutes, note, workDate, employeeId, id]
    );
    if (cur.report_id) await recomputeReportPeriod(q, cur.report_id);
    return (await q.get<TaskTime>('SELECT * FROM task_time WHERE id = ?', [id]))!;
  });
}

// ==================== ZEIT-RAPPORTE (abrechenbare Zeiten) ====================

export type TimeReportStatus = 'entwurf' | 'final';

export interface TimeReport {
  id: string;
  report_number: number | null;
  title: string;
  period_from: string;
  period_to: string;
  hourly_rate: number | null;
  currency: string;
  status: TimeReportStatus;
  note: string;
  created_by: string;
  created_at: string;
  finalized_at: string | null;
}

export interface TimeReportSummary extends TimeReport {
  entry_count: number;
  total_minutes: number;
}

/** Zeitbuchung mit vollem Kontext für Rapport-Übersicht und PDF. */
export interface TimeEntryDetail extends TaskTimeEntry {
  ticket_number: number | null;
  task_title: string;
  employee_name: string | null;
}

export function formatReportNo(n?: number | null): string {
  return n && n > 0 ? `RAP-${String(n).padStart(4, '0')}` : '';
}

const TIME_ENTRY_DETAIL_SQL = `
  SELECT t.*, s.ticket_number AS ticket_number, s.title AS task_title,
         e.name AS employee_name, r.report_number AS report_number, r.status AS report_status
  FROM task_time t
  LEFT JOIN staff_tasks s ON s.id = t.task_id
  LEFT JOIN employees e ON e.id = t.employee_id
  LEFT JOIN time_reports r ON r.id = t.report_id
`;

/** Alle Ticket-Zeitbuchungen (über alle Tickets), filterbar nach Zeitraum/Mitarbeiter/Rapport-Status. */
export async function listTaskTimeEntries(f: { from?: string; to?: string; employee_id?: string; reported?: 'open' | 'reported' } = {}): Promise<TimeEntryDetail[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.from) { where.push('t.work_date >= ?'); params.push(f.from); }
  if (f.to) { where.push('t.work_date <= ?'); params.push(f.to); }
  if (f.employee_id) { where.push('t.employee_id = ?'); params.push(f.employee_id); }
  if (f.reported === 'open') where.push('t.report_id IS NULL');
  if (f.reported === 'reported') where.push('t.report_id IS NOT NULL');
  return dbAll<TimeEntryDetail>(
    `${TIME_ENTRY_DETAIL_SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY t.work_date DESC, t.created_at DESC`,
    params
  );
}

export async function listTimeReports(): Promise<TimeReportSummary[]> {
  return dbAll<TimeReportSummary>(`
    SELECT r.*, COUNT(t.id) AS entry_count, COALESCE(SUM(t.minutes), 0) AS total_minutes
    FROM time_reports r
    LEFT JOIN task_time t ON t.report_id = r.id
    GROUP BY r.id
    ORDER BY r.report_number DESC
  `);
}

export async function getTimeReport(id: string): Promise<{ report: TimeReport; entries: TimeEntryDetail[]; total_minutes: number } | null> {
  const report = await dbGet<TimeReport>('SELECT * FROM time_reports WHERE id = ?', [id]);
  if (!report) return null;
  const entries = await dbAll<TimeEntryDetail>(
    `${TIME_ENTRY_DETAIL_SQL} WHERE t.report_id = ? ORDER BY t.work_date, t.created_at`, [id]
  );
  return { report, entries, total_minutes: entries.reduce((s, e) => s + (e.minutes || 0), 0) };
}

/** Zeitraum des Rapports aus seinen Einträgen ableiten (min/max Leistungsdatum). */
async function recomputeReportPeriod(q: Q, reportId: string): Promise<void> {
  const r = await q.get<{ pfrom: string | null; pto: string | null }>(
    `SELECT MIN(work_date) AS pfrom, MAX(work_date) AS pto FROM task_time WHERE report_id = ?`, [reportId]
  );
  await q.run('UPDATE time_reports SET period_from = ?, period_to = ? WHERE id = ?', [r?.pfrom || '', r?.pto || '', reportId]);
}

/**
 * Erstellt einen Rapport (Entwurf) aus offenen Zeitbuchungen.
 * Bereits rapportierte Einträge werden abgelehnt — jede Zeit landet in genau einem Rapport.
 */
export async function createTimeReport(input: {
  entry_ids: string[];
  title?: string;
  hourly_rate?: number | null;
  currency?: string;
  note?: string;
  created_by?: string;
}): Promise<{ report: TimeReport } | { error: string }> {
  const ids = [...new Set(input.entry_ids)].filter(Boolean);
  if (!ids.length) return { error: 'Keine Zeiteinträge ausgewählt' };
  const placeholders = ids.map(() => '?').join(', ');
  return withTx(async (q) => {
    const rows = await q.all<{ id: string; report_id: string | null }>(
      `SELECT id, report_id FROM task_time WHERE id IN (${placeholders})`, ids
    );
    if (rows.length !== ids.length) return { error: 'Mindestens ein Zeiteintrag existiert nicht (mehr)' };
    const taken = rows.filter((r) => r.report_id);
    if (taken.length) return { error: `${taken.length} Einträge sind bereits in einem Rapport` };

    const id = crypto.randomUUID();
    const nRow = await q.get<{ n: number }>('SELECT COALESCE(MAX(report_number), 0) + 1 AS n FROM time_reports');
    const n = nRow?.n || 1;
    await q.run(
      `INSERT INTO time_reports (id, report_number, title, hourly_rate, currency, status, note, created_by)
       VALUES (?, ?, ?, ?, ?, 'entwurf', ?, ?)`,
      [id, n, (input.title || '').trim() || `Zeitrapport ${formatReportNo(n)}`,
       input.hourly_rate ?? null, (input.currency || 'EUR').trim().toUpperCase() || 'EUR',
       (input.note || '').trim(), input.created_by || '']
    );
    await q.run(`UPDATE task_time SET report_id = ? WHERE id IN (${placeholders}) AND report_id IS NULL`, [id, ...ids]);
    await recomputeReportPeriod(q, id);
    const report = (await q.get<TimeReport>('SELECT * FROM time_reports WHERE id = ?', [id]))!;
    return { report };
  });
}

/** Stammdaten/Status ändern. Finalisieren stempelt finalized_at; final = inhaltlich gesperrt. */
export async function updateTimeReport(
  id: string,
  u: { title?: string; note?: string; hourly_rate?: number | null; currency?: string; status?: TimeReportStatus }
): Promise<TimeReport | { error: string } | null> {
  const cur = await dbGet<TimeReport>('SELECT * FROM time_reports WHERE id = ?', [id]);
  if (!cur) return null;
  const status = u.status ?? cur.status;
  if (!['entwurf', 'final'].includes(status)) return { error: 'Ungültiger Status' };
  if (cur.status === 'final' && status === 'final' && (u.title !== undefined || u.note !== undefined || u.hourly_rate !== undefined || u.currency !== undefined)) {
    return { error: 'Finalisierte Rapporte können nicht mehr geändert werden (erst auf Entwurf zurücksetzen)' };
  }
  const finalizedAt = status === 'final' ? (cur.finalized_at || `${nowLocal().date} ${nowLocal().time}`) : null;
  await dbRun(
    `UPDATE time_reports SET title = ?, note = ?, hourly_rate = ?, currency = ?, status = ?, finalized_at = ? WHERE id = ?`,
    [
      u.title !== undefined ? String(u.title).trim() : cur.title,
      u.note !== undefined ? String(u.note) : cur.note,
      u.hourly_rate !== undefined ? u.hourly_rate : cur.hourly_rate,
      u.currency !== undefined ? String(u.currency).trim().toUpperCase() || 'EUR' : cur.currency,
      status, finalizedAt, id,
    ]
  );
  return (await dbGet<TimeReport>('SELECT * FROM time_reports WHERE id = ?', [id])) ?? null;
}

/** Einträge zu einem Entwurf hinzufügen/entfernen; Zeitraum wird neu berechnet. */
export async function updateTimeReportEntries(
  id: string,
  changes: { add?: string[]; remove?: string[] }
): Promise<{ ok: true } | { error: string }> {
  const add = [...new Set(changes.add || [])].filter(Boolean);
  const remove = [...new Set(changes.remove || [])].filter(Boolean);
  if (!add.length && !remove.length) return { error: 'Nichts zu ändern' };
  return withTx(async (q) => {
    const cur = await q.get<TimeReport>('SELECT * FROM time_reports WHERE id = ?', [id]);
    if (!cur) return { error: 'Rapport nicht gefunden' };
    if (cur.status !== 'entwurf') return { error: 'Nur Entwürfe können geändert werden' };
    if (add.length) {
      const ph = add.map(() => '?').join(', ');
      const rows = await q.all<{ id: string; report_id: string | null }>(`SELECT id, report_id FROM task_time WHERE id IN (${ph})`, add);
      if (rows.length !== add.length) return { error: 'Mindestens ein Zeiteintrag existiert nicht (mehr)' };
      if (rows.some((r) => r.report_id)) return { error: 'Mindestens ein Eintrag ist bereits in einem Rapport' };
      await q.run(`UPDATE task_time SET report_id = ? WHERE id IN (${ph}) AND report_id IS NULL`, [id, ...add]);
    }
    if (remove.length) {
      const ph = remove.map(() => '?').join(', ');
      await q.run(`UPDATE task_time SET report_id = NULL WHERE id IN (${ph}) AND report_id = ?`, [...remove, id]);
    }
    await recomputeReportPeriod(q, id);
    return { ok: true as const };
  });
}

/** Entwurf löschen — die enthaltenen Zeiten werden wieder "offen". Finale Rapporte sind gesperrt. */
export async function deleteTimeReport(id: string): Promise<{ ok: true } | { error: string }> {
  return withTx(async (q) => {
    const cur = await q.get<TimeReport>('SELECT * FROM time_reports WHERE id = ?', [id]);
    if (!cur) return { error: 'Rapport nicht gefunden' };
    if (cur.status !== 'entwurf') return { error: 'Finalisierte Rapporte können nicht gelöscht werden (erst auf Entwurf zurücksetzen)' };
    await q.run('UPDATE task_time SET report_id = NULL WHERE report_id = ?', [id]);
    await q.run('DELETE FROM time_reports WHERE id = ?', [id]);
    return { ok: true as const };
  });
}

// ==================== TASK MESSAGES (Mail-Verlauf pro Ticket) ====================

export interface TaskMessage {
  id: string;
  task_id: string;
  direction: 'in' | 'out' | 'note';
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  graph_message_id: string | null;
  created_at: string;
  created_by: string;
}

export async function listTaskMessages(taskId: string): Promise<TaskMessage[]> {
  return dbAll<TaskMessage>('SELECT * FROM task_messages WHERE task_id = ? ORDER BY created_at ASC', [taskId]);
}

export async function addTaskMessage(m: {
  task_id: string;
  direction: 'in' | 'out' | 'note';
  from_email?: string;
  to_email?: string;
  subject?: string;
  body?: string;
  graph_message_id?: string | null;
  created_by?: string;
}): Promise<TaskMessage> {
  const id = crypto.randomUUID();
  await dbRun(
    `INSERT INTO task_messages (id, task_id, direction, from_email, to_email, subject, body, graph_message_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, m.task_id, m.direction, m.from_email || '', m.to_email || '', m.subject || '', m.body || '', m.graph_message_id || null, m.created_by || ''],
  );
  return (await dbGet<TaskMessage>('SELECT * FROM task_messages WHERE id = ?', [id]))!;
}

/** Prüft, ob eine eingehende Graph-Nachricht bereits einem Ticket zugeordnet wurde (Dedupe). */
export async function taskGraphMessageExists(graphMessageId: string): Promise<boolean> {
  const r = await dbGet<{ id: string }>('SELECT id FROM task_messages WHERE graph_message_id = ?', [graphMessageId]);
  return !!r;
}

// ==================== NOTIFICATIONS (Benachrichtigungs-Center) ====================

export interface AdminNotification {
  id: string;
  employee_id: string;
  type: 'task_assigned' | 'task_message' | 'task_note' | 'mention' | 'info';
  task_id: string | null;
  title: string;
  body: string;
  is_read: number; // 0 | 1
  created_at: string;
  created_by: string;
}

export async function addNotification(n: {
  employee_id: string;
  type: AdminNotification['type'];
  task_id?: string | null;
  title: string;
  body?: string;
  created_by?: string;
}): Promise<void> {
  await dbRun(
    `INSERT INTO admin_notifications (id, employee_id, type, task_id, title, body, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), n.employee_id, n.type, n.task_id || null, n.title, n.body || '', n.created_by || ''],
  );
}

export async function listNotifications(employeeId: string, opts?: { unreadOnly?: boolean; limit?: number }): Promise<AdminNotification[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
  return dbAll<AdminNotification>(
    `SELECT * FROM admin_notifications WHERE employee_id = ? ${opts?.unreadOnly ? 'AND is_read = 0' : ''}
     ORDER BY created_at DESC LIMIT ${limit}`,
    [employeeId],
  );
}

export async function countUnreadNotifications(employeeId: string): Promise<number> {
  const r = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM admin_notifications WHERE employee_id = ? AND is_read = 0', [employeeId]);
  return r?.n ?? 0;
}

/** Markiert Benachrichtigungen als gelesen; ohne ids = alle des Mitarbeiters. */
export async function markNotificationsRead(employeeId: string, ids?: string[]): Promise<number> {
  if (ids && ids.length) {
    let changed = 0;
    for (const id of ids) {
      changed += (await dbRun('UPDATE admin_notifications SET is_read = 1 WHERE id = ? AND employee_id = ?', [id, employeeId])).changes;
    }
    return changed;
  }
  return (await dbRun('UPDATE admin_notifications SET is_read = 1 WHERE employee_id = ? AND is_read = 0', [employeeId])).changes;
}

/** Findet einen Mitarbeiter über den Anzeigenamen (case-insensitive) – z.B. für created_by-Strings. */
export async function findEmployeeByName(name: string): Promise<Employee | null> {
  const n = (name || '').trim().toLowerCase();
  if (!n) return null;
  const all = await listEmployees(true);
  return all.find((e) => e.name.trim().toLowerCase() === n) || null;
}

/**
 * Erkennt @Erwähnungen in einem Text (voller Name oder Vorname, case-insensitive)
 * und liefert die passenden aktiven Mitarbeiter.
 */
export async function resolveMentions(text: string): Promise<Employee[]> {
  if (!text || !text.includes('@')) return [];
  const emps = await listEmployees(false);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return emps.filter((e) => {
    const full = e.name.trim();
    if (!full) return false;
    const first = full.split(/\s+/)[0];
    const rxFull = new RegExp(`@${esc(full).replace(/\\?\s+/g, '\\s+')}`, 'i');
    const rxFirst = new RegExp(`@${esc(first)}(?![\\wäöüß])`, 'i');
    return rxFull.test(text) || rxFirst.test(text);
  });
}

/**
 * Benachrichtigt die Beteiligten eines Tickets (Ersteller + Assignee) sowie
 * @Erwähnte über eine neue Nachricht/Notiz. Der Autor selbst wird ausgelassen.
 */
export async function notifyTaskParticipants(task: StaffTask, opts: {
  type: 'task_message' | 'task_note';
  body: string;
  actorName: string;
}): Promise<void> {
  const ticket = formatTicketNo(task.ticket_number) || 'Ticket';
  const actorLc = (opts.actorName || '').trim().toLowerCase();
  const targets = new Map<string, AdminNotification['type']>();

  // Ersteller (created_by ist ein Anzeigename) + Assignee
  const creator = task.created_by ? await findEmployeeByName(task.created_by) : null;
  if (creator) targets.set(creator.id, opts.type);
  if (task.assignee_id) targets.set(task.assignee_id, opts.type);

  // @Erwähnungen gewinnen gegenüber dem generischen Typ
  for (const m of await resolveMentions(opts.body)) targets.set(m.id, 'mention');

  const label = opts.type === 'task_note' ? 'Neue Notiz' : 'Neue Nachricht';
  for (const [empId, type] of targets) {
    const emp = await getEmployee(empId);
    if (!emp || emp.name.trim().toLowerCase() === actorLc) continue;
    await addNotification({
      employee_id: empId,
      type,
      task_id: task.id,
      title: type === 'mention'
        ? `${opts.actorName || 'Jemand'} hat dich in ${ticket} erwähnt`
        : `${label} in ${ticket} – ${task.title}`,
      body: opts.body.slice(0, 2000),
      created_by: opts.actorName || '',
    }).catch(() => { /* Benachrichtigung darf den Hauptfluss nie brechen */ });
  }
}
