import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { getCheckin } from '@/lib/workspace/checkin';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET ?refresh=1 — proaktiver Check-in der Faltin-KI (3 h zwischengespeichert). */
export async function GET(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const refresh = new URL(req.url).searchParams.get('refresh') === '1';
  const data = await getCheckin({ ownerKey: ws.ownerKey, employee: ws.employee, personName: ws.personName, refresh });
  return NextResponse.json({ success: true, data });
}
