import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { listBookings } from '@/lib/bookingStore';

/** GET /api/ext/bookings?status= → Anfragen/Buchungen (optional nach Status gefiltert). */
export async function GET(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const status = new URL(req.url).searchParams.get('status');
  let data = await listBookings();
  if (status) data = data.filter((b: { status?: string }) => b.status === status);
  return NextResponse.json({ success: true, data });
}
