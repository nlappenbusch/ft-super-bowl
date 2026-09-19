import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { getNudge, actOnNudge, resolveNudgesForRef } from '@/lib/workspace/nudges';

/** PATCH { action: 'snooze' | 'dismiss' | 'resolved' } — nur eigene Erinnerungen. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const { id } = await params;
  const n = await getNudge(id);
  if (!n || n.employee_id !== ws.employee?.id) {
    return NextResponse.json({ success: false, error: 'Erinnerung nicht gefunden' }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action === 'snooze' || body.action === 'dismiss') await actOnNudge(id, body.action);
  else if (body.action === 'resolved') await resolveNudgesForRef(n.ref_id);
  else return NextResponse.json({ success: false, error: 'Unbekannte Aktion' }, { status: 400 });
  return NextResponse.json({ success: true });
}
