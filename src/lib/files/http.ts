/**
 * files/http.ts — Datei-Auslieferung (Range-fähig) und ZIP-Stream ohne Zwischenspeicher.
 *
 * ZIP: Methode "stored" (keine Kompression — Fotos/PDFs/Videos sind ohnehin komprimiert)
 * mit Data-Descriptor (CRC wird beim Streamen berechnet). Die Gesamtlänge ist vorab
 * bekannt → Browser zeigt echten Fortschritt. Ohne ZIP64: bis knapp 4 GB gesamt.
 */
import fs from 'fs';
import { Readable } from 'stream';
import type { FileItem } from './store';
import { itemPath } from './store';

export const ZIP_MAX_BYTES = 0xffffffff - 64 * 1024 * 1024;

export function contentDisposition(kind: 'attachment' | 'inline', name: string): string {
  const ascii = name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '') || 'download';
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** Datei als Response streamen, inkl. HTTP-Range (Fortsetzen/Video-Spulen). */
export function fileResponse(req: Request, item: FileItem, opts: { inline?: boolean } = {}): Response {
  const p = itemPath(item.share_id, item.id);
  let size: number;
  try { size = fs.statSync(p).size; } catch { return new Response('Datei nicht gefunden', { status: 404 }); }
  const inlineOk = opts.inline && /^(image\/(png|jpe?g|gif|webp)|application\/pdf|video\/mp4|text\/plain)$/i.test(item.mime);
  const headers: Record<string, string> = {
    'Content-Type': inlineOk ? item.mime : 'application/octet-stream',
    'Content-Disposition': contentDisposition(inlineOk ? 'inline' : 'attachment', item.name),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex',
    'X-Content-Type-Options': 'nosniff',
  };
  const range = req.headers.get('range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m && size > 0) {
    let start = m[1] ? parseInt(m[1], 10) : NaN;
    let end = m[2] ? parseInt(m[2], 10) : size - 1;
    if (Number.isNaN(start)) { start = Math.max(0, size - end); end = size - 1; }
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    end = Math.min(end, size - 1);
    const stream = Readable.toWeb(fs.createReadStream(p, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}` },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(p)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, 'Content-Length': String(size) } });
}

/** Ist die Anfrage der Beginn eines Downloads (nicht ein Folge-Range)? → zählen. */
export function isFirstRequest(req: Request): boolean {
  const r = req.headers.get('range');
  return !r || /^bytes=0-/.test(r.trim());
}

// ───────────────────────── ZIP ─────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32Update(crc: number, buf: Uint8Array): number {
  let c = crc ^ 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

function uniqueNames(items: FileItem[]): string[] {
  const seen = new Map<string, number>();
  return items.map((it) => {
    const n = it.name;
    const c = seen.get(n.toLowerCase()) || 0;
    seen.set(n.toLowerCase(), c + 1);
    if (!c) return n;
    const dot = n.lastIndexOf('.');
    return dot > 0 ? `${n.slice(0, dot)} (${c + 1})${n.slice(dot)}` : `${n} (${c + 1})`;
  });
}

export function zipSize(items: FileItem[]): number {
  const names = uniqueNames(items).map((n) => Buffer.byteLength(n));
  return items.reduce((s, it, i) => s + 30 + names[i] + it.size + 16 + 46 + names[i], 0) + 22;
}

export function zipResponse(items: FileItem[], zipName: string): Response {
  const names = uniqueNames(items).map((n) => Buffer.from(n, 'utf8'));
  const { time, date } = dosDateTime(new Date());
  const total = zipSize(items);

  async function* generate(): AsyncGenerator<Uint8Array> {
    const central: Buffer[] = [];
    let offset = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = names[i];
      const lh = Buffer.alloc(30);
      lh.writeUInt32LE(0x04034b50, 0);
      lh.writeUInt16LE(20, 4);
      lh.writeUInt16LE(0x0808, 6); // Data-Descriptor + UTF-8-Namen
      lh.writeUInt16LE(0, 8);
      lh.writeUInt16LE(time, 10);
      lh.writeUInt16LE(date, 12);
      lh.writeUInt16LE(name.length, 26);
      yield lh; yield name;

      let crc = 0;
      let written = 0;
      const stream = fs.createReadStream(itemPath(it.share_id, it.id), { highWaterMark: 1024 * 1024 });
      for await (const chunk of stream) {
        const b = chunk as Buffer;
        crc = crc32Update(crc, b);
        written += b.length;
        yield b;
      }
      if (written !== it.size) throw new Error(`Grösse stimmt nicht: ${it.name}`);

      const dd = Buffer.alloc(16);
      dd.writeUInt32LE(0x08074b50, 0);
      dd.writeUInt32LE(crc, 4);
      dd.writeUInt32LE(it.size, 8);
      dd.writeUInt32LE(it.size, 12);
      yield dd;

      const ch = Buffer.alloc(46);
      ch.writeUInt32LE(0x02014b50, 0);
      ch.writeUInt16LE(20, 4);
      ch.writeUInt16LE(20, 6);
      ch.writeUInt16LE(0x0808, 8);
      ch.writeUInt16LE(0, 10);
      ch.writeUInt16LE(time, 12);
      ch.writeUInt16LE(date, 14);
      ch.writeUInt32LE(crc, 16);
      ch.writeUInt32LE(it.size, 20);
      ch.writeUInt32LE(it.size, 24);
      ch.writeUInt16LE(name.length, 28);
      ch.writeUInt32LE(offset, 42);
      central.push(ch, name);
      offset += 30 + name.length + it.size + 16;
    }
    const cd = Buffer.concat(central);
    yield cd;
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(items.length, 8);
    end.writeUInt16LE(items.length, 10);
    end.writeUInt32LE(cd.length, 12);
    end.writeUInt32LE(offset, 16);
    yield end;
  }

  const stream = Readable.toWeb(Readable.from(generate())) as ReadableStream;
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition('attachment', zipName),
      'Content-Length': String(total),
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
