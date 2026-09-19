import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { draftReplyInMailbox } from '@/lib/workspace/mailTriage';

/**
 * POST { text } — Antwort als ENTWURF im Postfach ablegen (Graph createReply).
 * Versendet nichts; der Mensch prüft und sendet in Outlook.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = String(body.text || '').trim();
  if (!text) return NextResponse.json({ success: false, error: 'Text fehlt' }, { status: 400 });
  const r = await draftReplyInMailbox(id, text);
  if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 502 });
  return NextResponse.json({ success: true, data: { web_link: r.webLink } });
}
