import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { findBookingByRequestNumber } from '@/lib/database';
import { getBooking } from '@/lib/bookingStore';

/** GET ?ref=RQ-10042|<id> — Anfrage für eine Entwurfskarte auflösen (Empfänger anzeigen, Versand über CRM). */
export async function GET(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const ref = (new URL(req.url).searchParams.get('ref') || '').trim();
  if (!ref) return NextResponse.json({ success: false, error: 'ref fehlt' }, { status: 400 });
  const rq = /^rq-?\d+/i.test(ref) ? (ref.toUpperCase().startsWith('RQ-') ? ref.toUpperCase() : `RQ-${ref.replace(/\D/g, '')}`) : null;
  const b = (rq ? await findBookingByRequestNumber(rq) : await getBooking(ref)) as
    | { id: string; request_number?: string | null; email: string; package_title: string; customer_name?: string } | undefined | null;
  if (!b) return NextResponse.json({ success: false, error: 'Anfrage nicht gefunden' }, { status: 404 });
  return NextResponse.json({
    success: true,
    data: { id: b.id, request_number: b.request_number || null, email: b.email, package: b.package_title, customer: b.customer_name || null },
  });
}
