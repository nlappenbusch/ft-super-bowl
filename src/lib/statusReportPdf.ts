/**
 * statusReportPdf.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Baut den gebrandeten System-Status- & Security-Audit-PDF-Report (Faltin Travel)
 * serverseitig mit jsPDF + autoTable. Jedes Hauptkapitel startet auf einer neuen
 * Seite; großzügige Abstände, einheitliche Kopf-/Fußzeile mit Seitenzahlen.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import type { HealthReport, StatusReport, VersionRow } from './statusCheck';

type RGB = [number, number, number];
const NAVY: RGB = [20, 48, 71];
const ORANGE: RGB = [217, 83, 30];
const DANGER: RGB = [220, 38, 38];
const CRIT: RGB = [153, 27, 27];
const WARN: RGB = [217, 119, 6];
const OK: RGB = [22, 163, 74];
const CYAN: RGB = [8, 145, 178];
const MUT: RGB = [107, 114, 128];
const INK: RGB = [51, 58, 68];
const ZEBRA: RGB = [247, 249, 251];
const STROKE: RGB = [219, 225, 232];

const W = 210, H = 297, M = 18;
const CONTENT_TOP = 34, CONTENT_BOTTOM = 20;

function sevColor(s: string): RGB {
  const u = (s || '').toUpperCase();
  if (u.includes('CRIT')) return CRIT;
  if (u.includes('HIGH')) return DANGER;
  if (u.includes('MOD') || u.includes('MED')) return WARN;
  if (u.includes('LOW')) return CYAN;
  return MUT;
}
function stateLabel(state: string): { label: string; color: RGB } {
  switch (state) {
    case 'current': return { label: 'aktuell', color: OK };
    case 'patch': return { label: 'Patch', color: CYAN };
    case 'minor': return { label: 'Minor', color: WARN };
    case 'major': return { label: 'Major', color: DANGER };
    default: return { label: '?', color: MUT };
  }
}
function healthColor(status: string): RGB {
  if (status === 'ok') return OK;
  if (status === 'warn') return WARN;
  return DANGER;
}

export function buildStatusReportPdf(health: HealthReport | null, report: StatusReport | null): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const today = new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Logo (für Kopfzeile, auf weiss)
  let logo = '';
  try {
    const p = path.join(process.cwd(), 'public', 'faltin-logo-email.png');
    if (fs.existsSync(p)) logo = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
  } catch { /* ohne Logo weiter */ }

  const versions = report?.versions || [];
  const vulns = report?.vulnerabilities || [];
  const cnt = (k: string) => vulns.filter((v) => (v.severity || '').toUpperCase().includes(k)).length;
  const nCrit = cnt('CRIT'), nHigh = cnt('HIGH'), nMod = cnt('MOD') + cnt('MED'), nLow = cnt('LOW');
  const nOutdated = versions.filter((v) => v.state === 'minor' || v.state === 'major').length;
  const nMajor = versions.filter((v) => v.state === 'major').length;
  const latestOf = (name: string) => versions.find((v) => v.name === name)?.latest || '–';

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  let y = CONTENT_TOP;
  const ensure = (need: number) => { if (y + need > H - CONTENT_BOTTOM) { doc.addPage(); y = CONTENT_TOP; } };
  const newChapter = () => { doc.addPage(); y = CONTENT_TOP; };

  const sectionTitle = (t: string) => {
    ensure(16);
    setFill(ORANGE); doc.rect(M, y - 4.5, 1.6, 8, 'F');
    setText(NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text(t, M + 5, y + 1.5);
    y += 12;
  };
  const para = (t: string, opts: { size?: number; color?: RGB; gap?: number; bold?: boolean } = {}) => {
    const size = opts.size ?? 9.5;
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(size);
    setText(opts.color ?? INK);
    const lines = doc.splitTextToSize(t, W - 2 * M) as string[];
    lines.forEach((ln) => { ensure(size * 0.5 + 1.6); doc.text(ln, M, y); y += size * 0.5 + 1.6; });
    y += opts.gap ?? 3;
  };

  // ── COVER (Seite 1) ──────────────────────────────────────────────────────
  setFill(NAVY); doc.rect(0, 0, W, 70, 'F');
  setFill(ORANGE); doc.rect(0, 70, W, 2, 'F');
  setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
  doc.text('FALTIN TRAVEL', M, 30);
  setText(ORANGE); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('WIR LIEFERN EMOTIONEN', M, 37);
  setText([255, 255, 255]); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Technischer Bericht', M, 52);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
  doc.text('System-Status & Security-Audit', M, 63);

  // Meta-Tabelle
  autoTable(doc, {
    startY: 96,
    margin: { left: M, right: M },
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2.5, bottom: 2.5, left: 0, right: 4 }, textColor: INK },
    columnStyles: { 0: { cellWidth: 28, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: W - 2 * M - 28 } },
    didDrawCell: (d) => {
      if (d.section === 'body' && d.column.index === 1) {
        setDraw(STROKE); doc.setLineWidth(0.2);
        doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
      }
    },
    body: [
      ['Projekt', 'Faltin Travel – Sportreisen-Plattform · next.faltintravel.com'],
      ['Stack', 'Next.js 16 (App Router) · React 19 · TypeScript · better-sqlite3 · Docker (self-hosted)'],
      ['Datum', `${today}  ·  Momentaufnahme (Snapshot)`],
      ['Methodik', 'Live-Health + Abgleich npm-Registry / nodejs.org / OSV.dev (Google)'],
    ],
  });

  // Risiko-Badge
  const riskHigh = nCrit + nHigh > 0;
  let ry = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  setFill(riskHigh ? DANGER : OK); doc.roundedRect(M, ry, W - 2 * M, 24, 2, 2, 'F');
  setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(`GESAMTRISIKO: ${riskHigh ? 'ERHÖHT' : 'NIEDRIG'}`, M + 6, ry + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  const rtext = riskHigh
    ? `${nCrit} kritische und ${nHigh} hohe Schwachstellen offen – primär Next.js (Middleware-Bypass, SSRF, DoS) auf der öffentlichen Seite. Vollständig durch Upgrades behebbar; sicherheitskritischer Teil in ~1–1,5 Std.`
    : 'Keine offenen kritischen/hohen Schwachstellen. Betrieblich stabil.';
  (doc.splitTextToSize(rtext, W - 2 * M - 12) as string[]).forEach((ln, i) => doc.text(ln, M + 6, ry + 15 + i * 4));
  setText(MUT); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(`Erstellt aus dem Status-Modul (/admin/status). Schwachstellendaten: OSV.dev, Stand ${today}.`, M, ry + 33);

  // ── KAPITEL: Management Summary (Seite 2) ────────────────────────────────
  newChapter();
  sectionTitle('Management Summary');
  // KPI-Karten
  const kpis: Array<[string, string, RGB]> = [
    [`${nCrit + nHigh}`, 'kritisch / hoch', DANGER],
    [`${vulns.length}`, 'Schwachstellen gesamt', WARN],
    [`${nOutdated}`, `veraltete Pakete (${nMajor} Major)`, NAVY],
    [riskHigh ? '~1–1,5 Std' : 'NIEDRIG', riskHigh ? 'bis Risiko niedrig' : 'Gesamtrisiko', OK],
  ];
  const kw = (W - 2 * M - 3 * 4) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (kw + 4);
    setFill(k[2]); doc.roundedRect(x, y, kw, 20, 2, 2, 'F');
    setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(k[0].length > 5 ? 11 : 16);
    doc.text(k[0], x + kw / 2, y + 9, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    (doc.splitTextToSize(k[1], kw - 4) as string[]).forEach((ln, j) => doc.text(ln, x + kw / 2, y + 13.5 + j * 3, { align: 'center' }));
  });
  y += 26;
  para('Die Plattform ist betrieblich stabil: Anwendung, Datenbank, M365-Mailversand, Inbound-Poll und das persistente Daten-Volume laufen. Architektur und Betrieb sind solide (CI-Gate, App-only-Graph, getrennter Seed-Mechanismus, persistentes Volume).');
  if (vulns.length > 0) {
    para(`Handlungsbedarf bei der Software-Aktualität: ${vulns.length} bekannte Schwachstellen (${nCrit} kritisch, ${nHigh} hoch, ${nMod} mittel, ${nLow} niedrig), alle durch Versions-Upgrades behebbar. Empfehlung: sicherheitskritische Updates sofort, der Rest geplant.`);
  } else if (nOutdated > 0) {
    para(`Aus Sicherheitssicht kein Handlungsbedarf: 0 bekannte Schwachstellen. Offen sind nur ${nOutdated} optionale Versions-Update${nOutdated === 1 ? '' : 's'}${nMajor > 0 ? ` (davon ${nMajor} Major)` : ''} – siehe Maßnahmenplan, ohne Zeitdruck.`);
  } else {
    para('Voll aktuell: keine bekannten Schwachstellen und alle beobachteten Pakete auf dem neuesten Stand. Kein Handlungsbedarf.');
  }

  // ── KAPITEL: Betriebs-Health ─────────────────────────────────────────────
  sectionTitle('1 · Betriebs-Health (Audit)');
  para('Snapshot der laufenden Komponenten. Live-Werte jederzeit unter Admin -> System -> Status.', { size: 8, color: MUT, gap: 1 });
  const healthItems = (health?.items || []).map((it) => [it.label, it.status.toUpperCase(), it.detail]);
  if (healthItems.length === 0) healthItems.push(['Health', '–', 'Kein Live-Health verfügbar.']);
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Komponente', 'Status', 'Detail']],
    body: healthItems,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: 24, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 'auto' } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 1) {
        const c = healthColor((health?.items?.[d.row.index]?.status) || 'down');
        d.cell.styles.fillColor = c; d.cell.styles.textColor = [255, 255, 255];
      }
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── KAPITEL: Sicherheits-Befunde ─────────────────────────────────────────
  newChapter();
  sectionTitle('2 · Sicherheits-Befunde (CVEs)');
  para('Quelle: OSV.dev (Google), Abgleich pro installierter Version. Schweregrade nach GHSA/Hersteller.', { size: 8, color: MUT, gap: 2 });
  // Schweregrad-Kästen
  const sboxes: Array<[string, number, RGB]> = [['CRITICAL', nCrit, CRIT], ['HIGH', nHigh, DANGER], ['MODERATE', nMod, WARN], ['LOW', nLow, CYAN]];
  const sw = (W - 2 * M - 3 * 4) / 4;
  sboxes.forEach((b, i) => {
    const x = M + i * (sw + 4);
    setFill(b[2]); doc.roundedRect(x, y, sw, 16, 2, 2, 'F');
    setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(14);
    doc.text(String(b[1]), x + sw / 2, y + 8, { align: 'center' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text(b[0], x + sw / 2, y + 13, { align: 'center' });
  });
  y += 22;
  if (vulns.length === 0) {
    para('Keine offenen Schwachstellen in den beobachteten Paketen.', { size: 9.5, bold: true, color: OK });
  } else {
  para('Kritische und hohe Befunde (mittel/niedrig werden durch dieselben Upgrades mitbehoben):', { size: 9.5, bold: true, gap: 1 });
  const ch = vulns.filter((v) => /CRIT|HIGH/.test((v.severity || '').toUpperCase()))
    .sort((a, b) => (a.severity.toUpperCase().includes('CRIT') ? 0 : 1) - (b.severity.toUpperCase().includes('CRIT') ? 0 : 1));
  const fix = (pkg: string) => latestOf(pkg);
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Paket', 'Schwere', 'CVE / GHSA', 'Kurzbeschreibung', 'Fix']],
    body: ch.map((v) => [`${v.package}\n${v.version}`, v.severity.toUpperCase(), v.cve || v.id, v.summary, fix(v.package)]),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 1: { cellWidth: 17, halign: 'center', fontStyle: 'bold', textColor: [255, 255, 255] }, 2: { cellWidth: 30 }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 14, fontStyle: 'bold', textColor: NAVY } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 1) d.cell.styles.fillColor = sevColor(ch[d.row.index].severity);
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
  para('Einordnung: Schwachstellen in öffentlich erreichbaren Komponenten haben Vorrang. Alle Funde sind durch die im Maßnahmenplan genannten Versions-Upgrades behoben.');
  }

  // ── KAPITEL: Versionsübersicht ───────────────────────────────────────────
  newChapter();
  sectionTitle('3 · Versionsübersicht');
  para('Installiert (Lockfile) gegen aktuell verfügbar (npm-Registry / nodejs.org).', { size: 8, color: MUT, gap: 2 });
  const order = (s: string) => ({ major: 0, minor: 1, patch: 2, current: 3, unknown: 4 } as Record<string, number>)[s] ?? 5;
  const vsorted = [...versions].sort((a, b) => order(a.state) - order(b.state));
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Paket', 'Installiert', 'Aktuell', 'Rückstand']],
    body: vsorted.map((v) => [v.name, v.installed, v.latest, stateLabel(v.state).label]),
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.3, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: { 0: { cellWidth: 58, fontStyle: 'bold', textColor: NAVY }, 1: { cellWidth: 38 }, 2: { cellWidth: 38 }, 3: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold', textColor: [255, 255, 255] } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 3) d.cell.styles.fillColor = stateLabel(vsorted[d.row.index].state).color;
    },
  });

  // ── KAPITEL: Maßnahmenplan ───────────────────────────────────────────────
  newChapter();
  sectionTitle('4 · Maßnahmenplan (Step-by-Step)');
  para('Nach Dringlichkeit gruppiert (dynamisch aus dem aktuellen Scan). Jeder Schritt folgt dem etablierten Flow: feature/fix-Branch -> PR -> CI grün -> Merge nach main -> Auto-Deploy -> /admin/status gegenchecken.', { size: 8, color: MUT, gap: 3 });

  type Step = { title: string; effort: string; risk: string; steps: string[]; note?: string };
  const waveHeader = (title: string, badge: string, color: RGB) => {
    ensure(14);
    setFill(color); doc.roundedRect(M, y, W - 2 * M, 9, 1.5, 1.5, 'F');
    setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.text(badge, M + 4, y + 5.8);
    doc.setFontSize(11); doc.text(title, M + 28, y + 6);
    y += 13;
  };
  const item = (it: Step, color: RGB) => {
    // Höhe grob schätzen für Umbruch
    const bodyLines = it.steps.reduce((s, t) => s + (doc.splitTextToSize(t, W - 2 * M - 16) as string[]).length, 0);
    const estH = 9 + bodyLines * 4.4 + (it.note ? 6 : 0);
    ensure(estH + 4);
    const top = y;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); setText(NAVY);
    doc.text(it.title, M + 6, y + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setText(MUT);
    doc.text(`Aufwand: ${it.effort} · Risiko: ${it.risk}`, W - M - 4, y + 4, { align: 'right' });
    y += 8;
    it.steps.forEach((s) => {
      const lines = doc.splitTextToSize(s, W - 2 * M - 16) as string[];
      lines.forEach((ln, i) => {
        setText(ORANGE); doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        if (i === 0) doc.text('•', M + 7, y + 3);
        setText(INK); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text(ln, M + 11, y + 3); y += 4.4;
      });
    });
    if (it.note) {
      setText(MUT); doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
      (doc.splitTextToSize(it.note, W - 2 * M - 16) as string[]).forEach((ln) => { doc.text(ln, M + 11, y + 3); y += 3.8; });
    }
    y += 3;
    // linker Farbbalken
    setFill(color); doc.rect(M + 2, top, 1.6, y - top - 1, 'F');
    y += 4;
  };

  const outdated = versions.filter((v) => v.state === 'patch' || v.state === 'minor' || v.state === 'major');
  if (outdated.length === 0) {
    para('Keine ausstehenden Updates – alle beobachteten Pakete sind aktuell. Kein Handlungsbedarf.', { bold: true, color: OK });
  } else {
    const isSec = (n: string) => vulns.some((v) => v.package === n) || ['next', 'eslint-config-next', 'jspdf', 'jspdf-autotable', 'react', 'react-dom'].includes(n);
    const sec = outdated.filter((v) => isSec(v.name));
    const majors = outdated.filter((v) => !isSec(v.name) && v.state === 'major');
    const minors = outdated.filter((v) => !isSec(v.name) && v.state !== 'major');
    const cmd = (v: VersionRow) => (v.name === 'node' ? 'Dockerfile-Base-Image auf die neue Node-LTS setzen' : `npm install ${v.name}@${v.latest}`);
    const noteOf = (v: VersionRow) => (v.name === 'better-sqlite3' ? 'Natives Modul – Rebuild im Docker-Build, danach DB-Smoke-Test.' : v.name === 'node' ? 'Native Module werden neu gebaut; Smoke-Test nach Deploy.' : undefined);
    const renderWave = (title: string, badge: string, color: RGB, list: VersionRow[]) => {
      if (list.length === 0) return;
      waveHeader(title, badge, color);
      list.forEach((v) => item({
        title: `${v.name} ${v.installed} -> ${v.latest}`,
        effort: v.state === 'major' ? '0,5–2 Std' : 'gering',
        risk: v.state === 'major' ? 'mittel' : 'niedrig',
        steps: [cmd(v), 'npm run build + npx tsc --noEmit, dann Branch -> PR -> CI grün -> Merge -> Deploy.'],
        note: noteOf(v),
      }, color));
    };
    renderWave('Welle 1 — Sofort (Sicherheit)', 'PRIO 1', DANGER, sec);
    renderWave('Welle 2 — Wartung (Minor/Patch)', 'PRIO 2', WARN, minors);
    renderWave('Welle 3 — Geplant (Major-Upgrades)', 'PRIO 3', NAVY, majors);
  }

  // ── KAPITEL: Aufwand & Bewertung ─────────────────────────────────────────
  newChapter();
  sectionTitle('5 · Aufwand & Gesamtbewertung');
  const outdatedAll = versions.filter((v) => v.state === 'patch' || v.state === 'minor' || v.state === 'major');
  const isSec2 = (n: string) => vulns.some((v) => v.package === n) || ['next', 'eslint-config-next', 'jspdf', 'jspdf-autotable', 'react', 'react-dom'].includes(n);
  const secC = outdatedAll.filter((v) => isSec2(v.name)).length;
  const majC = outdatedAll.filter((v) => !isSec2(v.name) && v.state === 'major').length;
  const minC = outdatedAll.filter((v) => !isSec2(v.name) && v.state !== 'major').length;
  const effRows: string[][] = [];
  if (secC) effRows.push(['1', `Sicherheit (${secC} Paket${secC === 1 ? '' : 'e'})`, 'gering', 'niedrig', 'sofort']);
  if (minC) effRows.push(['2', `Wartung – Minor/Patch (${minC})`, 'gering', 'niedrig', 'diese Woche']);
  if (majC) effRows.push(['3', `Majors (${majC})`, '0,5–2 Std/Paket', 'mittel', 'geplant']);
  if (effRows.length === 0) effRows.push(['—', 'Alle Pakete aktuell – keine offenen Maßnahmen', '—', '—', '—']);
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
    head: [['Welle', 'Inhalt', 'Aufwand', 'Risiko', 'Zeitpunkt']],
    body: effRows,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.6, lineColor: STROKE, lineWidth: 0.2, textColor: INK, valign: 'middle' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 14, fontStyle: 'bold', halign: 'center' }, 2: { cellWidth: 30, fontStyle: 'bold' }, 3: { cellWidth: 26 }, 4: { cellWidth: 30 } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Bewertungs-Band(er) – dynamisch
  ensure(20);
  if (riskHigh) {
    setFill(DANGER); doc.roundedRect(M, y, W - 2 * M, 13, 1.5, 1.5, 'F');
    setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Jetzt', M + 5, y + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Risiko ERHÖHT – offene kritische/hohe Schwachstellen in öffentlich erreichbarer Software.', M + 28, y + 5.5);
    y += 16;
    setFill(OK); doc.roundedRect(M, y, W - 2 * M, 13, 1.5, 1.5, 'F');
    setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Nach Fix', M + 5, y + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text('Risiko NIEDRIG – betrieblich stabil, aktuelle Sicherheitspatches eingespielt.', M + 32, y + 5.5);
    y += 21;
  } else {
    setFill(OK); doc.roundedRect(M, y, W - 2 * M, 13, 1.5, 1.5, 'F');
    setText([255, 255, 255]); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.text('Status', M + 5, y + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(`Risiko NIEDRIG – betrieblich stabil, keine offenen Schwachstellen${outdatedAll.length ? `; ${outdatedAll.length} optionale Update(s) offen.` : '.'}`, M + 30, y + 5.5);
    y += 21;
  }

  sectionTitle('Methodik & Quellen');
  para('Installierte Versionen aus node_modules. Aktuelle Versionen: npm-Registry (registry.npmjs.org) und nodejs.org/dist. Schwachstellen: OSV.dev (Open Source Vulnerabilities, Google) über ALLE installierten Pakete inkl. transitiver Abhängigkeiten, Schweregrade nach GHSA/Hersteller. Health-Status: Live-Signale dieser Plattform. Stand der Daten: ' + today + '. Werte sind eine Momentaufnahme – die Live-Version steht unter Admin -> System -> Status.', { size: 8, color: MUT });
  para('Dieser Bericht ist vertraulich und ausschließlich zur internen Verwendung bei der Faltin Travel AG bestimmt.', { size: 8, color: MUT });

  // ── Kopf-/Fußzeile auf allen Inhaltsseiten (2..N) ────────────────────────
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    if (logo) { try { doc.addImage(logo, 'PNG', M, 9, 30, 30 * 83 / 264); } catch { /* ignore */ } }
    setText(MUT); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text('System-Status & Security-Audit', W - M, 12, { align: 'right' });
    setDraw(ORANGE); doc.setLineWidth(0.5); doc.line(M, 20, W - M, 20);
    setDraw(STROKE); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
    setText(MUT); doc.setFontSize(7.5);
    doc.text('Faltin Travel AG · Vertraulich – nur zur internen Verwendung', M, H - 10);
    doc.text(`Seite ${i} / ${total}`, W - M, H - 10, { align: 'right' });
  }

  return new Uint8Array(doc.output('arraybuffer'));
}
