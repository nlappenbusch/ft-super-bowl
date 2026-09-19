import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { listKnowledge, searchKnowledge, createKnowledge } from '@/lib/workspace/store';

/** GET ?q= — Teamwissen (Suche optional). */
export async function GET(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  const data = q ? await searchKnowledge(q, 50) : await listKnowledge();
  return NextResponse.json({ success: true, data });
}

/** POST { title, content, tags?, pinned? } — Wissen festhalten (anheften nur für Admins). */
export async function POST(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { title?: string; content?: string; tags?: string; pinned?: boolean };
  if (!body.title?.trim() || !body.content?.trim()) {
    return NextResponse.json({ success: false, error: 'Titel und Inhalt sind nötig.' }, { status: 400 });
  }
  const k = await createKnowledge({
    title: body.title,
    content: body.content,
    tags: body.tags || '',
    pinned: ws.isAdmin && !!body.pinned,
    source: 'manuell',
    created_by: ws.employee?.id || ws.ownerKey,
    created_by_name: ws.personName,
  });
  return NextResponse.json({ success: true, data: k });
}
