/**
 * calculationPdf.ts — Angebots-/Kalkulations-PDF (TASK-00117).
 * ─────────────────────────────────────────────────────────────────────────────
 * Erzeugt aus einer Angebotskalkulation ein sauber formatiertes PDF im Stil
 * der bestehenden Rechnungs-PDFs (jsPDF, Logo aus /public, Faltin-Branding).
 *
 * Varianten:
 *   'kunde'  — Angebots-Seite: Leistungen + Gesamtpreis p.P., OHNE EK/Marge.
 *   'intern' — Angebots-Seite + zweite Seite mit der vollen Kalkulationstabelle.
 * Nur serverseitig verwenden (API-Route).
 */
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { getSettings } from './settingsStore';
import {
  CALC_CATEGORIES, categoryLabel, computeTotals, itemEk, fmtPeriod, type CalcItem,
} from './calcModel';
import { convertAmount } from './fxRates';
import { hotelInfoLine } from './hotelLookup';
import type { OfferCalculationRow } from './calculationStore';

export type CalcPdfVariant = 'kunde' | 'intern';

const NAVY: [number, number, number] = [20, 48, 71];    // #143047
const ACCENT: [number, number, number] = [217, 83, 30]; // #d9531e
const MUTED: [number, number, number] = [107, 114, 128];
const STROKE: [number, number, number] = [203, 213, 225];

function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function loadPublicImageB64(relPath: string): { data: string; format: 'PNG' | 'WEBP' | 'JPEG' } | null {
  try {
    const clean = relPath.replace(/^\//, '');
    const p = path.join(process.cwd(), 'public', clean);
    if (!fs.existsSync(p)) return null;
    const ext = path.extname(clean).toLowerCase();
    const format = ext === '.webp' ? 'WEBP' : ext === '.jpg' || ext === '.jpeg' ? 'JPEG' : 'PNG';
    return { data: fs.readFileSync(p).toString('base64'), format };
  } catch {
    return null;
  }
}

export function buildCalculationPdf(calc: OfferCalculationRow, variant: CalcPdfVariant): ArrayBuffer {
  const settings = getSettings();
  const company = settings.company;
  const target = calc.target_currency;
  const rates = calc.rates_snapshot;
  const totals = computeTotals(calc.items, target, rates, calc.margin_mode, calc.margin_value);
  const period = fmtPeriod(calc.travel_start, calc.travel_end);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const left = 20;
  const right = 190;
  let y = 16;

  const ensureSpace = (needed: number) => {
    if (y + needed > 272) {
      doc.addPage();
      y = 20;
    }
  };

  /* ─── Kopf: Logo + Angebots-Block ─── */
  const logo = loadPublicImageB64(company.logo_path || 'faltin-logo-email.png')
    || loadPublicImageB64('faltin_logo_black-1 (2).png');
  if (logo) {
    try { doc.addImage(`data:image/${logo.format.toLowerCase()};base64,${logo.data}`, logo.format, left, y, 52, 0); } catch { /* Logo optional */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text('Angebot', right, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const metaLines: string[] = [];
  if (calc.calc_number) metaLines.push(`Angebots-Nr. ${calc.calc_number}`);
  if (calc.request_number) metaLines.push(`Referenz ${calc.request_number}`);
  metaLines.push(`Datum ${(calc.created_at || '').slice(0, 10).split('-').reverse().join('.')}`);
  let metaY = y + 12;
  for (const l of metaLines) { doc.text(l, right, metaY, { align: 'right' }); metaY += 4; }

  y = Math.max(y + 24, metaY + 2);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1);
  doc.line(left, y, right, y);
  y += 9;

  /* ─── Empfänger + Titel + Zeitraum ─── */
  if (calc.customer_name) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`ERSTELLT FÜR ${calc.customer_name.toUpperCase()}`, left, y);
    y += 5.5;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...NAVY);
  const titleLines = doc.splitTextToSize(calc.title || 'Ihr Reise-Arrangement', right - left);
  doc.text(titleLines, left, y);
  y += titleLines.length * 6.5;

  if (period) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ACCENT);
    doc.text(period, left, y);
    y += 6;
  }
  if (calc.hotel_info) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const hotelLines = doc.splitTextToSize(hotelInfoLine(calc.hotel_info), right - left);
    doc.text(hotelLines, left, y);
    y += hotelLines.length * 4 + 2;
  }
  y += 3;

  /* ─── Leistungen ─── */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text('INKLUDIERTE LEISTUNGEN', left, y);
  doc.setDrawColor(...STROKE);
  doc.setLineWidth(0.3);
  doc.line(left, y + 1.5, right, y + 1.5);
  y += 7;

  const knownIds = CALC_CATEGORIES.map((c) => c.id as string);
  const extraIds = Array.from(new Set(calc.items.map((i) => i.category))).filter((c) => !knownIds.includes(c));
  const groups = [...knownIds, ...extraIds]
    .map((id) => ({ id, label: categoryLabel(id), items: calc.items.filter((i) => i.category === id && (i.description.trim() || i.amount > 0)) }))
    .filter((g) => g.items.length > 0);

  for (const g of groups) {
    ensureSpace(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...ACCENT);
    doc.text(g.label.toUpperCase(), left, y);
    y += 4.5;
    doc.setTextColor(...NAVY);
    for (const item of g.items) {
      ensureSpace(9);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const label = `${item.qty > 1 ? `${item.qty}× ` : ''}${item.description.trim() || g.label}`;
      const lines = doc.splitTextToSize(label, right - left - 6);
      doc.setTextColor(...ACCENT);
      doc.text('•', left + 1, y);
      doc.setTextColor(...NAVY);
      doc.text(lines, left + 5, y);
      y += lines.length * 4.2;
      if ((item.room_category || '').trim()) {
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(String(item.room_category), left + 5, y);
        y += 4;
        doc.setTextColor(...NAVY);
      }
      y += 0.8;
    }
    y += 2.5;
  }

  /* ─── Gesamtpreis-Box ─── */
  ensureSpace(30);
  y += 2;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.7);
  doc.roundedRect(left, y, right - left, 20, 2, 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('Gesamtpreis pro Person', left + 6, y + 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text('inkl. aller oben aufgeführten Leistungen', left + 6, y + 13.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...NAVY);
  doc.text(totals ? money(totals.vkTarget, target) : '—', right - 6, y + 12.5, { align: 'right' });
  y += 26;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  const legal = `Alle Preise pro Person in ${target}. Angebot freibleibend — Verfügbarkeit und Preis werden bei Buchung bestätigt.`;
  doc.text(doc.splitTextToSize(legal, right - left), left, y);

  /* ─── Fußzeile Seite 1 ─── */
  const footY = 283;
  doc.setDrawColor(...STROKE);
  doc.setLineWidth(0.3);
  doc.line(left, footY - 5, right, footY - 5);
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const companyLine = [
    `${company.name}${company.legal_form && !company.name.includes(company.legal_form) ? ' ' + company.legal_form : ''}`,
    [company.street, [company.zip, company.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    company.website || 'faltintravel.com',
  ].filter(Boolean).join(' · ');
  doc.text(companyLine, left, footY);
  const garantie = loadPublicImageB64(settings.invoice.reisegarantie_logo || 'Schweizer-Reisegarantie-300x120-1.webp');
  if (garantie) {
    try { doc.addImage(`data:image/${garantie.format.toLowerCase()};base64,${garantie.data}`, garantie.format, right - 28, footY - 3.5, 28, 0); } catch { /* optional */ }
  }

  /* ─── Interne Variante: Kalkulationstabelle auf Seite 2 ─── */
  if (variant === 'intern') {
    doc.addPage();
    y = 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(`Interne Kalkulation ${calc.calc_number || ''}`.trim(), left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 0, 0);
    doc.text('NUR FÜR DEN INTERNEN GEBRAUCH — nicht an Kunden weitergeben', left, y + 5);
    doc.setTextColor(...MUTED);
    if (rates) doc.text(`Kursbasis: ${rates.source} · Kursdatum ${rates.date} · Alle Preise pro Person`, left, y + 9.5);
    y += 16;

    // Tabellenkopf
    const colPos = left;            // Position (breit)
    const colQty = 118;             // Menge
    const colEk = 138;              // EK p.P. (Originalwährung)
    const colRate = 158;            // Kurs
    const colTarget = right;        // EK in Zielwährung (rechtsbündig)
    const rowHead = () => {
      doc.setFillColor(245, 247, 250);
      doc.rect(left, y - 4, right - left, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text('POSITION', colPos + 1, y);
      doc.text('MENGE', colQty, y, { align: 'right' });
      doc.text('EK P.P.', colEk, y, { align: 'right' });
      doc.text('KURS', colRate, y, { align: 'right' });
      doc.text(`EK P.P. (${target})`, colTarget - 1, y, { align: 'right' });
      y += 5;
    };
    rowHead();

    for (const g of groups) {
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...ACCENT);
      doc.text(g.label.toUpperCase(), colPos + 1, y);
      y += 4.5;
      let sub = 0;
      for (const item of g.items) {
        ensureSpace(8);
        const ek = itemEk(item);
        const inTarget = rates ? convertAmount(ek, item.currency, target, rates) : null;
        if (inTarget !== null) sub += inTarget;
        const rate = rates && item.currency !== target ? convertAmount(1, item.currency, target, rates) : null;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(...NAVY);
        const desc = doc.splitTextToSize(
          `${item.description.trim() || g.label}${(item.room_category || '').trim() ? ` — ${item.room_category}` : ''}`,
          92
        );
        doc.text(desc, colPos + 1, y);
        doc.text(`${item.qty}×`, colQty, y, { align: 'right' });
        doc.text(money(item.amount, item.currency), colEk, y, { align: 'right' });
        doc.setTextColor(...MUTED);
        doc.text(rate !== null ? rate.toFixed(4) : '–', colRate, y, { align: 'right' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NAVY);
        doc.text(inTarget !== null ? money(inTarget, target) : '–', colTarget - 1, y, { align: 'right' });
        y += desc.length * 3.8 + 1.2;
      }
      doc.setDrawColor(...STROKE);
      doc.setLineWidth(0.2);
      doc.line(left, y - 0.5, right, y - 0.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(`Zwischensumme ${g.label}`, colRate, y + 3, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(rates ? money(sub, target) : '–', colTarget - 1, y + 3, { align: 'right' });
      y += 8;
    }

    // Summenblock
    ensureSpace(24);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.6);
    doc.line(left, y, right, y);
    y += 5.5;
    const sumRow = (label: string, value: string, opts?: { big?: boolean; red?: boolean; accent?: boolean }) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(opts?.big ? 11.5 : 9);
      if (opts?.red) doc.setTextColor(200, 0, 0);
      else if (opts?.accent) doc.setTextColor(...ACCENT);
      else doc.setTextColor(...NAVY);
      doc.text(label, colRate, y, { align: 'right' });
      doc.text(value, colTarget - 1, y, { align: 'right' });
      y += opts?.big ? 7 : 5.5;
    };
    if (totals) {
      sumRow('EK gesamt (p.P.)', money(totals.ekTarget, target));
      sumRow(
        `Marge (${totals.marginPercent.toFixed(1).replace('.', ',')} %)`,
        money(totals.marginAmount, target),
        { red: totals.marginAmount < 0 }
      );
      sumRow('VK gesamt (p.P.)', money(totals.vkTarget, target), { big: true, accent: true });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(200, 0, 0);
      doc.text('Keine Wechselkurse festgeschrieben — Summen nicht berechenbar.', left, y);
      y += 6;
    }

    if (totals && totals.byCurrency.length > 0) {
      y += 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      for (const bc of totals.byCurrency) {
        // Kein "→": U+2192 fehlt im PDF-Standardfont (Helvetica/WinAnsi)
        doc.text(
          `EK-Anteil ${bc.currency}: ${money(bc.sum, bc.currency)}${bc.currency !== target ? ` = ${money(bc.inTarget, target)}` : ''}`,
          left, y
        );
        y += 4;
      }
    }
  }

  return doc.output('arraybuffer') as ArrayBuffer;
}
