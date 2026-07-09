import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/portalSession';
import { getInvoiceById } from '@/lib/invoiceStore';
import { getBooking } from '@/lib/bookingStore';
import { internalApiKey, INTERNAL_KEY_HEADER } from '@/lib/apiGuard';

/** GET /api/portal/invoices/[id]/pdf - Rechnung-PDF (nur Eigentuemer). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  const { id } = await params;

  const inv = await getInvoiceById(id).catch(() => undefined) as { booking_id: string; invoice_number: string } | undefined;
  if (!inv) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  const booking = await getBooking(inv.booking_id).catch(() => null) as { customer_id?: string | null } | null;
  if (!booking || booking.customer_id !== session.cid) {
    return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  }

  // PDF-Erzeugung an die bestehende Route delegieren – intern über Loopback
  // (hinter dem Reverse-Proxy ist req.url die interne Adresse; Loopback ist robust).
  const internal = `http://127.0.0.1:${process.env.PORT || '3000'}`;
  const r = await fetch(`${internal}/api/invoices/${encodeURIComponent(id)}/pdf`, {
    headers: { [INTERNAL_KEY_HEADER]: internalApiKey() },
  });
  if (!r.ok) return NextResponse.json({ success: false, error: 'PDF-Erzeugung fehlgeschlagen' }, { status: 502 });
  const buf = Buffer.from(await r.arrayBuffer());
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Rechnung_${inv.invoice_number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
