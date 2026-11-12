/**
 * mailbox/context.ts — Geschäftskontext zu einer Mail: Kunde(n), Anfragen/Buchungen,
 * Tickets, verknüpfte Objekte und verwandte Mails aus allen eigenen Postfächern.
 */
import { dbAll, dbGet } from '../dbq';
import { getCustomer } from '../customerStore';
import { findBookingByRequestNumber } from '../database';
import { findTaskByTicketNumber, formatTicketNo, listStaffTasks } from '../staffStore';
import type { MailDetail, MailSummary } from './graph';
import { searchMessages } from './graph';
import { ensureMailSchema } from './schema';

export interface ContextCustomer {
  id: string;
  name: string;
  company: string;
  phone: string;
  city: string;
  emails: string[];
  bookings: number;
  booked: number;
  revenue: number;
  url: string;
}

export interface ContextRequest {
  id: string;
  request_number: string;
  booking_number: string;
  title: string;
  status: string;
  start_date: string;
  persons: number;
  total: number;
  email: string;
  created_at: string;
  url: string;
  /** warum angezeigt: 'nummer' (im Text erwähnt) | 'absender' (gleiche Adresse) | 'link' (manuell verknüpft) */
  reason: string;
}

export interface ContextTask {
  id: string;
  ticket: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  url: string;
  reason: string;
}

export interface MailContext {
  customers: ContextCustomer[];
  requests: ContextRequest[];
  tasks: ContextTask[];
  related: MailSummary[];
  /** im Text erkannte Nummern */
  refs: string[];
  links: Array<{ id: string; target_type: string; target_id: string; target_label: string; created_by: string; created_at: string }>;
}

const OWN_DOMAINS = ['faltintravel.com', 'faltin-travel.ch', 'faltintravel.ch'];
const isOwn = (a: string) => OWN_DOMAINS.some((d) => a.toLowerCase().endsWith('@' + d));

const STATUS_LABEL: Record<string, string> = { new: 'Neu', in_progress: 'In Bearbeitung', booked: 'Gebucht', rejected: 'Abgelehnt' };

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
}

export function mailText(m: Pick<MailDetail, 'bodyHtml' | 'bodyIsHtml' | 'subject'>): string {
  return `${m.subject}\n${m.bodyIsHtml ? stripHtml(m.bodyHtml) : m.bodyHtml}`;
}

/** RQ-, TASK- und Buchungsnummern (FT26-0123) aus Betreff + Text. */
export function findRefs(text: string): { rq: string[]; task: number[]; ft: string[] } {
  const uniq = <T,>(a: T[]) => [...new Set(a)];
  return {
    rq: uniq((text.match(/RQ-\d{3,}/gi) || []).map((x) => x.toUpperCase())).slice(0, 8),
    task: uniq((text.match(/TASK-(\d{3,})/gi) || []).map((x) => parseInt(x.slice(5), 10))).slice(0, 8),
    ft: uniq((text.match(/\bFT\d{2}-\d{3,5}\b/gi) || []).map((x) => x.toUpperCase())).slice(0, 8),
  };
}

type ReqRow = { id: string; request_number: string | null; booking_number: string | null; package_title: string | null; status: string; start_date: string | null; number_of_persons: number | null; total_price: number | null; email: string | null; created_at: string; customer_id: string | null };
const REQ_COLS = 'id, request_number, booking_number, package_title, status, start_date, number_of_persons, total_price, email, created_at, customer_id';

function toReq(r: ReqRow, reason: string): ContextRequest {
  return {
    id: r.id,
    request_number: r.request_number || '',
    booking_number: r.booking_number || '',
    title: r.package_title || 'Anfrage',
    status: STATUS_LABEL[r.status] || r.status,
    start_date: r.start_date || '',
    persons: r.number_of_persons || 0,
    total: r.total_price || 0,
    email: r.email || '',
    created_at: r.created_at,
    url: r.request_number ? `/admin/crm?rq=${encodeURIComponent(r.request_number)}` : '/admin/crm',
    reason,
  };
}

export async function buildContext(
  msg: MailDetail,
  opts: { mailboxes: string[]; withRelated?: boolean },
): Promise<MailContext> {
  await ensureMailSchema();
  const text = mailText(msg);
  const refs = findRefs(text);

  // Externe Beteiligte (ohne eigene Adressen und ohne die Postfächer selbst)
  const people = [msg.from, ...msg.to, ...msg.cc, ...msg.replyTo]
    .map((a) => a.address.toLowerCase())
    .filter((a) => a && !isOwn(a) && !opts.mailboxes.includes(a));
  const externals = [...new Set(people)].slice(0, 6);

  const requests = new Map<string, ContextRequest>();
  const customers = new Map<string, ContextCustomer>();

  // 1) Im Text erwähnte Anfragen/Buchungen
  for (const rq of refs.rq) {
    const b = await findBookingByRequestNumber(rq).catch(() => undefined);
    if (b) {
      const row = await dbGet<ReqRow>(`SELECT ${REQ_COLS} FROM booking_requests WHERE id = ?`, [b.id]);
      if (row) requests.set(row.id, toReq(row, 'nummer'));
    }
  }
  for (const ft of refs.ft) {
    const row = await dbGet<ReqRow>(`SELECT ${REQ_COLS} FROM booking_requests WHERE upper(booking_number) = ?`, [ft]);
    if (row) requests.set(row.id, toReq(row, 'nummer'));
  }

  // 2) Kunden + Anfragen über die Absender-/Empfängeradressen
  for (const email of externals) {
    const ce = await dbGet<{ customer_id: string }>(`SELECT customer_id FROM customer_emails WHERE email = ?`, [email]);
    if (ce && !customers.has(ce.customer_id)) {
      const c = await getCustomer(ce.customer_id).catch(() => null);
      if (c) {
        const booked = c.bookings.filter((b) => b.status === 'booked');
        customers.set(c.id, {
          id: c.id,
          name: [c.first_name, c.last_name].filter(Boolean).join(' ') || c.name || email,
          company: c.company || '',
          phone: c.phone || '',
          city: c.city || '',
          emails: c.emails.map((e) => e.email),
          bookings: c.bookings.length,
          booked: booked.length,
          revenue: booked.reduce((s, b) => s + (Number(b.total_price) || 0), 0),
          url: `/admin/kunden/${c.id}`,
        });
      }
    }
    const rows = await dbAll<ReqRow>(
      `SELECT ${REQ_COLS} FROM booking_requests WHERE lower(email) = ? ORDER BY created_at DESC LIMIT 8`, [email],
    );
    for (const r of rows) if (!requests.has(r.id)) requests.set(r.id, toReq(r, 'absender'));
  }
  for (const c of customers.values()) {
    const rows = await dbAll<ReqRow>(`SELECT ${REQ_COLS} FROM booking_requests WHERE customer_id = ? ORDER BY created_at DESC LIMIT 8`, [c.id]);
    for (const r of rows) if (!requests.has(r.id)) requests.set(r.id, toReq(r, 'absender'));
  }

  // 3) Manuelle Verknüpfungen (aus diesem Client angelegt)
  const links = await dbAll<{ id: string; target_type: string; target_id: string; target_label: string; created_by: string; created_at: string }>(
    `SELECT id, target_type, target_id, target_label, created_by, created_at FROM mail_links
     WHERE (mailbox = ? AND message_id = ?) OR (conversation_id <> '' AND conversation_id = ?) OR (internet_message_id <> '' AND internet_message_id = ?)
     ORDER BY created_at DESC`,
    [msg.mailbox, msg.id, msg.conversationId, msg.internetMessageId],
  );
  for (const l of links.filter((x) => x.target_type === 'request')) {
    if (requests.has(l.target_id)) { requests.get(l.target_id)!.reason = 'link'; continue; }
    const row = await dbGet<ReqRow>(`SELECT ${REQ_COLS} FROM booking_requests WHERE id = ?`, [l.target_id]);
    if (row) requests.set(row.id, toReq(row, 'link'));
  }

  // 4) Tickets: erwähnte, verknüpfte und offene Tickets zu den Anfragen
  const tasks = new Map<string, ContextTask>();
  const pushTask = (t: { id: string; ticket_number: number | null; title: string; status: string; priority: string; due_date: string | null }, reason: string) => {
    if (tasks.has(t.id)) return;
    tasks.set(t.id, {
      id: t.id, ticket: formatTicketNo(t.ticket_number), title: t.title, status: t.status, priority: t.priority,
      due_date: t.due_date, url: `/admin/aufgaben?task=${t.id}`, reason,
    });
  };
  for (const n of refs.task) {
    const t = await findTaskByTicketNumber(n).catch(() => null);
    if (t) pushTask(t, 'nummer');
  }
  for (const l of links.filter((x) => x.target_type === 'task')) {
    const t = await dbGet<{ id: string; ticket_number: number | null; title: string; status: string; priority: string; due_date: string | null }>(
      'SELECT id, ticket_number, title, status, priority, due_date FROM staff_tasks WHERE id = ?', [l.target_id]);
    if (t) pushTask(t, 'link');
  }
  for (const r of [...requests.values()].slice(0, 5)) {
    const ts = await listStaffTasks({ booking_id: r.id }).catch(() => []);
    for (const t of ts.filter((x) => x.status !== 'erledigt').slice(0, 5)) pushTask(t, 'anfrage');
  }

  // 5) Verwandte Mails: gleiche Nummern oder gleiche Gegenseite, über alle eigenen Postfächer
  let related: MailSummary[] = [];
  if (opts.withRelated !== false) {
    const queries: string[] = [];
    for (const rq of refs.rq.slice(0, 2)) queries.push(`"${rq}"`);
    if (externals[0]) queries.push(`from:${externals[0]} OR to:${externals[0]}`);
    const seen = new Set<string>([msg.id]);
    const results = await Promise.all(
      opts.mailboxes.slice(0, 8).flatMap((mb) => queries.map((q) => searchMessages(mb, q, 12).catch(() => [] as MailSummary[]))),
    );
    for (const list of results) for (const m of list) {
      const key = `${m.mailbox}|${m.id}`;
      if (seen.has(m.id) || seen.has(key)) continue;
      seen.add(key);
      related.push(m);
    }
    // gleicher Verlauf im selben Postfach zeigt der Lesebereich schon → hier weglassen
    related = related.filter((m) => !(m.mailbox === msg.mailbox && m.conversationId === msg.conversationId))
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 25);
  }

  return {
    customers: [...customers.values()],
    requests: [...requests.values()].sort((a, b) =>
      (a.reason === 'absender' ? 1 : 0) - (b.reason === 'absender' ? 1 : 0) || b.created_at.localeCompare(a.created_at)).slice(0, 12),
    tasks: [...tasks.values()],
    related,
    refs: [...refs.rq, ...refs.ft, ...refs.task.map((n) => formatTicketNo(n))],
    links,
  };
}
