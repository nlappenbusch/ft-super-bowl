/**
 * presentation/pptx.ts – PowerPoint-Export eines Decks (16:9, 13.333"×7.5").
 * ─────────────────────────────────────────────────────────────────────────────
 * Gleiche Geometrie und gleicher Inhaltsplan wie PDF und Web-Vorschau. Anders als
 * im PDF bleibt der Text hier ein echter, editierbarer Textrahmen — PowerPoint
 * bricht selbst um. Bilder werden vorab auf das Zielverhältnis zugeschnitten,
 * damit sie ihre Fläche wie in der Vorschau füllen.
 *
 * Die Folienhöhe ist mit 7.5 Zoll = 540 pt identisch zum PDF, deshalb sind die
 * Schriftgrössen aus `theme.ts` unverändert übertragbar.
 * Nur serverseitig verwenden.
 */
import PptxGenJS from 'pptxgenjs';
import { getSettings } from '../settingsStore';
import { coverJpeg, containPng, panelGradient, imageAspect, sealBase64, LOGO_PATH, GUARANTEE_PATH } from './assets';
import { buildBlocks, buildPanel, type Block } from './blocks';
import { DECK, FS, PAD, PAD_PANEL, slideLayout, usedImageCount, parseRuns, plain, type Rect } from './theme';
import type { Deck, Slide } from './types';

const W_IN = 13.333;
const H_IN = 7.5;
const PT_PER_IN = 72;

/** Farbe ohne führendes # (pptxgenjs-Konvention). */
const c = (hex: string) => hex.replace('#', '').toUpperCase();

interface Box { x: number; y: number; w: number; h: number }

function inch(r: Rect): Box {
  return { x: r.x * W_IN, y: r.y * H_IN, w: r.w * W_IN, h: r.h * H_IN };
}

/** Schriftgrösse in pt aus dem relativen Mass der Folienhöhe. */
const fs = (rel: number) => Math.round(rel * H_IN * PT_PER_IN * 10) / 10;

type TextProps = NonNullable<Parameters<PptxGenJS.Slide['addText']>[1]>;
type TextItem = { text: string; options?: TextProps };

/** Absatz-Optionen je Blocktyp. */
function paraOptions(kind: Block['kind'], dense: boolean): TextProps {
  const body = fs(dense ? FS.bodySm : FS.body);
  switch (kind) {
    case 'kicker':
      return { fontSize: fs(FS.kicker), bold: true, color: c(DECK.accentSoft), charSpacing: 2, paraSpaceAfter: 8 };
    case 'titleBig':
      return { fontSize: fs(FS.h1), color: c(DECK.ink), paraSpaceAfter: 10, lineSpacingMultiple: 1.05 };
    case 'title':
      return { fontSize: fs(FS.h2), color: c(DECK.ink), paraSpaceAfter: 9, lineSpacingMultiple: 1.05 };
    case 'meta':
      return { fontSize: fs(FS.small), color: c(DECK.inkMuted), paraSpaceAfter: 2 };
    case 'para':
      return { fontSize: body, color: c(DECK.inkSoft), align: 'justify', paraSpaceAfter: 8, lineSpacingMultiple: 1.32 };
    case 'bullet':
      return { fontSize: body, color: c(DECK.inkSoft), bullet: { characterCode: '2014' }, paraSpaceAfter: 4 };
    case 'subhead':
      return { fontSize: fs(FS.h3), bold: true, color: c(DECK.ink), paraSpaceBefore: 4, paraSpaceAfter: 1 };
    case 'contact':
      return { fontSize: fs(FS.small), color: c(DECK.inkMuted), paraSpaceAfter: 1 };
    case 'link':
      return { fontSize: fs(FS.small), color: c(DECK.accentSoft), underline: { style: 'sng' }, paraSpaceAfter: 6 };
    case 'label':
      return { fontSize: fs(FS.kicker), bold: true, color: c(DECK.accent), charSpacing: 1.5, paraSpaceBefore: 8, paraSpaceAfter: 5 };
    case 'highlight':
      return { fontSize: fs(FS.bodySm), bold: true, color: c(DECK.ink), highlight: c(DECK.accent), paraSpaceBefore: 8 };
    case 'serviceRow':
      return { fontSize: fs(FS.bodySm), color: c(DECK.inkSoft), paraSpaceAfter: 3 };
    case 'programCell':
      return { fontSize: fs(FS.bodySm), color: c(DECK.inkSoft), paraSpaceAfter: 6 };
    default:
      return { fontSize: body, color: c(DECK.inkSoft), paraSpaceAfter: 6 };
  }
}

/** Einen Block in Text-Runs übersetzen (Fett-Auszeichnung bleibt erhalten). */
function blockToItems(b: Block, dense: boolean): TextItem[] {
  const opt = paraOptions(b.kind, dense);
  const items: TextItem[] = [];

  if (b.kind === 'programCell') {
    items.push({ text: (b.label || '').toUpperCase(), options: { ...paraOptions('label', dense), breakLine: true } });
    items.push({ text: plain(b.text || ''), options: { ...opt, breakLine: true } });
    return items;
  }
  if (b.kind === 'serviceRow') {
    items.push({ text: `${b.included ? '✓' : '✕'}  ${plain(b.text || '')}`, options: { ...opt, color: b.included ? c(DECK.inkSoft) : c(DECK.inkMuted), breakLine: true } });
    return items;
  }
  if (b.kind === 'kicker' || b.kind === 'label') {
    items.push({ text: plain(b.text || '').toUpperCase(), options: { ...opt, breakLine: true } });
    return items;
  }

  const runs = parseRuns(b.text || '');
  if (!runs.length) return items;
  runs.forEach((r, i) => {
    items.push({
      text: r.text,
      options: { ...opt, bold: r.bold || opt.bold, breakLine: i === runs.length - 1 },
    });
  });
  return items;
}

/** Fügt einen Textrahmen mit allen Blöcken ein. */
function addColumn(slide: PptxGenJS.Slide, blocks: Block[], area: Box, dense: boolean): void {
  const items = blocks.flatMap((b) => blockToItems(b, dense));
  if (!items.length) return;
  const padX = PAD.x * W_IN * (dense ? 0.82 : 1);
  const padY = PAD.y * H_IN * 0.5;
  slide.addText(items as unknown as PptxGenJS.TextProps[], {
    x: area.x + padX, y: area.y + padY,
    w: area.w - padX * 2, h: area.h - padY * 2,
    valign: 'top', fit: 'shrink', wrap: true,
  });
}

async function addBackground(slide: PptxGenJS.Slide, area: Box): Promise<void> {
  const grad = await panelGradient(area.w / area.h, 900);
  if (grad) slide.addImage({ data: `image/jpeg;base64,${grad}`, ...area });
  else slide.addShape('rect', { ...area, fill: { color: c(DECK.panelBottom) } });
}

async function addPanel(slide: PptxGenJS.Slide, s: Slide, deck: Deck, area: Box): Promise<void> {
  const company = getSettings().company;
  await addBackground(slide, area);
  const content = buildPanel(s, deck, company);

  const blocks: Block[] = [];
  if (content.kicker) blocks.push({ kind: 'kicker', text: content.kicker });
  if (content.title) blocks.push({ kind: 'title', text: content.title });
  content.lines.forEach((l, i) => blocks.push({ kind: i === 0 && !content.title ? 'subhead' : 'meta', text: l }));

  const logoAspect = (await imageAspect(LOGO_PATH)) || 264 / 83;
  const logoW = area.w * 0.62;
  const logoH = logoW / logoAspect;
  const padX = PAD_PANEL.x * W_IN;
  const padY = PAD_PANEL.y * H_IN;

  const items = blocks.flatMap((b) => blockToItems(b, true));
  if (items.length) {
    slide.addText(items as unknown as PptxGenJS.TextProps[], {
      x: area.x + padX, y: area.y + padY,
      w: area.w - padX * 2, h: Math.max(area.h * 0.4, area.h - logoH - padY * 2.5),
      valign: 'top', fit: 'shrink', wrap: true,
    });
  }
  if (content.showLogo) {
    const logo = await containPng(LOGO_PATH, 700);
    if (logo) slide.addImage({ data: `image/png;base64,${logo}`, x: area.x + padX, y: area.y + area.h - logoH - padY, w: logoW, h: logoH });
  }
}

/** Preise werden als echte PowerPoint-Tabelle gesetzt (dort später editierbar). */
function addPriceTable(slide: PptxGenJS.Slide, s: Slide, area: Box): void {
  const rows = (s.prices || []).filter((p) => p.label.trim() || p.price.trim());
  if (!rows.length) return;
  const padX = PAD.x * W_IN * 0.82;
  const body = fs(FS.bodySm);
  const data = rows.map((r) => ([
    { text: [r.label, r.note ? `\n${r.note}` : ''].join(''), options: { color: c(DECK.inkSoft), fontSize: body, valign: 'middle' as const } },
    { text: r.price, options: { color: c(DECK.ink), fontSize: body, bold: true, align: 'right' as const, valign: 'middle' as const } },
  ]));
  slide.addTable(data as unknown as PptxGenJS.TableRow[], {
    x: area.x + padX, y: area.y + area.h * 0.42,
    w: area.w - padX * 2,
    colW: [(area.w - padX * 2) * 0.68, (area.w - padX * 2) * 0.32],
    border: { type: 'solid', color: c(DECK.edge), pt: 0.5 },
    fill: { color: '0A1B2B' },
    autoPage: false,
  });
}

async function addSlide(pptx: PptxGenJS, s: Slide, deck: Deck): Promise<void> {
  const slide = pptx.addSlide();
  slide.background = { color: c(DECK.bg) };

  const imgs = (s.images || []).filter((i) => i.url);
  const layout = slideLayout(s.kind, usedImageCount(s));

  for (let i = 0; i < layout.images.length; i++) {
    const box = inch(layout.images[i]);
    const src = imgs[i]?.url;
    const b64 = src ? await coverJpeg(src, box.w / box.h, 1500) : null;
    if (b64) slide.addImage({ data: `image/jpeg;base64,${b64}`, ...box });
    else await addBackground(slide, box);
    const caption = imgs[i]?.caption;
    if (caption) {
      const capH = 0.34;
      slide.addShape('rect', { x: box.x, y: box.y + box.h - capH, w: box.w, h: capH, fill: { color: '04070C', transparency: 38 } });
      slide.addText(caption, {
        x: box.x + 0.1, y: box.y + box.h - capH, w: box.w - 0.2, h: capH,
        fontSize: fs(FS.tiny), color: c(DECK.inkSoft), valign: 'middle',
      });
    }
  }

  if (layout.text) {
    const box = inch(layout.text);
    await addBackground(slide, box);
    const dense = ['hotels', 'services', 'pricing', 'program'].includes(s.kind);

    if (s.kind === 'pricing') {
      // Kopf ohne Preiszeilen, die Tabelle kommt separat
      const head = buildBlocks(s, deck).filter((b) => b.kind !== 'priceRow');
      addColumn(slide, head, { ...box, h: box.h * 0.42 }, dense);
      addPriceTable(slide, s, box);
    } else {
      const sealH = s.kind === 'about' ? 0.62 : 0;
      addColumn(slide, buildBlocks(s, deck), { ...box, h: box.h - sealH }, dense);
      if (s.kind === 'about') {
        const seal = await sealBase64(520);
        const aspect = (await imageAspect(GUARANTEE_PATH)) || 3;
        if (seal) {
          const sw = box.w * 0.2;
          slide.addImage({ data: `image/png;base64,${seal}`, x: box.x + PAD.x * W_IN, y: box.y + box.h - sw / aspect - 0.25, w: sw, h: sw / aspect });
        }
      }
    }
  }

  if (layout.panel) await addPanel(slide, s, deck, inch(layout.panel));
  if (s.notes?.trim()) slide.addNotes(s.notes);
}

/** Baut das komplette Deck als PowerPoint-Datei. */
export async function buildDeckPptx(deck: Deck): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'FT_16x9', width: W_IN, height: H_IN });
  pptx.layout = 'FT_16x9';
  pptx.author = 'Faltin Travel AG';
  pptx.company = 'Faltin Travel AG';
  pptx.title = deck.title;
  pptx.subject = deck.meta.subtitle || '';

  for (const s of deck.slides) await addSlide(pptx, s, deck);
  if (!deck.slides.length) {
    const slide = pptx.addSlide();
    slide.background = { color: c(DECK.bg) };
    slide.addText('Diese Präsentation enthält noch keine Folien.', {
      x: 0, y: H_IN / 2 - 0.4, w: W_IN, h: 0.8, align: 'center', color: c(DECK.inkSoft), fontSize: 20,
    });
  }
  const out = await pptx.write({ outputType: 'nodebuffer' });
  return out as Buffer;
}
