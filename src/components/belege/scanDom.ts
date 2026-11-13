'use client';
/**
 * scanDom.ts — Browser-Seite des Beleg-Scanners: Bilder in Canvas laden, Beleg suchen
 * (auf einer kleinen Kopie), perspektivisch entzerren und als JPEG ausgeben.
 */
import { detectReceipt, scaleQuad, warpInto, warpSize, type Quad } from '@/lib/belege/scan';

export type { Quad };

/** Längste Seite für die Suche (klein = schnell, reicht für die Ecken). */
const DETECT_SIDE = 320;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Datei → Canvas (EXIF-Drehung beachtet, längste Seite max. maxSide). */
export async function fileToCanvas(file: Blob, maxSide = 2800): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const f = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = makeCanvas(Math.round(bmp.width * f), Math.round(bmp.height * f));
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c;
}

/** Sucht den Beleg in einem Bild/Video/Canvas; Ecken im Koordinatensystem der Quelle (sw×sh). */
export function detectIn(src: CanvasImageSource, sw: number, sh: number, scratch?: HTMLCanvasElement): { quad: Quad; confidence: number } | null {
  if (!sw || !sh) return null;
  const f = Math.min(1, DETECT_SIDE / Math.max(sw, sh));
  const w = Math.max(16, Math.round(sw * f));
  const h = Math.max(16, Math.round(sh * f));
  const c = scratch || makeCanvas(w, h);
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  const d = detectReceipt(ctx.getImageData(0, 0, w, h).data, w, h);
  if (!d) return null;
  return { quad: scaleQuad(d.quad, sw / w), confidence: d.confidence };
}

/** Ganzes Bild als Viereck (mit kleinem Rand), wenn nichts erkannt wurde. */
export function fullQuad(w: number, h: number, inset = 0): Quad {
  const ix = w * inset, iy = h * inset;
  return [{ x: ix, y: iy }, { x: w - ix, y: iy }, { x: w - ix, y: h - iy }, { x: ix, y: h - iy }];
}

/** Entzerrt den Ausschnitt; sanfte Kontrastanhebung für bessere Lesbarkeit. */
export function warpCanvas(src: HTMLCanvasElement, quad: Quad, maxSide = 2400): HTMLCanvasElement {
  const { w, h } = warpSize(quad, maxSide);
  const sctx = src.getContext('2d', { willReadFrequently: true })!;
  const sdata = sctx.getImageData(0, 0, src.width, src.height).data;
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d')!;
  const img = octx.createImageData(w, h);
  warpInto(sdata, src.width, src.height, quad, img.data, w, h);
  autoLevels(img.data);
  octx.putImageData(img, 0, 0);
  return out;
}

/** Tonwert-Spreizung (1 %/99 %-Perzentil) — Thermopapier wird kontrastreicher, Farben bleiben. */
function autoLevels(px: Uint8ClampedArray): void {
  const hist = new Uint32Array(256);
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 16) hist[(px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000 | 0]++;
  const sample = Math.ceil(n / 4);
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255; lo++) { acc += hist[lo]; if (acc > sample * 0.01) break; }
  acc = 0;
  for (; hi > 0; hi--) { acc += hist[hi]; if (acc > sample * 0.01) break; }
  if (hi - lo < 40 || (lo < 8 && hi > 247)) return;
  const k = 255 / (hi - lo);
  for (let i = 0; i < px.length; i += 4) {
    px[i] = (px[i] - lo) * k;
    px[i + 1] = (px[i + 1] - lo) * k;
    px[i + 2] = (px[i + 2] - lo) * k;
  }
}

export function canvasToJpeg(c: HTMLCanvasElement, q = 0.88): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Bild konnte nicht erzeugt werden.'))), 'image/jpeg', q));
}

/** Kann dieses Gerät eine Live-Kamera öffnen? */
export function hasLiveCamera(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof window !== 'undefined' && window.isSecureContext;
}

export const PREF_AUTOSTART = 'belege-kamera-start';
export const PREF_AUTOSHOT = 'belege-kamera-auto';

export function getPref(key: string, def: boolean): boolean {
  try { const v = localStorage.getItem(key); return v === null ? def : v === '1'; } catch { return def; }
}
export function setPref(key: string, v: boolean): void {
  try { localStorage.setItem(key, v ? '1' : '0'); } catch { /* */ }
}
