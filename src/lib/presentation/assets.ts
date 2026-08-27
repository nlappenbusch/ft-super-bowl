/**
 * presentation/assets.ts – Bildbeschaffung für PDF- und PPTX-Export (nur serverseitig).
 * ─────────────────────────────────────────────────────────────────────────────
 * Weder jsPDF noch PPTX können Bilder beschneiden („object-fit: cover"). Damit die
 * Exporte genauso aussehen wie die Web-Vorschau, wird jedes Bild hier serverseitig
 * per sharp auf das Zielseitenverhältnis zugeschnitten und als JPEG geliefert.
 * Ergebnisse werden im Prozess zwischengespeichert (mehrere Formate, gleiche Bilder).
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const MAX_REMOTE_BYTES = 20 * 1024 * 1024;
const cache = new Map<string, string>();
const CACHE_LIMIT = 120;

function remember(key: string, value: string): string {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, value);
  return value;
}

/** Rohdaten einer Bildquelle holen: data-URI, Datei unter /public oder http(s). */
async function readSource(url: string): Promise<Buffer | null> {
  try {
    if (!url) return null;
    if (url.startsWith('data:')) {
      const comma = url.indexOf(',');
      return comma > 0 ? Buffer.from(url.slice(comma + 1), 'base64') : null;
    }
    if (url.startsWith('/')) {
      const clean = url.replace(/^\//, '').split('?')[0];
      const abs = path.join(process.cwd(), 'public', clean);
      // Pfad-Ausbruch verhindern
      if (!abs.startsWith(path.join(process.cwd(), 'public'))) return null;
      return await fs.readFile(abs);
    }
    if (/^https?:\/\//i.test(url)) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) return null;
        const len = Number(res.headers.get('content-length') || 0);
        if (len && len > MAX_REMOTE_BYTES) return null;
        const buf = Buffer.from(await res.arrayBuffer());
        return buf.length > MAX_REMOTE_BYTES ? null : buf;
      } finally { clearTimeout(timer); }
    }
    return null;
  } catch { return null; }
}

/**
 * Liefert ein Bild als Base64-JPEG, exakt im geforderten Seitenverhältnis
 * (mittiger, motivbewusster Beschnitt). `null`, wenn die Quelle nicht lesbar ist.
 */
export async function coverJpeg(url: string, aspect: number, width = 1500): Promise<string | null> {
  const key = `${url}|${aspect.toFixed(4)}|${width}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const src = await readSource(url);
  if (!src) return null;
  try {
    const out = await sharp(src, { failOn: 'none' })
      .rotate()
      .resize(Math.round(width), Math.round(width / aspect), { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return remember(key, out.toString('base64'));
  } catch {
    // Fallback: unverändert einbetten (besser ein verzerrtes Bild als gar keines)
    try {
      const out = await sharp(src, { failOn: 'none' }).jpeg({ quality: 80 }).toBuffer();
      return remember(key, out.toString('base64'));
    } catch { return null; }
  }
}

/**
 * Bild ohne Beschnitt (Logos, Siegel) als PNG-Base64, auf Breite begrenzt.
 * `recolor` färbt schwarze Flächen eines SVG um – nötig für Siegel, die als
 * schwarze Silhouette vorliegen und auf dunklem Grund sonst verschwinden.
 */
export async function containPng(url: string, width = 700, recolor?: string): Promise<string | null> {
  const key = `contain|${url}|${width}|${recolor || ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let src = await readSource(url);
  if (!src) return null;
  if (recolor && url.toLowerCase().endsWith('.svg')) {
    const svg = src.toString('utf8')
      .replace(/#000000/gi, recolor).replace(/#000\b/gi, recolor)
      .replace(/fill="black"/gi, `fill="${recolor}"`)
      .replace(/fill:\s*black/gi, `fill:${recolor}`);
    src = Buffer.from(svg, 'utf8');
  }
  try {
    const out = await sharp(src, { failOn: 'none' })
      .resize({ width, withoutEnlargement: true })
      .png()
      .toBuffer();
    return remember(key, out.toString('base64'));
  } catch { return null; }
}

/** Seitenverhältnis eines Bildes (für Logos, die proportional platziert werden). */
export async function imageAspect(url: string): Promise<number | null> {
  const key = `aspect|${url}`;
  const hit = cache.get(key);
  if (hit) return Number(hit);
  const src = await readSource(url);
  if (!src) return null;
  try {
    const meta = await sharp(src, { failOn: 'none' }).metadata();
    if (!meta.width || !meta.height) return null;
    const a = meta.width / meta.height;
    remember(key, String(a));
    return a;
  } catch { return null; }
}

/** Helles Faltin-Logo (oranges Signet + weisser Schriftzug) für dunkle Folien. */
export const LOGO_PATH = '/faltin-logo.svg';
/** Siegel „Schweizer Reisegarantie" für die Über-uns-Folie. */
export const GUARANTEE_PATH = '/reisegarantielogo-de-768x258.webp';

/**
 * Das Garantie-Siegel liegt mit weissem Rand um das rote Logofeld vor. Für die
 * dunklen Folien wird nur dieser Rand weggeschnitten — die weisse Schrift IM
 * Logo muss erhalten bleiben (ein Freistellen aller weissen Flächen würde sie
 * ausradieren). Dieselbe Grafik nutzen PDF, PPTX und die Web-Vorschau
 * (über /api/presentation/seal).
 */
export async function sealPng(width = 520): Promise<Buffer | null> {
  const src = await readSource(GUARANTEE_PATH);
  if (!src) return null;
  try {
    return await sharp(src, { failOn: 'none' })
      .trim({ background: '#ffffff', threshold: 12 })
      .resize({ width, withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return await sharp(src, { failOn: 'none' })
      .resize({ width, withoutEnlargement: true })
      .png()
      .toBuffer()
      .catch(() => null);
  }
}

/** Siegel als Base64 (für die Exporte). */
export async function sealBase64(width = 520): Promise<string | null> {
  const key = `seal|${width}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const buf = await sealPng(width);
  return buf ? remember(key, buf.toString('base64')) : null;
}

/**
 * Diagonaler Verlauf (unten links Marineblau → oben rechts fast schwarz) als
 * JPEG-Base64. jsPDF und PPTX können keine echten Verläufe zeichnen; hier wird
 * derselbe Verlauf gerendert, den die Web-Vorschau per CSS zeigt.
 */
export async function panelGradient(aspect: number, width = 900): Promise<string | null> {
  const key = `grad|${aspect.toFixed(4)}|${width}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const h = Math.max(2, Math.round(width / aspect));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#123a63"/>
      <stop offset="52%" stop-color="#071a2e"/>
      <stop offset="100%" stop-color="#04070c"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
  </svg>`;
  try {
    const out = await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toBuffer();
    return remember(key, out.toString('base64'));
  } catch { return null; }
}
