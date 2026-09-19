/**
 * workspace/signals.ts — „Mein Tag“: was für eine Mitarbeiterin / einen Mitarbeiter
 * gerade ansteht. Rein deterministisch aus den Portal-Daten (keine KI), damit die
 * Übersicht schnell lädt; die KI formuliert daraus den Check-in und nutzt dieselben
 * Daten über das Werkzeug get_my_day.
 */
import { listStaffTasks, listEmployees, formatTicketNo, type Employee } from '../staffStore';
import { getAllBookings, listUnansweredBookingInbound } from '../database';
import { listCalculations } from '../calculationStore';
import { dbAll } from '../dbq';
import { ensureWorkspaceSchema } from './schema';

const DAY_MS = 24 * 3600 * 1000;

function ts(s?: string | null): number {
  if (!s) return 0;
  let v = s.includes('T') ? s : s.replace(' ', 'T');
  if (!/([zZ]|[+-]\d\d:?\d\d)$/.test(v)) v += 'Z';
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

function zurichToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export interface DaySignals {
  today: string;
  me: { id: string; name: string; role: string } | null;
  my_tasks: Array<{ id: string; ticket_no: string; title: string; status: string; priority: string; due_date: string | null; overdue: boolean }>;
  unassigned_tasks: Array<{ id: string; ticket_no: string; title: string; created_at: string; priority: string }>;
  waiting_customers: Array<{ booking_id: string; request_number: string | null; package: string; customer: string; last_in_at: string; mine: boolean; assignee: string | null; days_waiting: number }>;
  new_requests: Array<{ booking_id: string; request_number: string | null; package: string; customer: string; created_at: string; persons: number }>;
  stale_requests: Array<{ booking_id: string; request_number: string | null; package: string; customer: string; days_idle: number }>;
  offer_drafts: Array<{ id: string; offer_number: string | null; title: string; customer: string | null; updated_at: string }>;
  mail: { open: number; high: number; needs_reply: number };
}

type BookingRow = Awaited<ReturnType<typeof getAllBookings>>[number] & { updated_at?: string | null; assigned_to?: string | null };

export async function collectSignals(employee: Employee | null): Promise<DaySignals> {
  const today = zurichToday();
  const now = Date.now();
  const [tasks, employees, bookings, unanswered, calcs] = await Promise.all([
    listStaffTasks(),
    listEmployees(false),
    getAllBookings() as Promise<BookingRow[]>,
    listUnansweredBookingInbound().catch(() => []),
    listCalculations().catch(() => []),
  ]);
  const nameById = new Map(employees.map((e) => [e.id, e.name]));
  const meId = employee?.id || '';

  const open = tasks.filter((t) => t.status !== 'erledigt');
  const myTasks = open
    .filter((t) => meId && t.assignee_id === meId)
    .map((t) => {
      const due = (t.due_date || '').slice(0, 10) || null;
      return {
        id: t.id, ticket_no: formatTicketNo(t.ticket_number), title: t.title, status: t.status,
        priority: t.priority, due_date: due, overdue: !!due && due < today,
      };
    })
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || (a.due_date || '9999').localeCompare(b.due_date || '9999'))
    .slice(0, 12);

  const unassigned = open
    .filter((t) => !t.assignee_id && t.status === 'offen' && !t.ai_requested)
    .slice(0, 8)
    .map((t) => ({ id: t.id, ticket_no: formatTicketNo(t.ticket_number), title: t.title, created_at: t.created_at, priority: t.priority }));

  const waiting = unanswered
    .filter((u) => !u.assigned_to || u.assigned_to === meId)
    .map((u) => ({
      booking_id: u.booking_id, request_number: u.request_number, package: u.package_title,
      customer: u.customer_name || u.email, last_in_at: u.last_in_at, mine: !!meId && u.assigned_to === meId,
      assignee: u.assigned_to ? nameById.get(u.assigned_to) || null : null,
      days_waiting: Math.floor((now - ts(u.last_in_at)) / DAY_MS),
    }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || b.days_waiting - a.days_waiting)
    .slice(0, 10);

  const customerOf = (b: BookingRow) => (b.customer_name || '').trim() || b.email;
  const newRequests = bookings
    .filter((b) => b.status === 'new' && !b.assigned_to)
    .sort((a, b) => ts(b.created_at) - ts(a.created_at))
    .slice(0, 10)
    .map((b) => ({ booking_id: b.id, request_number: b.request_number || null, package: b.package_title, customer: customerOf(b), created_at: b.created_at, persons: b.number_of_persons }));

  const stale = bookings
    .filter((b) => meId && b.assigned_to === meId && (b.status === 'new' || b.status === 'in_progress'))
    .map((b) => ({ b, idle: Math.floor((now - ts(b.updated_at || b.created_at)) / DAY_MS) }))
    .filter((x) => x.idle >= 5)
    .sort((a, b) => b.idle - a.idle)
    .slice(0, 8)
    .map(({ b, idle }) => ({ booking_id: b.id, request_number: b.request_number || null, package: b.package_title, customer: customerOf(b), days_idle: idle }));

  const drafts = calcs
    .filter((c) => c.status === 'entwurf' && now - ts(c.updated_at) < 21 * DAY_MS)
    .slice(0, 6)
    .map((c) => ({ id: c.id, offer_number: c.calc_number, title: c.title, customer: c.customer_name, updated_at: c.updated_at }));

  await ensureWorkspaceSchema();
  const mailRows = await dbAll<{ priority: string; needs_reply: number }>(
    `SELECT priority, needs_reply FROM ws_mail_triage WHERE status = 'offen' AND triaged_at IS NOT NULL`,
  ).catch(() => []);

  return {
    today,
    me: employee ? { id: employee.id, name: employee.name, role: employee.role } : null,
    my_tasks: myTasks,
    unassigned_tasks: unassigned,
    waiting_customers: waiting,
    new_requests: newRequests,
    stale_requests: stale,
    offer_drafts: drafts,
    mail: {
      open: mailRows.length,
      high: mailRows.filter((m) => m.priority === 'hoch').length,
      needs_reply: mailRows.filter((m) => m.needs_reply).length,
    },
  };
}

/** Kompakte Textfassung für die KI (Check-in, get_my_day). */
export function signalsToText(s: DaySignals): string {
  const time = new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date());
  const lines: string[] = [`Heute: ${s.today} (${time} Uhr, Zürich). Person: ${s.me?.name || 'lokaler Admin'} (${s.me?.role || 'admin'}).`];
  lines.push(`Eigene offene Aufgaben (${s.my_tasks.length}):`);
  for (const t of s.my_tasks) lines.push(`- ${t.ticket_no} „${t.title}“ [${t.status}, ${t.priority}${t.due_date ? `, fällig ${t.due_date}${t.overdue ? ' ÜBERFÄLLIG' : ''}` : ''}] (task_id ${t.id})`);
  if (s.unassigned_tasks.length) {
    lines.push(`Nicht zugewiesene Aufgaben im Team (${s.unassigned_tasks.length}):`);
    for (const t of s.unassigned_tasks) lines.push(`- ${t.ticket_no} „${t.title}“ seit ${t.created_at.slice(0, 10)}`);
  }
  lines.push(`Kunden warten auf Antwort (${s.waiting_customers.length}):`);
  for (const w of s.waiting_customers) lines.push(`- ${w.request_number || w.booking_id} ${w.customer} – ${w.package}: wartet seit ${w.days_waiting} Tag(en)${w.mine ? ' (dir zugewiesen)' : w.assignee ? ` (${w.assignee})` : ' (nicht zugewiesen)'}`);
  lines.push(`Neue, nicht zugewiesene Anfragen (${s.new_requests.length}):`);
  for (const n of s.new_requests) lines.push(`- ${n.request_number || n.booking_id} ${n.customer} – ${n.package}, ${n.persons} Pers., eingegangen ${n.created_at.slice(0, 10)}`);
  if (s.stale_requests.length) {
    lines.push('Eigene Anfragen ohne Bewegung:');
    for (const r of s.stale_requests) lines.push(`- ${r.request_number || r.booking_id} ${r.customer} – ${r.package}: seit ${r.days_idle} Tagen ruhig`);
  }
  if (s.offer_drafts.length) {
    lines.push('Angebote im Entwurf:');
    for (const d of s.offer_drafts) lines.push(`- ${d.offer_number || d.id} „${d.title}“${d.customer ? ` für ${d.customer}` : ''}, zuletzt ${d.updated_at.slice(0, 10)}`);
  }
  lines.push(`Posteingang (request@, KI-sortiert): ${s.mail.open} offen, davon ${s.mail.high} dringend, ${s.mail.needs_reply} brauchen eine Antwort.`);
  return lines.join('\n');
}
