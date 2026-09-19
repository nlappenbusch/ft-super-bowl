import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { getConversation, listMessages, listConversationFiles, listDraftActions, updateConversation, deleteConversation } from '@/lib/workspace/store';
import { toDisplay } from '@/lib/workspace/display';
import { deleteAnthropicFiles } from '@/lib/workspace/files';

type Ctx = { params: Promise<{ id: string }> };

async function ownConversation(id: string) {
  const ws = await workspaceSession();
  if (!ws) return { error: unauthorized() };
  const conv = await getConversation(id);
  if (!conv || conv.employee_id !== ws.ownerKey) {
    return { error: NextResponse.json({ success: false, error: 'Chat nicht gefunden' }, { status: 404 }) };
  }
  return { conv };
}

/** GET — Verlauf zur Anzeige. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const r = await ownConversation(id);
  if ('error' in r) return r.error;
  const [messages, files, drafts] = await Promise.all([listMessages(id), listConversationFiles(id), listDraftActions(id)]);
  const byAnthropicId = new Map(files.map((f) => [f.anthropic_file_id, f]));
  return NextResponse.json({
    success: true,
    data: { id: r.conv.id, title: r.conv.title, items: toDisplay(messages, byAnthropicId, drafts) },
  });
}

/** PATCH { title?, archived? } */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const r = await ownConversation(id);
  if ('error' in r) return r.error;
  const body = (await req.json().catch(() => ({}))) as { title?: string; archived?: boolean };
  await updateConversation(id, {
    title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined,
    archived: typeof body.archived === 'boolean' ? body.archived : undefined,
  });
  return NextResponse.json({ success: true });
}

/** DELETE — Chat samt Dateien löschen (auch bei Anthropic). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const r = await ownConversation(id);
  if ('error' in r) return r.error;
  const fileIds = await deleteConversation(id);
  await deleteAnthropicFiles(fileIds);
  return NextResponse.json({ success: true });
}
