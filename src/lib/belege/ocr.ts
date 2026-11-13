/**
 * belege/ocr.ts — Text aus einem Beleg holen, ohne KI:
 *   PDF  → Textebene (pdf-parse). Gescannte PDFs ohne Text liefern leer → KI.
 *   Foto → Tesseract (tesseract.js, Deutsch/Englisch/Französisch) nach Vorbereitung mit sharp
 *          (Ausrichtung, Graustufen, Kontrast, Breite ~2000 px).
 * Die Sprachdaten lädt Tesseract beim ersten Mal (jsDelivr) und legt sie unter
 * data/belege/ocr-cache ab. Scheitert etwas, gibt es leeren Text – dann übernimmt die KI.
 */
import path from 'node:path';
import fs from 'node:fs';
import { BELEGE_ROOT } from './store';

const OCR_TIMEOUT_MS = 45_000;

export interface OcrResult { text: string; confidence: number; method: 'pdf-text' | 'ocr' | 'keine' ; error?: string }

export async function pdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const r = await parser.getText();
    return (r.text || '').replace(/\n-- \d+ of \d+ --\n/g, '\n').trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

type TessWorker = {
  recognize: (img: Buffer) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
};

let workerPromise: Promise<TessWorker> | null = null;
let busy: Promise<unknown> = Promise.resolve();

async function getWorker(): Promise<TessWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const cachePath = path.join(BELEGE_ROOT, 'ocr-cache');
      fs.mkdirSync(cachePath, { recursive: true });
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker(['deu', 'eng', 'fra'], 1, { cachePath, logger: () => {} });
      return w as unknown as TessWorker;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

async function prepare(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp(buffer)
    .rotate()
    .resize({ width: 2000, height: 3000, fit: 'inside', withoutEnlargement: false })
    .grayscale()
    .normalize()
    .sharpen()
    .png()
    .toBuffer();
}

export async function imageOcr(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const img = await prepare(buffer);
  // Ein Worker, nacheinander – Tesseract ist CPU-lastig und soll den Server nicht blockieren.
  const run = busy.then(async () => {
    const w = await getWorker();
    const r = await w.recognize(img);
    return { text: r.data.text || '', confidence: Math.round(r.data.confidence || 0) };
  });
  busy = run.catch(() => {});
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error('OCR-Zeitlimit')), OCR_TIMEOUT_MS); });
  try {
    return await Promise.race([run, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function extractText(buffer: Buffer, mime: string): Promise<OcrResult> {
  try {
    if (mime === 'application/pdf') {
      const text = await pdfText(buffer);
      return { text, confidence: text.length > 40 ? 95 : 0, method: 'pdf-text' };
    }
    if (mime.startsWith('image/')) {
      const r = await imageOcr(buffer);
      return { text: r.text, confidence: r.confidence, method: 'ocr' };
    }
    return { text: '', confidence: 0, method: 'keine' };
  } catch (e) {
    return { text: '', confidence: 0, method: 'keine', error: (e as Error).message };
  }
}
