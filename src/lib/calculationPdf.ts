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
  CALC_CATEGORIES, categoryLabel, computeTotals, computeGroupTotals, itemEk, fmtPeriod, nightsBetween,
  fmtSignedMoney, fmtServiceDate, fmtRoute, fmtTimeRange, priceStatusLabel, buildProgram, programTime,
  hasProgramData, programDayLabel, programPrefix, fmtDateWeekday, type CalcItem,
} from './calcModel';
import { convertAmount } from './fxRates';
import { hotelInfoLine } from './hotelLookup';
import { normalizeSalutation, type CustomerDetail } from './customerStore';
import type { OfferCalculationRow } from './calculationStore';
import { inquiryStatusLabel, type CalcInquiry } from './inquiryModel';
import {
  dayBlocks, timelineRange, kindColor, kindLabel, entryRoute, entryTime, PLAN_KINDS, SUPPLIER_TYPES, SUPPLIER_STATUSES, SOURCE_KINDS,
} from './planningModel';

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

/** jsPDF-Standardschrift kann nur WinAnsi — Pfeile & Co. ersetzen, Unbekanntes entfernen. */
function winAnsi(s: string): string {
  const extra = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  return (s || '')
    .replace(/→/g, '->').replace(/←/g, '<-').replace(/↔/g, '<->').replace(/−/g, '-').replace(/[★☆]/g, '*')
    .replace(/[✓✔]/g, 'x').replace(/\u00A0/g, ' ')
    .split('')
    .filter((ch) => ch.charCodeAt(0) <= 255 || extra.includes(ch))
    .join('');
}

export function buildCalculationPdf(
  calc: OfferCalculationRow,
  variant: CalcPdfVariant,
  customer?: CustomerDetail | null,
  inquiries: CalcInquiry[] = []
): ArrayBuffer {
  const settings = getSettings();
  const company = settings.company;
  const offerCfg = settings.offer;
  const target = calc.target_currency;
  const rates = calc.rates_snapshot;
  const totals = computeTotals(calc.items, target, rates, calc.margin_mode, calc.margin_value);
  const period = fmtPeriod(calc.travel_start, calc.travel_end);
  const pax = calc.pax || 1;
  const group = computeGroupTotals(totals, pax);

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
  if (pax > 1) row('Teilnehmer:', `${pax} Personen`);
  const hasFlight = calc.items.some((i) => i.category === 'flug' && i.description.trim());
  row('Anreise:', hasFlight ? 'Flug (siehe Leistungen)' : 'Eigene Anreise');
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
      const date = fmtServiceDate(item.service_from, item.service_to);
      const text = `Inkl. ${qty}${item.description.trim() || g.label}${room}${date ? ` (${date})` : ''}`;
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
  if (group && pax > 1) {
    currentY += 6;
    doc.setFontSize(9);
    doc.text(`Gesamtpreis (${pax} Personen):`, priceLabelX, currentY);
    doc.text(target, currencyX, currentY);
    doc.text(fmtAmount(group.vkTotal), amountX, currentY, { align: 'right' });
  }
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

  /* ─── Programm / Tagesablauf (intern immer, Angebot nur mit Schalter) ─── */
  const plan = calc.planning;
  const planDays = plan?.days?.filter((d) => d.entries.length) || [];
  const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  if (planDays.length && (variant === 'intern' || calc.program_in_offer)) {
    /* Programm aus der Reiseplanung (bevorzugt) */
    const internal = variant === 'intern';
    doc.addPage();
    let y = 18;
    const left = leftMargin;
    const textX = left + 27;
    const width = right - textX;
    const space = (needed: number) => { if (y + needed > 280) { doc.addPage(); y = 18; } };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(winAnsi(`Programm${calc.title ? ` — ${calc.title}` : ''}`), left, y);
    if (internal) {
      doc.setFontSize(8);
      doc.setTextColor(200, 0, 0);
      doc.text('INTERN — mit Anbietern, Preisen und Status', right, y, { align: 'right' });
    }
    y += 10;
    planDays.forEach((d, di) => {
      space(14);
      doc.setFillColor(245, 247, 250);
      doc.rect(left, y - 4.2, right - left, 6.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...ACCENT);
      doc.text(winAnsi(`Tag ${di + 1}${d.date ? ` · ${fmtDateWeekday(d.date)}` : ''}${d.title ? ` · ${d.title}` : ''}`), left + 1.5, y);
      y += 7;
      for (const e of d.entries) {
        const title = doc.splitTextToSize(winAnsi(e.title + (e.location ? ` — ${e.location}` : '')), width);
        const sub: string[] = [];
        const route = entryRoute(e, '->');
        if (route) sub.push(route);
        if (e.note) sub.push(e.note);
        if (internal) {
          const meta = [e.supplier, e.price_note, e.status].filter(Boolean).join(' · ');
          if (meta) sub.push(meta);
        }
        const subLines = sub.flatMap((t) => doc.splitTextToSize(winAnsi(t), width) as string[]);
        space(title.length * 4.2 + subLines.length * 3.7 + 2);
        doc.setFillColor(...hex(kindColor(e.kind)));
        doc.rect(left + 0.5, y - 2.6, 1.6, 3.2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...NAVY);
        doc.text(winAnsi(entryTime(e) || '—'), left + 3.5, y);
        doc.text(title, textX, y);
        y += title.length * 4.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        for (const l of subLines) { doc.text(l, textX, y); y += 3.7; }
        y += 1.8;
      }
      y += 3;
    });
    if (internal && plan.not_included) {
      space(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...NAVY);
      doc.text('Nicht kalkuliert / offen:', left, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(winAnsi(plan.not_included), right - left);
      space(lines.length * 3.8);
      doc.text(lines, left, y);
      y += lines.length * 3.8;
    }

    /* Schema (nur intern): Zeitachse je Tag mit farbigen Blöcken, Transfers als Pfeile */
    if (internal) {
      doc.addPage('a4', 'landscape');
      const W = 297;
      const L = 38;
      const R = W - 12;
      let yy = 16;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...NAVY);
      doc.text(winAnsi(`Ablauf schematisch${calc.title ? ` — ${calc.title}` : ''}`), 12, yy);
      // Legende
      let lx = 150;
      doc.setFontSize(7);
      for (const k of PLAN_KINDS) {
        doc.setFillColor(...hex(k.color));
        doc.rect(lx, yy - 2.6, 3, 3, 'F');
        doc.setTextColor(...NAVY);
        doc.setFont('helvetica', 'normal');
        doc.text(winAnsi(k.label), lx + 4, yy);
        lx += 22;
      }
      yy += 9;
      const { from, to } = timelineRange(planDays);
      const x = (m: number) => L + ((m - from) / (to - from)) * (R - L);
      for (const [di, d] of planDays.entries()) {
        const blocks = dayBlocks(d);
        const lanes: number[] = [];
        const placed = blocks.map((b) => {
          const end = b.point ? b.start + 75 : b.end;
          let lane = lanes.findIndex((l) => l <= b.start);
          if (lane < 0) { lane = lanes.length; lanes.push(end); } else lanes[lane] = end;
          return { ...b, lane };
        });
        const rows = Math.max(1, lanes.length);
        const h = rows * 9 + 6;
        if (yy + h > 200) { doc.addPage('a4', 'landscape'); yy = 16; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...ACCENT);
        doc.text(winAnsi(`Tag ${di + 1}`), 12, yy + 3);
        doc.setTextColor(...NAVY);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.text(doc.splitTextToSize(winAnsi(`${d.date ? fmtDateWeekday(d.date) : ''}${d.title ? ` ${d.title}` : ''}`), L - 14), 12, yy + 6.5);
        doc.setDrawColor(230, 233, 238);
        doc.setLineWidth(0.2);
        for (let m = from; m <= to; m += 60) {
          doc.line(x(m), yy, x(m), yy + h);
          doc.setTextColor(160, 160, 160);
          doc.text(String(Math.floor(m / 60) % 24).padStart(2, '0'), x(m) + 0.5, yy + 2.2);
        }
        for (const b of placed) {
          const by = yy + 4 + b.lane * 9;
          const x1 = x(b.start);
          const x2 = Math.max(x(b.end), x1 + (b.point ? 0 : 1));
          const c = hex(kindColor(b.entry.kind));
          if (b.entry.kind === 'transfer' && !b.point) {
            doc.setDrawColor(...c);
            doc.setLineWidth(0.6);
            doc.line(x1, by + 3, x2 - 1.2, by + 3);
            doc.setFillColor(...c);
            doc.triangle(x2 - 1.6, by + 1.8, x2, by + 3, x2 - 1.6, by + 4.2, 'F');
            doc.setFontSize(5.5);
            doc.setTextColor(...c);
            const lbl = [b.entry.distance_km ? `${b.entry.distance_km} km` : '', b.entry.duration_min ? `${b.entry.duration_min} min` : '', b.entry.route_to].filter(Boolean).join(' · ') || b.entry.title;
            doc.text(doc.splitTextToSize(winAnsi(lbl), Math.max(14, x2 - x1))[0] || '', x1, by + 7);
          } else if (b.point) {
            doc.setFillColor(...c);
            doc.circle(x1, by + 3, 1.2, 'F');
            doc.setFontSize(5.5);
            doc.setTextColor(...NAVY);
            const w = Math.max(10, x(b.start + 70) - x1 - 2);
            doc.text(doc.splitTextToSize(winAnsi(entryTime(b.entry)), w)[0] || '', x1 + 1.8, by + 2.8);
            doc.text(doc.splitTextToSize(winAnsi(b.entry.title), w)[0] || '', x1 + 1.8, by + 5.6);
          } else {
            doc.setFillColor(...c);
            doc.roundedRect(x1, by, x2 - x1, 7, 0.8, 0.8, 'F');
            doc.setFontSize(5.5);
            doc.setTextColor(255, 255, 255);
            const w = Math.max(4, x2 - x1 - 1.4);
            doc.text(doc.splitTextToSize(winAnsi(entryTime(b.entry)), w)[0] || '', x1 + 0.7, by + 2.8);
            doc.text(doc.splitTextToSize(winAnsi(b.entry.title), w)[0] || '', x1 + 0.7, by + 5.6);
          }
        }
        yy += h + 5;
      }
      doc.setFontSize(6.5);
      doc.setTextColor(...MUTED);
      doc.text(winAnsi(`Kategorien: ${PLAN_KINDS.map((k) => kindLabel(k.id)).join(', ')} · Transfers als Pfeile mit km und Fahrzeit`), 12, 203);
    }

    /* DMC / Anbieter + Belege (nur intern) */
    if (internal && (plan.suppliers.length || plan.sources.length)) {
      doc.addPage('a4', 'portrait');
      let y2 = 18;
      const sp = (n: number) => { if (y2 + n > 280) { doc.addPage('a4', 'portrait'); y2 = 18; } };
      const head = (t: string) => {
        sp(12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...NAVY);
        doc.text(winAnsi(t), left, y2);
        y2 += 7;
      };
      if (plan.suppliers.length) {
        head('DMC- und Anbieter-Optionen');
        for (const r of plan.suppliers) {
          const lab = (list: readonly { id: string; label: string }[], v: string) => list.find((x) => x.id === v)?.label || v;
          const body = [r.contact, r.coverage, r.source ? `Quelle: ${r.source}` : '', r.note].filter(Boolean)
            .flatMap((t) => doc.splitTextToSize(winAnsi(t), right - left - 4) as string[]);
          sp(6 + body.length * 3.7);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...ACCENT);
          doc.text(winAnsi(r.name), left, y2);
          doc.setFontSize(7.5);
          doc.setTextColor(...NAVY);
          doc.text(winAnsi(`${lab(SUPPLIER_TYPES, r.type)} · ${lab(SUPPLIER_STATUSES, r.status)}`), right, y2, { align: 'right' });
          y2 += 4.2;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...MUTED);
          for (const l of body) { doc.text(l, left + 2, y2); y2 += 3.7; }
          y2 += 3;
        }
      }
      if (plan.sources.length) {
        y2 += 3;
        head('Belege / Quellen');
        for (const r of plan.sources) {
          const kind = SOURCE_KINDS.find((x) => x.id === r.kind)?.label || r.kind;
          const lines = doc.splitTextToSize(winAnsi(`${r.what}${r.what && r.ref ? ' — ' : ''}${r.ref} (${kind})`), right - left - 12);
          sp(lines.length * 3.7 + 1);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.setTextColor(...NAVY);
          doc.text(winAnsi(r.nr), left, y2);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...MUTED);
          doc.text(lines, left + 12, y2);
          y2 += lines.length * 3.7 + 1;
        }
      }
    }
  }

  const showProgram = !planDays.length && hasProgramData(calc.items) && (variant === 'intern' || calc.program_in_offer);
  if (showProgram) {
    const internal = variant === 'intern';
    doc.addPage();
    let y = 18;
    const left = leftMargin;
    const timeX = left;
    const textX = left + 26;
    const width = right - textX;
    const space = (needed: number) => { if (y + needed > 280) { doc.addPage(); y = 18; } };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(winAnsi(`Programm${calc.title ? ` — ${calc.title}` : ''}`), left, y);
    if (period) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(winAnsi(period), left, y + 5);
    }
    if (internal) {
      doc.setFontSize(8);
      doc.setTextColor(200, 0, 0);
      doc.text('INTERN — mit Anbietern und Preisstatus', right, y, { align: 'right' });
    }
    y += 13;
    const days = buildProgram(calc.items);
    days.forEach((d) => {
      space(14);
      doc.setFillColor(245, 247, 250);
      doc.rect(left, y - 4.2, right - left, 6.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...ACCENT);
      doc.text(winAnsi(programDayLabel(days, d.date)), left + 1.5, y);
      y += 7;
      for (const e of d.entries) {
        const it = e.item;
        const prefix = programPrefix(e);
        const title = doc.splitTextToSize(winAnsi(prefix + (it.description.trim() || categoryLabel(it.category))), width);
        const sub: string[] = [];
        const route = fmtRoute(it, '->');
        if (route) sub.push(route);
        if (it.pickup_point) sub.push(`Treffpunkt: ${it.pickup_point}`);
        if (internal) {
          const sup = [it.supplier_name, it.supplier_contact, it.supplier_ref, priceStatusLabel(it.price_status)].filter(Boolean).join(' · ');
          if (sup) sub.push(sup);
        }
        const subLines = sub.flatMap((t) => doc.splitTextToSize(winAnsi(t), width) as string[]);
        space(title.length * 4.2 + subLines.length * 3.7 + 2);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...NAVY);
        doc.text(winAnsi(programTime(e) || '—'), timeX + 1.5, y);
        doc.text(title, textX, y);
        y += title.length * 4.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        for (const l of subLines) { doc.text(l, textX, y); y += 3.7; }
        y += 1.8;
      }
      y += 3;
    });
  }

  /* ─── Interne Variante: Kalkulationstabelle auf Seite 2 ─── */
  if (variant === 'intern') {
    doc.addPage('a4', 'portrait');
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
    if (rates) doc.text(`Kursbasis: ${rates.source} · Kursdatum ${rates.date} · Positionen pro Person · Teilnehmer: ${pax}`, left, y + 9.5);
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
        const serviceDate = fmtServiceDate(item.service_from, item.service_to);
        const details = [
          fmtTimeRange(item), fmtRoute(item, '->'), item.pickup_point ? `Treffpunkt ${item.pickup_point}` : '',
          item.supplier_name, item.supplier_contact, item.supplier_ref, priceStatusLabel(item.price_status),
        ].filter(Boolean).join(' · ');
        const desc = doc.splitTextToSize(
          winAnsi(`${item.description.trim() || g.label}${(item.room_category || '').trim() ? ` — ${item.room_category}` : ''}${serviceDate ? ` (${serviceDate})` : ''}${details ? `\n${details}` : ''}`),
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
      if (group) {
        y += 2;
        sumRow(`EK gesamt (${group.pax} Pax)`, money(group.ekTotal, target));
        sumRow(`Marge gesamt (${group.pax} Pax)`, money(group.marginTotal, target), { red: group.marginTotal < 0 });
        sumRow(`VK gesamt (${group.pax} Pax)`, money(group.vkTotal, target), { big: true, accent: true });
      }
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

  /* ─── Interne Variante: Anfragen an Leistungsträger (voller Text) ─── */
  if (variant === 'intern' && inquiries.length > 0) {
    doc.addPage();
    let y = 18;
    const left = leftMargin;
    const width = right - left;
    const space = (needed: number) => { if (y + needed > 280) { doc.addPage(); y = 18; } };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(`Anfragen an Leistungsträger ${calc.calc_number || ''}`.trim(), left, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 0, 0);
    doc.text('NUR FÜR DEN INTERNEN GEBRAUCH', left, y + 5);
    y += 12;
    // Übersicht
    doc.setTextColor(...MUTED);
    doc.setFontSize(8);
    for (const [n, inq] of inquiries.entries()) {
      space(5);
      const line = winAnsi(`${n + 1}. ${inq.supplier || inq.subject || 'Anfrage'} — ${inquiryStatusLabel(inq.status)}${inq.sent_at ? `, gesendet ${fmtDate(inq.sent_at)}` : ''}`);
      doc.text(doc.splitTextToSize(line, width), left, y);
      y += 4.2;
    }
    y += 4;
    for (const [n, inq] of inquiries.entries()) {
      space(30);
      doc.setDrawColor(...STROKE);
      doc.setLineWidth(0.3);
      doc.line(left, y, right, y);
      y += 6;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...ACCENT);
      doc.text(winAnsi(`${n + 1}. ${inq.supplier || 'Anfrage'}`), left, y);
      doc.setFontSize(8);
      doc.setTextColor(...NAVY);
      doc.text(winAnsi(inquiryStatusLabel(inq.status) + (inq.sent_at ? ` · gesendet ${fmtDate(inq.sent_at)}${inq.sent_by ? ` von ${inq.sent_by}` : ''}` : ' · noch nicht gesendet')), right, y, { align: 'right' });
      y += 5;
      const meta: Array<[string, string]> = [
        ['An:', inq.to_addr || '—'],
        ...(inq.cc_addr ? [['Kopie:', inq.cc_addr] as [string, string]] : []),
        ['Betreff:', inq.subject || '—'],
        ...(inq.sent_from ? [['Von:', inq.sent_from] as [string, string]] : []),
      ];
      doc.setFontSize(8);
      for (const [k, v] of meta) {
        const lines = doc.splitTextToSize(winAnsi(v), width - 20);
        space(lines.length * 3.8 + 1);
        doc.setFont('helvetica', 'bold');
        doc.text(k, left, y);
        doc.setFont('helvetica', 'normal');
        doc.text(lines, left + 20, y);
        y += lines.length * 3.8;
      }
      y += 2;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(30, 30, 30);
      for (const raw of winAnsi(inq.body || '').split('\n')) {
        const lines = raw.trim() ? doc.splitTextToSize(raw, width) : [''];
        for (const l of lines) {
          space(4);
          doc.text(l, left, y);
          y += 3.9;
        }
      }
      if (inq.internal_note.trim()) {
        y += 2;
        const lines = doc.splitTextToSize(winAnsi(`Interne Notiz: ${inq.internal_note.trim()}`), width);
        space(lines.length * 3.8);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(lines, left, y);
        y += lines.length * 3.8;
      }
      y += 6;
    }
  }

  return doc.output('arraybuffer') as ArrayBuffer;
}
