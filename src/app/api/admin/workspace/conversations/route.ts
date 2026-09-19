import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { listConversations } from '@/lib/workspace/store';

/** GET — eigene Chats (neueste zuerst). */
export async function GET() {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const rows = await listConversations(ws.ownerKey);
  return NextResponse.json({ success: true, data: rows.map(({ id, title, updated_at, created_at }) => ({ id, title, updated_at, created_at })) });
}
