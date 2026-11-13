/**
 * belege/ai.ts — die KI liest den Beleg selbst (Foto oder PDF), wenn Textebene/OCR nicht reichen.
 * Faltins eigener Anthropic-Key (settings.ai), Modell settings.ai.belege_model
 * (Standard claude-sonnet-5-5: schnell genug fürs Handy). Strukturierte Ausgabe nach Schema.
 * Die KI schlägt nur vor – gespeichert wird in leere Felder, Menschen haben Vorrang.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { anthropicClient, FALLBACK_BETA, isWorkspaceAiConfigured } from '../workspace/claude';
import { getSettings } from '../settingsStore';
import { KATEGORIEN } from './kontenplan';

export interface AiReceipt {
  readable: boolean;
  supplier: string;
  supplier_vat_id: string;
  country: string;
  receipt_date: string;
  invoice_no: string;
  currency: string;
  amount_gross: number;
  vat_lines: Array<{ rate: number; vat: number }>;
  category: string;
  description: string;
  payment_hint: string;
  references: string[];
  confidence: number;
  remarks: string;
}

export function isBelegeAiConfigured(): boolean {
  return isWorkspaceAiConfigured();
}

function model(): string {
  const a = getSettings().ai as unknown as { belege_model?: string };
  return (a.belege_model || '').trim() || 'claude-sonnet-5-5';
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['readable', 'supplier', 'supplier_vat_id', 'country', 'receipt_date', 'invoice_no', 'currency', 'amount_gross', 'vat_lines', 'category', 'description', 'payment_hint', 'references', 'confidence', 'remarks'],
  properties: {
    readable: { type: 'boolean', description: 'false, wenn das kein Beleg ist oder er unlesbar ist' },
    supplier: { type: 'string', description: 'Name des Geschäfts/Lieferanten, wie auf dem Beleg (ohne Adresse)' },
    supplier_vat_id: { type: 'string', description: 'MWST-/UID-Nummer, z. B. CHE-123.456.789 MWST, sonst leer' },
    country: { type: 'string', description: 'ISO-Ländercode des Lieferanten (CH, DE, US …), sonst leer' },
    receipt_date: { type: 'string', description: 'Kauf-/Rechnungsdatum als YYYY-MM-DD, sonst leer' },
    invoice_no: { type: 'string', description: 'Rechnungs-/Belegnummer, sonst leer' },
    currency: { type: 'string', description: 'ISO-Währung des Endbetrags (CHF, EUR, USD, GBP …)' },
    amount_gross: { type: 'number', description: 'Endbetrag inkl. MWST, den der Kunde bezahlt hat (inkl. Trinkgeld, falls auf dem Beleg); 0 wenn unbekannt' },
    vat_lines: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['rate', 'vat'],
        properties: { rate: { type: 'number', description: 'Satz in Prozent, z. B. 8.1' }, vat: { type: 'number', description: 'Steuerbetrag in Belegwährung' } },
      },
    },
    category: { type: 'string', enum: KATEGORIEN.map((k) => k.key) },
    description: { type: 'string', description: 'Sehr kurze Beschreibung auf Deutsch, was gekauft wurde (max. 60 Zeichen)' },
    payment_hint: { type: 'string', enum: ['firmenkarte', 'bar', 'rechnung', 'unbekannt'], description: 'Karte → firmenkarte, Bar → bar, offene Rechnung mit Zahlungsfrist → rechnung' },
    references: { type: 'array', items: { type: 'string' }, description: 'Buchungs-/Vorgangsnummern auf dem Beleg, besonders RQ-12345 oder FT12345' },
    confidence: { type: 'number', description: 'Sicherheit 0..1 für Betrag und Datum' },
    remarks: { type: 'string', description: 'Hinweis für die Buchhaltung, z. B. "Trinkgeld handschriftlich", sonst leer' },
  },
} as const;

const SYSTEM = `Du liest Belege (Quittungen, Rechnungen, Tickets) für die Buchhaltung der Faltin Travel AG,
einer Schweizer Sportreiseagentur (Regensdorf). Sie kauft Tickets, Hotels und Transfers für Kundenreisen
(Super Bowl, Darts-WM, Ryder Cup, French Open …) und hat eigene Spesen.

Regeln:
- Lies nur, was auf dem Beleg steht. Rate nichts: unbekannte Felder leer bzw. 0.
- amount_gross ist der tatsächlich bezahlte Endbetrag (bei Kartenbelegen der belastete Betrag).
- Datum im Format YYYY-MM-DD. Schweizer Belege schreiben TT.MM.JJ.
- Kategorie: Tickets/Hotel/Transfer für Kundenreisen → kunde_leistung. Restaurant mit mehreren Personen → essen_kunde,
  allein unterwegs → verpflegung. Zug/Taxi/Flug/Parking der Mitarbeitenden → reise.
- MWST-Zeilen nur, wenn sie auf dem Beleg stehen.`;

export async function aiReadReceipt(opts: { buffer: Buffer; mime: string; ocrText: string }): Promise<AiReceipt> {
  const client = anthropicClient();
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [];

  if (opts.mime === 'application/pdf') {
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: opts.buffer.toString('base64') } });
  } else {
    const sharp = (await import('sharp')).default;
    const img = await sharp(opts.buffer).rotate().resize({ width: 1600, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: img.toString('base64') } });
  }
  const hint = opts.ocrText.trim()
    ? `\n\nZur Hilfe der maschinell erkannte Text (kann Fehler enthalten):\n"""\n${opts.ocrText.slice(0, 6000)}\n"""`
    : '';
  content.push({ type: 'text', text: `Lies diesen Beleg aus.${hint}` });

  const stream = client.beta.messages.stream({
    model: model(),
    max_tokens: 4000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA as unknown as Record<string, unknown> } },
    messages: [{ role: 'user', content }],
  } as Parameters<typeof client.beta.messages.stream>[0]);
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('Die KI hat den Beleg abgelehnt.');
  const text = msg.content.filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text) as AiReceipt;
}
