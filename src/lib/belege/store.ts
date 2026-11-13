/**
 * belege/store.ts — Speicher und Abläufe von Faltin Belege.
 * ─────────────────────────────────────────────────────────────────────────────
 * Ablauf eines Belegs:
 *   eingang     Foto/PDF ist da, Analyse (Textebene/OCR → bei Bedarf KI) füllt Vorschläge
 *   erfasst     Erfasser:in hat bestätigt («Fertig») → wartet auf die Buchhaltung
 *   rueckfrage  Buchhaltung hat eine Frage zurückgeschickt → Erfasser:in ergänzt
 *   freigegeben Buchhaltung hat geprüft (gesperrt; «Freigabe aufheben» nur Prüfende)
 *   verbucht    exportiert an die Buchhaltung (Paul) – endgültig
 *   verworfen   Doppelt/falsch – bleibt im Verlauf
 * Felder, die ein Mensch gesetzt hat (`user_fields`), überschreibt die Analyse nie.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dbAll, dbGet, dbRun } from '../dbq';
import { ensureBelegeSchema } from './schema';
import {
  DEFAULT_GEGENKONTEN, type GegenkontoRegeln, gegenkonto, kategorie, kontoFuerKategorie,
  vorsteuerAbziehbar, vorsteuerKonto, isZahlungsart,
} from './kontenplan';
import {
  type Receipt, type ReceiptStatus, type VatLine, type ReceiptExtraction, type AssocCandidate,
  round2, vatFromGross, totalVat, missingFields, missingForApproval, canEdit, receiptPoints,
  levelFor, badgesFor, streakDays,
} from './model';
import { BELEGE_MAX_FILE_BYTES } from './config';

export const BELEGE_ROOT = path.join(process.cwd(), 'data', 'belege');

export interface BelegeUser { id: string; name: string; email: string; reviewer: boolean }

interface Row {
  [k: string]: unknown;
  id: string; number: string; status: string; source: string;
  created_by: string; created_by_name: string; created_by_email: string;
  file_name: string; file_mime: string; file_size: number; file_hash: string; file_path: string; has_thumb: number;
  receipt_date: string; supplier: string; supplier_vat_id: string; country: string; invoice_no: string;
  description: string; category: string; currency: string; amount_gross: number; vat_lines: string;
  amount_chf: number; fx_rate: number; payment: string; account: string; contra_account: string; vat_account: string;
  event_slug: string; booking_id: string; booking_ref: string; notes: string; ocr_text: string;
  analysis_status: string; analysis_method: string; analysis_error: string; extraction: string; user_fields: string;
  duplicate_of: string; reviewed_by: string; reviewed_by_name: string; reviewed_at: string; review_note: string;
  expense_id: string; exported_at: string; created_at: string; updated_at: string;
}

function parseJson<T>(s: unknown, fallback: T): T {
  if (typeof s !== 'string' || !s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function toReceipt(r: Row): Receipt {
  return {
    id: r.id, number: r.number, status: r.status as ReceiptStatus, source: (r.source || 'handy') as Receipt['source'],
    created_by: r.created_by, created_by_name: r.created_by_name, created_by_email: r.created_by_email,
    file_name: r.file_name, file_mime: r.file_mime, file_size: Number(r.file_size) || 0, file_hash: r.file_hash,
    has_thumb: !!Number(r.has_thumb),
    receipt_date: r.receipt_date, supplier: r.supplier, supplier_vat_id: r.supplier_vat_id, country: r.country,
    invoice_no: r.invoice_no, description: r.description, category: r.category, currency: r.currency,
    amount_gross: Number(r.amount_gross) || 0, vat_lines: parseJson<VatLine[]>(r.vat_lines, []),
    amount_chf: Number(r.amount_chf) || 0, fx_rate: Number(r.fx_rate) || 1, payment: r.payment,
    account: r.account, contra_account: r.contra_account, vat_account: r.vat_account,
    event_slug: r.event_slug, booking_id: r.booking_id, booking_ref: r.booking_ref, notes: r.notes,
    analysis_status: (r.analysis_status || 'offen') as Receipt['analysis_status'], analysis_method: r.analysis_method,
    analysis_error: r.analysis_error, extraction: parseJson<ReceiptExtraction | null>(r.extraction, null),
    duplicate_of: r.duplicate_of, reviewed_by_name: r.reviewed_by_name, reviewed_at: r.reviewed_at,
    review_note: r.review_note, expense_id: r.expense_id, exported_at: r.exported_at,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

const nowIso = () => new Date().toISOString();

// ───────────────────────── Regeln (Gegenkonten) ─────────────────────────

const RULES_FILE = path.join(BELEGE_ROOT, 'regeln.json');

export function getRegeln(): GegenkontoRegeln {
  try {
    const j = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')) as Partial<GegenkontoRegeln>;
    return { ...DEFAULT_GEGENKONTEN, ...j, gesellschafter_emails: (j.gesellschafter_emails || DEFAULT_GEGENKONTEN.gesellschafter_emails).map((e) => e.toLowerCase().trim()).filter(Boolean) };
  } catch {
    return DEFAULT_GEGENKONTEN;
  }
}

export function saveRegeln(r: Partial<GegenkontoRegeln>): GegenkontoRegeln {
  const next = { ...getRegeln(), ...r };
  const clean = (v: unknown, d: string) => (typeof v === 'string' && /^\d{4,6}$/.test(v.trim()) ? v.trim() : d);
  const out: GegenkontoRegeln = {
    firmenkarte: clean(next.firmenkarte, DEFAULT_GEGENKONTEN.firmenkarte),
    bar: clean(next.bar, DEFAULT_GEGENKONTEN.bar),
    privat: clean(next.privat, DEFAULT_GEGENKONTEN.privat),
    privat_gesellschafter: clean(next.privat_gesellschafter, DEFAULT_GEGENKONTEN.privat_gesellschafter),
    gesellschafter_emails: (Array.isArray(next.gesellschafter_emails) ? next.gesellschafter_emails : [])
      .map((e) => String(e).toLowerCase().trim()).filter((e) => e.includes('@')),
  };
  fs.mkdirSync(BELEGE_ROOT, { recursive: true });
  const tmp = `${RULES_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(out, null, 2));
  fs.renameSync(tmp, RULES_FILE);
  return out;
}

// ───────────────────────── Verlauf ─────────────────────────

export async function addLog(receiptId: string, actor: Pick<BelegeUser, 'id' | 'name'> | null, action: string, detail = ''): Promise<void> {
  await dbRun(
    'INSERT INTO bel_log (id, receipt_id, at, actor, actor_name, action, detail) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [crypto.randomUUID(), receiptId, nowIso(), actor?.id || '', actor?.name || 'System', action, detail.slice(0, 2000)],
  );
}

export async function getLog(receiptId: string): Promise<Array<{ at: string; actor_name: string; action: string; detail: string }>> {
  await ensureBelegeSchema();
  return dbAll('SELECT at, actor_name, action, detail FROM bel_log WHERE receipt_id = ? ORDER BY at ASC', [receiptId]);
}

// ───────────────────────── Anlegen ─────────────────────────

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf',
};

async function nextNumber(): Promise<string> {
  const yy = String(new Date().getFullYear()).slice(2);
  const last = await dbGet<{ number: string }>(
    'SELECT number FROM bel_receipts WHERE number LIKE ? ORDER BY number DESC LIMIT 1', [`B${yy}-%`],
  );
  const n = last ? Number(last.number.split('-')[1]) + 1 : 1;
  return `B${yy}-${String(n).padStart(5, '0')}`;
}

export async function createReceipt(opts: {
  user: BelegeUser;
  source: Receipt['source'];
  buffer: Buffer;
  fileName: string;
  mime: string;
}): Promise<Receipt> {
  await ensureBelegeSchema();
  if (!opts.buffer.length) throw new Error('Leere Datei.');
  if (opts.buffer.length > BELEGE_MAX_FILE_BYTES) throw new Error('Datei zu gross (max. 25 MB).');
  const ext = EXT[opts.mime];
  if (!ext) throw new Error('Nur Fotos (JPG, PNG, WebP, HEIC) oder PDF.');

  const id = crypto.randomUUID();
  const hash = crypto.createHash('sha256').update(opts.buffer).digest('hex');
  const year = String(new Date().getFullYear());
  const rel = `${year}/${id}.${ext}`;
  const abs = path.join(/*turbopackIgnore: true*/ BELEGE_ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, opts.buffer);

  let hasThumb = 0;
  if (opts.mime.startsWith('image/')) {
    try {
      const sharp = (await import('sharp')).default;
      await sharp(opts.buffer).rotate().resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 78 }).toFile(path.join(/*turbopackIgnore: true*/ BELEGE_ROOT, year, `${id}.thumb.jpg`));
      hasThumb = 1;
    } catch { /* Vorschau ist optional */ }
  }

  const dup = await dbGet<{ number: string }>(
    "SELECT number FROM bel_receipts WHERE file_hash = ? AND status <> 'verworfen' ORDER BY created_at ASC LIMIT 1", [hash],
  );

  const created = nowIso();
  for (let attempt = 0; attempt < 6; attempt++) {
    const number = await nextNumber();
    try {
      await dbRun(
        `INSERT INTO bel_receipts (id, number, status, source, created_by, created_by_name, created_by_email,
           file_name, file_mime, file_size, file_hash, file_path, has_thumb, duplicate_of, analysis_status,
           created_at, updated_at)
         VALUES (?, ?, 'eingang', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'offen', ?, ?)`,
        [id, number, opts.source, opts.user.id, opts.user.name, opts.user.email.toLowerCase(),
          opts.fileName.slice(0, 200), opts.mime, opts.buffer.length, hash, rel, hasThumb, dup?.number || '', created, created],
      );
      await addLog(id, opts.user, 'Hochgeladen', `${opts.fileName} (${Math.round(opts.buffer.length / 1024)} KB, ${opts.source})${dup ? ` – gleiche Datei wie ${dup.number}` : ''}`);
      const r = await getReceipt(id);
      if (!r) throw new Error('Beleg nach dem Speichern nicht gefunden.');
      return r;
    } catch (e) {
      if (!/unique|UNIQUE|duplicate key/.test(String((e as Error).message))) {
        try { fs.unlinkSync(abs); } catch { /* */ }
        throw e;
      }
    }
  }
  throw new Error('Belegnummer konnte nicht vergeben werden.');
}

// ───────────────────────── Lesen ─────────────────────────

export async function getReceipt(id: string): Promise<Receipt | null> {
  await ensureBelegeSchema();
  const r = await dbGet<Row>('SELECT * FROM bel_receipts WHERE id = ?', [id]);
  return r ? toReceipt(r) : null;
}

async function getRow(id: string): Promise<Row | undefined> {
  await ensureBelegeSchema();
  return dbGet<Row>('SELECT * FROM bel_receipts WHERE id = ?', [id]);
}

export async function getOcrText(id: string): Promise<string> {
  const r = await getRow(id);
  return r?.ocr_text || '';
}

export function canSee(r: Pick<Receipt, 'created_by'>, user: BelegeUser): boolean {
  return user.reviewer || r.created_by === user.id;
}

export async function listReceipts(opts: {
  user: BelegeUser;
  statuses?: ReceiptStatus[];
  mine?: boolean;
  q?: string;
  limit?: number;
}): Promise<Receipt[]> {
  await ensureBelegeSchema();
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.mine || !opts.user.reviewer) { where.push('created_by = ?'); params.push(opts.user.id); }
  if (opts.statuses?.length) {
    where.push(`status IN (${opts.statuses.map(() => '?').join(',')})`);
    params.push(...opts.statuses);
  }
  const q = (opts.q || '').trim().toLowerCase();
  if (q) {
    where.push('(lower(supplier) LIKE ? OR lower(number) LIKE ? OR lower(description) LIKE ? OR lower(created_by_name) LIKE ? OR lower(booking_ref) LIKE ? OR lower(event_slug) LIKE ? OR lower(invoice_no) LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like, like, like);
  }
  const limit = Math.min(Math.max(opts.limit || 200, 1), 1000);
  const rows = await dbAll<Row>(
    `SELECT * FROM bel_receipts ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT ${limit}`,
    params,
  );
  return rows.map(toReceipt);
}

export async function statusCounts(user: BelegeUser, mine: boolean): Promise<Record<string, number>> {
  await ensureBelegeSchema();
  const own = mine || !user.reviewer;
  const rows = await dbAll<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM bel_receipts ${own ? 'WHERE created_by = ?' : ''} GROUP BY status`,
    own ? [user.id] : [],
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.status] = Number(r.n) || 0;
  return out;
}

export function filePath(r: Pick<Row, 'file_path'>, thumb = false): string {
  const rel = thumb ? r.file_path.replace(/\.[a-z]+$/, '.thumb.jpg') : r.file_path;
  const abs = path.resolve(/*turbopackIgnore: true*/ BELEGE_ROOT, rel);
  if (!abs.startsWith(path.resolve(BELEGE_ROOT))) throw new Error('Ungültiger Pfad.');
  return abs;
}

export async function readReceiptFile(id: string, thumb = false): Promise<{ buffer: Buffer; mime: string; name: string } | null> {
  const r = await getRow(id);
  if (!r) return null;
  const useThumb = thumb && !!Number(r.has_thumb);
  try {
    const buffer = fs.readFileSync(filePath(r, useThumb));
    return { buffer, mime: useThumb ? 'image/jpeg' : r.file_mime, name: r.file_name || `${r.number}` };
  } catch {
    return null;
  }
}

// ───────────────────────── Vorschläge aus dem Verlauf ─────────────────────────

export function normSupplier(s: string): string {
  return s.toLowerCase().replace(/\b(ag|gmbh|sa|sàrl|sarl|ltd|inc|llc|kg)\b/g, '').replace(/[^a-z0-9äöüéèà]+/g, ' ').trim();
}

export interface SupplierHistory { supplier: string; count: number; category: string; account: string; payment: string; currency: string; vat_rate: number | null; country: string }

/** Lieferanten aus bisherigen Belegen (für Autovervollständigung + Vorschläge). */
export async function supplierHistory(limit = 300): Promise<SupplierHistory[]> {
  await ensureBelegeSchema();
  const rows = await dbAll<Row>(
    "SELECT supplier, category, account, payment, currency, vat_lines, country, status FROM bel_receipts WHERE supplier <> '' AND status <> 'verworfen' ORDER BY created_at DESC LIMIT 3000",
  );
  const map = new Map<string, { supplier: string; count: number; cat: Map<string, number>; acc: Map<string, number>; pay: Map<string, number>; cur: Map<string, number>; rate: Map<string, number>; land: Map<string, number> }>();
  const bump = (m: Map<string, number>, k: string, w: number) => { if (k) m.set(k, (m.get(k) || 0) + w); };
  for (const r of rows) {
    const key = normSupplier(r.supplier);
    if (!key) continue;
    let e = map.get(key);
    if (!e) { e = { supplier: r.supplier, count: 0, cat: new Map(), acc: new Map(), pay: new Map(), cur: new Map(), rate: new Map(), land: new Map() }; map.set(key, e); }
    // Geprüfte Belege zählen doppelt – die Buchhaltung hat dort das letzte Wort.
    const w = r.status === 'freigegeben' || r.status === 'verbucht' ? 2 : 1;
    e.count++;
    bump(e.cat, r.category, w); bump(e.acc, r.account, w); bump(e.pay, r.payment, w); bump(e.cur, r.currency, w); bump(e.land, r.country, w);
    const lines = parseJson<VatLine[]>(r.vat_lines, []);
    if (lines.length === 1) bump(e.rate, String(lines[0].rate), w);
  }
  const top = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  return Array.from(map.values())
    .map((e) => ({
      supplier: e.supplier, count: e.count, category: top(e.cat), account: top(e.acc), payment: top(e.pay),
      currency: top(e.cur), vat_rate: top(e.rate) ? Number(top(e.rate)) : null, country: top(e.land),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function historyFor(supplier: string): Promise<SupplierHistory | null> {
  const key = normSupplier(supplier);
  if (!key) return null;
  const all = await supplierHistory(1000);
  return all.find((h) => normSupplier(h.supplier) === key)
    || all.find((h) => { const k = normSupplier(h.supplier); return k.length >= 4 && (key.startsWith(k) || k.startsWith(key)); })
    || null;
}

/** Zuletzt benutzte Werte der Person (Zahlungsart, Währung) – als Standard beim nächsten Beleg. */
export async function personDefaults(userId: string): Promise<{ payment: string; currency: string }> {
  await ensureBelegeSchema();
  const rows = await dbAll<{ payment: string; currency: string }>(
    "SELECT payment, currency FROM bel_receipts WHERE created_by = ? AND payment <> '' ORDER BY created_at DESC LIMIT 10", [userId],
  );
  const count = (k: 'payment' | 'currency') => {
    const m = new Map<string, number>();
    for (const r of rows) if (r[k]) m.set(r[k], (m.get(r[k]) || 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  };
  return { payment: count('payment'), currency: count('currency') };
}

// ───────────────────────── Ändern ─────────────────────────

const EDITABLE = [
  'receipt_date', 'supplier', 'supplier_vat_id', 'country', 'invoice_no', 'description', 'category', 'currency',
  'amount_gross', 'vat_lines', 'amount_chf', 'payment', 'account', 'contra_account', 'vat_account',
  'event_slug', 'booking_id', 'booking_ref', 'notes',
] as const;
type EditableField = (typeof EDITABLE)[number];

export type ReceiptPatch = Partial<Record<EditableField, unknown>> & { vat_rate?: number | null };

/** Felder, die nur die Buchhaltung setzen darf. */
const REVIEWER_ONLY: EditableField[] = ['account', 'contra_account', 'vat_account', 'amount_chf'];

function sanitize(field: EditableField, v: unknown): unknown {
  switch (field) {
    case 'amount_gross':
    case 'amount_chf': {
      const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[’' ]/g, '').replace(',', '.'));
      return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? round2(n) : 0;
    }
    case 'vat_lines': {
      const arr = Array.isArray(v) ? v : [];
      return arr.slice(0, 6).map((l) => ({
        rate: round2(Number((l as VatLine).rate) || 0), vat: round2(Number((l as VatLine).vat) || 0), net: round2(Number((l as VatLine).net) || 0),
      }));
    }
    case 'receipt_date': {
      const s = String(v ?? '').slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
    }
    case 'currency': return String(v ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
    case 'country': return String(v ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
    case 'payment': return isZahlungsart(v) ? v : '';
    case 'category': return typeof v === 'string' && kategorie(v).key === v ? v : '';
    case 'account': case 'contra_account': case 'vat_account': return String(v ?? '').replace(/\D/g, '').slice(0, 6);
    case 'notes': case 'description': return String(v ?? '').slice(0, 2000);
    default: return String(v ?? '').trim().slice(0, 200);
  }
}

/**
 * Abgeleitete Felder neu rechnen: Konto aus Kategorie, Gegenkonto aus Zahlungsart,
 * Vorsteuerkonto, MWST-Zeile bei einem Satz, CHF-Betrag. Was ein Mensch gesetzt hat, bleibt.
 */
async function derive(r: Row, userFields: Set<string>): Promise<Partial<Row>> {
  const out: Partial<Row> = {};
  const cur = r.currency || 'CHF';
  if (!userFields.has('account') && r.category) out.account = kontoFuerKategorie(r.category, r.country);
  const account = (out.account ?? r.account) as string;
  if (!userFields.has('contra_account') && r.payment) out.contra_account = gegenkonto(r.payment, cur, r.created_by_email, getRegeln());

  // MWST: genau ein Satz → aus Bruttobetrag rechnen (bleibt stimmig, wenn sich der Betrag ändert)
  const lines = parseJson<VatLine[]>(r.vat_lines, []);
  if (lines.length === 1 && Number(r.amount_gross) > 0) {
    const fresh = vatFromGross(Number(r.amount_gross), lines[0].rate);
    // Vom Beleg übernommener Betrag mit Rundungsdifferenz bleibt, solange er zum Brutto passt.
    const consistent = Math.abs(lines[0].vat + lines[0].net - Number(r.amount_gross)) < 0.01 && Math.abs(fresh.vat - lines[0].vat) <= 0.05;
    if (!consistent && (fresh.vat !== lines[0].vat || fresh.net !== lines[0].net)) {
      if (!userFields.has('vat_lines_exact')) out.vat_lines = JSON.stringify([fresh]);
    }
  }
  const vatTotal = totalVat(parseJson<VatLine[]>((out.vat_lines ?? r.vat_lines) as string, []));
  if (!userFields.has('vat_account')) out.vat_account = vatTotal > 0 && vorsteuerAbziehbar(r.country || (cur === 'CHF' ? 'CH' : '')) ? vorsteuerKonto(account) : '';

  if (!userFields.has('amount_chf')) {
    const gross = Number(r.amount_gross) || 0;
    if (cur === 'CHF') { out.amount_chf = round2(gross); out.fx_rate = 1; }
    else if (gross > 0) {
      try {
        const { getCurrentRates, convertAmount } = await import('../fxRates');
        const snap = await getCurrentRates();
        if (snap) {
          const chf = round2(convertAmount(gross, cur, 'CHF', snap));
          if (chf > 0) { out.amount_chf = chf; out.fx_rate = Math.round((chf / gross) * 1e6) / 1e6; }
        }
      } catch { /* Kurs später */ }
    } else { out.amount_chf = 0; }
  }
  return out;
}

async function writeRow(id: string, set: Partial<Row>): Promise<void> {
  const keys = Object.keys(set);
  if (!keys.length) return;
  await dbRun(
    `UPDATE bel_receipts SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    [...keys.map((k) => set[k] as unknown), nowIso(), id],
  );
}

export async function updateReceipt(id: string, patch: ReceiptPatch, user: BelegeUser | null, opts: { fromAnalysis?: boolean } = {}): Promise<Receipt> {
  const row = await getRow(id);
  if (!row) throw new Error('Beleg nicht gefunden.');
  const r0 = toReceipt(row);
  if (user && !canEdit(r0, user)) throw new Error('Dieser Beleg ist gesperrt (freigegeben oder verbucht).');

  const userFields = new Set(parseJson<string[]>(row.user_fields, []));
  const set: Partial<Row> = {};
  const changed: string[] = [];

  // MWST-Satz als Kurzform: ein Satz → Zeile aus dem Bruttobetrag
  if (patch.vat_rate !== undefined) {
    const gross = Number(sanitize('amount_gross', patch.amount_gross ?? row.amount_gross)) || 0;
    const lines = patch.vat_rate === null ? [] : [vatFromGross(gross, Number(patch.vat_rate) || 0)];
    patch = { ...patch, vat_lines: lines };
    delete patch.vat_rate;
  }

  for (const f of EDITABLE) {
    if (!(f in patch)) continue;
    if (user && REVIEWER_ONLY.includes(f) && !user.reviewer) continue;
    if (opts.fromAnalysis && userFields.has(f)) continue; // Mensch hat Vorrang
    const v = sanitize(f, patch[f]);
    const stored = f === 'vat_lines' ? JSON.stringify(v) : v;
    if (String(stored) !== String(row[f] ?? '')) {
      (set as Record<string, unknown>)[f] = stored;
      changed.push(f);
      if (!opts.fromAnalysis) userFields.add(f);
    }
  }
  // Exakt eingegebene MWST (Desktop, mehrere Sätze) nicht mehr automatisch nachrechnen
  if (!opts.fromAnalysis && changed.includes('vat_lines') && Array.isArray(patch.vat_lines) && (patch.vat_lines as unknown[]).length > 1) userFields.add('vat_lines_exact');
  if (!opts.fromAnalysis && changed.includes('amount_gross')) userFields.delete('vat_lines_exact');
  // Konto zurücksetzen («automatisch»): leerer Wert gibt das Feld wieder frei
  for (const f of ['account', 'contra_account', 'vat_account', 'amount_chf'] as const) {
    if (!opts.fromAnalysis && f in patch && (patch[f] === '' || patch[f] === null)) userFields.delete(f);
  }

  if (!changed.length) return r0;
  set.user_fields = JSON.stringify(Array.from(userFields));
  const merged = { ...row, ...set } as Row;
  Object.assign(set, await derive(merged, userFields));
  await writeRow(id, set);
  if (user && !opts.fromAnalysis) await addLog(id, user, 'Bearbeitet', changed.join(', '));
  return (await getReceipt(id))!;
}

/** Analyse-Ergebnis übernehmen: nur leere, nicht von Menschen gesetzte Felder. */
export async function applyAnalysis(id: string, fields: ReceiptPatch, meta: {
  ocr_text: string; method: string; extraction: ReceiptExtraction; error?: string;
}): Promise<Receipt | null> {
  const row = await getRow(id);
  if (!row) return null;
  const r = toReceipt(row);
  const fill: ReceiptPatch = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !(v > 0) && k !== 'vat_rate')) continue;
    if (k === 'vat_rate') { if (!r.vat_lines.length) fill.vat_rate = v as number; continue; }
    if (k === 'vat_lines') { if (!r.vat_lines.length && Array.isArray(v) && v.length) fill.vat_lines = v; continue; }
    const cur = (r as unknown as Record<string, unknown>)[k];
    if (cur === '' || cur === 0 || cur === null || cur === undefined) (fill as Record<string, unknown>)[k] = v;
  }
  await writeRow(id, {
    ocr_text: meta.ocr_text.slice(0, 20000),
    analysis_status: meta.error ? 'fehler' : 'fertig',
    analysis_method: meta.method,
    analysis_error: meta.error || '',
    extraction: JSON.stringify({ ...meta.extraction, at: nowIso() }),
  });
  if (r.status === 'verbucht' || r.status === 'freigegeben') return getReceipt(id);
  const out = Object.keys(fill).length ? await updateReceipt(id, fill, null, { fromAnalysis: true }) : await getReceipt(id);
  await addLog(id, null, meta.error ? 'Analyse mit Fehler' : 'Analysiert', `${meta.method}${meta.error ? ` – ${meta.error}` : ''}${Object.keys(fill).length ? ` → ${Object.keys(fill).join(', ')}` : ''}`);
  return out;
}

export async function setAnalysisStatus(id: string, status: 'laeuft' | 'fehler' | 'offen', error = ''): Promise<void> {
  await writeRow(id, { analysis_status: status, analysis_error: error });
}

// ───────────────────────── Ablauf (Status) ─────────────────────────

export type ReceiptAction = 'submit' | 'question' | 'approve' | 'reopen' | 'discard' | 'restore';

export async function receiptAction(id: string, action: ReceiptAction, user: BelegeUser, note = ''): Promise<Receipt> {
  const r = await getReceipt(id);
  if (!r) throw new Error('Beleg nicht gefunden.');
  const own = r.created_by === user.id;
  const n = note.trim().slice(0, 1000);

  switch (action) {
    case 'submit': {
      if (!own && !user.reviewer) throw new Error('Nur die erfassende Person kann den Beleg abschliessen.');
      if (!['eingang', 'rueckfrage'].includes(r.status)) throw new Error('Der Beleg ist schon abgeschlossen.');
      const miss = missingFields(r);
      if (miss.length) throw new Error(`Bitte noch ausfüllen: ${miss.join(', ')}.`);
      await writeRow(id, { status: 'erfasst' });
      await addLog(id, user, r.status === 'rueckfrage' ? 'Rückfrage beantwortet' : 'Erfasst', n);
      break;
    }
    case 'question': {
      if (!user.reviewer) throw new Error('Nur die Buchhaltung kann Rückfragen stellen.');
      if (!n) throw new Error('Bitte die Frage kurz notieren.');
      if (!['erfasst', 'eingang'].includes(r.status)) throw new Error('Rückfrage nur bei offenen Belegen.');
      await writeRow(id, { status: 'rueckfrage', review_note: n });
      await addLog(id, user, 'Rückfrage', n);
      break;
    }
    case 'approve': {
      if (!user.reviewer) throw new Error('Nur die Buchhaltung kann freigeben.');
      if (!['erfasst', 'eingang', 'rueckfrage'].includes(r.status)) throw new Error('Der Beleg ist nicht offen.');
      const miss = missingForApproval(r);
      if (miss.length) throw new Error(`Für die Freigabe fehlt: ${miss.join(', ')}.`);
      const expenseId = await linkExpense(r);
      await writeRow(id, { status: 'freigegeben', reviewed_by: user.id, reviewed_by_name: user.name, reviewed_at: nowIso(), expense_id: expenseId });
      await addLog(id, user, 'Freigegeben', n || `${r.account} an ${r.contra_account}, CHF ${r.amount_chf.toFixed(2)}`);
      break;
    }
    case 'reopen': {
      if (!user.reviewer) throw new Error('Nur die Buchhaltung kann eine Freigabe aufheben.');
      if (r.status !== 'freigegeben') throw new Error('Nur freigegebene Belege lassen sich wieder öffnen.');
      if (r.expense_id) await unlinkExpense(r.expense_id);
      await writeRow(id, { status: 'erfasst', reviewed_by: '', reviewed_by_name: '', reviewed_at: '', expense_id: '' });
      await addLog(id, user, 'Freigabe aufgehoben', n);
      break;
    }
    case 'discard': {
      if (!user.reviewer && !(own && ['eingang', 'rueckfrage', 'erfasst'].includes(r.status))) throw new Error('Diesen Beleg kannst du nicht verwerfen.');
      if (r.status === 'verbucht' || r.status === 'freigegeben') throw new Error('Freigegebene Belege zuerst wieder öffnen.');
      await writeRow(id, { status: 'verworfen' });
      await addLog(id, user, 'Verworfen', n);
      break;
    }
    case 'restore': {
      if (r.status !== 'verworfen') throw new Error('Der Beleg ist nicht verworfen.');
      if (!user.reviewer && !own) throw new Error('Keine Berechtigung.');
      await writeRow(id, { status: 'eingang' });
      await addLog(id, user, 'Wiederhergestellt', n);
      break;
    }
    default:
      throw new Error('Unbekannte Aktion.');
  }
  return (await getReceipt(id))!;
}

/** Freigegebener Beleg mit Event/Anfrage → erscheint als Kosten in «Finanzen» (Tabelle expenses). */
async function linkExpense(r: Receipt): Promise<string> {
  if (!r.event_slug && !r.booking_id) return '';
  try {
    const { createExpenseRecord } = await import('../expenseStore');
    const e = await createExpenseRecord({
      expense_date: r.receipt_date || r.created_at.slice(0, 10),
      event_slug: r.event_slug,
      booking_id: r.booking_id,
      category: kategorie(r.category).expense,
      description: `${r.number} ${r.description || kategorie(r.category).label}`.trim(),
      vendor: r.supplier,
      amount: r.amount_chf,
      notes: `Beleg ${r.number}${r.currency !== 'CHF' ? ` (${r.currency} ${r.amount_gross.toFixed(2)})` : ''} – belege.faltintravel.com`,
    });
    return (e as { id?: string })?.id || '';
  } catch (err) {
    console.error('[belege] Kosten konnten nicht verknüpft werden:', err);
    return '';
  }
}

async function unlinkExpense(expenseId: string): Promise<void> {
  try {
    const { deleteExpenseRecord } = await import('../expenseStore');
    await deleteExpenseRecord(expenseId);
  } catch (err) {
    console.error('[belege] Kosten konnten nicht entfernt werden:', err);
  }
}

// ───────────────────────── Zuordnung (Anfragen/Events) ─────────────────────────

interface BookingRow { id: string; request_number: string | null; booking_number: string | null; package_title: string; event_slug: string; travelers: string; email: string; start_date: string }

function travelerName(travelers: string): string {
  try {
    const arr = JSON.parse(travelers) as Array<{ firstName?: string; lastName?: string; first_name?: string; last_name?: string }>;
    const t = Array.isArray(arr) ? arr[0] : null;
    return t ? `${t.firstName || t.first_name || ''} ${t.lastName || t.last_name || ''}`.trim() : '';
  } catch { return ''; }
}

function bookingCandidate(b: BookingRow, reason: string): AssocCandidate {
  const ref = b.request_number || b.booking_number || b.id.slice(0, 8);
  const name = travelerName(b.travelers) || b.email;
  return { kind: 'anfrage', id: b.id, label: `${ref} · ${name}`, sub: b.package_title, event_slug: b.event_slug || '', reason };
}

/** Suche für das Zuordnungsfeld: Anfragen (RQ/FT, Name, Mail) und Events. */
export async function searchAssoc(q: string): Promise<AssocCandidate[]> {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  const like = `%${s}%`;
  const out: AssocCandidate[] = [];
  try {
    const rows = await dbAll<BookingRow>(
      `SELECT id, request_number, booking_number, package_title, event_slug, travelers, email, start_date FROM booking_requests
       WHERE lower(COALESCE(request_number,'')) LIKE ? OR lower(COALESCE(booking_number,'')) LIKE ? OR lower(email) LIKE ? OR lower(travelers) LIKE ? OR lower(package_title) LIKE ?
       ORDER BY created_at DESC LIMIT 12`,
      [like, like, like, like, like],
    );
    out.push(...rows.map((b) => bookingCandidate(b, 'Suche')));
  } catch { /* Tabelle fehlt lokal */ }
  try {
    const { getEvents } = await import('../contentStore');
    for (const e of getEvents()) {
      const hay = `${e.title} ${e.name} ${e.slug} ${e.location_city || ''}`.toLowerCase();
      if (hay.includes(s)) out.push({ kind: 'event', id: e.slug, label: e.title || e.name, sub: [e.start_date?.slice(0, 10), e.location_city].filter(Boolean).join(' · '), event_slug: e.slug, reason: 'Suche' });
      if (out.length > 24) break;
    }
  } catch { /* */ }
  return out;
}

/** Vorschläge zur Zuordnung aus Belegtext und Datum. */
export async function assocCandidates(opts: { refs: string[]; text: string; date: string }): Promise<AssocCandidate[]> {
  const out: AssocCandidate[] = [];
  const seen = new Set<string>();
  const add = (c: AssocCandidate) => { const k = `${c.kind}:${c.id}`; if (!seen.has(k)) { seen.add(k); out.push(c); } };
  for (const ref of opts.refs.slice(0, 5)) {
    try {
      const b = await dbGet<BookingRow>(
        'SELECT id, request_number, booking_number, package_title, event_slug, travelers, email, start_date FROM booking_requests WHERE upper(request_number) = ? OR upper(booking_number) = ? LIMIT 1',
        [ref, ref],
      );
      if (b) add(bookingCandidate(b, `${ref} steht auf dem Beleg`));
    } catch { /* */ }
  }
  try {
    const { getEvents } = await import('../contentStore');
    const text = opts.text.toLowerCase();
    const d = opts.date;
    for (const e of getEvents()) {
      const start = (e.start_date || '').slice(0, 10);
      const end = (e.end_date || e.start_date || '').slice(0, 10);
      if (!start) continue;
      const near = d && Date.parse(d) >= Date.parse(start) - 4 * 86400000 && Date.parse(d) <= Date.parse(end) + 3 * 86400000;
      const city = (e.location_city || '').toLowerCase();
      const named = (city.length > 3 && text.includes(city)) || (e.title && text.includes(e.title.toLowerCase()));
      if (near && (named || !text)) add({ kind: 'event', id: e.slug, label: e.title || e.name, sub: [start, e.location_city].filter(Boolean).join(' · '), event_slug: e.slug, reason: named ? 'Datum und Ort passen' : 'Datum passt' });
      else if (near) add({ kind: 'event', id: e.slug, label: e.title || e.name, sub: [start, e.location_city].filter(Boolean).join(' · '), event_slug: e.slug, reason: 'Datum passt' });
    }
  } catch { /* */ }
  return out.slice(0, 6);
}

export async function bookingLabel(id: string): Promise<string> {
  if (!id) return '';
  try {
    const b = await dbGet<BookingRow>('SELECT id, request_number, booking_number, package_title, event_slug, travelers, email, start_date FROM booking_requests WHERE id = ?', [id]);
    return b ? bookingCandidate(b, '').label : '';
  } catch { return ''; }
}

// ───────────────────────── Punktespiel ─────────────────────────

export interface PlayerStats {
  points: number;
  level: ReturnType<typeof levelFor>;
  streak: number;
  receipts: number;
  today: { count: number; chf: number };
  badges: ReturnType<typeof badgesFor>;
}

export interface LeaderRow { id: string; name: string; points: number; receipts: number; level: string; emoji: string }

export async function playerStats(userId: string): Promise<PlayerStats> {
  await ensureBelegeSchema();
  const rows = (await dbAll<Row>('SELECT * FROM bel_receipts WHERE created_by = ? ORDER BY created_at DESC LIMIT 5000', [userId])).map(toReceipt);
  const today = new Date().toISOString().slice(0, 10);
  const live = rows.filter((r) => r.status !== 'verworfen');
  const points = live.reduce((s, r) => s + receiptPoints(r).total, 0);
  const todays = live.filter((r) => r.created_at.slice(0, 10) === today);
  return {
    points,
    level: levelFor(points),
    streak: streakDays(live.map((r) => r.created_at), today),
    receipts: live.length,
    today: { count: todays.length, chf: round2(todays.reduce((s, r) => s + r.amount_chf, 0)) },
    badges: badgesFor(live, today),
  };
}

/** Rangliste der letzten 30 Tage (Punkte aus den in diesem Zeitraum erfassten Belegen). */
export async function leaderboard(days = 30): Promise<LeaderRow[]> {
  await ensureBelegeSchema();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = (await dbAll<Row>("SELECT * FROM bel_receipts WHERE created_at >= ? AND status <> 'verworfen'", [since])).map(toReceipt);
  const map = new Map<string, LeaderRow>();
  for (const r of rows) {
    const e = map.get(r.created_by) || { id: r.created_by, name: r.created_by_name, points: 0, receipts: 0, level: '', emoji: '' };
    e.points += receiptPoints(r).total;
    e.receipts++;
    map.set(r.created_by, e);
  }
  return Array.from(map.values())
    .map((e) => { const l = levelFor(e.points).level; return { ...e, level: l.name, emoji: l.emoji }; })
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
}

// ───────────────────────── Export an die Buchhaltung ─────────────────────────

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function chf(n: number): string {
  return round2(n).toFixed(2);
}

/**
 * CSV (Semikolon, UTF-8 mit BOM – öffnet sauber in Excel) für den Treuhänder:
 * eine Zeile je Beleg, bei abziehbarer MWST eine zweite Zeile Vorsteuer an Gegenkonto.
 */
export async function exportCsv(opts: { from?: string; to?: string; statuses: ReceiptStatus[]; baseUrl: string }): Promise<{ csv: string; ids: string[] }> {
  await ensureBelegeSchema();
  const where = [`status IN (${opts.statuses.map(() => '?').join(',')})`];
  const params: unknown[] = [...opts.statuses];
  if (opts.from) { where.push('receipt_date >= ?'); params.push(opts.from); }
  if (opts.to) { where.push('receipt_date <= ?'); params.push(opts.to); }
  const rows = (await dbAll<Row>(`SELECT * FROM bel_receipts WHERE ${where.join(' AND ')} ORDER BY receipt_date ASC, number ASC`, params)).map(toReceipt);

  const head = ['Datum', 'Beleg', 'Text', 'Soll', 'Haben', 'Betrag CHF', 'Währung', 'Betrag FW', 'Kurs', 'MWST-Satz', 'MWST CHF', 'Lieferant', 'UID/MWST-Nr', 'Rechnungsnr', 'Event', 'Anfrage', 'Erfasst von', 'Geprüft von', 'Datei'];
  const lines = [head.join(';')];
  for (const r of rows) {
    const vat = totalVat(r.vat_lines);
    const vatChf = r.vat_account ? round2(vat * (r.currency === 'CHF' ? 1 : r.fx_rate)) : 0;
    const text = [r.supplier, r.description || kategorie(r.category).label].filter(Boolean).join(' – ');
    const rates = r.vat_lines.map((l) => `${l.rate}%`).join('/');
    const link = `${opts.baseUrl}/api/admin/belege/${r.id}/datei`;
    const base = [r.receipt_date, r.number, text];
    const tail = [r.supplier, r.supplier_vat_id, r.invoice_no, r.event_slug, r.booking_ref, r.created_by_name, r.reviewed_by_name, link];
    lines.push([...base, r.account, r.contra_account, chf(r.amount_chf - vatChf), r.currency, chf(r.amount_gross), r.fx_rate, rates, chf(vatChf), ...tail].map(csvCell).join(';'));
    if (vatChf > 0) lines.push([...base.slice(0, 2), `Vorsteuer ${rates} – ${text}`, r.vat_account, r.contra_account, chf(vatChf), r.currency, chf(vat), r.fx_rate, rates, chf(vatChf), ...tail].map(csvCell).join(';'));
  }
  return { csv: `﻿${lines.join('\r\n')}\r\n`, ids: rows.map((r) => r.id) };
}

export async function markExported(ids: string[], user: BelegeUser): Promise<number> {
  let n = 0;
  for (const id of ids) {
    const r = await getReceipt(id);
    if (!r || r.status !== 'freigegeben') continue;
    await writeRow(id, { status: 'verbucht', exported_at: nowIso() });
    await addLog(id, user, 'Verbucht (Export)', '');
    n++;
  }
  return n;
}
