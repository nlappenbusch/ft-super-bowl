/**
 * inquiryModel.ts — Anfragen an Leistungsträger je Kalkulation (reine Logik).
 * ─────────────────────────────────────────────────────────────────────────────
 * Client- und serverseitig nutzbar, ohne Imports (läuft auch unter `node --test`).
 * Eine Anfrage ist ein Mail-Entwurf an Hotel, Busunternehmen, Veranstalter usw.,
 * der aus der Kalkulation heraus gesendet und dessen Status nachgeführt wird.
 */

export const INQUIRY_STATUSES = [
  { id: 'entwurf', label: 'Entwurf', tone: 'muted' },
  { id: 'gesendet', label: 'Gesendet', tone: 'info' },
  { id: 'beantwortet', label: 'Antwort erhalten', tone: 'warn' },
  { id: 'angebot', label: 'Angebot erhalten', tone: 'ok' },
  { id: 'abgelehnt', label: 'Abgelehnt / nicht verfügbar', tone: 'danger' },
  { id: 'erledigt', label: 'Erledigt', tone: 'navy' },
  { id: 'ueberholt', label: 'Überholt / nicht senden', tone: 'muted' },
] as const;

export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]['id'];

export function normInquiryStatus(v: unknown): InquiryStatus {
  return INQUIRY_STATUSES.some((s) => s.id === v) ? (v as InquiryStatus) : 'entwurf';
}

export function inquiryStatusLabel(s: string): string {
  return INQUIRY_STATUSES.find((x) => x.id === s)?.label || s;
}

export interface InquiryEvent {
  at: string;
  by: string;
  /** z. B. "angelegt", "gesendet", "status:angebot", "fehler" */
  action: string;
  note?: string;
}

export interface CalcInquiry {
  id: string;
  calc_id: string;
  created_at: string;
  updated_at: string;
  /** Leistungsträger, z. B. "Nikki Beach Marbella" */
  supplier: string;
  /** Kalkulations-Kategorie (hotel, flug, transfer, ticket, extras) — optional */
  category: string;
  /** Zugehörige Kalkulationsposition (optional) */
  item_id: string;
  /** Empfänger, kommagetrennt */
  to_addr: string;
  cc_addr: string;
  subject: string;
  /** Mailtext (Klartext) — wird beim Senden 1:1 verschickt */
  body: string;
  /** Interne Notiz — wird NIE mitgesendet */
  internal_note: string;
  status: InquiryStatus;
  sent_at: string;
  sent_by: string;
  sent_from: string;
  send_error: string;
  history: InquiryEvent[];
  sort: number;
  created_by: string;
}

const EMAIL = /^[^\s@,;<>]+@[^\s@,;<>]+\.[A-Za-z]{2,}$/;

/** "a@x.ch; b@y.de , c@z.com" → bereinigte, eindeutige Liste (ungültige fallen raus). */
export function parseAddressList(v: unknown): string[] {
  const s = Array.isArray(v) ? v.join(',') : typeof v === 'string' ? v : '';
  const out: string[] = [];
  for (const part of s.split(/[,;\s]+/)) {
    const a = part.trim().replace(/^<|>$/g, '').toLowerCase();
    if (a && EMAIL.test(a) && !out.includes(a)) out.push(a);
  }
  return out.slice(0, 20);
}

/** Interne Hinweise im Mailtext erkennen — solche Anfragen dürfen nicht raus. */
export function hasInternalMarker(text: string): boolean {
  return /\[\s*INTERN/i.test(text || '');
}

export type SendCheck = { ok: true; to: string[]; cc: string[] } | { ok: false; error: string };

/** Prüft, ob eine Anfrage versendet werden darf. */
export function checkSendable(i: Pick<CalcInquiry, 'to_addr' | 'cc_addr' | 'subject' | 'body' | 'status'>): SendCheck {
  if (i.status !== 'entwurf') return { ok: false, error: 'Nur Entwürfe können gesendet werden. Für eine weitere Mail die Anfrage duplizieren.' };
  const to = parseAddressList(i.to_addr);
  if (to.length === 0) return { ok: false, error: 'Bitte mindestens einen gültigen Empfänger eintragen.' };
  if (!i.subject.trim()) return { ok: false, error: 'Bitte einen Betreff eintragen.' };
  if (i.body.trim().length < 20) return { ok: false, error: 'Der Mailtext ist zu kurz.' };
  if (hasInternalMarker(i.subject) || hasInternalMarker(i.body)) {
    return { ok: false, error: 'Der Text enthält noch einen [INTERN]-Hinweis. Bitte vor dem Senden entfernen (gehört ins Feld „Interne Notiz").' };
  }
  return { ok: true, to, cc: parseAddressList(i.cc_addr).filter((a) => !to.includes(a)) };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Klartext → schlichtes HTML (Absätze, Zeilenumbrüche, Links klickbar). */
export function textToHtml(text: string): string {
  const paras = (text || '').replace(/\r\n/g, '\n').trim().split(/\n{2,}/);
  const body = paras
    .map((p) => `<p style="margin:0 0 12px 0">${esc(p)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
      .replace(/\n/g, '<br>')}</p>`)
    .join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937">${body}</div>`;
}

/** Status-Zählung für die Übersicht, z. B. { entwurf: 5, gesendet: 2 }. */
export function countByStatus(list: Array<Pick<CalcInquiry, 'status'>>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const i of list) out[i.status] = (out[i.status] || 0) + 1;
  return out;
}
