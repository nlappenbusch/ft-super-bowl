/**
 * belege/parse.ts — liest aus dem erkannten Text eines Belegs (PDF-Textebene oder OCR)
 * Lieferant, Datum, Betrag, Währung, MWST, Rechnungsnummer und Buchungsbezüge.
 * Reine Logik (Tests: tests/belegeParse.test.ts).
 *
 * Bewusst vorsichtig: lieber ein Feld leer lassen als falsch füllen. Die Sicherheit je Feld
 * (`confidence`) entscheidet, ob danach die KI den Beleg selbst ansieht.
 */

export interface ParsedVat { rate: number; vat: number }

export interface ParsedReceipt {
  supplier: string;
  supplier_vat_id: string;
  country: string;
  receipt_date: string; // YYYY-MM-DD
  invoice_no: string;
  currency: string;
  amount_gross: number;
  vat: ParsedVat[];
  refs: string[];
  confidence: { supplier: number; date: number; amount: number };
  /** Gesamtsicherheit 0..1 (Mittel der Felder). */
  score: number;
}

const CURRENCY_TOKENS: Array<[RegExp, string]> = [
  [/\b(CHF|SFR\.?|Fr\.)(?=[\s\d.,]|$)/gi, 'CHF'],
  [/€|\bEUR\b/gi, 'EUR'],
  [/US\$|\bUSD\b/gi, 'USD'],
  [/£|\bGBP\b/gi, 'GBP'],
  [/\$/g, 'USD'],
];

/** Beträge mit genau zwei Nachkommastellen, Tausender mit ’ ' ´ Leerzeichen . oder , */
const NUM_RE = /(?:\d{1,3}(?:[’'´\s.,]\d{3})+|\d+)[.,]\d{2}(?!\d)/g;

/** "1'234.50", "1.234,50", "1 234,50", "12.50" → 1234.5 */
export function parseAmount(s: string): number | null {
  const m = s.trim().match(/^(.*?)([.,])(\d{2})$/);
  if (!m) return null;
  const whole = m[1].replace(/[’'´\s.,]/g, '');
  if (!/^\d+$/.test(whole)) return null;
  const v = Number(`${whole}.${m[3]}`);
  return Number.isFinite(v) ? v : null;
}

function amountsIn(line: string): number[] {
  const out: number[] = [];
  for (const m of line.matchAll(NUM_RE)) {
    const v = parseAmount(m[0]);
    if (v !== null) out.push(v);
  }
  return out;
}

const TOTAL_STRONG = /(zu\s*zahlen|total\s*(chf|eur|usd|gbp|fr)?|gesamt(betrag|summe)?|endbetrag|rechnungsbetrag|grand\s*total|amount\s*due|total\s*due|balance\s*due|à\s*payer|a\s*payer|totale|betrag\s*(chf|eur)?)\b/i;
const TOTAL_WEAK = /\b(summe|betrag|bar|karte|kartenzahlung|visa|mastercard|maestro|twint|amex|paid|bezahlt)\b/i;
const NOT_TOTAL = /(mwst|mw\.?st|tva|iva|vat|ust|netto|net\b|subtotal|zwischensumme|rückgeld|rueckgeld|change|exkl|excl|trinkgeld|tip\b)/i;

const MONTHS: Record<string, number> = {
  jan: 1, januar: 1, january: 1, janvier: 1,
  feb: 2, februar: 2, february: 2, fevrier: 2, février: 2,
  mar: 3, mär: 3, märz: 3, maerz: 3, march: 3, mars: 3,
  apr: 4, april: 4, avril: 4,
  mai: 5, may: 5,
  jun: 6, juni: 6, june: 6, juin: 6,
  jul: 7, juli: 7, july: 7, juillet: 7,
  aug: 8, august: 8, aout: 8, août: 8,
  sep: 9, sept: 9, september: 9, septembre: 9,
  okt: 10, oct: 10, oktober: 10, october: 10, octobre: 10,
  nov: 11, november: 11, novembre: 11,
  dez: 12, dec: 12, dezember: 12, december: 12, decembre: 12, décembre: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Alle plausiblen Daten im Text (Reihenfolge des Auftretens). */
export function findDates(text: string, today = new Date()): string[] {
  const found: Array<{ at: number; v: string }> = [];
  const push = (at: number, v: string | null) => { if (v) found.push({ at, v }); };
  for (const m of text.matchAll(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})\b/g)) push(m.index ?? 0, iso(+m[3], +m[2], +m[1]));
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(m.index ?? 0, iso(+m[1], +m[2], +m[3]));
  for (const m of text.matchAll(/\b(\d{1,2})\.?\s+([A-Za-zäéû]{3,9})\.?\s+(\d{4})\b/g)) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) push(m.index ?? 0, iso(+m[3], mo, +m[1]));
  }
  for (const m of text.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    const mo = MONTHS[m[1].toLowerCase()];
    if (mo) push(m.index ?? 0, iso(+m[3], mo, +m[2]));
  }
  const max = new Date(today.getTime() + 2 * 86400000).toISOString().slice(0, 10);
  const min = new Date(today.getTime() - 3 * 365 * 86400000).toISOString().slice(0, 10);
  return found.sort((a, b) => a.at - b.at).map((f) => f.v).filter((v) => v <= max && v >= min);
}

function detectCurrency(text: string): string {
  const counts: Record<string, number> = {};
  for (const [re, cur] of CURRENCY_TOKENS) {
    const n = (text.match(re) || []).length;
    if (n) counts[cur] = (counts[cur] || 0) + n;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : '';
}

const COMPANY_HINT = /\b(AG|GmbH|SA|Sàrl|Sarl|Ltd|Limited|Inc|LLC|S\.?p\.?A|S\.?r\.?l|KG|OHG|Hotel|Restaurant|Café|Cafe|Bar|Bistro|Airlines?|Bahn|SBB|Garage|Apotheke|Shop|Store)\b/i;
const NOT_SUPPLIER = /(\brechnung|\binvoice|\bquittung|\breceipt|\bbeleg\b|kassenbon|\bdatum\b|\bdate\b|\btel\b|telefon|\bphone|\bfax\b|www\.|http|@|\bmwst|\bvat\b|\buid\b|che-|\biban\b|\btotal\b|\bsumme\b|\bseite\b|\bpage\b|\bkunde|\bcustomer|\bguest\b|\bgast\b|\btisch\b|\btable\b|bedient|\bkasse\b|\d{2}[./]\d{2}[./]\d{2,4})/i;

function guessSupplier(lines: string[]): { name: string; conf: number } {
  const head = lines.slice(0, 12);
  const withHint = head.find((l) => COMPANY_HINT.test(l) && !NOT_SUPPLIER.test(l) && l.length <= 60);
  if (withHint) return { name: clean(withHint), conf: 0.8 };
  const first = head.find((l) => /[A-Za-zÄÖÜäöü]{3,}/.test(l) && !NOT_SUPPLIER.test(l) && l.length >= 3 && l.length <= 50 && !/^\d/.test(l));
  return first ? { name: clean(first), conf: 0.45 } : { name: '', conf: 0 };
}

function clean(s: string): string {
  return s.replace(/\s{2,}/g, ' ').replace(/^[^A-Za-z0-9ÄÖÜäöü]+|[^A-Za-z0-9ÄÖÜäöü.)]+$/g, '').trim();
}

function guessTotal(lines: string[]): { amount: number; conf: number } {
  // 1) Starke Total-Zeilen (von unten, der letzte Total ist meist der Endbetrag)
  let best: { amount: number; conf: number } | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (!TOTAL_STRONG.test(l) || NOT_TOTAL.test(l)) continue;
    let a = amountsIn(l);
    if (!a.length && lines[i + 1]) a = amountsIn(lines[i + 1]); // Betrag in der Folgezeile
    if (a.length) {
      const v = Math.max(...a);
      if (!best || v > best.amount) best = { amount: v, conf: 0.85 };
    }
  }
  if (best) return best;
  // 2) Schwache Zeilen (Bezahlt mit Karte, Bar …)
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (!TOTAL_WEAK.test(l) || NOT_TOTAL.test(l)) continue;
    const a = amountsIn(l);
    if (a.length) return { amount: Math.max(...a), conf: 0.6 };
  }
  // 3) Grösster Betrag im Beleg
  const all = lines.filter((l) => !NOT_TOTAL.test(l)).flatMap(amountsIn).filter((v) => v < 1_000_000);
  return all.length ? { amount: Math.max(...all), conf: 0.35 } : { amount: 0, conf: 0 };
}

const VAT_LINE = /(mwst|mw\.?st|tva|iva|vat|ust\b|mehrwertsteuer|umsatzsteuer)/i;

function guessVat(lines: string[]): ParsedVat[] {
  const out: ParsedVat[] = [];
  for (const l of lines) {
    if (!VAT_LINE.test(l)) continue;
    const pm = l.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
    if (!pm) continue;
    const rate = Number(pm[1].replace(',', '.'));
    if (!(rate >= 0 && rate <= 27)) continue;
    const amounts = amountsIn(l.replace(pm[0], ' '));
    // Auf MWST-Zeilen steht oft Basis UND Steuer: die kleinere Zahl ist die Steuer.
    const vat = amounts.length ? Math.min(...amounts) : 0;
    if (!out.some((v) => v.rate === rate)) out.push({ rate, vat });
  }
  return out;
}

export function parseReceiptText(text: string, today = new Date()): ParsedReceipt {
  const norm = (text || '').replace(/\r/g, '').replace(/[\t ]/g, ' ');
  const lines = norm.split('\n').map((l) => l.trim()).filter(Boolean);

  const sup = guessSupplier(lines);
  const dates = findDates(norm, today);
  const tot = guessTotal(lines);
  const currency = detectCurrency(norm);

  const che = norm.match(/CHE[-\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}/i)?.[0] || '';
  const de = che ? '' : (norm.match(/\bDE\s?\d{9}\b/)?.[0] || '');
  const atu = che || de ? '' : (norm.match(/\bATU\s?\d{8}\b/)?.[0] || '');
  const fr = che || de || atu ? '' : (norm.match(/\bFR\s?[0-9A-Z]{2}\s?\d{9}\b/)?.[0] || '');
  const vatId = (che || de || atu || fr).replace(/\s+/g, ' ').trim();

  let country = '';
  if (che || /\bCH-\d{4}\b|\bSchweiz\b|\bSwitzerland\b|\bSuisse\b/i.test(norm)) country = 'CH';
  else if (de || /\bDeutschland\b|\bGermany\b|\bD-\d{5}\b/.test(norm)) country = 'DE';
  else if (atu || /\bÖsterreich\b|\bAustria\b/.test(norm)) country = 'AT';
  else if (fr || /\bFrance\b/.test(norm)) country = 'FR';
  else if (/\bUnited Kingdom\b|\bLondon\b|\bVAT Reg/i.test(norm)) country = 'GB';
  else if (/\bUSA\b|\bUnited States\b|, (CA|NY|FL|NV|TX) \d{5}\b/.test(norm)) country = 'US';
  if (!country && currency === 'CHF') country = 'CH';

  const invoice = norm.match(/(?:rechnung|invoice|beleg|quittung|bon|receipt|facture|ticket)\s*(?:nr\.?|no\.?|nummer|number|#|n°)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/.]{2,24})/i)?.[1] || '';

  const refs = Array.from(new Set([
    ...Array.from(norm.matchAll(/\bRQ-\d{3,6}\b/gi), (m) => m[0].toUpperCase()),
    ...Array.from(norm.matchAll(/\bFT-?[A-Z]{0,3}-?\d{4,6}(?:-[A-Z])?\b/g), (m) => m[0].toUpperCase()),
  ]));

  const confidence = {
    supplier: sup.conf,
    date: dates.length ? (dates.length === 1 ? 0.9 : 0.75) : 0,
    amount: tot.conf,
  };
  const score = Math.round(((confidence.supplier + confidence.date + confidence.amount) / 3) * 100) / 100;

  return {
    supplier: sup.name,
    supplier_vat_id: vatId,
    country,
    receipt_date: dates[0] || '',
    invoice_no: invoice,
    currency,
    amount_gross: tot.amount,
    vat: guessVat(lines),
    refs,
    confidence,
    score,
  };
}

/** Reicht das Ergebnis, oder soll die KI den Beleg ansehen? */
export function needsAi(p: ParsedReceipt, textLength: number): boolean {
  if (textLength < 40) return true;
  if (!p.amount_gross || !p.receipt_date || !p.supplier) return true;
  return p.score < 0.7 || p.confidence.amount < 0.6;
}
