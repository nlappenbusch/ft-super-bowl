/**
 * presentation/theme.ts – Gestaltungs- und Geometrie-Grundlage des Decks.
 * ─────────────────────────────────────────────────────────────────────────────
 * ALLE drei Renderer (Web-Vorschau, PDF, PPTX) beziehen Farben, Schriftgrössen und
 * Flächen aus dieser Datei. Geometrie ist normiert (0..1 je Achse), Schriftgrössen
 * sind Anteile der FOLIENHÖHE. Jeder Renderer multipliziert mit seiner eigenen
 * Folienabmessung — dadurch sehen alle Ausgaben gleich aus.
 *
 * Vorlage: Faltin-Deck „Ryder Cup 2027" (dunkler Grund, Textspalte links,
 * Bildspalte rechts, weisse Fugen).
 */
import type { Slide, SlideKind } from './types';

export const ASPECT = 16 / 9;

/* ─── Farben ──────────────────────────────────────────────────────────────── */

export const DECK = {
  bg: '#04070c',            // Folienhintergrund (fast schwarz)
  panelTop: '#0d2b4a',      // Verlauf oben (Marineblau)
  panelBottom: '#050f1c',   // Verlauf unten
  edge: '#1d3b58',          // feine Kantenlinie
  ink: '#ffffff',
  inkSoft: '#c9d7e5',
  inkMuted: '#8ba0b6',
  accent: '#d9531e',        // Faltin-Orange
  accentSoft: '#ffb996',
  gutter: '#ffffff',        // Fugenfarbe zwischen den Flächen
} as const;

/** Schriftgrössen als Anteil der Folienhöhe. */
export const FS = {
  h1: 0.076,      // Titelfolie
  h2: 0.058,      // Folientitel
  h3: 0.030,      // Zwischentitel (Hotelname, Tagesblock)
  kicker: 0.0225, // Kleine Zeile über dem Titel (gesperrt, Versalien)
  body: 0.0255,
  bodySm: 0.0215, // dichtere Folien (Hotels, Leistungen)
  small: 0.0195,
  tiny: 0.0155,
} as const;

/** Zeilenabstand als Faktor der Schriftgrösse. */
export const LEADING = { title: 1.12, body: 1.5, dense: 1.38 } as const;

/* ─── Geometrie ───────────────────────────────────────────────────────────── */

export interface Rect { x: number; y: number; w: number; h: number }

/** Aussenrand und Fugen — in x-Einheiten gedacht, für y mit ASPECT umgerechnet. */
const M_X = 0.016;
const M_Y = M_X * ASPECT;
const GAP_X = 0.007;
const GAP_Y = GAP_X * ASPECT;

/** Innenabstand innerhalb einer Textfläche. */
export const PAD = { x: 0.042, y: 0.042 * ASPECT } as const;
/** Innenabstand im schmalen rechten Panel. */
export const PAD_PANEL = { x: 0.022, y: 0.022 * ASPECT } as const;

export type LayoutVariant = 'split' | 'hero' | 'gallery' | 'full';

export interface SlideLayout {
  variant: LayoutVariant;
  /** Fläche für die Textspalte (dunkles Panel). Null bei reinen Bildfolien. */
  text: Rect | null;
  /** Bildflächen in Renderreihenfolge. */
  images: Rect[];
  /** Zusätzliches Panel (Titelblock der Titelfolie, Kontaktblock bei „Über uns"). */
  panel: Rect | null;
}

const full = (): Rect => ({ x: M_X, y: M_Y, w: 1 - 2 * M_X, h: 1 - 2 * M_Y });

/** Zwei gestapelte Bildflächen in der rechten Spalte. */
function rightColumn(count: number, x: number): Rect[] {
  const w = 1 - M_X - x;
  const top = M_Y;
  const height = 1 - 2 * M_Y;
  if (count <= 1) return [{ x, y: top, w, h: height }];
  const h = (height - GAP_Y * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({ x, y: top + i * (h + GAP_Y), w, h }));
}

/**
 * Liefert die Flächenaufteilung einer Folie.
 * `imageCount` ist die tatsächliche Zahl vorhandener Bilder — ohne Bilder nimmt
 * die Textfläche die ganze Folie ein.
 */
export function slideLayout(kind: SlideKind, imageCount: number): SlideLayout {
  const has = imageCount > 0;

  if (kind === 'gallery') {
    const n = Math.min(Math.max(imageCount, 1), 4);
    const area = full();
    if (n === 1) return { variant: 'gallery', text: null, images: [area], panel: null };
    if (n === 2) {
      const w = (area.w - GAP_X) / 2;
      return { variant: 'gallery', text: null, panel: null,
        images: [{ ...area, w }, { ...area, x: area.x + w + GAP_X, w }] };
    }
    if (n === 3) {
      const wBig = area.w * 0.58;
      const wSm = area.w - wBig - GAP_X;
      const hSm = (area.h - GAP_Y) / 2;
      return { variant: 'gallery', text: null, panel: null, images: [
        { ...area, w: wBig },
        { x: area.x + wBig + GAP_X, y: area.y, w: wSm, h: hSm },
        { x: area.x + wBig + GAP_X, y: area.y + hSm + GAP_Y, w: wSm, h: hSm },
      ] };
    }
    const w = (area.w - GAP_X) / 2;
    const h = (area.h - GAP_Y) / 2;
    return { variant: 'gallery', text: null, panel: null, images: [
      { x: area.x, y: area.y, w, h },
      { x: area.x + w + GAP_X, y: area.y, w, h },
      { x: area.x, y: area.y + h + GAP_Y, w, h },
      { x: area.x + w + GAP_X, y: area.y + h + GAP_Y, w, h },
    ] };
  }

  if (kind === 'title' || kind === 'about' || kind === 'closing') {
    // Grosse Fläche links, rechts oben ein Panel, rechts unten ein Bild.
    const splitX = kind === 'title' ? 0.672 : 0.660;
    const colX = splitX + GAP_X;
    const colW = 1 - M_X - colX;
    const panelH = (1 - 2 * M_Y) * (kind === 'title' ? 0.47 : 0.52);
    const mainRect: Rect = { x: M_X, y: M_Y, w: splitX - M_X, h: 1 - 2 * M_Y };
    const panel: Rect = { x: colX, y: M_Y, w: colW, h: panelH };
    const lower: Rect = { x: colX, y: M_Y + panelH + GAP_Y, w: colW, h: 1 - 2 * M_Y - panelH - GAP_Y };
    // Titelfolie: links ein Bild. Sonst: links Text, rechts unten ein Bild.
    if (kind === 'title') {
      return { variant: 'hero', text: null, panel, images: has ? [mainRect, lower] : [] };
    }
    return { variant: 'hero', text: mainRect, panel, images: has ? [lower] : [] };
  }

  if (!has) return { variant: 'full', text: full(), images: [], panel: null };

  const splitX = 0.658;
  const cols = rightColumn(Math.min(imageCount, 2), splitX + GAP_X);
  return {
    variant: 'split',
    text: { x: M_X, y: M_Y, w: splitX - M_X, h: 1 - 2 * M_Y },
    images: cols,
    panel: null,
  };
}

/** Bildzahl, die eine Folie tatsächlich rendert. */
export function usedImageCount(slide: Slide): number {
  const n = slide.images?.filter((i) => i.url).length || 0;
  if (slide.kind === 'gallery') return Math.min(n, 4);
  if (slide.kind === 'title') return n > 0 ? Math.min(n, 2) : 0;
  if (slide.kind === 'about' || slide.kind === 'closing') return Math.min(n, 1);
  return Math.min(n, 2);
}

/** Absätze eines Fliesstextes (Leerzeile trennt). */
export function paragraphs(body?: string): string[] {
  if (!body) return [];
  return body.split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}

/* ─── Inline-Auszeichnung ─────────────────────────────────────────────────── */

export interface TextRun { text: string; bold: boolean }

/**
 * Zerlegt einen Text in Fett-/Normal-Abschnitte. Auszeichnung: **fett**.
 * Von allen drei Renderern verwendet, damit Hervorhebungen überall gleich wirken.
 */
export function parseRuns(text: string): TextRun[] {
  if (!text) return [];
  const out: TextRun[] = [];
  const re = /\*\*([\s\S]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), bold: false });
  return out.filter((r) => r.text.length > 0);
}

/** Text ohne Auszeichnung (für Messungen und Klartext-Ausgaben). */
export function plain(text: string): string {
  return (text || '').replace(/\*\*([\s\S]+?)\*\*/g, '$1');
}
