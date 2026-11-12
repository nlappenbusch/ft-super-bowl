/**
 * inquiryStore.ts — Anfragen an Leistungsträger je Kalkulation (Tabelle calc_inquiries).
 * ─────────────────────────────────────────────────────────────────────────────
 * Läuft über `dbq` (SQLite ODER Postgres). Schema: database.initDatabase() bzw.
 * dbq.applyPgSchemaEnhancements(). Jede Änderung von Status/Versand landet im
 * Verlauf (`history`), damit nachvollziehbar bleibt, wer wann was gesendet hat.
 */
import './database';
import { dbAll, dbGet, dbRun } from './dbq';
import { sendGraphMail, getMailbox } from './graphMailer';
import {
  checkSendable, normInquiryStatus, textToHtml,
  type CalcInquiry, type InquiryEvent, type InquiryStatus,
} from './inquiryModel';

interface Row {
  id: string; calc_id: string; created_at: string; updated_at: string;
  supplier: string; category: string; item_id: string; to_addr: string; cc_addr: string;
  subject: string; body: string; internal_note: string; status: string;
  sent_at: string; sent_by: string; sent_from: string; send_error: string;
  history: string; sort: number; created_by: string;
}

function parse(r: Row): CalcInquiry {
  let history: InquiryEvent[] = [];
  try {
    const h = JSON.parse(r.history || '[]');
    if (Array.isArray(h)) history = h.filter((e) => e && typeof e === 'object');
  } catch { /* leer lassen */ }
  return {
    id: r.id, calc_id: r.calc_id, created_at: r.created_at || '', updated_at: r.updated_at || '',
    supplier: r.supplier || '', category: r.category || '', item_id: r.item_id || '',
    to_addr: r.to_addr || '', cc_addr: r.cc_addr || '', subject: r.subject || '', body: r.body || '',
    internal_note: r.internal_note || '', status: normInquiryStatus(r.status),
    sent_at: r.sent_at || '', sent_by: r.sent_by || '', sent_from: r.sent_from || '', send_error: r.send_error || '',
    history, sort: Number(r.sort) || 0, created_by: r.created_by || '',
  };
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const text = (v: unknown, max = 20_000) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').slice(0, max) : '');

export async function listInquiries(calcId: string): Promise<CalcInquiry[]> {
  const rows = await dbAll<Row>(`SELECT * FROM calc_inquiries WHERE calc_id = ? ORDER BY sort ASC, created_at ASC`, [calcId]);
  return rows.map(parse);
}

export async function getInquiry(id: string): Promise<CalcInquiry | null> {
  const r = await dbGet<Row>(`SELECT * FROM calc_inquiries WHERE id = ?`, [id]);
  return r ? parse(r) : null;
}

export interface InquiryInput {
  supplier?: unknown; category?: unknown; item_id?: unknown; to_addr?: unknown; cc_addr?: unknown;
  subject?: unknown; body?: unknown; internal_note?: unknown; status?: unknown;
}

export async function createInquiry(calcId: string, input: InquiryInput, by: string): Promise<CalcInquiry | null> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const max = await dbGet<{ m: number | null }>(`SELECT MAX(sort) AS m FROM calc_inquiries WHERE calc_id = ?`, [calcId]);
  const status = normInquiryStatus(input.status);
  const history: InquiryEvent[] = [{ at: now, by, action: 'angelegt' }];
  if (status !== 'entwurf') history.push({ at: now, by, action: `status:${status}` });
  await dbRun(
    `INSERT INTO calc_inquiries (id, calc_id, created_at, updated_at, supplier, category, item_id, to_addr, cc_addr,
      subject, body, internal_note, status, history, sort, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, calcId, now, now, str(input.supplier), str(input.category, 40), str(input.item_id, 80),
      str(input.to_addr, 1000), str(input.cc_addr, 1000), str(input.subject, 300), text(input.body),
      text(input.internal_note, 5000), status, JSON.stringify(history), (Number(max?.m) || 0) + 1, by]
  );
  return getInquiry(id);
}

/** Felder ändern. Bereits gesendete Anfragen: Text/Empfänger bleiben gesperrt, nur Status und interne Notiz. */
export async function updateInquiry(id: string, input: InquiryInput, by: string): Promise<CalcInquiry | null> {
  const cur = await getInquiry(id);
  if (!cur) return null;
  const locked = !!cur.sent_at;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const set = (col: string, v: unknown) => { sets.push(`${col} = ?`); vals.push(v); };
  if (!locked) {
    if ('supplier' in input) set('supplier', str(input.supplier));
    if ('category' in input) set('category', str(input.category, 40));
    if ('item_id' in input) set('item_id', str(input.item_id, 80));
    if ('to_addr' in input) set('to_addr', str(input.to_addr, 1000));
    if ('cc_addr' in input) set('cc_addr', str(input.cc_addr, 1000));
    if ('subject' in input) set('subject', str(input.subject, 300));
    if ('body' in input) set('body', text(input.body));
  }
  if ('internal_note' in input) set('internal_note', text(input.internal_note, 5000));
  const history = [...cur.history];
  if ('status' in input) {
    const next = normInquiryStatus(input.status);
    // Zurück auf „Entwurf" nur, solange nichts gesendet wurde.
    if (next !== cur.status && !(locked && next === 'entwurf')) {
      set('status', next);
      history.push({ at: new Date().toISOString(), by, action: `status:${next}` });
    }
  }
  if (!sets.length) return cur;
  set('history', JSON.stringify(history.slice(-100)));
  set('updated_at', new Date().toISOString());
  await dbRun(`UPDATE calc_inquiries SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  return getInquiry(id);
}

export async function deleteInquiry(id: string): Promise<boolean> {
  const { changes } = await dbRun(`DELETE FROM calc_inquiries WHERE id = ?`, [id]);
  return changes > 0;
}

/**
 * Anfrage über Microsoft Graph aus dem konfigurierten Postfach senden (wie alle
 * Portal-Mails). Erfolg → Status „gesendet", Zeitpunkt und Absender werden
 * festgehalten, Text und Empfänger danach gesperrt. Fehler → bleibt Entwurf,
 * Fehlertext wird gespeichert.
 */
export async function sendInquiry(id: string, by: string): Promise<{ ok: true; inquiry: CalcInquiry } | { ok: false; error: string; status: number }> {
  const cur = await getInquiry(id);
  if (!cur) return { ok: false, error: 'Anfrage nicht gefunden', status: 404 };
  const check = checkSendable(cur);
  if (!check.ok) return { ok: false, error: check.error, status: 400 };

  const now = new Date().toISOString();
  const res = await sendGraphMail({
    to: check.to[0],
    cc: [...check.to.slice(1), ...check.cc],
    subject: cur.subject.trim(),
    html: textToHtml(cur.body),
    text: cur.body,
  });
  const history = [...cur.history];
  if (!res.success) {
    const err = res.error || 'Versand fehlgeschlagen';
    history.push({ at: now, by, action: 'fehler', note: err.slice(0, 300) });
    await dbRun(`UPDATE calc_inquiries SET send_error = ?, history = ?, updated_at = ? WHERE id = ?`,
      [err.slice(0, 1000), JSON.stringify(history.slice(-100)), now, id]);
    return { ok: false, error: `Versand fehlgeschlagen: ${err}`, status: 502 };
  }
  const from = getMailbox();
  history.push({ at: now, by, action: 'gesendet', note: `von ${from} an ${[...check.to, ...check.cc].join(', ')}` });
  await dbRun(
    `UPDATE calc_inquiries SET status = ?, sent_at = ?, sent_by = ?, sent_from = ?, send_error = '', history = ?, updated_at = ? WHERE id = ?`,
    ['gesendet' as InquiryStatus, now, by, from, JSON.stringify(history.slice(-100)), now, id]
  );
  const inquiry = await getInquiry(id);
  return inquiry ? { ok: true, inquiry } : { ok: false, error: 'Anfrage nach dem Versand nicht mehr gefunden', status: 500 };
}
