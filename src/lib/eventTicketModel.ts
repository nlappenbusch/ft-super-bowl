/**
 * eventTicketModel.ts — E-Tickets für Kund:innen (reine Logik, ohne DB/Netz; Tests in tests/).
 * ─────────────────────────────────────────────────────────────────────────────
 * Ein Datensatz = ein Platz (wie in den Lieferanten-Listen: Kunde, Apple, Android,
 * Area, Row, Seat, E-Mail). Eine Mail fasst alle Plätze eines Empfängers für dasselbe
 * Spiel zusammen und kommt wahlweise im Faltin-Branding oder neutral (White-Label,
 * ohne Logo und Firmenangaben — für Wiederverkäufer, die die Mail weitergeben).
 *
 * Spielangaben (Spiel, Datum, Kickoff, Stadion, …) stehen am Ticket; leere Felder
 * füllt `resolveTicket()` aus dem verknüpften Event (`event_id`).
 */

export type TicketBranding = 'ft' | 'neutral';
export type TicketStatus = 'offen' | 'entwurf' | 'gesendet';

export const TICKET_STATUSES: TicketStatus[] = ['offen', 'entwurf', 'gesendet'];

export interface EventTicket {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  branding: TicketBranding;
  /** Sprache der Mail. */
  lang: MailLang;
  /** Ticketinhaber in der Mail nicht nennen (z. B. Wiederverkäufer). */
  hide_holder: boolean;
  /** Verknüpftes Event aus events.json (optional) — liefert Vorgaben für leere Felder. */
  event_id: string;
  event_title: string;
  /** Paarung, z. B. «New England Patriots vs. Detroit Lions». */
  match_title: string;
  /** YYYY-MM-DD */
  event_date: string;
  /** HH:MM */
  kickoff: string;
  venue: string;
  venue_address: string;
  entrance: string;
  category: string;
  area: string;
  row_no: string;
  seat: string;
  /** Name, wie er in der Lieferantenliste steht, z. B. «Mr. WEEGE, Fredrik». */
  holder_raw: string;
  holder_salutation: '' | 'Herr' | 'Frau';
  holder_first: string;
  holder_last: string;
  recipient_email: string;
  apple_url: string;
  android_url: string;
  booking_ref: string;
  internal_note: string;
  status: TicketStatus;
  draft_mailbox: string;
  draft_web_link: string;
  draft_at: string;
  draft_by: string;
  sort: number;
}

/** Ausschnitt aus ContentEventRecord, den die Tickets brauchen. */
export interface TicketEventSource {
  id: string;
  name?: string | null;
  title?: string | null;
  start_date?: string | null;
  venue?: string | null;
  location_name?: string | null;
  location_city?: string | null;
  spielplan?: Array<{ date?: string; session?: string; matchup?: string; round?: string }> | null;
}

/* ───────────────────────────── Normalisieren ───────────────────────────── */

export function normBranding(v: unknown): TicketBranding {
  const s = String(v ?? '').toLowerCase().trim();
  return s === 'neutral' || s === 'whitelabel' || s === 'white-label' ? 'neutral' : 'ft';
}

export function normStatus(v: unknown): TicketStatus {
  const s = String(v ?? '').toLowerCase().trim();
  return (TICKET_STATUSES as string[]).includes(s) ? (s as TicketStatus) : 'offen';
}

export function normDate(v: unknown): string {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

export function normTime(v: unknown): string {
  const m = /^(\d{1,2})[:.](\d{2})/.exec(String(v ?? '').trim());
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return '';
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export function normEmail(v: unknown): string {
  const s = String(v ?? '').replace(/<mailto:[^>]*>/gi, '').trim().toLowerCase();
  return EMAIL.test(s) ? s : '';
}

/** Nur http(s)-Links, sonst leer. */
export function normUrl(v: unknown): string {
  const s = String(v ?? '').trim();
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : '';
  } catch {
    return '';
  }
}

/* ───────────────────────────── Namen ───────────────────────────── */

const SALUTATIONS: Array<[RegExp, 'Herr' | 'Frau']> = [
  [/^(mr|m|herr|hr|monsieur|sig|signor|sr)\.?$/i, 'Herr'],
  [/^(mrs|ms|miss|frau|fr|mme|madame|sig\.ra|signora|sra)\.?$/i, 'Frau'],
];

function titleCase(s: string): string {
  if (!s) return s;
  // Nur GANZ grossgeschriebene Namen umsetzen («WEEGE» → «Weege»), «McDonald» bleibt.
  if (s !== s.toUpperCase() || s === s.toLowerCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
}

/**
 * «Mr. WEEGE, Fredrik» → Herr / Fredrik / Weege; «M. Faltin, Stefan» → Herr / Stefan / Faltin;
 * «Frau Anna Muster» → Frau / Anna / Muster.
 */
export function parseHolderName(raw: string): { salutation: '' | 'Herr' | 'Frau'; first: string; last: string } {
  let s = String(raw || '').replace(/\s+/g, ' ').trim();
  let salutation: '' | 'Herr' | 'Frau' = '';
  const head = /^(\S+)\s+/.exec(s);
  if (head) {
    for (const [re, sal] of SALUTATIONS) {
      if (re.test(head[1])) { salutation = sal; s = s.slice(head[0].length).trim(); break; }
    }
  }
  let first = '';
  let last = '';
  if (s.includes(',')) {
    const [l, ...rest] = s.split(',');
    last = l.trim();
    first = rest.join(',').trim();
  } else {
    const parts = s.split(' ');
    last = parts.pop() || '';
    first = parts.join(' ');
  }
  return { salutation, first: titleCase(first), last: titleCase(last) };
}

export function holderName(t: Pick<EventTicket, 'holder_first' | 'holder_last' | 'holder_raw'>): string {
  const n = [t.holder_first, t.holder_last].filter(Boolean).join(' ').trim();
  return n || t.holder_raw.trim();
}

/* ───────────────────────────── Import (Tabelle einfügen) ───────────────────────────── */

export interface ImportedTicket {
  holder_raw: string;
  apple_url: string;
  android_url: string;
  area: string;
  row_no: string;
  seat: string;
  recipient_email: string;
}

const HEADER_WORDS = /^(kunde|customer|name|apple|android|area|block|row|reihe|seat|platz|sitz|e-?mail( adresse)?|email address|\[add to apple wallet\])$/i;
const URL_RE = /^https?:\/\/\S+$/i;

/** Wallet-Typ aus dem Link: tmtickets nutzt type=0 (Apple) / type=1 (Android). */
function walletKind(url: string): 'apple' | 'android' | '' {
  const m = /[?&]type=(\d)/.exec(url);
  if (m) return m[1] === '0' ? 'apple' : m[1] === '1' ? 'android' : '';
  if (/pay\.google\.com|android|google/i.test(url)) return 'android';
  if (/pkpass|apple/i.test(url)) return 'apple';
  return '';
}

/**
 * Liest eine eingefügte Lieferantenliste — egal ob als Tabelle (Tabs) oder eine Zelle
 * pro Zeile (so kommt sie aus Outlook als Text). Ein Datensatz beginnt mit einem Namen,
 * auf den ein Link folgt; danach zwei Wallet-Links, Area, Row, Seat und optional E-Mail.
 */
export function parseTicketTable(text: string): ImportedTicket[] {
  const cells = String(text || '')
    .replace(/<mailto:[^>]*>/gi, '')
    .split(/\r?\n|\t/)
    .map((c) => c.trim())
    .filter((c) => c && !HEADER_WORDS.test(c));

  const out: ImportedTicket[] = [];
  let cur: (ImportedTicket & { nums: string[] }) | null = null;
  const flush = () => {
    if (cur && (cur.apple_url || cur.android_url)) {
      const [area = '', row = '', seat = ''] = cur.nums;
      out.push({
        holder_raw: cur.holder_raw, apple_url: cur.apple_url, android_url: cur.android_url,
        area, row_no: row, seat, recipient_email: cur.recipient_email,
      });
    }
    cur = null;
  };

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    const next = cells[i + 1] || '';
    if (URL_RE.test(c)) {
      if (!cur) continue;
      const url = normUrl(c);
      const kind = walletKind(url);
      if (kind === 'apple' && !cur.apple_url) cur.apple_url = url;
      else if (kind === 'android' && !cur.android_url) cur.android_url = url;
      else if (!cur.apple_url) cur.apple_url = url;
      else if (!cur.android_url) cur.android_url = url;
      continue;
    }
    if (EMAIL.test(c.toLowerCase())) {
      if (cur) cur.recipient_email = normEmail(c);
      continue;
    }
    if (URL_RE.test(next) && !/^[\d\s/-]+$/.test(c)) {
      // Name mit folgendem Link → neuer Datensatz
      flush();
      cur = { holder_raw: c, apple_url: '', android_url: '', area: '', row_no: '', seat: '', recipient_email: '', nums: [] };
      continue;
    }
    if (cur && cur.nums.length < 3) cur.nums.push(c);
  }
  flush();
  return out;
}

/* ───────────────────────────── Event-Vorgaben ───────────────────────────── */

const MONTHS: Record<string, number> = {
  januar: 1, jan: 1, january: 1, februar: 2, feb: 2, february: 2, märz: 3, maerz: 3, mar: 3, march: 3,
  april: 4, apr: 4, mai: 5, may: 5, juni: 6, jun: 6, june: 6, juli: 7, jul: 7, july: 7,
  august: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, oct: 10, october: 10,
  november: 11, nov: 11, dezember: 12, dez: 12, dec: 12, december: 12,
};

/** Datum aus Spielplan-Text («So. 15.11.2026», «15. November 2026») → YYYY-MM-DD. */
export function dateFromText(s: string): string {
  const t = String(s || '');
  let m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{1,2})\.?\s+([A-Za-zÄÖÜäöü]+)\.?\s+(\d{4})/.exec(t);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()];
    if (mon) return `${m[3]}-${String(mon).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

/** Vorgaben aus einem Event: Titel, Ort und — bei genau einem Spielplan-Eintrag — Paarung/Datum/Zeit. */
export function eventDefaults(ev: TicketEventSource | null | undefined): Partial<EventTicket> {
  if (!ev) return {};
  const out: Partial<EventTicket> = {};
  const name = String(ev.name || ev.title || '').replace(/\s+(Tickets?\b.*)$/i, '').trim();
  if (name) out.event_title = name;
  const venue = String(ev.venue || ev.location_name || '').trim();
  if (venue) out.venue = venue;
  const city = String(ev.location_city || '').trim();
  if (city) out.venue_address = city;
  const d = normDate(ev.start_date);
  if (d) out.event_date = d;
  const plan = (ev.spielplan || []).filter((p) => p && (p.matchup || p.date));
  if (plan.length === 1) {
    const p = plan[0];
    if (p.matchup && !/\bTBA\b|\bTBD\b/i.test(p.matchup)) out.match_title = p.matchup.trim();
    const pd = dateFromText(p.date || '');
    if (pd) out.event_date = pd;
    const tm = normTime(/(\d{1,2}[:.]\d{2})/.exec(`${p.session || ''} ${p.date || ''}`)?.[1] || '');
    if (tm) out.kickoff = tm;
  }
  return out;
}

const EVENT_FIELDS = ['event_title', 'match_title', 'event_date', 'kickoff', 'venue', 'venue_address'] as const;

/** Leere Spielangaben am Ticket aus dem verknüpften Event füllen (Ticketwerte haben Vorrang). */
export function resolveTicket(t: EventTicket, ev?: TicketEventSource | null): EventTicket {
  const d = eventDefaults(ev);
  const r = { ...t };
  for (const k of EVENT_FIELDS) if (!r[k] && d[k]) (r as Record<string, unknown>)[k] = d[k];
  return r;
}

/* ───────────────────────────── Gruppen (eine Mail je Empfänger + Spiel) ───────────────────────────── */

export function mailGroupKey(t: EventTicket): string {
  const ev = t.event_id || `${t.event_title}|${t.match_title}|${t.event_date}`;
  return `${t.recipient_email || '(ohne E-Mail)'}::${ev}`.toLowerCase();
}

export function groupForMail(tickets: EventTicket[]): Map<string, EventTicket[]> {
  const g = new Map<string, EventTicket[]>();
  for (const t of tickets) {
    const k = mailGroupKey(t);
    if (!g.has(k)) g.set(k, []);
    g.get(k)!.push(t);
  }
  for (const list of g.values()) list.sort(seatOrder);
  return g;
}

const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : NaN);
export function seatOrder(a: EventTicket, b: EventTicket): number {
  const k = (t: EventTicket) => [t.area, t.row_no, t.seat];
  const [x, y] = [k(a), k(b)];
  for (let i = 0; i < 3; i++) {
    const nx = num(x[i]);
    const ny = num(y[i]);
    const c = !Number.isNaN(nx) && !Number.isNaN(ny) ? nx - ny : x[i].localeCompare(y[i], 'de');
    if (c) return c;
  }
  return 0;
}

/** «7, 8, 9, 10» → «7–10»; Lücken bleiben sichtbar: «6, 8–9». */
export function seatRange(seats: string[]): string {
  const ns = seats.map(num);
  if (ns.some((n) => Number.isNaN(n))) return seats.join(', ');
  const sorted = [...new Set(ns)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}–${sorted[j]}` : String(sorted[i]));
    i = j;
  }
  return parts.join(', ');
}

/* ───────────────────────────── Prüfen vor dem Entwurf ───────────────────────────── */

export function checkMailGroup(tickets: EventTicket[]): string[] {
  const errs: string[] = [];
  if (!tickets.length) return ['Keine Tickets ausgewählt.'];
  const keys = new Set(tickets.map(mailGroupKey));
  if (keys.size > 1) errs.push('Eine Mail darf nur Tickets für denselben Empfänger und dasselbe Spiel enthalten.');
  if (!tickets[0].recipient_email) errs.push('Empfänger-E-Mail fehlt.');
  if (new Set(tickets.map((t) => t.branding)).size > 1) errs.push('Die Tickets haben unterschiedliches Branding (FT / White-Label).');
  if (new Set(tickets.map((t) => t.lang || 'de')).size > 1) errs.push('Die Tickets haben unterschiedliche Sprachen.');
  tickets.forEach((t) => {
    const label = `Platz ${t.seat || '?'}`;
    if (!t.apple_url && !t.android_url) errs.push(`${label}: kein Wallet-Link.`);
    if (!t.match_title && !t.event_title) errs.push(`${label}: Spiel fehlt.`);
  });
  return errs;
}

/* ───────────────────────────── Mail ───────────────────────────── */

export interface MailAssets {
  /** Basis für Bilder, z. B. https://next.faltintravel.com (ohne Slash am Ende) oder '' für relative Pfade. */
  base: string;
  /** true: Bilder als eingebettete Anhänge (`cid:`), damit Outlook sie ohne Nachladen zeigt und
   *  im White-Label keine Faltin-Adresse im Quelltext steht. */
  cid?: boolean;
}

/** Bilder, die eine Mail dieses Brandings braucht (liegen unter public/mail/). */
export function mailImages(branding: TicketBranding): string[] {
  const wallet = ['wallet-apple.png', 'wallet-google.png'];
  return branding === 'neutral' ? wallet : ['faltin-logo-weiss.png', 'reisegarantie.png', ...wallet];
}

export const imageCid = (file: string) => `${file.replace(/[^a-z0-9]/gi, '-')}@ticket`;

function imageSrc(assets: MailAssets, file: string): string {
  return assets.cid ? `cid:${imageCid(file)}` : `${assets.base.replace(/\/+$/, '')}/mail/${file}`;
}

export interface RenderOptions {
  assets: MailAssets;
  /** Plätze, deren .pkpass im Anhang liegt (dann erscheint der Hinweis). */
  attachedSeats?: number;
  /** Ticketinhaber nicht nennen (keine Zeile «Ticket auf», neutrale Anrede). */
  hideHolder?: boolean;
  /** Sprache der Mail (Standard Deutsch). */
  lang?: MailLang;
}

export type MailLang = 'de' | 'en';
export function normLang(v: unknown): MailLang {
  return String(v ?? '').trim().toLowerCase().startsWith('en') ? 'en' : 'de';
}

const esc = (s: string) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 2026-11-15 → «Sonntag, 15. November 2026» bzw. «Sunday, 15 November 2026» */
export function longDate(iso: string, lang: MailLang = 'de'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (lang === 'en') return `${EN_WEEKDAYS[d.getUTCDay()]}, ${+m[3]} ${EN_MONTHS[+m[2] - 1]} ${m[1]}`;
  return `${WEEKDAYS[d.getUTCDay()]}, ${+m[3]}. ${MONTH_NAMES[+m[2] - 1]} ${m[1]}`;
}

export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** Ort aus der Adresse: «Werner-Heisenberg-Allee 25, 80939 München» → «München». */
export function cityOf(address: string): string {
  const last = String(address || '').split(',').pop() || '';
  return last.replace(/^\s*[A-Z]{0,2}-?\d{4,5}\s*/, '').trim();
}

const EN_CITIES: Record<string, string> = {
  'München': 'Munich', 'Köln': 'Cologne', 'Zürich': 'Zurich', 'Genf': 'Geneva', 'Wien': 'Vienna', 'Rom': 'Rome', 'Mailand': 'Milan',
};

interface Palette {
  head: string; accent: string; kicker: string; ink: string; text: string; muted: string;
  line: string; tint: string; page: string; foot: string; tileLabel: string;
}

const FT: Palette = {
  head: '#02235e', accent: '#f14624', kicker: '#d63c1c', ink: '#1f2933', text: '#3b4652', muted: '#5b6675',
  line: '#dfe7f3', tint: '#f0f4fa', page: '#f3f6fb', foot: '#e8eef7', tileLabel: '#aebbd4',
};
/** White-Label: Anthrazit + gedämpftes Gold, gehört keiner Marke. Akzentschrift ≥ 4,5 : 1 auf Weiss. */
const NEUTRAL: Palette = {
  head: '#1c2430', accent: '#c9a44c', kicker: '#8a6a1c', ink: '#1c2430', text: '#3d4550', muted: '#5f6873',
  line: '#e3e5e8', tint: '#f4f4f2', page: '#f1f1ef', foot: '#e9e9e6', tileLabel: '#c9b98f',
};

const FONT = "Mulish,'Helvetica Neue',Helvetica,Arial,sans-serif";

export function greeting(t: EventTicket, lang: MailLang = 'de'): string {
  if (lang === 'en') {
    if (t.holder_salutation === 'Herr' && t.holder_last) return `Dear Mr ${t.holder_last}`;
    if (t.holder_salutation === 'Frau' && t.holder_last) return `Dear Ms ${t.holder_last}`;
    return 'Hello';
  }
  if (t.holder_salutation === 'Herr' && t.holder_last) return `Sehr geehrter Herr ${t.holder_last}`;
  if (t.holder_salutation === 'Frau' && t.holder_last) return `Sehr geehrte Frau ${t.holder_last}`;
  return 'Guten Tag';
}

export function mailSubject(tickets: EventTicket[], lang: MailLang = 'de'): string {
  const t = tickets[0];
  const en = lang === 'en';
  const what = [t.event_title, t.match_title].filter(Boolean).join(' – ') || (en ? 'Your event' : 'Ihr Event');
  const when = shortDate(t.event_date);
  const n = tickets.length;
  const lead = en ? (n > 1 ? `Your ${n} tickets` : 'Your ticket') : (n > 1 ? `Ihre ${n} Tickets` : 'Ihr Ticket');
  return `${lead}: ${what}${when ? `, ${when}` : ''}`;
}

/** Alle sichtbaren Texte der Ticketmail je Sprache. */
function texts(lang: MailLang, n: number) {
  const many = n > 1;
  if (lang === 'en') {
    return {
      htmlLang: 'en', block: 'Block', row: 'Row', seat: 'Seat', seats: 'Seats', rows: 'Rows', tickets: 'Tickets',
      kickoff: (k: string) => `Kick-off ${k}`, kickoffFact: (k: string) => k,
      appleTitle: 'Add to Apple Wallet', appleSub: 'iPhone and Apple Watch',
      googleTitle: 'Google Wallet / Android', googleSub: 'Android smartphones',
      preMany: (m: string, d: string) => `Your ${n} tickets for ${m}${d ? ` on ${d}` : ''} – add them to your wallet with one tap.`,
      preOne: (m: string, d: string, a: string, r: string, s: string) => `Your ticket for ${m}${d ? ` on ${d}` : ''} – Block ${a}, Row ${r}, Seat ${s}. Add it to your wallet with one tap.`,
      walletHead: many ? 'Add your tickets to your wallet' : 'Add your ticket to your wallet',
      walletText: `Open this email on your smartphone and tap the matching button.${many ? ' Each seat has its own ticket – add all of them or pass individual tickets on to your companions.' : ''}`,
      ticketLine: (i: number, a: string, r: string, s: string) => `Ticket ${i} · Block ${a} · Row ${r} · Seat ${s}`,
      attached: (k: number) => `For iPhone, ${k > 1 ? 'the tickets are' : 'the ticket is'} also attached as a file (.pkpass) – just tap it and choose «Add».`,
      facts: { match: 'Match', date: 'Date', kickoff: 'Kick-off', venue: 'Stadium', entrance: 'Entrance', category: 'Category', holder: many ? 'Tickets in the name of' : 'Ticket in the name of' },
      intro: (m: string, d: string, c: string) => `${many ? `Here are your ${n} tickets` : 'Here is your ticket'} for ${m}${d ? ` on ${d}` : ''}${c ? ` in ${c}` : ''}.`,
      introRest: `We recommend adding ${many ? 'them' : 'it'} to your smartphone wallet now – that way you will have ${many ? 'them' : 'it'} at hand on match day, even without a network connection.`,
      h1: many ? 'Your tickets are here' : 'Your ticket is here',
      matchday: 'Match day', seatHead: many ? 'Your seats' : 'Your seat', entranceHead: (e: string) => `Entrance ${e}`,
      allDetails: 'All details',
      showCode: (e: string) => `Please show the code directly from your wallet at ${e ? `entrance ${e}` : 'the entrance'} and turn up your screen brightness. If you have any questions or something does not work, just get in touch.`,
      enjoy: 'Enjoy the game!', regards: 'Kind regards', team: 'Your Faltin Travel AG team',
      confidential: 'Please treat this email as confidential: anyone with the wallet buttons or the attachment can add the ticket.',
      confidentialNoFile: 'Please treat this email as confidential: anyone with the wallet buttons can add the ticket.',
      textLine: (i: number | null, a: string, r: string, s: string, e: string) => `${i ? `Ticket ${i}: ` : ''}Block ${a}, Row ${r}, Seat ${s}${e ? `, Entrance ${e}` : ''}`,
      textIntro: (m: string, d: string) => `${many ? `Here are your ${n} tickets` : 'Here is your ticket'} for ${m}${d ? ` on ${d}` : ''}.`,
      guarantee: 'As a member of the Swiss travel industry guarantee fund, customer payments are protected.',
      country: 'Switzerland', phone: 'Phone',
    };
  }
  return {
    htmlLang: 'de', block: 'Block', row: 'Reihe', seat: 'Platz', seats: 'Plätze', rows: 'Reihen', tickets: 'Tickets',
    kickoff: (k: string) => `Kickoff ${k} Uhr`, kickoffFact: (k: string) => `${k} Uhr`,
    appleTitle: 'Zu Apple Wallet hinzufügen', appleSub: 'iPhone und Apple Watch',
    googleTitle: 'Google Wallet / Android', googleSub: 'Android-Smartphones',
    preMany: (m: string, d: string) => `Ihre ${n} Tickets für ${m}${d ? ` am ${d}` : ''} – mit einem Tipp ins Wallet.`,
    preOne: (m: string, d: string, a: string, r: string, s: string) => `Ihr Ticket für ${m}${d ? ` am ${d}` : ''} – Block ${a}, Reihe ${r}, Platz ${s}. Mit einem Tipp ins Wallet.`,
    walletHead: many ? 'Tickets ins Wallet laden' : 'Ticket ins Wallet laden',
    walletText: `Öffnen Sie diese Mail auf dem Smartphone und tippen Sie auf den passenden Knopf.${many ? ' Jeder Platz hat ein eigenes Ticket – laden Sie alle oder geben Sie einzelne an Ihre Begleitung weiter.' : ''}`,
    ticketLine: (i: number, a: string, r: string, s: string) => `Ticket ${i} · Block ${a} · Reihe ${r} · Platz ${s}`,
    attached: (k: number) => `Für iPhone ${k > 1 ? 'liegen die Tickets' : 'liegt das Ticket'} zusätzlich als Datei (.pkpass) im Anhang – einfach antippen und «Hinzufügen» wählen.`,
    facts: { match: 'Spiel', date: 'Datum', kickoff: 'Kickoff', venue: 'Stadion', entrance: 'Eingang', category: 'Kategorie', holder: many ? 'Tickets auf' : 'Ticket auf' },
    intro: (m: string, d: string, c: string) => `${many ? `Hier sind Ihre ${n} Tickets` : 'Hier ist Ihr Ticket'} für ${m}${d ? ` am ${d}` : ''}${c ? ` in ${c}` : ''}.`,
    introRest: `Laden Sie ${many ? 'sie' : 'es'} am besten jetzt schon ins Wallet Ihres Smartphones – dann haben Sie ${many ? 'sie' : 'es'} am Spieltag auch ohne Netz griffbereit.`,
    h1: many ? 'Ihre Tickets sind da' : 'Ihr Ticket ist da',
    matchday: 'Spieltag', seatHead: many ? 'Ihre Sitzplätze' : 'Ihr Sitzplatz', entranceHead: (e: string) => `Eingang ${e}`,
    allDetails: 'Alle Angaben',
    showCode: (e: string) => `Bitte zeigen Sie ${e ? `am Eingang ${e} ` : 'am Eingang '}den Code direkt aus dem Wallet vor und stellen Sie die Bildschirmhelligkeit hoch. Haben Sie Fragen oder klappt etwas nicht, melden Sie sich jederzeit bei uns.`,
    enjoy: 'Wir wünschen Ihnen ein grossartiges Spiel!', regards: 'Freundliche Grüsse', team: 'Ihr Team von Faltin Travel AG',
    confidential: 'Bitte behandeln Sie diese Mail vertraulich: Wer die Wallet-Knöpfe oder den Anhang hat, kann das Ticket laden.',
    confidentialNoFile: 'Bitte behandeln Sie diese Mail vertraulich: Wer die Wallet-Knöpfe hat, kann das Ticket laden.',
    textLine: (i: number | null, a: string, r: string, s: string, e: string) => `${i ? `Ticket ${i}: ` : ''}Block ${a}, Reihe ${r}, Platz ${s}${e ? `, Eingang ${e}` : ''}`,
    textIntro: (m: string, d: string) => `${many ? `Hier sind Ihre ${n} Tickets` : 'Hier ist Ihr Ticket'} für ${m}${d ? ` am ${d}` : ''}.`,
    guarantee: 'Aufgrund unserer Teilnahme am Garantiefonds der Schweizer Reisebranche sind die Kundengelder abgesichert.',
    country: 'Schweiz', phone: 'Tel.',
  };
}
type Texts = ReturnType<typeof texts>;

/** Dateiname des Wallet-Anhangs je Platz. */
export function passFileName(t: EventTicket): string {
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const parts = ['Ticket', slug(t.event_title || t.match_title || 'Event').slice(0, 40)];
  if (t.area) parts.push(`Block${slug(t.area)}`);
  if (t.row_no) parts.push(`Reihe${slug(t.row_no)}`);
  if (t.seat) parts.push(`Platz${slug(t.seat)}`);
  return `${parts.filter(Boolean).join('-')}.pkpass`;
}

function tile(p: Palette, label: string, value: string, last: boolean, small = false): string {
  return `
                      <td width="33%" valign="top" style="width:33%;${last ? '' : 'padding-right:8px;'}">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td align="center" bgcolor="${p.head}" style="background-color:${p.head};border-radius:8px;padding:14px 6px 16px;">
                              <p style="margin:0;font-family:${FONT};font-size:11px;line-height:1.3;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${p.tileLabel};">${esc(label)}</p>
                              <p style="margin:4px 0 0;font-family:${FONT};font-size:${small ? 24 : 34}px;line-height:1.1;font-weight:800;color:#ffffff;mso-line-height-rule:exactly;">${esc(value || '–')}</p>
                            </td>
                          </tr>
                        </table>
                      </td>`;
}

function walletButton(o: {
  href: string; icon: string; alt: string; title: string; sub: string;
  bg: string; fg: string; border: string; subColor: string; compact: boolean;
}): string {
  const size = o.compact ? 32 : 40;
  return `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 ${o.compact ? 8 : 12}px;">
                <tr>
                  <td bgcolor="${o.bg}" style="background-color:${o.bg};border:2px solid ${o.border};border-radius:12px;">
                    <a href="${esc(o.href)}" target="_blank" rel="noopener" style="display:block;text-decoration:none;color:${o.fg};padding:${o.compact ? '10px 14px' : '14px 18px'};">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                        <tr>
                          <td valign="middle" style="padding:0 ${o.compact ? 10 : 14}px 0 0;vertical-align:middle;">
                            <img src="${esc(o.icon)}" width="${size}" height="${size}" alt="${esc(o.alt)}" style="display:block;width:${size}px;height:${size}px;border:0;">
                          </td>
                          <td valign="middle" style="vertical-align:middle;text-align:left;">
                            <span style="display:block;font-family:${FONT};font-size:${o.compact ? 16 : 18}px;line-height:1.25;font-weight:800;color:${o.fg};">${esc(o.title)}</span>
                            <span style="display:block;font-family:${FONT};font-size:13px;line-height:1.35;color:${o.subColor};">${esc(o.sub)}</span>
                          </td>
                        </tr>
                      </table>
                    </a>
                  </td>
                </tr>
              </table>`;
}

function walletButtons(p: Palette, t: EventTicket, assets: MailAssets, compact: boolean, L: Texts): string {
  let h = '';
  if (t.apple_url) {
    h += walletButton({
      href: t.apple_url, icon: imageSrc(assets, 'wallet-apple.png'), alt: 'Apple Wallet', title: L.appleTitle,
      sub: L.appleSub, bg: '#000000', fg: '#ffffff', border: '#000000', subColor: '#c7c7cc', compact,
    });
  }
  if (t.android_url) {
    h += walletButton({
      href: t.android_url, icon: imageSrc(assets, 'wallet-google.png'), alt: 'Google Wallet', title: L.googleTitle,
      sub: L.googleSub, bg: '#ffffff', fg: p.ink, border: p.ink, subColor: p.muted, compact,
    });
  }
  return h;
}

/**
 * HTML-Mail (Tabellen, Inline-CSS, Bilder als gehostete PNGs) für alle Plätze eines
 * Empfängers. Bei einem Platz grosse Knöpfe, bei mehreren eine Karte je Platz.
 */
export function renderTicketMail(input: EventTicket[], opts: RenderOptions): { subject: string; html: string; text: string } {
  const tickets = [...input].sort(seatOrder);
  const t = tickets[0];
  const neutral = t.branding === 'neutral';
  const p = neutral ? NEUTRAL : FT;
  const P = `margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.6;color:${p.text};`;
  const many = tickets.length > 1;
  const lang = opts.lang || t.lang || 'de';
  const hideHolder = opts.hideHolder ?? !!t.hide_holder;
  const L = texts(lang, tickets.length);
  const match = t.match_title || t.event_title;
  const date = longDate(t.event_date, lang);
  const when = [date, t.kickoff ? L.kickoff(t.kickoff) : ''].filter(Boolean).join(' · ');
  const place = [t.venue, t.venue_address].filter(Boolean).join(', ');
  const sameAreaRow = new Set(tickets.map((x) => `${x.area}|${x.row_no}`)).size === 1;
  const subject = mailSubject(tickets, lang);
  const cityDe = cityOf(t.venue_address);
  const city = lang === 'en' ? (EN_CITIES[cityDe] || cityDe) : cityDe;
  const salute = hideHolder ? greeting({ ...t, holder_salutation: '', holder_last: '' }, lang) : greeting(t, lang);
  const kicker = neutral
    ? [city || t.venue, date.replace(/^\S+, /, '')].filter(Boolean).join(' · ')
    : [t.event_title, city].filter(Boolean).join(' · ');

  const preheader = many
    ? L.preMany(match, shortDate(t.event_date))
    : L.preOne(match, shortDate(t.event_date), t.area, t.row_no, t.seat);

  const head = neutral
    ? `<p style="margin:0;font-family:${FONT};font-size:11px;line-height:1.4;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:${p.accent};">E-Ticket</p>
              <p style="margin:4px 0 0;font-family:${FONT};font-size:24px;line-height:1.2;font-weight:800;letter-spacing:0.02em;color:#ffffff;mso-line-height-rule:exactly;">${esc(t.event_title || match)}</p>`
    : `<a href="https://www.faltintravel.com" target="_blank" rel="noopener" style="text-decoration:none;color:#ffffff;">
                <img src="${esc(imageSrc(opts.assets, 'faltin-logo-weiss.png'))}" width="180" height="57" alt="Faltin Travel"
                     style="display:block;width:180px;max-width:100%;height:auto;border:0;font-family:${FONT};font-size:24px;line-height:57px;font-weight:bold;color:#ffffff;">
              </a>`;

  // Sitzplatz-Kacheln
  let seats: string;
  if (!many) {
    seats = `${tile(p, L.block, t.area, false)}${tile(p, L.row, t.row_no, false)}${tile(p, L.seat, t.seat, true)}`;
  } else if (sameAreaRow) {
    seats = `${tile(p, L.block, t.area, false)}${tile(p, L.row, t.row_no, false)}${tile(p, L.seats, seatRange(tickets.map((x) => x.seat)), true, true)}`;
  } else {
    seats = `${tile(p, L.tickets, String(tickets.length), false)}${tile(p, L.block, [...new Set(tickets.map((x) => x.area))].join(', '), false, true)}${tile(p, L.rows, [...new Set(tickets.map((x) => x.row_no))].join(', '), true, true)}`;
  }

  // Wallet-Bereich
  let wallet = `
              <p style="margin:0 0 6px;font-family:${FONT};font-size:18px;line-height:1.3;font-weight:800;color:${p.head};">${esc(L.walletHead)}</p>
              <p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.5;color:${p.text};">${esc(L.walletText)}</p>`;
  if (!many) {
    wallet += walletButtons(p, t, opts.assets, false, L);
  } else {
    tickets.forEach((x, i) => {
      wallet += `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 14px;">
                <tr>
                  <td style="border:1px solid ${p.line};border-radius:12px;padding:14px 14px 6px;">
                    <p style="margin:0 0 10px;font-family:${FONT};font-size:15px;line-height:1.4;font-weight:800;color:${p.ink};">${esc(L.ticketLine(i + 1, x.area || '–', x.row_no || '–', x.seat || '–'))}</p>
${walletButtons(p, x, opts.assets, true, L)}
                  </td>
                </tr>
              </table>`;
    });
  }
  if (opts.attachedSeats) {
    wallet += `
              <p style="margin:4px 0 26px;font-family:${FONT};font-size:13px;line-height:1.55;color:${p.muted};">${esc(L.attached(opts.attachedSeats))}</p>`;
  } else {
    wallet += `<div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>`;
  }

  // Alle Angaben
  const facts: Array<[string, string]> = [];
  if (match) facts.push([L.facts.match, esc(match)]);
  if (date) facts.push([L.facts.date, esc(date)]);
  if (t.kickoff) facts.push([L.facts.kickoff, esc(L.kickoffFact(t.kickoff))]);
  if (t.venue || t.venue_address) {
    facts.push([L.facts.venue, `${esc(t.venue)}${t.venue_address ? `<br><span style="font-weight:400;color:${p.muted};">${esc(t.venue_address)}</span>` : ''}`]);
  }
  if (t.entrance) facts.push([L.facts.entrance, esc(t.entrance)]);
  if (t.category) facts.push([L.facts.category, esc(t.category)]);
  const name = hideHolder ? '' : holderName(t);
  if (name) facts.push([L.facts.holder, esc(name)]);
  const factRows = facts.map(([label, value], i) => {
    const rule = i === 0 ? '' : `border-top:1px solid ${p.line};`;
    return `
                <tr>
                  <td width="32%" valign="top" style="${rule}padding:11px 12px 11px 0;font-family:${FONT};font-size:14px;line-height:1.45;color:${p.muted};vertical-align:top;">${esc(label)}</td>
                  <td valign="top" style="${rule}padding:11px 0;font-family:${FONT};font-size:15px;line-height:1.45;font-weight:700;color:${p.ink};vertical-align:top;">${value}</td>
                </tr>`;
  }).join('');

  const intro = L.intro(`<strong style="color:${p.ink};">${esc(match)}</strong>`, esc(date), esc(city));

  const sign = neutral ? '' : `<br>
                <strong style="color:${p.head};">${esc(L.team)}</strong>`;

  const footer = neutral
    ? `<p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${p.muted};">${esc(opts.attachedSeats ? L.confidential : L.confidentialNoFile)}</p>`
    : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="144" valign="middle" style="width:144px;padding:0 16px 0 0;vertical-align:middle;">
                    <img src="${esc(imageSrc(opts.assets, 'reisegarantie.png'))}" width="128" height="44" alt="Reisegarantie" style="display:block;width:128px;height:auto;border:0;border-radius:6px;">
                  </td>
                  <td valign="middle" style="vertical-align:middle;font-family:${FONT};font-size:13px;line-height:1.6;color:${p.muted};">
                    ${esc(L.guarantee)}
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;padding:16px 0 0;border-top:1px solid #d3dcea;font-family:${FONT};font-size:13px;line-height:1.6;color:${p.muted};">
                <strong style="color:${p.head};">Faltin Travel AG</strong><br>
                Riedthofstrasse 172, 8105 Regensdorf, ${L.country}<br>
                ${L.phone}: <a href="tel:+41447002277" style="color:${p.head};text-decoration:none;">+41 44 700 22 77</a>
                &nbsp;·&nbsp; <a href="mailto:kontakt@faltintravel.com" style="color:${p.head};text-decoration:none;">kontakt@faltintravel.com</a><br>
                <a href="https://www.faltintravel.com" target="_blank" rel="noopener" style="color:${p.head};text-decoration:none;">www.faltintravel.com</a>
                &nbsp;·&nbsp; UID: CHE-267.347.685
              </p>`;

  const html = `<!DOCTYPE html>
<html lang="${L.htmlLang}" dir="ltr" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <style>table, td, p, a, h1, span, strong { font-family: Arial, Helvetica, sans-serif !important; }</style>
  <![endif]-->
  <style>
    :root { color-scheme: light; supported-color-schemes: light; }
    body { margin: 0 !important; padding: 0 !important; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { -ms-interpolation-mode: bicubic; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    @media only screen and (max-width: 620px) {
      .ft-shell { padding: 0 !important; }
      .ft-head { padding: 22px 24px !important; border-radius: 0 !important; }
      .ft-pad { padding-left: 22px !important; padding-right: 22px !important; }
      .ft-foot { border-radius: 0 !important; }
      .ft-h1 { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${p.page};">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${p.page}" style="background-color:${p.page};">
    <tr>
      <td class="ft-shell" align="center" style="padding:32px 12px;">
        <!--[if mso]><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;border-collapse:separate;">
          <tr>
            <td class="ft-head" bgcolor="${p.head}" style="background-color:${p.head};padding:26px 40px;border-radius:10px 10px 0 0;">
              ${head}
            </td>
          </tr>
          <tr>
            <td height="4" bgcolor="${p.accent}" style="background-color:${p.accent};height:4px;font-size:0;line-height:0;mso-line-height-rule:exactly;">&nbsp;</td>
          </tr>
          <tr>
            <td class="ft-pad" bgcolor="#ffffff" style="background-color:#ffffff;padding:34px 40px 36px;font-family:${FONT};font-size:16px;line-height:1.6;color:${p.text};">
              ${kicker ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${p.kicker};">${esc(kicker)}</p>` : ''}
              <h1 class="ft-h1" style="margin:0 0 22px;font-family:${FONT};font-size:28px;line-height:1.2;font-weight:800;color:${p.head};mso-line-height-rule:exactly;">${esc(L.h1)}</h1>
              <p style="${P}">${esc(salute)}</p>
              <p style="${P}">${intro} ${esc(L.introRest)}</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 22px;">
                <tr>
                  <td bgcolor="${p.tint}" style="background-color:${p.tint};border-left:4px solid ${p.accent};border-radius:0 8px 8px 0;padding:18px 20px;">
                    <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${p.muted};">${esc(L.matchday)}</p>
                    <p style="margin:0;font-family:${FONT};font-size:20px;line-height:1.3;font-weight:800;color:${p.head};">${esc(match)}</p>
                    ${when || place ? `<p style="margin:6px 0 0;font-family:${FONT};font-size:15px;line-height:1.5;color:${p.ink};">${esc(when)}${when && place ? '<br>' : ''}${esc(place)}</p>` : ''}
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${p.head};">${esc(L.seatHead)}${t.entrance ? ` · ${esc(L.entranceHead(t.entrance))}` : ''}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 26px;">
                <tr>${seats}
                </tr>
              </table>
${wallet}
              <p style="margin:0 0 4px;font-family:${FONT};font-size:12px;line-height:1.4;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${p.head};">${esc(L.allDetails)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">${factRows}
              </table>

              <p style="${P}">${esc(L.showCode(t.entrance))}</p>
              <p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.6;color:${p.text};">${esc(L.enjoy)}</p>
              <p style="margin:28px 0 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${p.text};">
                ${esc(L.regards)}${sign}
              </p>
            </td>
          </tr>
          <tr>
            <td class="ft-pad ft-foot" bgcolor="${p.foot}" style="background-color:${p.foot};padding:24px 40px 28px;border-radius:0 0 10px 10px;">
              ${footer}
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Textfassung
  const lines = [
    salute, '',
    L.textIntro(match, date),
    [when, place].filter(Boolean).join(' – '), '',
  ];
  tickets.forEach((x, i) => {
    lines.push(L.textLine(many ? i + 1 : null, x.area || '–', x.row_no || '–', x.seat || '–', x.entrance || t.entrance));
    if (x.apple_url) lines.push(`  Apple Wallet (iPhone): ${x.apple_url}`);
    if (x.android_url) lines.push(`  Google Wallet (Android): ${x.android_url}`);
  });
  lines.push('', L.enjoy, '', L.regards);
  if (!neutral) lines.push(L.team, '', `Faltin Travel AG, Riedthofstrasse 172, 8105 Regensdorf, ${L.country}`, `${L.phone} +41 44 700 22 77 · kontakt@faltintravel.com · www.faltintravel.com`);

  return { subject, html, text: lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n') };
}
