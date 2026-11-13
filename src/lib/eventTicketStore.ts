/**
 * eventTicketStore.ts — E-Tickets für Kund:innen (Tabelle event_tickets).
 * ─────────────────────────────────────────────────────────────────────────────
 * Läuft über `dbq` (SQLite ODER Postgres). Schema: database.initDatabase() bzw.
 * dbq.applyPgSchemaEnhancements(). Reine Logik (Import, Mail) in eventTicketModel.ts.
 */
import './database';
import { dbAll, dbGet, dbRun } from './dbq';
import {
  normBranding, normLang, normStatus, normDate, normTime, normEmail, normUrl, parseHolderName,
  type EventTicket,
} from './eventTicketModel';

type Row = Record<keyof EventTicket, string | number | null>;

const TEXT_FIELDS = [
  'created_at', 'updated_at', 'created_by', 'event_id', 'event_title', 'match_title', 'event_date', 'kickoff',
  'venue', 'venue_address', 'entrance', 'category', 'area', 'row_no', 'seat', 'holder_raw', 'holder_first',
  'holder_last', 'recipient_email', 'apple_url', 'android_url', 'booking_ref', 'internal_note',
  'draft_mailbox', 'draft_web_link', 'draft_at', 'draft_by',
] as const;

function parse(r: Row): EventTicket {
  const t = { id: String(r.id) } as EventTicket;
  for (const k of TEXT_FIELDS) (t as unknown as Record<string, string>)[k] = String(r[k] ?? '');
  t.branding = normBranding(r.branding);
  t.lang = normLang(r.lang);
  t.hide_holder = Number(r.hide_holder) === 1;
  t.status = normStatus(r.status);
  const sal = String(r.holder_salutation ?? '');
  t.holder_salutation = sal === 'Herr' || sal === 'Frau' ? sal : '';
  t.sort = Number(r.sort) || 0;
  return t;
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');

/** Eingaben bereinigen. Nur Felder, die im Input stehen, kommen zurück (für PATCH). */
export function cleanTicketInput(input: Record<string, unknown>): Partial<EventTicket> {
  const out: Partial<EventTicket> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  if (has('branding')) out.branding = normBranding(input.branding);
  if (has('status')) out.status = normStatus(input.status);
  if (has('lang')) out.lang = normLang(input.lang);
  if (has('hide_holder')) out.hide_holder = input.hide_holder === true || input.hide_holder === 1 || input.hide_holder === '1' || input.hide_holder === 'true';
  if (has('event_date')) out.event_date = normDate(input.event_date);
  if (has('kickoff')) out.kickoff = normTime(input.kickoff);
  if (has('recipient_email')) out.recipient_email = normEmail(input.recipient_email);
  if (has('apple_url')) out.apple_url = normUrl(input.apple_url);
  if (has('android_url')) out.android_url = normUrl(input.android_url);
  if (has('holder_salutation')) {
    const s = str(input.holder_salutation);
    out.holder_salutation = s === 'Herr' || s === 'Frau' ? s : '';
  }
  for (const k of ['event_id', 'event_title', 'match_title', 'venue', 'venue_address', 'entrance', 'category',
    'area', 'row_no', 'seat', 'holder_raw', 'holder_first', 'holder_last', 'booking_ref'] as const) {
    if (has(k)) (out as Record<string, string>)[k] = str(input[k], k === 'venue_address' ? 300 : 200);
  }
  if (has('internal_note')) out.internal_note = typeof input.internal_note === 'string' ? input.internal_note.slice(0, 5000) : '';
  // Name aus der Lieferantenliste zerlegen, wenn Vor-/Nachname fehlen
  if (out.holder_raw && !has('holder_first') && !has('holder_last')) {
    const n = parseHolderName(out.holder_raw);
    out.holder_first = n.first;
    out.holder_last = n.last;
    if (!has('holder_salutation')) out.holder_salutation = n.salutation;
  }
  return out;
}

export async function listTickets(): Promise<EventTicket[]> {
  const rows = await dbAll<Row>(`SELECT * FROM event_tickets ORDER BY event_date DESC, created_at ASC, sort ASC`);
  return rows.map(parse);
}

export async function getTicket(id: string): Promise<EventTicket | null> {
  const r = await dbGet<Row>(`SELECT * FROM event_tickets WHERE id = ?`, [id]);
  return r ? parse(r) : null;
}

export async function getTickets(ids: string[]): Promise<EventTicket[]> {
  const out: EventTicket[] = [];
  for (const id of [...new Set(ids)].slice(0, 100)) {
    const t = await getTicket(id);
    if (t) out.push(t);
  }
  return out;
}

const COLS = ['branding', 'lang', 'hide_holder', 'status', 'holder_salutation', 'sort', ...TEXT_FIELDS] as const;

export async function createTicket(input: Record<string, unknown>, by: string): Promise<EventTicket | null> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const clean = cleanTicketInput(input);
  const max = await dbGet<{ m: number | null }>(`SELECT MAX(sort) AS m FROM event_tickets`);
  const t: Record<string, string | number> = {};
  for (const k of TEXT_FIELDS) t[k] = '';
  Object.assign(t, clean, {
    created_at: now, updated_at: now, created_by: by, draft_mailbox: '', draft_web_link: '', draft_at: '', draft_by: '',
    branding: clean.branding || 'ft', lang: clean.lang || 'de', hide_holder: clean.hide_holder ? 1 : 0, status: 'offen', holder_salutation: clean.holder_salutation || '',
    sort: (Number(max?.m) || 0) + 1,
  });
  await dbRun(
    `INSERT INTO event_tickets (id, ${COLS.join(', ')}) VALUES (?, ${COLS.map(() => '?').join(', ')})`,
    [id, ...COLS.map((k) => t[k] ?? '')],
  );
  return getTicket(id);
}

export async function updateTicket(id: string, input: Record<string, unknown>): Promise<EventTicket | null> {
  const cur = await getTicket(id);
  if (!cur) return null;
  const clean = cleanTicketInput(input);
  const keys = Object.keys(clean) as Array<keyof EventTicket>;
  if (!keys.length) return cur;
  const now = new Date().toISOString();
  await dbRun(
    `UPDATE event_tickets SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    [...keys.map((k) => (typeof clean[k] === 'boolean' ? (clean[k] ? 1 : 0) : clean[k] as string)), now, id],
  );
  return getTicket(id);
}

export async function deleteTicket(id: string): Promise<boolean> {
  const cur = await getTicket(id);
  if (!cur) return false;
  await dbRun(`DELETE FROM event_tickets WHERE id = ?`, [id]);
  return true;
}

/** Nach dem Anlegen des Outlook-Entwurfs: Postfach, Link und Status merken. */
export async function markDrafted(ids: string[], info: { mailbox: string; webLink: string; by: string }): Promise<void> {
  const now = new Date().toISOString();
  for (const id of ids) {
    await dbRun(
      `UPDATE event_tickets SET status = 'entwurf', draft_mailbox = ?, draft_web_link = ?, draft_at = ?, draft_by = ?, updated_at = ? WHERE id = ? AND status <> 'gesendet'`,
      [info.mailbox, info.webLink, now, info.by, now, id],
    );
  }
}
