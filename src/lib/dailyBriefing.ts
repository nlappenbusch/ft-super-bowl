/**
 * dailyBriefing.ts (TASK-00091)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tägliches Team-Briefing per Mail an alle aktiven Mitarbeitenden:
 *   – eigene offene Aufgaben (NEU-Markierung, Fälligkeit/Überfälligkeit)
 *   – neue Aufgaben im Team (letzte 24 h)
 *   – neue Anfragen & Anfragen mit Bewegung (letzte 24 h)
 *   – eigene Anfragen ohne Bewegung seit 5+ Tagen (Erinnerung)
 *   – Schulterklopfen für Erledigtes (eigene erledigte Aufgaben/Buchungen)
 *
 * Gesteuert über settings.mail.daily_briefing_enabled / daily_briefing_hour
 * (Europe/Zurich). Der Scheduler in instrumentation.ts ruft runDailyBriefing()
 * alle 5 Minuten auf; der Versandzeitpunkt wird über data/briefing-state.json
 * dedupliziert (einmal pro Kalendertag). Manueller Test: POST /api/admin/briefing.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs';
import path from 'path';
import { listEmployees, listStaffTasks, formatTicketNo, type StaffTask, type Employee } from './staffStore';
import { getAllBookings } from './database';
import type { BookingRequest } from './supabase';
import { getSettings } from './settingsStore';
import {
  dailyBriefingEmailHtml,
  type BriefingTaskItem,
  type BriefingInquiryItem,
} from './emailTemplates';

const STATE_PATH = path.join(process.cwd(), 'data', 'briefing-state.json');
const DAY_MS = 24 * 3600 * 1000;
const STALE_DAYS = 5;
const MAX_ITEMS_PER_SECTION = 12;

/** Anfrage-Zeilen aus SELECT b.* enthalten auch nicht im Interface deklarierte Spalten. */
type BookingRow = BookingRequest & { updated_at?: string | null; assigned_to?: string | null };

export interface BriefingRunResult {
  /** false = Feature aus oder Graph nicht konfiguriert. */
  configured: boolean;
  /** false = heute schon verschickt bzw. Versandstunde noch nicht erreicht. */
  due: boolean;
  sent: number;
  skippedEmpty: number;
  errors: number;
  recipients: string[];
}

interface BriefingState {
  last_sent_date?: string;
  last_run_at?: string;
  last_result?: Omit<BriefingRunResult, 'recipients'>;
}

function readState(): BriefingState {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')) as BriefingState;
  } catch {
    return {};
  }
}

function writeState(state: BriefingState): void {
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[daily-briefing] State konnte nicht geschrieben werden:', (e as Error).message);
  }
}

/** Datum (YYYY-MM-DD) und Stunde in Europe/Zurich. */
function zurichNow(d = new Date()): { date: string; hour: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

/** Toleranter Timestamp-Parser: ISO ("…T…Z") und SQL ("YYYY-MM-DD HH:MM:SS", UTC). */
function ts(s?: string | null): number {
  if (!s) return 0;
  let v = s.includes('T') ? s : s.replace(' ', 'T');
  if (!/([zZ]|[+-]\d\d:?\d\d)$/.test(v)) v += 'Z';
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : 0;
}

const BOOKING_STATUS_LABEL: Record<string, string> = {
  new: 'Neu',
  in_progress: 'In Bearbeitung',
  booked: 'Gebucht',
  rejected: 'Abgelehnt',
};

function bookingTitle(b: BookingRow): string {
  const who = (b.customer_name || '').trim() || b.email || '';
  return [b.package_title, who].filter(Boolean).join(' — ') || 'Anfrage';
}

function formatDueDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

/** Rotierende Schulterklopf-Floskel (deterministisch pro Tag). */
function praisePhrase(dateStr: string): string {
  const phrases = ['Stark gemacht', 'Sauber abgeräumt', 'Top-Leistung', 'Weiter so', 'Klasse Arbeit'];
  const seed = Number(dateStr.replace(/-/g, '')) || 0;
  return phrases[seed % phrases.length];
}

function plural(n: number, singular: string, pluralWord: string): string {
  return `${n} ${n === 1 ? singular : pluralWord}`;
}

function taskItem(t: StaffTask, opts: { sinceMs: number; today: string; base: string; withAssignee?: Map<string, string> }): BriefingTaskItem {
  const due = (t.due_date || '').slice(0, 10);
  const overdue = !!due && due < opts.today;
  return {
    ticketNo: formatTicketNo(t.ticket_number) || '—',
    title: t.title,
    url: `${opts.base}/admin/aufgaben/${t.id}`,
    priority: t.priority,
    dueLabel: due ? (overdue ? `überfällig seit ${formatDueDate(due)}` : `fällig ${formatDueDate(due)}`) : undefined,
    overdue,
    isNew: ts(t.created_at) >= opts.sinceMs,
    assigneeName: opts.withAssignee
      ? (t.assignee_id ? opts.withAssignee.get(t.assignee_id) || 'Unbekannt' : 'Nicht zugewiesen')
      : undefined,
  };
}

function inquiryItem(b: BookingRow, base: string, ageLabel?: string): BriefingInquiryItem {
  return {
    requestNumber: b.request_number || '—',
    title: bookingTitle(b),
    url: `${base}/admin/crm`,
    statusLabel: BOOKING_STATUS_LABEL[b.status] || b.status,
    ageLabel,
  };
}

/** Eigene offene Aufgaben sortieren: überfällig → fällig (aufsteigend) → hoch → neueste. */
function sortOpenTasks(a: StaffTask, b: StaffTask, today: string): number {
  const dueA = (a.due_date || '').slice(0, 10);
  const dueB = (b.due_date || '').slice(0, 10);
  const overA = dueA && dueA < today ? 0 : 1;
  const overB = dueB && dueB < today ? 0 : 1;
  if (overA !== overB) return overA - overB;
  if (dueA !== dueB) return (dueA || '9999') < (dueB || '9999') ? -1 : 1;
  const prioA = a.priority === 'hoch' ? 0 : 1;
  const prioB = b.priority === 'hoch' ? 0 : 1;
  if (prioA !== prioB) return prioA - prioB;
  return ts(b.created_at) - ts(a.created_at);
}

let running = false;

/**
 * Prüft Zeitfenster & Versand-Status und verschickt fällige Briefings.
 * `force` überspringt Feature-Toggle, Uhrzeit und Tages-Deduplizierung
 * (zählt aber als heutiger Versand, damit der Scheduler nicht doppelt schickt).
 */
export async function runDailyBriefing(opts: { force?: boolean } = {}): Promise<BriefingRunResult> {
  const empty = (over: Partial<BriefingRunResult>): BriefingRunResult =>
    ({ configured: true, due: true, sent: 0, skippedEmpty: 0, errors: 0, recipients: [], ...over });

  if (running) return empty({ due: false });
  const m = getSettings().mail;
  const enabled = m.daily_briefing_enabled !== false;
  const sendHour = Math.min(23, Math.max(0, Math.round(Number(m.daily_briefing_hour ?? 7)) || 0));

  const { isGraphConfigured, sendGraphMail } = await import('./graphMailer');
  if (!isGraphConfigured() || (!enabled && !opts.force)) return empty({ configured: false, due: false });

  const now = zurichNow();
  const state = readState();
  if (!opts.force) {
    if (now.hour < sendHour) return empty({ due: false });
    if (state.last_sent_date === now.date) return empty({ due: false });
  }

  running = true;
  try {
    // Versand-Marker VOR dem Mail-Loop setzen: ein Fehler mitten im Versand darf
    // beim nächsten Scheduler-Tick keine Doppel-Mails an bereits Beliefert erzeugen.
    writeState({ ...state, last_sent_date: now.date, last_run_at: new Date().toISOString() });

    const base = (m.login_base_url || 'https://next.faltintravel.com').replace(/\/+$/, '');
    const sinceMs = Date.now() - DAY_MS;
    const staleBeforeMs = Date.now() - STALE_DAYS * DAY_MS;

    const [employees, tasks, bookings] = await Promise.all([
      listEmployees(false),
      listStaffTasks(),
      getAllBookings() as Promise<BookingRow[]>,
    ]);
    const nameById = new Map(employees.map((e) => [e.id, e.name]));

    const newTeamTasks = tasks.filter((t) => ts(t.created_at) >= sinceMs);
    const newInquiries = bookings.filter((b) => ts(b.created_at) >= sinceMs);
    const movedInquiries = bookings.filter((b) => ts(b.created_at) < sinceMs && ts(b.updated_at) >= sinceMs);
    const teamDoneCount = tasks.filter((t) => t.status === 'erledigt' && ts(t.updated_at) >= sinceMs).length;

    const dateLabel = new Intl.DateTimeFormat('de-CH', {
      timeZone: 'Europe/Zurich', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(new Date());

    const result = empty({});
    const recipients = employees.filter((e): e is Employee => !!(e.email || '').trim());

    for (const emp of recipients) {
      try {
        const myOpenAll = tasks
          .filter((t) => t.assignee_id === emp.id && t.status !== 'erledigt')
          .sort((a, b) => sortOpenTasks(a, b, now.date));
        const myOpen = myOpenAll.slice(0, MAX_ITEMS_PER_SECTION);
        const othersNew = newTeamTasks
          .filter((t) => t.assignee_id !== emp.id)
          .slice(0, MAX_ITEMS_PER_SECTION);
        const myStale = bookings
          .filter((b) => b.assigned_to === emp.id
            && (b.status === 'new' || b.status === 'in_progress')
            && ts(b.updated_at || b.created_at) <= staleBeforeMs)
          .slice(0, MAX_ITEMS_PER_SECTION);

        const myDone = tasks.filter((t) => t.assignee_id === emp.id && t.status === 'erledigt' && ts(t.updated_at) >= sinceMs).length;
        const myBooked = bookings.filter((b) => b.assigned_to === emp.id && b.status === 'booked' && ts(b.updated_at) >= sinceMs).length;
        const kudos: string[] = [];
        if (myDone > 0 || myBooked > 0) {
          const parts: string[] = [];
          if (myDone > 0) parts.push(plural(myDone, 'Aufgabe erledigt', 'Aufgaben erledigt'));
          if (myBooked > 0) parts.push(plural(myBooked, 'Anfrage zur Buchung gebracht', 'Anfragen zur Buchung gebracht'));
          kudos.push(`🎉 ${praisePhrase(now.date)}: In den letzten 24 Stunden hast du ${parts.join(' und ')}.`);
        }
        if (teamDoneCount > myDone) {
          kudos.push(`👏 Das Team hat insgesamt ${plural(teamDoneCount, 'Aufgabe', 'Aufgaben')} erledigt.`);
        }

        const hasContent = myOpen.length || othersNew.length || newInquiries.length || movedInquiries.length || myStale.length || kudos.length;
        if (!hasContent) {
          result.skippedEmpty++;
          continue;
        }

        const html = dailyBriefingEmailHtml({
          recipientFirstName: (emp.name || '').split(' ')[0] || undefined,
          dateLabel,
          kudos,
          myOpenTasks: myOpen.map((t) => taskItem(t, { sinceMs, today: now.date, base })),
          myOpenMore: Math.max(0, myOpenAll.length - myOpen.length),
          newTeamTasks: othersNew.map((t) => taskItem(t, { sinceMs, today: now.date, base, withAssignee: nameById })),
          newInquiries: newInquiries.slice(0, MAX_ITEMS_PER_SECTION).map((b) => inquiryItem(b, base)),
          movedInquiries: movedInquiries.slice(0, MAX_ITEMS_PER_SECTION).map((b) => inquiryItem(b, base)),
          staleInquiries: myStale.map((b) => {
            const days = Math.floor((Date.now() - ts(b.updated_at || b.created_at)) / DAY_MS);
            return inquiryItem(b, base, `seit ${plural(days, 'Tag', 'Tagen')} ohne Bewegung`);
          }),
          boardUrl: `${base}/admin/aufgaben`,
          crmUrl: `${base}/admin/crm`,
        });

        const counts = [
          myOpenAll.length ? plural(myOpenAll.length, 'offene Aufgabe', 'offene Aufgaben') : '',
          newInquiries.length ? plural(newInquiries.length, 'neue Anfrage', 'neue Anfragen') : '',
        ].filter(Boolean).join(' · ');
        const subject = `☀️ Dein Tages-Briefing – ${dateLabel}${counts ? ` (${counts})` : ''}`;

        const send = await sendGraphMail({ to: emp.email, toName: emp.name, subject, html });
        if (send.success) {
          result.sent++;
          result.recipients.push(emp.email);
        } else {
          result.errors++;
          console.warn('[daily-briefing] Versand fehlgeschlagen an', emp.email, send.error);
        }
      } catch (e) {
        result.errors++;
        console.warn('[daily-briefing] Fehler für', emp.email, (e as Error).message);
      }
    }

    writeState({
      last_sent_date: now.date,
      last_run_at: new Date().toISOString(),
      last_result: { configured: true, due: true, sent: result.sent, skippedEmpty: result.skippedEmpty, errors: result.errors },
    });
    return result;
  } finally {
    running = false;
  }
}

/** Status für die Admin-UI. */
export function briefingStatus(): { enabled: boolean; hour: number; last_sent_date: string | null; last_run_at: string | null; last_result: BriefingState['last_result'] | null } {
  const m = getSettings().mail;
  const state = readState();
  return {
    enabled: m.daily_briefing_enabled !== false,
    hour: Math.min(23, Math.max(0, Math.round(Number(m.daily_briefing_hour ?? 7)) || 0)),
    last_sent_date: state.last_sent_date || null,
    last_run_at: state.last_run_at || null,
    last_result: state.last_result || null,
  };
}
