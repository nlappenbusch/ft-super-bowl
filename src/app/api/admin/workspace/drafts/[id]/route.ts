import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { getConversation, recordDraftAction } from '@/lib/workspace/store';

/**
 * POST { conversation_id, action: 'sent' | 'outlook', web_link? } — festhalten, dass ein
 * Antwortentwurf aus dem Chat gesendet bzw. in Outlook abgelegt wurde (nur eigene Chats).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { conversation_id?: string; action?: string; web_link?: string };
  const conv = body.conversation_id ? await getConversation(body.conversation_id) : null;
  if (!conv || conv.employee_id !== ws.ownerKey) return NextResponse.json({ success: false, error: 'Chat nicht gefunden' }, { status: 404 });
  if (body.action !== 'sent' && body.action !== 'outlook') return NextResponse.json({ success: false, error: 'Unbekannte Aktion' }, { status: 400 });
  await recordDraftAction({ draft_id: id, conversation_id: conv.id, action: body.action, web_link: typeof body.web_link === 'string' ? body.web_link : '', by_name: ws.personName });
  return NextResponse.json({ success: true });
}
