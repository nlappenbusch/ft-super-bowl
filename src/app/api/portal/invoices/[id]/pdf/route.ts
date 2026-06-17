import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/portalSession';
import { getInvoiceById } from '@/lib/invoiceStore';
import { getBooking } from '@/lib/bookingStore';
import { publicBaseUrl } from '@/lib/emailTemplates';

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

  // PDF-Erzeugung an die bestehende Route delegieren (gleiche App, serverseitig).
  const origin = (() => { try { return new URL(req.url).origin; } catch { return publicBaseUrl(); } })();
  const r = await fetch(`${origin}/api/invoices/${encodeURIComponent(id)}/pdf`);
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
