/**
 * presentation/pdf.ts – PDF-Export eines Decks (16:9, 960×540 pt = 13.33"×7.5").
 * ─────────────────────────────────────────────────────────────────────────────
 * Zeichnet die Folien exakt nach der Geometrie aus `theme.ts` und dem Inhaltsplan
 * aus `blocks.ts`. Bilder werden vorher serverseitig auf das Zielverhältnis
 * beschnitten (`assets.ts`), Verläufe als Bild eingebettet — jsPDF kann beides nicht.
 * Passt der Text nicht in die Spalte, verkleinert sich die Schrift stufenweise.
 * Nur serverseitig verwenden.
 */
import { jsPDF } from 'jspdf';
import { getSettings } from '../settingsStore';
import { coverJpeg, containPng, panelGradient, imageAspect, sealBase64, LOGO_PATH, GUARANTEE_PATH } from './assets';
import { buildBlocks, buildPanel, type Block } from './blocks';
import {
  DECK, FS, LEADING, PAD, PAD_PANEL, slideLayout, usedImageCount, parseRuns, plain,
  type Rect, type TextRun,
} from './theme';
import type { Deck, Slide } from './types';

const W = 960;
const H = 540;

type RGB = [number, number, number];

function rgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

interface Box { x: number; y: number; w: number; h: number }

/** Normiertes Rechteck → Punkte. */
function pt(r: Rect): Box {
  return { x: r.x * W, y: r.y * H, w: r.w * W, h: r.h * H };
}

/** Transparenz setzen (jsPDF-GState ist nicht typisiert). */
function opacity(doc: jsPDF, value: number): void {
  const G = (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState;
  (doc as unknown as { setGState: (g: unknown) => void }).setGState(new G({ opacity: value }));
}

interface Style {
  size: number;      // pt
  bold: boolean;
  color: RGB;
  leading: number;
  gapAfter: number;  // pt
  justify: boolean;
  upper: boolean;
  charSpace: number;
}

/** Schriftbild je Blocktyp. `dense` gilt für inhaltsreiche Folien (Hotels, Preise). */
function styleFor(kind: Block['kind'], scale: number, dense: boolean): Style {
  const s = (rel: number) => rel * H * scale;
  const base: Style = {
    size: s(dense ? FS.bodySm : FS.body), bold: false, color: rgb(DECK.inkSoft),
    leading: LEADING.body, gapAfter: s(0.012), justify: false, upper: false, charSpace: 0,
  };
  switch (kind) {
    case 'kicker':
      return { ...base, size: s(FS.kicker), bold: true, color: rgb(DECK.accentSoft), upper: true, charSpace: s(0.0045), gapAfter: s(0.016), leading: LEADING.dense };
    case 'titleBig':
      return { ...base, size: s(FS.h1), color: rgb(DECK.ink), leading: LEADING.title, gapAfter: s(0.020) };
    case 'title':
      return { ...base, size: s(FS.h2), color: rgb(DECK.ink), leading: LEADING.title, gapAfter: s(0.018) };
    case 'meta':
      return { ...base, size: s(FS.small), color: rgb(DECK.inkMuted), leading: LEADING.dense, gapAfter: s(0.004) };
    case 'para':
      return { ...base, justify: true, leading: dense ? LEADING.dense : LEADING.body };
    case 'bullet':
      return { ...base, leading: LEADING.dense, gapAfter: s(0.008) };
    case 'subhead':
      return { ...base, size: s(FS.h3), bold: true, color: rgb(DECK.ink), leading: LEADING.dense, gapAfter: s(0.004) };
    case 'contact':
      return { ...base, size: s(FS.small), color: rgb(DECK.inkMuted), leading: LEADING.dense, gapAfter: s(0.002) };
    case 'link':
      return { ...base, size: s(FS.small), color: rgb(DECK.accentSoft), leading: LEADING.dense };
    case 'label':
      return { ...base, size: s(FS.kicker), bold: true, color: rgb(DECK.accent), upper: true, charSpace: s(0.004), gapAfter: s(0.010) };
    case 'highlight':
      return { ...base, size: s(FS.bodySm), bold: true, color: rgb(DECK.ink), leading: LEADING.dense };
    case 'serviceRow':
    case 'priceRow':
      return { ...base, size: s(FS.bodySm), leading: LEADING.dense, gapAfter: s(0.007) };
    case 'programCell':
      return { ...base, size: s(FS.bodySm), leading: LEADING.dense, gapAfter: s(0.010) };
    default:
      return base;
  }
}

/* ─── Zeichensatz ─────────────────────────────────────────────────────────
 * Die Standardschriften von jsPDF können nur WinAnsi. Zeichen darüber hinaus
 * (★, ✓, Emojis …) würden als Buchstabensalat erscheinen – sie werden hier
 * ersetzt oder entfernt. Haken und Kreuze zeichnet der Renderer als Vektor.
 */
const WIN_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''));
const CHAR_MAP: Record<string, string> = {
  '★': '•', '☆': '•', '✦': '•', '▪': '•', '●': '•', '◆': '•',
  '✓': '•', '✔': '•', '✕': '×', '✗': '×', '✖': '×',
  '→': '–', '←': '–', '⇒': '–', '…': '…', ' ': ' ', ' ': ' ',
};

/** Text auf darstellbare Zeichen reduzieren. */
function winAnsi(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp <= 0xff) { out += ch; continue; }
    if (CHAR_MAP[ch]) { out += CHAR_MAP[ch]; continue; }
    if (WIN_EXTRA.has(ch)) { out += ch; continue; }
    // alles andere weglassen, statt Buchstabensalat zu drucken
  }
  return out;
}

/**
 * Wörter mit Fett-Kennzeichnung – Grundlage für Umbruch und Blocksatz.
 * `glue` heisst: dieses Wort schliesst ohne Leerzeichen an das vorige an
 * (z.B. das Satzzeichen direkt nach einer fetten Passage).
 */
interface Word { text: string; bold: boolean; glue: boolean }

function toWords(runs: TextRun[]): Word[] {
  const out: Word[] = [];
  let prevEndedWithSpace = true;
  for (const r of runs) {
    const startsSpace = /^\s/.test(r.text);
    const endsSpace = /\s$/.test(r.text);
    const parts = r.text.split(/\s+/).filter(Boolean);
    parts.forEach((p, i) => {
      out.push({
        text: p, bold: r.bold,
        glue: out.length > 0 && i === 0 && !startsSpace && !prevEndedWithSpace,
      });
    });
    if (parts.length) prevEndedWithSpace = endsSpace;
    else prevEndedWithSpace = true;
  }
  return out;
}

function widthOf(doc: jsPDF, word: string, bold: boolean, size: number): number {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  return doc.getTextWidth(winAnsi(word));
}

/**
 * Zeichnet (oder misst) formatierten Text mit Fett-Anteilen, optional im Blocksatz.
 * Gibt die verbrauchte Höhe zurück; bei `dry` wird nichts gezeichnet.
 */
function drawRich(doc: jsPDF, text: string, x: number, y: number, maxW: number, st: Style, dry: boolean): number {
  const raw = st.upper ? plain(text).toUpperCase() : text;
  const words = toWords(st.upper ? [{ text: raw, bold: st.bold }] : parseRuns(raw));
  if (!words.length) return 0;
  doc.setCharSpace(st.charSpace);
  const spaceW = widthOf(doc, ' ', st.bold, st.size) + st.charSpace;
  const lineH = st.size * st.leading;
  const wordW = (w: Word) => widthOf(doc, w.text, w.bold || st.bold, st.size) + st.charSpace * w.text.length;

  // Umbruch: geklebte Wörter (Satzzeichen nach fett) wandern mit ihrem Vorgänger.
  const lines: Word[][] = [];
  let line: Word[] = [];
  let lineW = 0;
  for (const w of words) {
    const ww = wordW(w);
    const gap = line.length && !w.glue ? spaceW : 0;
    if (line.length && lineW + gap + ww > maxW) {
      if (w.glue && line.length > 1) {
        const carry = line.pop() as Word;
        lines.push(line);
        line = [{ ...carry, glue: false }, w];
        lineW = wordW(carry) + ww;
      } else {
        lines.push(line);
        line = [{ ...w, glue: false }];
        lineW = ww;
      }
    } else {
      lineW += gap + ww;
      line.push(w);
    }
  }
  if (line.length) lines.push(line);

  if (!dry) {
    doc.setTextColor(st.color[0], st.color[1], st.color[2]);
    lines.forEach((ln, idx) => {
      const isLast = idx === lines.length - 1;
      const widths = ln.map(wordW);
      const gaps = ln.filter((w, i) => i > 0 && !w.glue).length;
      const natural = widths.reduce((a, b) => a + b, 0) + spaceW * gaps;
      const extra = st.justify && !isLast && gaps > 0 ? Math.max(0, (maxW - natural) / gaps) : 0;
      let cx = x;
      const cy = y + idx * lineH + st.size * 0.82;
      ln.forEach((w, i) => {
        if (i > 0) cx += w.glue ? 0 : spaceW + extra;
        doc.setFont('helvetica', w.bold || st.bold ? 'bold' : 'normal');
        doc.setFontSize(st.size);
        doc.text(winAnsi(w.text), cx, cy);
        cx += widths[i];
      });
    });
  }
  doc.setCharSpace(0);
  return lines.length * lineH;
}

/** Haken bzw. Kreuz als Vektor – unabhängig vom Zeichensatz der Schrift. */
function drawMark(doc: jsPDF, included: boolean, x: number, y: number, size: number): void {
  const col = included ? rgb(DECK.accent) : rgb(DECK.inkMuted);
  doc.setDrawColor(col[0], col[1], col[2]);
  doc.setLineWidth(Math.max(0.7, size * 0.09));
  const s = size * 0.62;
  const top = y + size * 0.18;
  if (included) {
    doc.line(x, top + s * 0.55, x + s * 0.36, top + s * 0.92);
    doc.line(x + s * 0.36, top + s * 0.92, x + s, top + s * 0.12);
  } else {
    doc.line(x, top + s * 0.15, x + s * 0.85, top + s * 0.9);
    doc.line(x + s * 0.85, top + s * 0.15, x, top + s * 0.9);
  }
}

/** Misst bzw. zeichnet die komplette Textspalte. Gibt die belegte Höhe zurück. */
function renderColumn(doc: jsPDF, blocks: Block[], area: Box, scale: number, dense: boolean, dry: boolean): number {
  const padX = PAD.x * W * (dense ? 0.82 : 1);
  const padY = PAD.y * H * 0.5;
  const x = area.x + padX;
  const maxW = area.w - padX * 2;
  let y = area.y + padY;
  const start = y;

  for (const b of blocks) {
    const st = styleFor(b.kind, scale, dense);
    if (b.gap) y += b.gap * st.size * 0.55;

    if (b.kind === 'programCell') {
      const labelSt: Style = { ...styleFor('label', scale, dense), gapAfter: 0 };
      const boxPad = st.size * 0.55;
      const innerW = maxW - boxPad * 2;
      const hLabel = drawRich(doc, b.label || '', x + boxPad, y + boxPad, innerW, labelSt, true);
      const textY = y + boxPad + hLabel + st.size * 0.2;
      const hText = drawRich(doc, b.text || '', x + boxPad, textY, innerW, st, true);
      const boxH = hLabel + hText + boxPad * 2 + st.size * 0.2;
      if (!dry) {
        doc.setFillColor(255, 255, 255);
        opacity(doc, 0.07);
        doc.roundedRect(x, y, maxW, boxH, 4, 4, 'F');
        opacity(doc, 1);
        drawRich(doc, b.label || '', x + boxPad, y + boxPad, innerW, labelSt, false);
        drawRich(doc, b.text || '', x + boxPad, textY, innerW, st, false);
      }
      y += boxH + st.gapAfter;
      continue;
    }

    if (b.kind === 'serviceRow') {
      const markW = st.size * 1.15;
      if (!dry) drawMark(doc, !!b.included, x, y, st.size);
      const h = drawRich(doc, b.text || '', x + markW, y, maxW - markW, st, dry);
      y += h + st.gapAfter;
      continue;
    }

    if (b.kind === 'priceRow') {
      const priceW = widthOf(doc, b.value || '', true, st.size);
      const h = drawRich(doc, b.text || '', x, y, Math.max(40, maxW - priceW - st.size), st, dry);
      let hh = h;
      if (b.note) {
        const noteSt = styleFor('contact', scale, dense);
        hh += drawRich(doc, b.note, x, y + h, Math.max(40, maxW - priceW - st.size), noteSt, dry);
      }
      if (!dry) {
        const ink = rgb(DECK.ink);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(st.size);
        doc.setTextColor(ink[0], ink[1], ink[2]);
        doc.text(b.value || '', x + maxW, y + st.size * 0.82, { align: 'right' });
        const edge = rgb(DECK.edge);
        doc.setDrawColor(edge[0], edge[1], edge[2]);
        doc.setLineWidth(0.5);
        doc.line(x, y + hh + st.size * 0.35, x + maxW, y + hh + st.size * 0.35);
      }
      y += hh + st.gapAfter + st.size * 0.35;
      continue;
    }

    if (b.kind === 'highlight') {
      const padH = st.size * 0.6;
      const h = drawRich(doc, b.text || '', x + padH, y + padH * 0.7, maxW - padH * 2, st, true);
      const textW = Math.min(maxW, widthOf(doc, plain(b.text || ''), true, st.size) + padH * 2.4);
      const pillH = h + padH * 1.4;
      if (!dry) {
        const a = rgb(DECK.accent);
        doc.setFillColor(a[0], a[1], a[2]);
        doc.roundedRect(x, y, textW, pillH, pillH / 2, pillH / 2, 'F');
        drawRich(doc, b.text || '', x + padH * 1.2, y + padH * 0.7, maxW - padH * 2, st, false);
      }
      y += pillH + st.gapAfter;
      continue;
    }

    const prefix = b.kind === 'bullet' ? '—  ' : '';
    const h = drawRich(doc, prefix + (b.text || ''), x, y, maxW, st, dry);
    if (!dry && b.kind === 'link') {
      const c = rgb(DECK.accentSoft);
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setLineWidth(0.4);
      const lw = Math.min(maxW, widthOf(doc, plain(b.text || ''), false, st.size));
      doc.line(x, y + st.size * 0.98, x + lw, y + st.size * 0.98);
    }
    y += h + st.gapAfter;
  }
  return y - start + padY;
}

/** Grösste Schriftskalierung, bei der die Spalte nicht überläuft. */
function fitScale(doc: jsPDF, blocks: Block[], area: Box, dense: boolean): number {
  for (const s of [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.66, 0.62, 0.58]) {
    if (renderColumn(doc, blocks, area, s, dense, true) <= area.h) return s;
  }
  return 0.55;
}

async function paintGradient(doc: jsPDF, r: Box): Promise<void> {
  const grad = await panelGradient(r.w / r.h, 900);
  if (grad) {
    doc.addImage(grad, 'JPEG', r.x, r.y, r.w, r.h, undefined, 'FAST');
  } else {
    const c = rgb(DECK.panelBottom);
    doc.setFillColor(c[0], c[1], c[2]);
    doc.rect(r.x, r.y, r.w, r.h, 'F');
  }
}

/** Titel-/Kontaktpanel der rechten Spalte. */
async function drawPanel(doc: jsPDF, slide: Slide, deck: Deck, r: Box): Promise<void> {
  const company = getSettings().company;
  await paintGradient(doc, r);
  const content = buildPanel(slide, deck, company);

  const blocks: Block[] = [];
  if (content.kicker) blocks.push({ kind: 'kicker', text: content.kicker });
  if (content.title) blocks.push({ kind: 'title', text: content.title });
  content.lines.forEach((l, i) => blocks.push({ kind: i === 0 && !content.title ? 'subhead' : 'meta', text: l }));

  // Platz für das Logo am unteren Rand freihalten
  const logoAspect = (await imageAspect(LOGO_PATH)) || 264 / 83;
  const logoW = r.w * 0.62;
  const logoH = logoW / logoAspect;
  const textArea: Box = { ...r, h: Math.max(r.h * 0.4, r.h - logoH - PAD_PANEL.y * H * 2) };
  const scale = fitScale(doc, blocks, textArea, true);
  renderColumn(doc, blocks, textArea, scale, true, false);

  if (content.showLogo) {
    const logo = await containPng(LOGO_PATH, 700);
    if (logo) doc.addImage(logo, 'PNG', r.x + PAD_PANEL.x * W, r.y + r.h - logoH - PAD_PANEL.y * H, logoW, logoH, undefined, 'FAST');
  }
}

async function drawSlide(doc: jsPDF, slide: Slide, deck: Deck): Promise<void> {
  const bg = rgb(DECK.bg);
  doc.setFillColor(bg[0], bg[1], bg[2]);
  doc.rect(0, 0, W, H, 'F');

  const imgs = (slide.images || []).filter((i) => i.url);
  const layout = slideLayout(slide.kind, usedImageCount(slide));

  for (let i = 0; i < layout.images.length; i++) {
    const r = pt(layout.images[i]);
    const src = imgs[i]?.url;
    const b64 = src ? await coverJpeg(src, r.w / r.h, 1500) : null;
    if (b64) {
      doc.addImage(b64, 'JPEG', r.x, r.y, r.w, r.h, undefined, 'FAST');
    } else {
      await paintGradient(doc, r);
    }
    const caption = imgs[i]?.caption;
    if (caption) {
      const st = styleFor('contact', 1, true);
      doc.setFillColor(4, 7, 12);
      opacity(doc, 0.62);
      doc.rect(r.x, r.y + r.h - st.size * 2.1, r.w, st.size * 2.1, 'F');
      opacity(doc, 1);
      drawRich(doc, caption, r.x + st.size * 0.7, r.y + r.h - st.size * 1.7, r.w - st.size * 1.4, { ...st, color: rgb(DECK.inkSoft) }, false);
    }
  }

  if (layout.text) {
    const r = pt(layout.text);
    await paintGradient(doc, r);
    const dense = ['hotels', 'services', 'pricing', 'program'].includes(slide.kind);
    const blocks = buildBlocks(slide, deck);

    // Über-uns: unten Platz für das Reisegarantie-Siegel lassen
    const sealAspect = (await imageAspect(GUARANTEE_PATH)) || 3;
    const sealW = r.w * 0.20;
    const sealH = sealW / sealAspect;
    const textArea: Box = slide.kind === 'about' ? { ...r, h: r.h - sealH - PAD.y * H * 0.8 } : r;

    const scale = fitScale(doc, blocks, textArea, dense);
    renderColumn(doc, blocks, textArea, scale, dense, false);

    if (slide.kind === 'about') {
      const seal = await sealBase64(520);
      if (seal) doc.addImage(seal, 'PNG', r.x + PAD.x * W, r.y + r.h - sealH - PAD.y * H * 0.5, sealW, sealH, undefined, 'FAST');
    }
  }

  if (layout.panel) await drawPanel(doc, slide, deck, pt(layout.panel));
}

/** Baut das komplette Deck als PDF. */
export async function buildDeckPdf(deck: Deck): Promise<ArrayBuffer> {
  const doc = new jsPDF({ unit: 'pt', format: [W, H], orientation: 'landscape', compress: true });

  if (!deck.slides.length) {
    const bg = rgb(DECK.bg);
    const ink = rgb(DECK.inkSoft);
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.rect(0, 0, W, H, 'F');
    doc.setTextColor(ink[0], ink[1], ink[2]);
    doc.setFontSize(20);
    doc.text('Diese Präsentation enthält noch keine Folien.', W / 2, H / 2, { align: 'center' });
    return doc.output('arraybuffer');
  }

  for (let i = 0; i < deck.slides.length; i++) {
    if (i > 0) doc.addPage([W, H], 'landscape');
    await drawSlide(doc, deck.slides[i], deck);
  }
  doc.setProperties({ title: deck.title, creator: 'Faltin Travel AG', subject: deck.meta.subtitle || '' });
  return doc.output('arraybuffer');
}
