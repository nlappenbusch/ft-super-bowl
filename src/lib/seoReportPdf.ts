/**
 * seoReportPdf.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gebrandeter SEO- & GEO-Audit-PDF-Report (Faltin Travel), serverseitig via jsPDF.
 * Voll dynamisch aus dem SEO-Scan. Kopf-/Fußzeile + Seitenzahlen wie der Status-Report.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import type { SeoReport, SeoCheck } from './seoCheck';

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

const W = 210, H = 297, M = 18, CONTENT_TOP = 34, CONTENT_BOTTOM = 20;
const RECOMMENDED_JSONLD = ['Organization', 'Event', 'Product', 'Offer', 'FAQPage', 'BreadcrumbList'];

function statusColor(s: string): RGB {
  if (s === 'ok') return OK;
  if (s === 'warn') return WARN;
  if (s === 'fail') return DANGER;
  return MUT;
}
function scoreColor(s: number): RGB {
  if (s >= 85) return OK;
  if (s >= 60) return WARN;
  return DANGER;
}

export function buildSeoReportPdf(report: SeoReport): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

  let logo = '';
  try {
    const p = path.join(process.cwd(), 'public', 'faltin-logo-email.png');
    if (fs.existsSync(p)) logo = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  } catch { /* ohne Logo */ }

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  let y = CONTENT_TOP;
  const ensure = (need: number) => { if (y + need > H - CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; } };
  const newChapter = () => { doc.addPage(); y = CONTENT_TOP; };
  const sectionTitle = (t: string) => {
    ensure(16); setFill(ORANGE); doc.rect(M, y - 4.5, 1.6, 8, 'F');
    setText(NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(t, M + 5, y + 1.5); y += 12;
  };
  const para = (t: string, opts: { size?: number; color?: RGB; gap?: number; bold?: boolean } = {}) => {
    const size = opts.size ?? 9.5;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(size); setText(opts.color ?? INK);
    (doc.splitTextToSize(t, W - 2 * M) as string[]).forEach((ln) => { ensure(size * 0.5 + 1.6); doc.text(ln, M, y); y += size * 0.5 + 1.6; });
    y += opts.gap ?? 3;
  };

  // ── COVER ──
  setFill(NAVY); doc.rect(0, 0, W, 70, 'F'); setFill(ORANGE); doc.rect(0, 70, W, 2, 'F');
  setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.text('FALTIN TRAVEL', M, 30);
  setText(ORANGE); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('WIR LIEFERN EMOTIONEN', M, 37);
  setText([255, 255, 255]); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text('Technischer Bericht', M, 52);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.text('SEO & GEO Audit', M, 63);

  autoTable(doc, {
    startY: 96, margin: { left: M, right: M }, theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2.5, bottom: 2.5, left: 0, right: 4 }, textColor: INK },
    columnStyles: { 0: { cellWidth: 30, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: W - 2 * M - 30 } },
    didDrawCell: (d) => { if (d.section === 'body' && d.column.index === 1) { setDraw(STROKE); doc.setLineWidth(0.2); doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height); } },
    body: [
      ['Projekt', 'Faltin Travel – Sportreisen-Plattform'],
      ['Domain', report.baseUrl],
      ['Datum', `${today} · Momentaufnahme (Snapshot)`],
      ['Geprüft', `${report.summary.pages} Seiten · ${report.summary.ok} ok / ${report.summary.warn} Warnungen / ${report.summary.fail} Fehler`],
      ['Methodik', 'On-Page-SEO, Technik, JSON-LD, GEO/KI-Lesbarkeit (eigener Crawl der Sitemap)'],
    ],
  });
  let ry = finalY() + 8;
  const sc = scoreColor(report.score);
  setFill(sc); doc.roundedRect(M, ry, W - 2 * M, 24, 2, 2, 'F');
  setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(`SEO/GEO-SCORE: ${report.score} / 100`, M + 6, ry + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const verdict = report.score >= 85 ? 'Sehr gut aufgestellt – nur Feinschliff offen.' : report.score >= 60 ? 'Solide Basis mit klarem Optimierungspotenzial (v.a. strukturierte Daten & GEO).' : 'Deutlicher Handlungsbedarf bei Auffindbarkeit für Suche und KI.';
  (doc.splitTextToSize(verdict, W - 2 * M - 12) as string[]).forEach((ln, i) => doc.text(ln, M + 6, ry + 15 + i * 4));
  setText(MUT); doc.setFontSize(8); doc.text(`Erstellt aus dem SEO-Modul (/admin/seo). Stand ${today}.`, M, ry + 33);

  // ── KAPITEL 1: Technik & GEO (Site) ──
  newChapter();
  sectionTitle('1 · Technik & GEO (Site-Ebene)');
  para('Grundlagen für Crawlbarkeit (Suche) und Auffindbarkeit in KI-Antworten (GEO).', { size: 8, color: MUT, gap: 2 });
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Prüfung', 'Status', 'Detail']],
    body: report.site.map((c: SeoCheck) => [c.label, c.status.toUpperCase(), c.detail]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 50, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: 22, halign: 'center', fontStyle: 'bold', textColor: [255, 255, 255] }, 2: { cellWidth: 'auto' } },
    didParseCell: (d) => { if (d.section === 'body' && d.column.index === 1) d.cell.styles.fillColor = statusColor(report.site[d.row.index].status); },
  });
  y = finalY() + 6;

  // Strukturierte Daten
  sectionTitle('2 · Strukturierte Daten (JSON-LD)');
  para('Empfohlene Typen für Rich Results und maschinelles Verständnis (KI). Gefunden vs. fehlend.', { size: 8, color: MUT, gap: 2 });
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Typ', 'Status', 'Zweck']],
    body: RECOMMENDED_JSONLD.map((t) => {
      const have = report.jsonldTypes.includes(t);
      const purpose: Record<string, string> = { Organization: 'Marke/Anbieter', Event: 'Event-Daten (Datum, Ort)', Product: 'Paket als Produkt', Offer: 'Preis/Verfügbarkeit', FAQPage: 'FAQ Rich Result', BreadcrumbList: 'Breadcrumb-Navigation' };
      return [t, have ? 'VORHANDEN' : 'FEHLT', purpose[t] || ''];
    }),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: 30, halign: 'center', fontStyle: 'bold', textColor: [255, 255, 255] }, 2: { cellWidth: 'auto' } },
    didParseCell: (d) => { if (d.section === 'body' && d.column.index === 1) d.cell.styles.fillColor = report.jsonldTypes.includes(RECOMMENDED_JSONLD[d.row.index]) ? OK : DANGER; },
  });

  // ── KAPITEL: Seiten ──
  newChapter();
  sectionTitle('3 · Seiten-Befunde');
  para('Score je Seite und Anzahl offener Punkte (Warnungen/Fehler).', { size: 8, color: MUT, gap: 2 });
  const pageRows = report.pages.map((p) => {
    const issues = p.checks.filter((c) => c.status === 'warn' || c.status === 'fail');
    const top = issues.slice(0, 3).map((c) => c.label).join(', ') || '—';
    return [p.label.length > 42 ? p.label.slice(0, 41) + '…' : p.label, String(p.score), String(issues.length), top];
  });
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Seite', 'Score', 'Offen', 'Wichtigste Befunde']],
    body: pageRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.2, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 58, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: 16, halign: 'center', fontStyle: 'bold', textColor: [255, 255, 255] }, 2: { cellWidth: 14, halign: 'center' }, 3: { cellWidth: 'auto' } },
    didParseCell: (d) => { if (d.section === 'body' && d.column.index === 1) d.cell.styles.fillColor = scoreColor(report.pages[d.row.index].score); },
  });

  // ── KAPITEL: KI-Empfehlung ──
  newChapter();
  sectionTitle('4 · Empfehlungen (priorisiert)');
  if (report.ai?.text) {
    const md = report.ai.text;
    const esc = (s: string) => s;
    for (const raw of md.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) { y += 2; continue; }
      let m: RegExpMatchArray | null;
      if ((m = line.match(/^#{1,6}\s+(.*)$/))) { ensure(8); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setText(NAVY); (doc.splitTextToSize(esc(m[1]), W - 2 * M) as string[]).forEach((l) => { ensure(6); doc.text(l, M, y); y += 5.5; }); y += 1; }
      else if ((m = line.match(/^[-*]\s+(.*)$/))) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9); setText(INK); (doc.splitTextToSize(esc(m[1]), W - 2 * M - 6) as string[]).forEach((l, i) => { ensure(5); if (i === 0) { setText(ORANGE); doc.setFont('helvetica', 'bold'); doc.text('•', M + 2, y); setText(INK); doc.setFont('helvetica', 'normal'); } doc.text(l, M + 6, y); y += 4.6; }); }
      else { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setText(INK); (doc.splitTextToSize(esc(line.replace(/\*\*/g, '')), W - 2 * M) as string[]).forEach((l) => { ensure(5.5); doc.text(l, M, y); y += 5; }); y += 1; }
    }
  } else {
    para('Keine KI-Empfehlung verfügbar (Anthropic-Key in KI-Redaktion hinterlegen und neu scannen).', { color: MUT });
  }

  y += 4;
  sectionTitle('Methodik & Hinweis');
  para('Eigener Crawl der in der Sitemap gelisteten Seiten; Auswertung des serverseitig ausgelieferten HTML (Title, Meta, H1, Canonical, OpenGraph, JSON-LD, Bild-Alt) sowie sitemap.xml/robots.txt/llms.txt. GEO bewertet, ob Preis-/Paket-Fakten im SSR-HTML stehen und ob KI-Crawler zugelassen sind. Stand: ' + today + '. Live-Version: Admin -> System -> SEO & GEO.', { size: 8, color: MUT });

  // ── Kopf-/Fußzeile ──
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    if (logo) { try { doc.addImage(logo, 'PNG', M, 9, 30, 30 * 83 / 264); } catch { /* ignore */ } }
    setText(MUT); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('SEO & GEO Audit', W - M, 12, { align: 'right' });
    setDraw(ORANGE); doc.setLineWidth(0.5); doc.line(M, 20, W - M, 20);
    setDraw(STROKE); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
    setText(MUT); doc.setFontSize(7.5);
    doc.text('Faltin Travel AG · Vertraulich – nur zur internen Verwendung', M, H - 10);
    doc.text(`Seite ${i} / ${total}`, W - M, H - 10, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
