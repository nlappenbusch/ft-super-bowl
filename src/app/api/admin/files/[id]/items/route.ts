/**
 * POST /api/admin/files/[id]/items — Datei anmelden { name, size, mime } → { id }.
 * Die Bytes kommen danach stückweise über PUT /api/files/chunk/[itemId]?offset=…
 */
import { NextResponse } from 'next/server';
import { addItem, freeDiskBytes, getShare } from '@/lib/files/store';
import { FILES_MAX_FILE_BYTES } from '@/lib/files/config';

export const dynamic = 'force-dynamic';

const RESERVE_BYTES = 2 * 1024 ** 3; // 2 GB frei lassen

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await getShare(id);
  if (!share || share.deleted_at) return NextResponse.json({ success: false, error: 'Freigabe nicht gefunden' }, { status: 404 });
  const body = await req.json().catch(() => ({})) as { name?: string; size?: number; mime?: string };
  const size = Number(body.size);
  if (!body.name || !Number.isFinite(size) || size < 0) {
    return NextResponse.json({ success: false, error: 'Name und Grösse fehlen' }, { status: 400 });
  }
  if (size > FILES_MAX_FILE_BYTES) {
    return NextResponse.json({ success: false, error: `Datei zu gross (max. ${Math.round(FILES_MAX_FILE_BYTES / 1024 ** 3)} GB)` }, { status: 413 });
  }
  const free = freeDiskBytes();
  if (free !== null && size > free - RESERVE_BYTES) {
    return NextResponse.json({ success: false, error: 'Nicht genug Speicherplatz auf dem Server' }, { status: 507 });
  }
  const item = await addItem(id, { name: body.name, size, mime: body.mime });
  return NextResponse.json({ success: true, data: item });
}
