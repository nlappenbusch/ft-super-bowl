import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { agentTodaySummary, runWorkspaceAgent } from '@/lib/workspace/agentRunner';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** GET — was der Hintergrund-Agent in den letzten 24 h selbständig erledigt hat. */
export async function GET() {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  return NextResponse.json({ success: true, data: await agentTodaySummary() });
}

/** POST { action: 'run' } — Lauf sofort starten (nur Admins). */
export async function POST(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  if (!ws.isAdmin) return NextResponse.json({ success: false, error: 'Nur Admins' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== 'run') return NextResponse.json({ success: false, error: 'Unbekannte Aktion' }, { status: 400 });
  const summary = await runWorkspaceAgent({ force: true });
  return NextResponse.json({ success: true, data: summary });
}
