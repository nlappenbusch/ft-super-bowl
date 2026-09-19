import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { listMyNudges } from '@/lib/workspace/nudges';

export const dynamic = 'force-dynamic';

/** GET — offene Erinnerungen der angemeldeten Person. */
export async function GET() {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  if (!ws.employee) return NextResponse.json({ success: true, data: [] });
  return NextResponse.json({ success: true, data: await listMyNudges(ws.employee.id) });
}
