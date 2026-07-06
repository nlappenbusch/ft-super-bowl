import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * WP-Plugin-Download fürs Admin-Panel (durch Middleware admin-geschützt).
 *
 * GET /api/admin/plugin          → faltin-events-<version>.zip (Download)
 * GET /api/admin/plugin?info=1   → { version, filename } (für die UI)
 *
 * Die ZIP wird zur LAUFZEIT aus der deployten wordpress-plugin/
 * faltin-events.php gepackt — damit ist der Download immer exakt so
 * aktuell wie der Server-Stand, ohne manuell gepflegte ZIP im Repo.
 * Flache Struktur (nur die .php) — konsistent zur bisherigen Installation
 * als Single-File-Plugin (ein Ordner-Zip würde in WordPress ein zweites,
 * paralleles Plugin anlegen).
 */

const PLUGIN_FILE = 'faltin-events.php';

function pluginPath(): string {
  return path.join(process.cwd(), 'wordpress-plugin', PLUGIN_FILE);
}

function parseVersion(php: string): string {
  const m = php.match(/^\s*\*\s*Version:\s*([0-9][0-9a-zA-Z.\-]*)/m);
  return m ? m[1] : '0.0.0';
}

/* ── Minimaler ZIP-Writer (STORED, keine Kompression, keine Dependencies) ── */

const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function buildStoredZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  // Feste DOS-Zeit (01.01.2026 00:00) — deterministische Builds
  const dosTime = 0x0000;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);      // local file header signature
    local.writeUInt16LE(20, 4);              // version needed
    local.writeUInt16LE(0, 6);               // flags
    local.writeUInt16LE(0, 8);               // method: STORED
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.data.length, 18);  // compressed size
    local.writeUInt32LE(e.data.length, 22);  // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);              // extra len
    name.copy(local, 30);
    locals.push(local, e.data);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);    // central dir signature
    central.writeUInt16LE(20, 4);            // version made by
    central.writeUInt16LE(20, 6);            // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);            // method
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(e.data.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);            // extra
    central.writeUInt16LE(0, 32);            // comment
    central.writeUInt16LE(0, 34);            // disk
    central.writeUInt16LE(0, 36);            // internal attrs
    central.writeUInt32LE(0, 38);            // external attrs
    central.writeUInt32LE(offset, 42);       // local header offset
    name.copy(central, 46);
    centrals.push(central);

    offset += local.length + e.data.length;
  }

  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);         // end of central dir
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, cd, eocd]);
}

export async function GET(request: Request) {
  let php: string;
  try {
    php = fs.readFileSync(pluginPath(), 'utf8');
  } catch {
    return NextResponse.json(
      { success: false, error: 'Plugin-Datei nicht gefunden (wordpress-plugin/faltin-events.php).' },
      { status: 404 }
    );
  }
  const version = parseVersion(php);
  const filename = `faltin-events-${version}.zip`;

  const { searchParams } = new URL(request.url);
  if (searchParams.get('info')) {
    return NextResponse.json({ success: true, data: { version, filename } });
  }

  const zip = buildStoredZip([{ name: PLUGIN_FILE, data: Buffer.from(php, 'utf8') }]);
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zip.length),
      'Cache-Control': 'no-store',
    },
  });
}
