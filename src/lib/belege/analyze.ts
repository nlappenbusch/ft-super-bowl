/**
 * belege/analyze.ts — Eingangsverarbeitung eines Belegs (läuft im Hintergrund nach dem Upload):
 *   1. Text holen: PDF-Textebene bzw. OCR (lokal, ohne KI)
 *   2. Text auswerten (parse.ts) + Lieferanten-Verlauf (wie wurde dieser Lieferant bisher kontiert?)
 *   3. Reicht das nicht (Betrag/Datum/Lieferant fehlen oder unsicher) → KI liest den Beleg selbst
 *   4. Vorschläge in leere Felder übernehmen, Zuordnung zu Anfrage/Event vorschlagen
 * Der Client fragt den Beleg solange ab, bis `analysis_status` fertig/fehler ist.
 */
import fs from 'node:fs';
import {
  applyAnalysis, assocCandidates, filePath, getReceipt, historyFor, personDefaults, setAnalysisStatus,
  type ReceiptPatch,
} from './store';
import { dbGet } from '../dbq';
import { extractText } from './ocr';
import { parseReceiptText, needsAi } from './parse';
import { aiReadReceipt, isBelegeAiConfigured, type AiReceipt } from './ai';
import { kategorieAusText, kategorie } from './kontenplan';
import { round2, type ReceiptSuggestion } from './model';

const running = new Map<string, Promise<void>>();

/** Analyse starten (nicht warten). Doppelte Starts für denselben Beleg werden zusammengelegt. */
export function startAnalysis(id: string, opts: { forceAi?: boolean } = {}): Promise<void> {
  const existing = running.get(id);
  if (existing) return existing;
  const p = analyze(id, opts)
    .catch(async (e) => {
      console.error('[belege] Analyse fehlgeschlagen:', id, e);
      await setAnalysisStatus(id, 'fehler', String((e as Error)?.message || e).slice(0, 300)).catch(() => {});
    })
    .finally(() => running.delete(id));
  running.set(id, p);
  return p;
}

async function analyze(id: string, opts: { forceAi?: boolean }): Promise<void> {
  const r = await getReceipt(id);
  if (!r) return;
  await setAnalysisStatus(id, 'laeuft');
  const row = await dbGet<{ file_path: string }>('SELECT file_path FROM bel_receipts WHERE id = ?', [id]);
  if (!row) return;
  const buffer = fs.readFileSync(filePath(row));

  // 1) Text
  const ocr = await extractText(buffer, r.file_mime);
  const parsed = parseReceiptText(ocr.text);

  // 2) KI, wenn nötig (oder auf Wunsch)
  let ai: AiReceipt | null = null;
  let aiReason = '';
  let aiError = '';
  const want = opts.forceAi || needsAi(parsed, ocr.text.length) || (ocr.method === 'ocr' && ocr.confidence < 65);
  if (want) {
    aiReason = opts.forceAi ? 'auf Wunsch' : ocr.text.length < 40 ? 'kein lesbarer Text' : 'Text unsicher';
    if (isBelegeAiConfigured()) {
      try {
        ai = await aiReadReceipt({ buffer, mime: r.file_mime, ocrText: ocr.text });
      } catch (e) {
        aiError = (e as Error).message;
      }
    } else {
      aiError = 'KI nicht eingerichtet (Anthropic-Key fehlt)';
    }
  }

  // 3) Felder zusammenführen: KI (wenn gelesen) vor Textauswertung
  const useAi = ai && ai.readable;
  const pick = <T,>(aiV: T | undefined, pV: T): T => (useAi && aiV !== undefined && aiV !== '' && aiV !== 0 ? aiV : pV);
  const supplier = pick(ai?.supplier, parsed.supplier);
  const fields: ReceiptPatch = {
    supplier,
    supplier_vat_id: pick(ai?.supplier_vat_id, parsed.supplier_vat_id),
    country: pick(ai?.country, parsed.country),
    receipt_date: pick(ai?.receipt_date, parsed.receipt_date),
    invoice_no: pick(ai?.invoice_no, parsed.invoice_no),
    currency: pick(ai?.currency, parsed.currency),
    amount_gross: pick(ai?.amount_gross, parsed.amount_gross),
    description: useAi ? ai!.description : '',
  };
  const vatSrc = useAi && ai!.vat_lines.length ? ai!.vat_lines : parsed.vat;
  if (vatSrc.length === 1) {
    // Steht der MWST-Betrag auf dem Beleg, gilt er (Kassen runden anders als die Formel).
    const gross = Number(fields.amount_gross) || 0;
    const v = Number(vatSrc[0].vat) || 0;
    if (v > 0 && gross > v) fields.vat_lines = [{ rate: vatSrc[0].rate, vat: round2(v), net: round2(gross - v) }];
    else fields.vat_rate = vatSrc[0].rate;
  }
  else if (vatSrc.length > 1) fields.vat_lines = vatSrc.map((v) => ({ rate: v.rate, vat: v.vat, net: 0 }));

  // Verlauf: so wurde dieser Lieferant bisher kontiert
  const suggestions: ReceiptSuggestion[] = [];
  const hist = supplier ? await historyFor(supplier) : null;
  let category = '';
  if (hist?.category) {
    category = hist.category;
    suggestions.push({ field: 'category', value: hist.category, label: `${kategorie(hist.category).label} (wie die letzten ${hist.count}×)`, source: 'verlauf' });
  }
  if (!category && useAi && ai!.category) {
    category = ai!.category;
    suggestions.push({ field: 'category', value: category, label: kategorie(category).label, source: 'ki' });
  }
  if (!category) {
    const guess = kategorieAusText(`${supplier}\n${ocr.text.slice(0, 1500)}`);
    if (guess) { category = guess; suggestions.push({ field: 'category', value: guess, label: kategorie(guess).label, source: 'regel' }); }
  }
  if (category) fields.category = category;
  if (hist?.payment) fields.payment = hist.payment;
  else if (useAi && ai!.payment_hint && ai!.payment_hint !== 'unbekannt') fields.payment = ai!.payment_hint;
  const head = ocr.text.slice(0, 4000);
  if (!fields.payment && /\b(bar|bargeld|barzahlung|cash|esp[èe]ces|r[üu]ckgeld)\b/i.test(head)) fields.payment = 'bar';
  if (!fields.payment) {
    const pd = await personDefaults(r.created_by);
    if (pd.payment) fields.payment = pd.payment;
  }
  if (!fields.payment && /\b(visa|mastercard|master card|amex|american express|maestro|kreditkarte|credit card|carte de cr[ée]dit)\b/i.test(head)) {
    fields.payment = 'firmenkarte';
    suggestions.push({ field: 'payment', value: 'firmenkarte', label: 'Karte auf dem Beleg – Firmenkarte?', source: 'beleg' });
  }
  if (!fields.currency) fields.currency = hist?.currency || 'CHF';
  if (!fields.country && hist?.country) fields.country = hist.country;
  if (fields.vat_rate === undefined && !fields.vat_lines && hist?.vat_rate !== null && hist?.vat_rate !== undefined && (fields.country || 'CH') === 'CH') {
    fields.vat_rate = hist.vat_rate;
    suggestions.push({ field: 'vat_rate', value: String(hist.vat_rate), label: `MWST ${hist.vat_rate}% (wie bisher)`, source: 'verlauf' });
  }

  // 4) Zuordnung
  const refs = Array.from(new Set([...parsed.refs, ...(useAi ? ai!.references.map((s) => s.toUpperCase()) : [])]));
  const candidates = await assocCandidates({ refs, text: ocr.text, date: String(fields.receipt_date || '') });
  const strong = candidates.find((c) => c.kind === 'anfrage' && c.reason.includes('steht auf dem Beleg'));
  if (strong) {
    fields.booking_id = strong.id;
    fields.booking_ref = strong.label.split(' · ')[0];
    if (strong.event_slug) fields.event_slug = strong.event_slug;
  }

  const method = [ocr.method !== 'keine' ? ocr.method : '', ai ? (useAi ? 'ki' : 'ki-unlesbar') : ''].filter(Boolean).join('+') || 'keine';
  const remarks = useAi && ai!.remarks ? ai!.remarks : '';
  await applyAnalysis(id, fields, {
    ocr_text: ocr.text,
    method,
    error: !ocr.text && !useAi ? (aiError || ocr.error || (ai && !ai.readable ? 'Beleg nicht lesbar' : 'Kein Text erkannt')) : undefined,
    extraction: {
      method,
      ocr_confidence: ocr.confidence,
      text_length: ocr.text.length,
      parsed: { ...parsed, confidence: parsed.confidence, score: parsed.score },
      ai: ai ? { ...ai } : null,
      ai_reason: aiError ? `${aiReason}: ${aiError}` : aiReason,
      suggestions: remarks ? [...suggestions, { field: 'notes', value: remarks, label: remarks, source: 'ki' }] : suggestions,
      candidates,
    },
  });
}
