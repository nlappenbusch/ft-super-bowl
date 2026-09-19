import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { suggestReply } from '@/lib/workspace/mailTriage';
import { describeAiError } from '@/lib/workspace/claude';

export const maxDuration = 180;

/** POST — Antwortvorschlag der KI (wird NICHT versendet). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const { id } = await params;
  try {
    const data = await suggestReply(id, { name: ws.personName });
    return NextResponse.json({ success: true, data });
  } catch (e) {
    return NextResponse.json({ success: false, error: describeAiError(e) }, { status: 500 });
  }
}
