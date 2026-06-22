/**
 * staffStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Mitarbeiter, Zeiterfassung, Urlaub & interne Tasks.
 * Läuft über die Backend-Abstraktion `dbq` (SQLite ODER Postgres je nach DB_BACKEND).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { dbGet, dbAll, dbRun } from './dbq';
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

export interface StaffTask {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  description: string;
  assignee_id: string | null;
  booking_id: string | null;
  due_date: string | null;
  priority: 'niedrig' | 'normal' | 'hoch';
  status: 'offen' | 'in_arbeit' | 'erledigt';
  created_by: string | null;
}

export async function createStaffTask(input: Partial<StaffTask> & { title: string }): Promise<StaffTask> {
  const id = crypto.randomUUID();
  await dbRun(`
    INSERT INTO staff_tasks (id, title, description, assignee_id, booking_id, due_date, priority, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, input.title, input.description || '', input.assignee_id || null,
    input.booking_id || null, input.due_date || null,
    input.priority || 'normal', input.status || 'offen', input.created_by || null]);
  return (await dbGet<StaffTask>('SELECT * FROM staff_tasks WHERE id = ?', [id]))!;
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
