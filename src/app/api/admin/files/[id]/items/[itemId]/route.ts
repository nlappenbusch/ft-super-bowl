/**
 * GET    /api/admin/files/[id]/items/[itemId] — interner Download (zählt nicht als Abruf).
 * DELETE /api/admin/files/[id]/items/[itemId] — einzelne Datei aus der Freigabe entfernen.
 */
import { NextResponse } from 'next/server';
import { deleteItem, getItem } from '@/lib/files/store';
import { fileResponse } from '@/lib/files/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const item = await getItem(itemId);
  if (!item || item.share_id !== id || !item.complete) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  return fileResponse(req, item, { inline: new URL(req.url).searchParams.get('inline') === '1' });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  const item = await getItem(itemId);
  if (!item || item.share_id !== id) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  await deleteItem(itemId);
  return NextResponse.json({ success: true });
}
