/**
 * seoReportPdf.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gebrandeter SEO- & GEO-Audit-PDF-Report (Faltin Travel). Voll dynamisch.
 * - WinAnsi-Sanitize aller Texte (jsPDF-Standardfont kann kein →/≤/≥/✓ ...).
 * - Kategorie-Sub-Scores, Stärken-Sektion, saubere Markdown-Wiedergabe der KI.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import type { SeoReport, SeoCheck, CheckCat } from './seoCheck';

type RGB = [number, number, number];
const NAVY: RGB = [20, 48, 71];
const ORANGE: RGB = [217, 83, 30];
const DANGER: RGB = [220, 38, 38];
const WARN: RGB = [217, 119, 6];
const OK: RGB = [22, 163, 74];
const MUT: RGB = [107, 114, 128];
const INK: RGB = [51, 58, 68];
const ZEBRA: RGB = [247, 249, 251];
const STROKE: RGB = [219, 225, 232];
const GREENBG: RGB = [240, 253, 244];

const W = 210, H = 297, M = 18, CONTENT_TOP = 34, CONTENT_BOTTOM = 20;
const CAT_LABEL: Record<CheckCat, string> = { onpage: 'On-Page-SEO', technik: 'Technik & Crawlbarkeit', structured: 'Strukturierte Daten', geo: 'GEO / KI-Lesbarkeit' };
const RECOMMENDED_JSONLD = ['Organization', 'Event', 'Product', 'Offer', 'FAQPage', 'BreadcrumbList'];

/** WinAnsi-sichere Ersetzungen (jsPDF-Standardfont). */
function san(s: string): string {
  return (s == null ? '' : String(s))
    .replace(/[→➔➜➡⇒]/g, '->')
    .replace(/[←⇐]/g, '<-')
    .replace(/≤/g, '<=').replace(/≥/g, '>=')
    .replace(/[✓✔]/g, '+').replace(/[✗✘✕✖]/g, 'x')
    .replace(/…/g, '...').replace(/ /g, ' ')
    .replace(/[Ѐ-ӿ]/g, '');
}
function statusColor(s: string): RGB { return s === 'ok' ? OK : s === 'warn' ? WARN : s === 'fail' ? DANGER : MUT; }
function scoreColor(s: number): RGB { return s >= 85 ? OK : s >= 60 ? WARN : DANGER; }

export function buildSeoReportPdf(report: SeoReport): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  let logo = '';
  try { const p = path.join(process.cwd(), 'public', 'faltin-logo-email.png'); if (fs.existsSync(p)) logo = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`; } catch { /* */ }

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const T = (s: string, x: number, y: number, opts?: Parameters<typeof doc.text>[3]) => doc.text(san(s), x, y, opts);
  const split = (s: string, w: number) => doc.splitTextToSize(san(s), w) as string[];

  let y = CONTENT_TOP;
  const ensure = (need: number) => { if (y + need > H - CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; } };
  const newChapter = () => { doc.addPage(); y = CONTENT_TOP; };
  const sectionTitle = (t: string) => { ensure(16); setFill(ORANGE); doc.rect(M, y - 4.5, 1.6, 8, 'F'); setText(NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); T(t, M + 5, y + 1.5); y += 12; };
  const para = (t: string, opts: { size?: number; color?: RGB; gap?: number; bold?: boolean } = {}) => {
    const size = opts.size ?? 9.5; doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(size); setText(opts.color ?? INK);
    split(t, W - 2 * M).forEach((ln) => { ensure(size * 0.5 + 1.6); doc.text(ln, M, y); y += size * 0.5 + 1.6; }); y += opts.gap ?? 3;
  };

  // ── COVER ──
  setFill(NAVY); doc.rect(0, 0, W, 70, 'F'); setFill(ORANGE); doc.rect(0, 70, W, 2, 'F');
  setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(26); T('FALTIN TRAVEL', M, 30);
  setText(ORANGE); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); T('WIR LIEFERN EMOTIONEN', M, 37);
  setText([255, 255, 255]); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); T('Technischer Bericht', M, 52);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26); T('SEO & GEO Audit', M, 63);

  autoTable(doc, {
    startY: 96, margin: { left: M, right: M }, theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2.5, bottom: 2.5, left: 0, right: 4 }, textColor: INK, font: 'helvetica' },
    columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: W - 2 * M - 30 } },
    didDrawCell: (d) => { if (d.section === 'body' && d.column.index === 1) { setDraw(STROKE); doc.setLineWidth(0.2); doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height); } },
    body: [
      ['Projekt', 'Faltin Travel - Sportreisen-Plattform'],
      ['Domain', san(report.baseUrl)],
      ['Datum', `${today} - Momentaufnahme (Snapshot)`],
      ['Geprüft', `${report.summary.pages} Seiten - ${report.summary.checks} Checks (${report.summary.ok} ok / ${report.summary.warn} Warnungen / ${report.summary.fail} Fehler)`],
      ['Methodik', 'On-Page-SEO, Technik, JSON-LD, GEO/KI-Lesbarkeit (eigener Crawl der Sitemap)'],
    ],
  });
  let ry = finalY() + 8;
  const sc = scoreColor(report.score);
  setFill(sc); doc.roundedRect(M, ry, W - 2 * M, 24, 2, 2, 'F');
  setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); T(`SEO/GEO-SCORE: ${report.score} / 100`, M + 6, ry + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const verdict = report.score >= 85 ? 'Sehr gut aufgestellt - nur Feinschliff offen.' : report.score >= 60 ? 'Solide Basis mit klarem Optimierungspotenzial (v.a. strukturierte Daten & GEO).' : 'Deutlicher Handlungsbedarf bei der Auffindbarkeit fuer Suche und KI.';
  split(verdict, W - 2 * M - 12).forEach((ln, i) => doc.text(ln, M + 6, ry + 15 + i * 4));
  setText(MUT); doc.setFontSize(8); T(`Erstellt aus dem SEO-Modul (/admin/seo). Stand ${today}.`, M, ry + 33);

  // ── KAPITEL: Überblick (Kategorien + Stärken) ──
  newChapter();
  sectionTitle('Überblick nach Kategorie');
  const cats: CheckCat[] = ['onpage', 'technik', 'structured', 'geo'];
  cats.forEach((c) => {
    const v = report.categories[c] ?? 0; const col = scoreColor(v);
    ensure(11);
    setText(NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); T(CAT_LABEL[c], M, y + 3);
    const barX = M + 62, barW = W - M - barX - 14;
    setFill([237, 240, 244]); doc.roundedRect(barX, y, barW, 5, 1.2, 1.2, 'F');
    setFill(col); doc.roundedRect(barX, y, Math.max(2, barW * v / 100), 5, 1.2, 1.2, 'F');
    setText(col); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); T(`${v}`, W - M, y + 4, { align: 'right' });
    y += 9;
  });
  y += 3;

  // Stärken
  if (report.strengths.length) {
    sectionTitle('Das läuft bereits gut');
    const boxTop = y;
    const lines = report.strengths.flatMap((s) => split(s, W - 2 * M - 14).map((ln, i) => ({ ln, first: i === 0 })));
    const boxH = lines.length * 5.2 + 6;
    ensure(boxH);
    setFill(GREENBG); doc.roundedRect(M, boxTop, W - 2 * M, boxH, 2, 2, 'F');
    setFill(OK); doc.rect(M, boxTop, 1.6, boxH, 'F');
    let yy = boxTop + 6;
    lines.forEach(({ ln, first }) => {
      if (first) { setText(OK); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('+', M + 6, yy); }
      setText(INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(ln, M + 11, yy); yy += 5.2;
    });
    y = boxTop + boxH + 6;
  }

  // ── KAPITEL 1: Technik & GEO ──
  newChapter();
  sectionTitle('1 · Technik, Crawlbarkeit & GEO');
  para('Grundlagen für Crawlbarkeit (Suche) und Auffindbarkeit in KI-Antworten (GEO).', { size: 8, color: MUT, gap: 2 });
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Prüfung', 'Status', 'Detail']],
    body: report.site.map((c: SeoCheck) => [san(c.label), c.status.toUpperCase(), san(c.detail)]),
    theme: 'grid', styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle', font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: 22, halign: 'center', fontStyle: 'bold', textColor: [255, 255, 255] }, 2: { cellWidth: 'auto' } },
    didParseCell: (d) => { if (d.section === 'body' && d.column.index === 1) d.cell.styles.fillColor = statusColor(report.site[d.row.index].status); },
  });
  y = finalY() + 6;

  sectionTitle('2 · Strukturierte Daten (JSON-LD)');
  para('Empfohlene Typen für Rich Results und maschinelles Verständnis (KI). Gefunden vs. fehlend.', { size: 8, color: MUT, gap: 2 });
  const purpose: Record<string, string> = { Organization: 'Marke/Anbieter', Event: 'Event-Daten (Datum, Ort)', Product: 'Paket als Produkt', Offer: 'Preis/Verfügbarkeit', FAQPage: 'FAQ Rich Result', BreadcrumbList: 'Breadcrumb-Navigation' };
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Typ', 'Status', 'Zweck']],
    body: RECOMMENDED_JSONLD.map((t) => [t, report.jsonldTypes.includes(t) ? 'VORHANDEN' : 'FEHLT', purpose[t] || '']),
    theme: 'grid', styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle', font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: 30, halign: 'center', fontStyle: 'bold', textColor: [255, 255, 255] }, 2: { cellWidth: 'auto' } },
    didParseCell: (d) => { if (d.section === 'body' && d.column.index === 1) d.cell.styles.fillColor = report.jsonldTypes.includes(RECOMMENDED_JSONLD[d.row.index]) ? OK : DANGER; },
  });

  // ── KAPITEL 3: Seiten ──
  newChapter();
  sectionTitle('3 · Seiten-Befunde');
  para('Score je Seite und offene Punkte (Warnungen/Fehler). Grün = stark, rot = Handlungsbedarf.', { size: 8, color: MUT, gap: 2 });
  const pageRows = report.pages.map((p) => {
    const issues = p.checks.filter((c) => c.status === 'warn' || c.status === 'fail');
    const top = issues.slice(0, 3).map((c) => c.label).join(', ') || 'keine offenen Punkte';
    return [san(p.label.length > 40 ? p.label.slice(0, 39) + '…' : p.label), String(p.score), String(issues.length), san(top)];
  });
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Seite', 'Score', 'Offen', 'Wichtigste Befunde']],
    body: pageRows,
    theme: 'grid', styles: { fontSize: 8, cellPadding: 2.2, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle', font: 'helvetica' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 58, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: 16, halign: 'center', fontStyle: 'bold', textColor: [255, 255, 255] }, 2: { cellWidth: 14, halign: 'center' }, 3: { cellWidth: 'auto' } },
    didParseCell: (d) => { if (d.section === 'body' && d.column.index === 1) d.cell.styles.fillColor = scoreColor(report.pages[d.row.index].score); },
  });

  // ── KAPITEL 4: Empfehlungen (KI, sauberes Markdown) ──
  newChapter();
  sectionTitle('4 · Empfehlungen (priorisiert)');
  if (report.ai?.text) {
    const inline = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
    for (const raw of report.ai.text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || /^[-*_]{3,}$/.test(line) || line.startsWith('|') || line.startsWith('>')) { if (!line) y += 1.5; continue; }
      let m: RegExpMatchArray | null;
      if ((m = line.match(/^#{1,6}\s+(.*)$/))) {
        ensure(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setText(NAVY);
        split(inline(m[1]), W - 2 * M).forEach((l) => { ensure(6); doc.text(l, M, y); y += 5.6; }); y += 1.5;
      } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
        doc.setFontSize(9); const parts = split(inline(m[1]), W - 2 * M - 6);
        parts.forEach((l, i) => { ensure(5); if (i === 0) { setText(ORANGE); doc.setFont('helvetica', 'bold'); doc.text('-', M + 2, y); } setText(INK); doc.setFont('helvetica', 'normal'); doc.text(l, M + 6, y); y += 4.6; });
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setText(INK);
        split(inline(line), W - 2 * M).forEach((l) => { ensure(5.5); doc.text(l, M, y); y += 5; }); y += 1.5;
      }
    }
  } else {
    para('Keine KI-Empfehlung verfügbar (Anthropic-Key in KI-Redaktion hinterlegen und neu scannen).', { color: MUT });
  }

  y += 4;
  sectionTitle('Methodik & Hinweis');
  para('Eigener Crawl der in der Sitemap gelisteten Seiten (intern über localhost); Auswertung des serverseitig ausgelieferten HTML (Title, Meta, H1/H2, Canonical, OpenGraph/Twitter, JSON-LD, Bild-Alt, Viewport, Inhaltstiefe, interne Links, Mixed-Content) sowie sitemap.xml/robots.txt/llms.txt und 404-Handling. GEO bewertet, ob Preis-/Paket-Fakten im SSR-HTML stehen, semantisches HTML und ob KI-Crawler zugelassen sind. Stand: ' + today + '. Live-Version: Admin -> System -> SEO & GEO.', { size: 8, color: MUT });

  // ── Kopf-/Fußzeile ──
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    if (logo) { try { doc.addImage(logo, 'PNG', M, 9, 30, 30 * 83 / 264); } catch { /* */ } }
    setText(MUT); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    T('SEO & GEO Audit', W - M, 12, { align: 'right' });
    setDraw(ORANGE); doc.setLineWidth(0.5); doc.line(M, 20, W - M, 20);
    setDraw(STROKE); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
    setText(MUT); doc.setFontSize(7.5);
    T('Faltin Travel AG - Vertraulich, nur zur internen Verwendung', M, H - 10);
    T(`Seite ${i} / ${total}`, W - M, H - 10, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
