import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { getKnowledge, updateKnowledge, deleteKnowledge } from '@/lib/workspace/store';

type Ctx = { params: Promise<{ id: string }> };

/** Bearbeiten/Löschen: Verfasser:in oder Admin. Anheften: nur Admin. */
async function guard(id: string) {
  const ws = await workspaceSession();
  if (!ws) return { error: unauthorized() };
  const k = await getKnowledge(id);
  if (!k) return { error: NextResponse.json({ success: false, error: 'Eintrag nicht gefunden' }, { status: 404 }) };
  const own = k.created_by === (ws.employee?.id || ws.ownerKey);
  if (!own && !ws.isAdmin) {
    return { error: NextResponse.json({ success: false, error: 'Nur Verfasser:in oder Admins dürfen das ändern.' }, { status: 403 }) };
  }
  return { ws, k };
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const g = await guard(id);
  if ('error' in g) return g.error;
  const body = (await req.json().catch(() => ({}))) as { title?: string; content?: string; tags?: string; pinned?: boolean };
  const k = await updateKnowledge(id, {
    title: body.title, content: body.content, tags: body.tags,
    pinned: g.ws.isAdmin && typeof body.pinned === 'boolean' ? body.pinned : undefined,
  });
  return NextResponse.json({ success: true, data: k });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const g = await guard(id);
  if ('error' in g) return g.error;
  await deleteKnowledge(id);
  return NextResponse.json({ success: true });
}
