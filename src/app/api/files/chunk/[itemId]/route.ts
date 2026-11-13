/**
 * PUT /api/files/chunk/[itemId]?offset=N — ein Upload-Stück (Rohbytes im Body).
 *
 * Bewusst AUSSERHALB von /api/admin: die Middleware puffert Request-Bodies nur bis
 * zu einer Grenze — Upload-Stücke sollen ungepuffert gestreamt werden. Darum prüft
 * die Route die Session selbst (requireAdminSession).
 *
 * Idempotent: ein wiederholtes Stück (offset < bereits empfangen) kürzt die Datei
 * auf `offset` und schreibt neu — so übersteht der Upload Verbindungsabbrüche.
 */
import fs from 'fs';
import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/apiGuard';
import { getItem, getShare, itemPath, setItemProgress } from '@/lib/files/store';
import { FILES_CHUNK_BYTES } from '@/lib/files/config';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

export async function PUT(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  const { itemId } = await params;
  const item = await getItem(itemId);
  if (!item) return NextResponse.json({ success: false, error: 'Datei nicht gefunden' }, { status: 404 });
  const share = await getShare(item.share_id);
  if (!share || share.deleted_at) return NextResponse.json({ success: false, error: 'Freigabe gelöscht' }, { status: 410 });
  if (item.complete) return NextResponse.json({ success: true, data: { received: item.size, complete: true } });

  const offset = Number(new URL(req.url).searchParams.get('offset'));
  const p = itemPath(item.share_id, item.id);
  let current = 0;
  try { current = fs.statSync(p).size; } catch { /* neu */ }
  if (!Number.isFinite(offset) || offset < 0 || offset > current) {
    return NextResponse.json({ success: false, error: 'Falscher Offset', received: current }, { status: 409 });
  }
  if (offset < current) fs.truncateSync(p, offset);

  const fh = await fs.promises.open(p, 'r+');
  let pos = offset;
  try {
    if (!req.body) throw new Error('Leerer Body');
    const reader = req.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (pos + value.length > item.size || pos - offset + value.length > FILES_CHUNK_BYTES * 2) {
        throw new Error('Mehr Daten als angemeldet');
      }
      await fh.write(value, 0, value.length, pos);
      pos += value.length;
    }
  } catch (e) {
    await fh.close();
    try { fs.truncateSync(p, offset); } catch { /* egal */ }
    return NextResponse.json({ success: false, error: (e as Error).message, received: offset }, { status: 400 });
  }
  await fh.close();
  const complete = pos === item.size;
  await setItemProgress(item.id, pos, complete);
  return NextResponse.json({ success: true, data: { received: pos, complete } });
}
