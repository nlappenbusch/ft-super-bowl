/**
 * workspace/officeText.ts — Text aus Word/Excel/PowerPoint-Dateien (OOXML) ziehen.
 * ─────────────────────────────────────────────────────────────────────────────
 * .docx/.xlsx/.pptx sind ZIP-Archive mit XML. Claude liest PDFs und Text direkt,
 * Office-Dateien aber nicht — darum hier ein minimaler ZIP-Leser (Central Directory
 * + zlib.inflateRawSync, ohne ZIP64) und je Format eine schlichte XML→Text-Umwandlung.
 * Ziel ist lesbarer Inhalt für die KI, keine originalgetreue Darstellung.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { inflateRawSync } from 'zlib';

function readZip(buf: Buffer): Map<string, () => Buffer> {
  const entries = new Map<string, () => Buffer>();
  // End of Central Directory suchen (max. 64 KB Kommentar am Ende)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Keine gültige ZIP-/Office-Datei.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf-8');
    entries.set(name, () => {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return inflateRawSync(data);
      throw new Error(`ZIP-Kompression ${method} nicht unterstützt.`);
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&');
}

function docxText(zip: Map<string, () => Buffer>): string {
  const doc = zip.get('word/document.xml');
  if (!doc) throw new Error('word/document.xml fehlt.');
  const xml = doc().toString('utf-8');
  return decodeXml(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<\/w:tc>/g, '\t')
      .replace(/<[^>]+>/g, ''),
  ).replace(/\n{3,}/g, '\n\n').trim();
}

function colIndex(ref: string): number {
  const letters = (ref.match(/^[A-Z]+/) || ['A'])[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function xlsxText(zip: Map<string, () => Buffer>): string {
  const shared: string[] = [];
  const ss = zip.get('xl/sharedStrings.xml');
  if (ss) {
    const xml = ss().toString('utf-8');
    for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) || []) {
      shared.push(decodeXml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')));
    }
  }
  const wb = zip.get('xl/workbook.xml')?.().toString('utf-8') || '';
  const sheetNames = Array.from(wb.matchAll(/<sheet [^>]*name="([^"]*)"/g)).map((m) => decodeXml(m[1]));
  const sheetFiles = Array.from(zip.keys())
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  const out: string[] = [];
  sheetFiles.forEach((file, i) => {
    const xml = zip.get(file)!().toString('utf-8');
    const rows: string[] = [];
    for (const row of xml.match(/<row[\s\S]*?<\/row>/g) || []) {
      const cells: string[] = [];
      for (const c of row.match(/<c [^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
        const ref = (c.match(/ r="([A-Z]+)\d+"/) || [])[1] || '';
        const type = (c.match(/ t="([^"]+)"/) || [])[1] || '';
        let val = '';
        if (type === 'inlineStr') val = decodeXml(((c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1]) || '');
        else {
          const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1] || '';
          val = type === 's' ? shared[Number(v)] ?? '' : decodeXml(v);
        }
        const idx = ref ? colIndex(ref) : cells.length;
        while (cells.length < idx) cells.push('');
        cells[idx] = val.replace(/\s+/g, ' ').trim();
      }
      if (cells.some(Boolean)) rows.push(cells.join('\t'));
    }
    out.push(`## Blatt: ${sheetNames[i] || `Blatt ${i + 1}`}\n${rows.join('\n')}`);
  });
  return out.join('\n\n').trim();
}

function pptxText(zip: Map<string, () => Buffer>): string {
  const slides = Array.from(zip.keys())
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.match(/(\d+)\.xml$/)![1]) - Number(b.match(/(\d+)\.xml$/)![1]));
  return slides.map((file, i) => {
    const xml = zip.get(file)!().toString('utf-8');
    const paras = (xml.match(/<a:p>[\s\S]*?<\/a:p>/g) || [])
      .map((p) => decodeXml((p.match(/<a:t>([\s\S]*?)<\/a:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')))
      .filter(Boolean);
    return `## Folie ${i + 1}\n${paras.join('\n')}`;
  }).join('\n\n').trim();
}

export const OFFICE_EXTENSIONS = ['docx', 'xlsx', 'pptx'] as const;

/** Text aus einer .docx/.xlsx/.pptx-Datei; wirft bei unbekanntem Format. */
export function officeToText(buf: Buffer, filename: string): string {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const zip = readZip(buf);
  if (ext === 'docx') return docxText(zip);
  if (ext === 'xlsx') return xlsxText(zip);
  if (ext === 'pptx') return pptxText(zip);
  throw new Error(`Dateiformat .${ext} wird nicht unterstützt.`);
}
