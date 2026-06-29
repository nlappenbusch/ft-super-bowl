import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getBooking, updateBooking } from '@/lib/bookingStore';

/** GET → einzelne Anfrage/Buchung. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const b = await getBooking(id);
  if (!b) return NextResponse.json({ success: false, error: 'Anfrage nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: b });
}

/** PATCH { status?, notes?, assigned_to?, offer_sent?, docs_ready? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateBooking(id, {
    status: body.status,
    notes: body.notes,
    assigned_to: body.assigned_to,
    offer_sent: body.offer_sent,
    docs_ready: body.docs_ready,
  });
  if (!updated) return NextResponse.json({ success: false, error: 'Anfrage nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: updated });
}
