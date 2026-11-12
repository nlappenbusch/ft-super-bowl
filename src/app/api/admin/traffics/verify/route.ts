import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/apiGuard';
import { verifyOffer, TrafficsError } from '@/lib/traffics';

/**
 * POST { code, adults } → Einzelangebot beim Veranstalter prüfen (`/offers/{code}`).
 * Live-Abfrage bis DERTOUR — nur auf ausdrücklichen Klick aufrufen.
 */
export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as { code?: unknown; adults?: unknown };
  try {
    const data = await verifyOffer(String(body.code || ''), Number(body.adults) || 1);
    return NextResponse.json({ success: true, data });
  } catch (e) {
    const status = e instanceof TrafficsError ? e.status : 500;
    return NextResponse.json({ success: false, error: (e as Error).message }, { status });
  }
}
