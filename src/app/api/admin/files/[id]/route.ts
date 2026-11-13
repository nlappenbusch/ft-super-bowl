/**
 * PATCH  /api/admin/files/[id] — Titel/Nachricht/Ablauf/Passwort ändern
 *        { title?, message?, extend_days? | days? | expires_at?, password?: string|null }
 * DELETE /api/admin/files/[id] — Freigabe sofort endgültig löschen (Dateien weg).
 */
import { NextResponse } from 'next/server';
import { deleteShare, updateShare } from '@/lib/files/store';
import { currentActor } from '@/lib/files/actor';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const share = await updateShare(id, body || {});
  if (!share) return NextResponse.json({ success: false, error: 'Freigabe nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: share });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await currentActor();
  const ok = await deleteShare(id, actor?.name || 'Unbekannt');
  if (!ok) return NextResponse.json({ success: false, error: 'Freigabe nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true });
}
