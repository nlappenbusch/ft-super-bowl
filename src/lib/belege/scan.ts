/**
 * scan.ts — Beleg im Foto finden und gerade ziehen (reine Rechnerei, ohne DOM → testbar).
 *
 * Idee: Quittungen sind helles Papier vor dunklerem Hintergrund. Graustufen → Otsu-Schwelle →
 * grösste helle zusammenhängende Fläche → vier Ecken (Extrempunkte von x+y und x−y).
 * Passt die Fläche nicht gut in ein Viereck (Hintergrund ebenfalls hell, Beleg angeschnitten),
 * gibt es kein Ergebnis — dann bleibt das ganze Bild.
 */

export interface Pt { x: number; y: number }
/** Reihenfolge: oben links, oben rechts, unten rechts, unten links. */
export type Quad = [Pt, Pt, Pt, Pt];

export interface Detection { quad: Quad; confidence: number; areaShare: number }

/** RGBA-Pixel (wie ImageData.data) → Graustufen. */
export function toGray(rgba: ArrayLike<number>, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (rgba[j] * 299 + rgba[j + 1] * 587 + rgba[j + 2] * 114) / 1000;
  return g;
}

/** Otsu-Schwelle + Abstand der beiden Klassenmittel (Mass für den Kontrast). */
export function otsu(gray: Uint8Array): { threshold: number; spread: number } {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = -1, threshold = 128, spread = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; threshold = t; spread = mF - mB; }
  }
  return { threshold, spread };
}

function shoelace(q: Pt[]): number {
  let a = 0;
  for (let i = 0; i < q.length; i++) { const p = q[i], n = q[(i + 1) % q.length]; a += p.x * n.y - n.x * p.y; }
  return Math.abs(a) / 2;
}

function isConvex(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    const s = Math.sign(cross);
    if (!sign) sign = s; else if (s !== sign) return false;
  }
  return true;
}

/**
 * Sucht den Beleg in einem (kleinen, z. B. 320 px) RGBA-Bild. Koordinaten im selben Massstab.
 */
export function detectReceipt(rgba: ArrayLike<number>, w: number, h: number): Detection | null {
  if (w < 16 || h < 16) return null;
  const raw = toGray(rgba, w, h);
  // 3×3-Weichzeichner gegen Textpixel und Rauschen
  const gray = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          s += raw[yy * w + xx]; n++;
        }
      }
      gray[y * w + x] = s / n;
    }
  }
  const { threshold, spread } = otsu(gray);
  if (spread < 35) return null; // zu wenig Kontrast zwischen Papier und Hintergrund

  const total = w * h;
  // Maske «Papier» und Textlöcher schliessen (Dilatation, dann Erosion, je Radius 2)
  let mask: Uint8Array = new Uint8Array(total);
  for (let i = 0; i < total; i++) mask[i] = gray[i] >= threshold ? 1 : 0;
  mask = morph(morph(mask, w, h, 2, true), w, h, 2, false);
  const label = new Int32Array(total).fill(-1);
  const stack = new Int32Array(total);
  let best: { area: number; tl: Pt; tr: Pt; br: Pt; bl: Pt } | null = null;
  let comp = 0;
  for (let start = 0; start < total; start++) {
    if (label[start] !== -1 || !mask[start]) continue;
    let sp = 0, area = 0;
    stack[sp++] = start;
    label[start] = comp;
    let minS = Infinity, maxS = -Infinity, minD = Infinity, maxD = -Infinity;
    let tl: Pt = { x: 0, y: 0 }, br: Pt = { x: 0, y: 0 }, tr: Pt = { x: 0, y: 0 }, bl: Pt = { x: 0, y: 0 };
    while (sp) {
      const i = stack[--sp];
      area++;
      const x = i % w, y = (i - x) / w;
      const s = x + y, d = x - y;
      if (s < minS) { minS = s; tl = { x, y }; }
      if (s > maxS) { maxS = s; br = { x, y }; }
      if (d > maxD) { maxD = d; tr = { x, y }; }
      if (d < minD) { minD = d; bl = { x, y }; }
      if (x > 0) { const k = i - 1; if (label[k] === -1 && mask[k]) { label[k] = comp; stack[sp++] = k; } }
      if (x < w - 1) { const k = i + 1; if (label[k] === -1 && mask[k]) { label[k] = comp; stack[sp++] = k; } }
      if (y > 0) { const k = i - w; if (label[k] === -1 && mask[k]) { label[k] = comp; stack[sp++] = k; } }
      if (y < h - 1) { const k = i + w; if (label[k] === -1 && mask[k]) { label[k] = comp; stack[sp++] = k; } }
    }
    if (!best || area > best.area) best = { area, tl, tr, br, bl };
    comp++;
  }
  if (!best) return null;
  const share = best.area / total;
  if (share < 0.06 || share > 0.97) return null;

  const quad: Quad = [best.tl, best.tr, best.br, best.bl];
  if (!isConvex(quad)) return null;
  const qArea = shoelace(quad);
  if (qArea < total * 0.06) return null;
  if (qArea > total * 0.92) return null; // praktisch das ganze Bild → nichts zu schneiden
  // Klebt das Viereck an drei oder mehr Bildrändern, ist es eher der Hintergrund
  const mx = w * 0.015, my = h * 0.015;
  const edges = [quad.some((p) => p.x <= mx), quad.some((p) => p.x >= w - 1 - mx), quad.some((p) => p.y <= my), quad.some((p) => p.y >= h - 1 - my)].filter(Boolean).length;
  if (edges >= 3) return null;
  const fill = best.area / qArea;
  if (fill < 0.72) return null; // eher ein Klecks als ein Blatt
  // Kanten nicht anschneiden: Ecken leicht nach aussen schieben
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
  const grown = quad.map((p) => ({
    x: Math.min(w - 1, Math.max(0, p.x + (p.x - cx) * 0.02)),
    y: Math.min(h - 1, Math.max(0, p.y + (p.y - cy) * 0.02)),
  })) as Quad;
  return { quad: grown, confidence: Math.min(1, fill), areaShare: qArea / total };
}

/** Binäre Dilatation (grow=true) bzw. Erosion, quadratisches Fenster, separabel. */
function morph(m: Uint8Array, w: number, h: number, r: number, grow: boolean): Uint8Array {
  const tmp = new Uint8Array(m.length);
  const out = new Uint8Array(m.length);
  const hit = grow ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = grow ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const xx = x + d;
        if (xx < 0 || xx >= w) continue;
        if (m[y * w + xx] === hit) { v = hit; break; }
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = grow ? 0 : 1;
      for (let d = -r; d <= r; d++) {
        const yy = y + d;
        if (yy < 0 || yy >= h) continue;
        if (tmp[yy * w + x] === hit) { v = hit; break; }
      }
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Quad in einen anderen Massstab umrechnen. */
export function scaleQuad(q: Quad, f: number): Quad {
  return q.map((p) => ({ x: p.x * f, y: p.y * f })) as Quad;
}

/** Wie stark hat sich das Viereck bewegt? (mittlere Eckverschiebung relativ zur Bilddiagonale) */
export function quadDrift(a: Quad, b: Quad, w: number, h: number): number {
  const diag = Math.hypot(w, h) || 1;
  let s = 0;
  for (let i = 0; i < 4; i++) s += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  return s / 4 / diag;
}

/** Zielgrösse des entzerrten Bildes (längste Seite max. maxSide). */
export function warpSize(q: Quad, maxSide: number): { w: number; h: number } {
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  let w = Math.max(d(q[0], q[1]), d(q[3], q[2]));
  let h = Math.max(d(q[0], q[3]), d(q[1], q[2]));
  const f = Math.min(1, maxSide / Math.max(w, h));
  w = Math.max(1, Math.round(w * f));
  h = Math.max(1, Math.round(h * f));
  return { w, h };
}

/**
 * Homographie H (3×3, zeilenweise, h[8]=1), die die Punkte `from` auf `to` abbildet.
 * Gelöst über das 8×8-Gleichungssystem (Gauss mit Pivotsuche).
 */
export function homography(from: Pt[], to: Pt[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i];
    const { x: u, y: v } = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    const piv = A[c][c] || 1e-12;
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / piv;
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / (A[r][r] || 1e-12);
  }
  return [...x, 1];
}

export function applyH(H: number[], x: number, y: number): Pt {
  const d = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / d, y: (H[3] * x + H[4] * y + H[5]) / d };
}

/**
 * Perspektivisch entzerren: für jedes Zielpixel die Stelle im Quellbild lesen (bilinear).
 * src/dst sind RGBA-Puffer; dst hat die Grösse dw×dh.
 */
export function warpInto(src: ArrayLike<number>, sw: number, sh: number, quad: Quad, dst: Uint8ClampedArray, dw: number, dh: number): void {
  const H = homography(
    [{ x: 0, y: 0 }, { x: dw - 1, y: 0 }, { x: dw - 1, y: dh - 1 }, { x: 0, y: dh - 1 }],
    quad,
  );
  let o = 0;
  for (let v = 0; v < dh; v++) {
    for (let u = 0; u < dw; u++, o += 4) {
      const d = H[6] * u + H[7] * v + H[8];
      let x = (H[0] * u + H[1] * v + H[2]) / d;
      let y = (H[3] * u + H[4] * v + H[5]) / d;
      if (x < 0) x = 0; else if (x > sw - 1.001) x = sw - 1.001;
      if (y < 0) y = 0; else if (y > sh - 1.001) y = sh - 1.001;
      const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      for (let c = 0; c < 3; c++) {
        const top = src[i00 + c] + (src[i10 + c] - src[i00 + c]) * fx;
        const bot = src[i01 + c] + (src[i11 + c] - src[i01 + c]) * fx;
        dst[o + c] = top + (bot - top) * fy;
      }
      dst[o + 3] = 255;
    }
  }
}
