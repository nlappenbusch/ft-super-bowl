/**
 * calculationPdf.ts — Angebots-/Kalkulations-PDF (TASK-00117, Rechnungs-Stil TASK-00123).
 * ─────────────────────────────────────────────────────────────────────────────
 * Erzeugt aus einer Angebotskalkulation ein PDF im Layout der Rechnungs-PDFs
 * (Briefkopf mit Logo + Firmenblock, Adressfeld, Detailblock, Preistabelle,
 * Fusszeile). Optionale Zusatzleistungen erscheinen als +/−-Freitextzeilen.
 *
 * Varianten:
 *   'kunde'  — Angebots-Seite im Rechnungs-Stil, OHNE EK/Marge.
 *   'intern' — Angebots-Seite + zweite Seite mit der vollen Kalkulationstabelle.
 * Nur serverseitig verwenden (API-Route).
 */
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';
import { getSettings } from './settingsStore';
import {
  CALC_CATEGORIES, categoryLabel, computeTotals, itemEk, fmtPeriod, nightsBetween,
  fmtSignedMoney, type CalcItem,
} from './calcModel';
import { convertAmount } from './fxRates';
import { hotelInfoLine } from './hotelLookup';
import { normalizeSalutation, type CustomerDetail } from './customerStore';
import type { OfferCalculationRow } from './calculationStore';

export type CalcPdfVariant = 'kunde' | 'intern';

const NAVY: [number, number, number] = [20, 48, 71];    // #143047
const ACCENT: [number, number, number] = [217, 83, 30]; // #d9531e
const MUTED: [number, number, number] = [107, 114, 128];
const STROKE: [number, number, number] = [203, 213, 225];

function money(n: number, currency: string): string {
  return `${currency} ${n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtAmount(n: number): string {
  return n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-CH');
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

export function buildCalculationPdf(
  calc: OfferCalculationRow,
  variant: CalcPdfVariant,
  customer?: CustomerDetail | null
): ArrayBuffer {
  const settings = getSettings();
  const company = settings.company;
  const offerCfg = settings.offer;
  const target = calc.target_currency;
  const rates = calc.rates_snapshot;
  const totals = computeTotals(calc.items, target, rates, calc.margin_mode, calc.margin_value);
  const period = fmtPeriod(calc.travel_start, calc.travel_end);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const leftMargin = 20;
  const rightMargin = 130; // rechte Spalte (Firmenblock), wie Rechnung
  const right = 190;
  let currentY = 12;

  const ensureSpace = (needed: number) => {
    if (currentY + needed > 272) {
      doc.addPage();
      currentY = 20;
    }
  };

  /* ─── Briefkopf: Logo links, Firmenblock rechts (wie Rechnung) ─── */
  let faltinLogoBase64 = '';
  const logoFile = company.logo_path?.replace(/^\//, '') || 'faltin_logo_black-1 (2).png';
  try {
    const logoPath = path.join(process.cwd(), 'public', logoFile);
    if (fs.existsSync(logoPath)) {
      faltinLogoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
      doc.addImage(faltinLogoBase64, 'PNG', leftMargin, currentY, 60, 0);
    } else {
      doc.setFontSize(16);
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.text(company.name, leftMargin, currentY);
    }
  } catch {
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.text(company.name, leftMargin, currentY);
  }

  let firmY = 15;
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(`${company.name}${company.legal_form && !company.name.includes(company.legal_form) ? ' ' + company.legal_form : ''}`, rightMargin, firmY);
  firmY += 3;
  doc.setFont('helvetica', 'normal');
  doc.text(company.street, rightMargin, firmY);
  firmY += 3;
  doc.text(`${company.zip} ${company.city}, ${company.country}`, rightMargin, firmY);
  firmY += 3;
  if (company.phone) { doc.text(`TEL ${company.phone}`, rightMargin, firmY); firmY += 3; }
  if (company.fax)   { doc.text(`FAX ${company.fax}`, rightMargin, firmY);   firmY += 3; }
  if (company.email) { doc.text(company.email, rightMargin, firmY); firmY += 3; }
  if (company.website) { doc.text(company.website, rightMargin, firmY); }

  // Reisegarantie-Logo rechts (gleiche Position wie auf der Rechnung)
  const garantie = loadPublicImageB64(settings.invoice.reisegarantie_logo || 'reisegarantielogo-de-768x258.webp');
  if (garantie) {
    try { doc.addImage(`data:image/${garantie.format.toLowerCase()};base64,${garantie.data}`, garantie.format, rightMargin, 38, 45, 0); } catch { /* optional */ }
  }

  /* ─── Absenderzeile + Kundenadresse (wie Rechnung) ─── */
  currentY = 48;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  const absenderText = `${company.name} · ${company.street} · ${company.zip} ${company.city}`;
  doc.text(absenderText, leftMargin, currentY);
  doc.setLineWidth(0.1);
  doc.line(leftMargin, currentY + 0.5, leftMargin + doc.getTextWidth(absenderText), currentY + 0.5);

  currentY = 55;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const recipientName = (customer?.name || [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim())
    || calc.customer_name || '';
  if (recipientName) {
    const line1 = [normalizeSalutation(customer?.salutation), recipientName].filter(Boolean).join(' ');
    doc.text(line1, leftMargin, currentY);
    currentY += 4;
    if (customer?.company) { doc.text(customer.company, leftMargin, currentY); currentY += 4; }
    if (customer?.street) { doc.text(customer.street, leftMargin, currentY); currentY += 4; }
    const zipCity = [customer?.zip, customer?.city].filter(Boolean).join(' ');
    if (zipCity) { doc.text(customer?.country ? `${zipCity}, ${customer.country}` : zipCity, leftMargin, currentY); currentY += 4; }
    const email = customer?.emails?.find((e) => e.is_primary)?.email || customer?.emails?.[0]?.email || '';
    if (email) { doc.text(email, leftMargin, currentY); currentY += 4; }
    if (customer?.phone) { doc.text(customer.phone, leftMargin, currentY); currentY += 4; }
  } else {
    doc.setTextColor(...MUTED);
    doc.text('— Kein Kunde zugeordnet —', leftMargin, currentY);
    doc.setTextColor(0, 0, 0);
    currentY += 4;
  }
  currentY += 15;

  /* ─── Titel + Angebots-Box ─── */
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Angebot', leftMargin, currentY);
  currentY += 8;

  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.rect(leftMargin, currentY - 2, 170, 6, 'FD');

  doc.setFontSize(8);
  const boxY = currentY + 1.5;
  const offerDate = calc.created_at ? new Date(calc.created_at) : new Date();
  const validDays = Math.max(1, Number(offerCfg.valid_days) || 14);
  const validUntil = new Date(offerDate.getTime() + validDays * 24 * 60 * 60 * 1000);

  doc.setFont('helvetica', 'bold');
  doc.text('Angebotsnummer:', leftMargin + 2, boxY);
  doc.setFont('helvetica', 'normal');
  doc.text(calc.calc_number || calc.id.slice(0, 8), leftMargin + 30, boxY);

  doc.setFont('helvetica', 'bold');
  doc.text('Angebotsdatum:', leftMargin + 60, boxY);
  doc.setFont('helvetica', 'normal');
  doc.text(offerDate.toLocaleDateString('de-CH'), leftMargin + 85, boxY);

  doc.setFont('helvetica', 'bold');
  doc.text('Gültig bis:', leftMargin + 110, boxY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 0, 0);
  doc.text(validUntil.toLocaleDateString('de-CH'), leftMargin + 140, boxY);
  doc.setTextColor(0, 0, 0);

  currentY += 10;

  /* ─── Detailblock (Label/Wert, wie Rechnung) ─── */
  const labelX = leftMargin;
  const valueX = leftMargin + 38;
  doc.setFontSize(8);

  const row = (label: string, value: string) => {
    if (!value) return;
    ensureSpace(6);
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelX, currentY);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(value, right - valueX);
    doc.text(lines, valueX, currentY);
    currentY += lines.length * 4.2;
  };

  if (period) row('Reisetermin:', period);
  row('Anreise:', 'Eigene Anreise');
  const destination = calc.hotel_info
    ? [calc.hotel_info.city, calc.hotel_info.country].filter(Boolean).join(', ')
    : '';
  row('Destination:', destination);
  const hotelLine = calc.hotel_info
    ? hotelInfoLine(calc.hotel_info)
    : calc.items.find((i) => i.category === 'hotel' && i.description.trim())?.description || '';
  row('Hotel:', hotelLine);

  const nights = nightsBetween(calc.travel_start, calc.travel_end);
  const roomCats = Array.from(new Set(
    calc.items.filter((i) => i.category === 'hotel' && (i.room_category || '').trim()).map((i) => String(i.room_category).trim())
  ));
  const unterbringung = [
    nights !== null && nights > 0 ? `${nights} ${nights === 1 ? 'Übernachtung' : 'Übernachtungen'}/Frühstück` : '',
    roomCats.join(', '),
  ].filter(Boolean).join(' · ');
  row('Unterbringung:', unterbringung);
  row('Veranstaltung:', calc.title || `Reise-Arrangement ${calc.calc_number}`);
  if (calc.request_number) row('Referenz:', calc.request_number);

  currentY += 2;

  /* ─── Leistungen (inkludiert, ohne Einzelpreise — wie Rechnung) ─── */
  ensureSpace(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Leistungen:', labelX, currentY);
  doc.setFont('helvetica', 'normal');

  const knownIds = CALC_CATEGORIES.map((c) => c.id as string);
  const extraIds = Array.from(new Set(calc.items.map((i) => i.category))).filter((c) => !knownIds.includes(c));
  const groups = [...knownIds, ...extraIds]
    .map((id) => ({ id, label: categoryLabel(id), items: calc.items.filter((i) => i.category === id && (i.description.trim() || i.amount > 0)) }))
    .filter((g) => g.items.length > 0);

  let leistungFirst = true;
  for (const g of groups) {
    for (const item of g.items) {
      ensureSpace(6);
      const qty = item.qty > 1 ? `${item.qty}× ` : '';
      const room = (item.room_category || '').trim() ? ` — ${item.room_category}` : '';
      const text = `Inkl. ${qty}${item.description.trim() || g.label}${room}`;
      const lines = doc.splitTextToSize(text, right - valueX);
      doc.text(lines, valueX, currentY);
      currentY += lines.length * 3.8;
      leistungFirst = false;
    }
  }
  if (leistungFirst) currentY += 4;
  currentY += 6;

  /* ─── Preistabelle (rechtsbündig, wie Rechnung) ─── */
  ensureSpace(30);
  const priceLabelX = 105;
  const currencyX = 162;
  const amountX = 190;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const vkPP = totals ? totals.vkTarget : 0;
  doc.text('Reisepreis pro Person:', priceLabelX, currentY);
  doc.text(target, currencyX, currentY);
  doc.text(totals ? fmtAmount(vkPP) : '—', amountX, currentY, { align: 'right' });
  currentY += 5;

  doc.text(`${settings.invoice.vat_note || 'Mehrwertsteuer 0%'}:`, priceLabelX, currentY);
  doc.text(target, currencyX, currentY);
  doc.text('0.00', amountX, currentY, { align: 'right' });
  currentY += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Angebotspreis pro Person:', priceLabelX, currentY);
  doc.text(target, currencyX, currentY);
  doc.text(totals ? fmtAmount(vkPP) : '—', amountX, currentY, { align: 'right' });
  doc.setLineWidth(0.5);
  doc.line(amountX - 28, currentY + 1, amountX + 2, currentY + 1);
  currentY += 10;

  /* ─── Optionale Zusatzleistungen (+/− Freitext) ─── */
  const extras = (calc.offer_extras || []).filter((e) => e.label.trim());
  if (extras.length > 0) {
    ensureSpace(10 + extras.length * 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Optionale Zusatzleistungen (pro Person):', leftMargin, currentY);
    currentY += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    for (const e of extras) {
      ensureSpace(5);
      const lines = doc.splitTextToSize(e.label, amountX - leftMargin - 35);
      doc.text(lines, leftMargin, currentY);
      doc.text(fmtSignedMoney(e.amount, target), amountX, currentY, { align: 'right' });
      currentY += lines.length * 3.8 + 0.7;
    }
    currentY += 5;
  }

  /* ─── Rechtstext + Gültigkeit ─── */
  ensureSpace(16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const legal = `${offerCfg.legal_note} Dieses Angebot ist gültig bis ${validUntil.toLocaleDateString('de-CH')}.`;
  const legalLines = doc.splitTextToSize(legal, 170);
  doc.text(legalLines, leftMargin, currentY);
  currentY += legalLines.length * 3 + 4;

  if (calc.notes && calc.notes.trim() && !calc.notes.trim().startsWith('{')) {
    ensureSpace(12);
    const noteLines = doc.splitTextToSize(calc.notes.trim(), 170);
    doc.text(noteLines, leftMargin, currentY);
    currentY += noteLines.length * 3 + 4;
  }

  /* ─── Fusszeile (wie Rechnung) ─── */
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  const footerY = 282;
  const footerRightX = 125;
  if (company.ceo) {
    doc.text(`Inhaberverwaltungsrat: ${company.ceo}`, leftMargin, footerY);
    doc.text(company.uid || '', footerRightX, footerY);
    doc.text(`Geschäftsführer: ${company.ceo}`, leftMargin, footerY + 3.5);
    doc.text(company.hr_id || '', footerRightX, footerY + 3.5);
  }
  doc.text(`Sitz der Gesellschaft und Gerichtsstand: ${company.city}`, leftMargin, footerY + 7);
  doc.setTextColor(0, 0, 0);

  /* ─── Interne Variante: Kalkulationstabelle auf Seite 2 ─── */
  if (variant === 'intern') {
    doc.addPage();
    let y = 18;
    const left = leftMargin;
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

    const ensureSpace2 = (needed: number) => {
      if (y + needed > 272) {
        doc.addPage();
        y = 20;
      }
    };

    // Tabellenkopf
    const colPos = left;            // Position (breit)
    const colQty = 118;             // Menge
    const colEk = 138;              // EK p.P. (Originalwährung)
    const colRate = 158;            // Kurs
    const colTarget = right;        // EK in Zielwährung (rechtsbündig)
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

    for (const g of groups) {
      ensureSpace2(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...ACCENT);
      doc.text(g.label.toUpperCase(), colPos + 1, y);
      y += 4.5;
      let sub = 0;
      for (const item of g.items) {
        ensureSpace2(8);
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
    ensureSpace2(24);
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

    if (extras.length > 0) {
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...NAVY);
      doc.text('Optionale Zusatzleistungen (nicht im VK enthalten):', left, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...MUTED);
      for (const e of extras) {
        ensureSpace2(5);
        doc.text(`${e.label}: ${fmtSignedMoney(e.amount, target)} p.P.`, left, y);
        y += 3.8;
      }
    }
  }

  return doc.output('arraybuffer') as ArrayBuffer;
}
