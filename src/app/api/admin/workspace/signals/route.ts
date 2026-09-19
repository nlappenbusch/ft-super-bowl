import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { collectSignals } from '@/lib/workspace/signals';

export const dynamic = 'force-dynamic';

/** GET — „Mein Tag“ der angemeldeten Person. */
export async function GET() {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  return NextResponse.json({ success: true, data: await collectSignals(ws.employee) });
}
