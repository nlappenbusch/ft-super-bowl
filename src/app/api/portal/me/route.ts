import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/portalSession';
import { getCustomer, updateCustomer, type CustomerUpdate } from '@/lib/customerStore';
import { listMessages } from '@/lib/bookingStore';
import { listAttachmentsForBooking, listCustomerDocuments, DOC_CATEGORY_LABEL, type DocCategory } from '@/lib/documentStore';

/** GET /api/portal/me – alles fürs Dashboard. */
export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const c = await getCustomer(session.cid);
  if (!c) return NextResponse.json({ success: false, error: 'Kunde nicht gefunden' }, { status: 404 });

  const docs = await listCustomerDocuments(session.cid, true);
  const docView = (d: typeof docs[number]) => ({
    id: d.id, category: d.category, categoryLabel: DOC_CATEGORY_LABEL[(d.category as DocCategory)] || 'Dokument',
    title: d.title || d.filename, filename: d.filename, mime: d.mime, size: d.size,
    booking_id: d.booking_id, created_at: d.created_at,
  });

  const requests = [];
  for (const b of c.bookings) {
    const msgs = await listMessages(b.id);
    const atts = await listAttachmentsForBooking(b.id);
    const attByMsg = new Map<string, { id: string; filename: string; mime: string; size: number }[]>();
    for (const a of atts) {
      const arr = attByMsg.get(a.message_id) || [];
      arr.push({ id: a.id, filename: a.filename, mime: a.mime, size: a.size });
      attByMsg.set(a.message_id, arr);
    }
    const bDocs = docs.filter((d) => d.booking_id === b.id);

    // Reise-Timeline ableiten (monoton: höchste erreichte Stufe gilt, frühere sind erledigt).
    const hasOfferDoc = bDocs.some((d) => d.category === 'offer');
    const hasTravelDoc = bDocs.some((d) => ['ticket', 'voucher', 'hotel'].includes(d.category));
    let stage = 0; // 0 Anfrage · 1 Angebot · 2 Gebucht · 3 Unterlagen · 4 Reise
    if (Number(b.offer_sent) === 1 || (b.total_price || 0) > 0 || hasOfferDoc) stage = Math.max(stage, 1);
    if (b.status === 'booked') stage = Math.max(stage, 2);
    if (Number(b.docs_ready) === 1 || hasTravelDoc) stage = Math.max(stage, 3);
    if (b.start_date && new Date(b.start_date).getTime() <= Date.now()) stage = Math.max(stage, 4);
    const closed = b.status === 'rejected';

    requests.push({
      id: b.id,
      request_number: b.request_number,
      package_title: b.package_title,
      start_date: b.start_date,
      status: b.status,
      stage,
      closed,
      total_price: b.total_price,
      created_at: b.created_at,
      messages: msgs.map((m) => ({
        id: m.id, direction: m.direction, subject: m.subject, body: m.body, created_at: m.created_at,
        attachments: attByMsg.get(m.id) || [],
      })),
      documents: bDocs.map(docView),
      invoices: c.invoices.filter((i) => i.booking_id === b.id).map((i) => ({
        id: i.id, invoice_number: i.invoice_number, total_amount: i.total_amount,
        paid_amount: i.paid_amount, status: i.status, invoice_date: i.invoice_date,
      })),
    });
  }

  return NextResponse.json({
    success: true,
    email: session.email,
    emails: c.emails.map((e) => e.email),
    profile: {
      salutation: c.salutation, first_name: c.first_name, last_name: c.last_name, name: c.name,
      company: c.company, phone: c.phone, street: c.street, zip: c.zip, city: c.city, country: c.country,
    },
    requests,
    generalDocuments: docs.filter((d) => !d.booking_id).map(docView),
  });
}

/** PATCH /api/portal/me – Kunde pflegt eigene Stammdaten (keine E-Mail-Änderung). */
export async function PATCH(req: Request) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const allowed = ['salutation', 'first_name', 'last_name', 'company', 'phone', 'street', 'zip', 'city', 'country'] as const;
  const updates: CustomerUpdate = {};
  for (const f of allowed) {
    if (f in body) updates[f] = String(body[f] ?? '');
  }
  const updated = await updateCustomer(session.cid, updates);
  if (!updated) return NextResponse.json({ success: false, error: 'Kunde nicht gefunden' }, { status: 404 });
  return NextResponse.json({
    success: true,
    profile: {
      salutation: updated.salutation, first_name: updated.first_name, last_name: updated.last_name, name: updated.name,
      company: updated.company, phone: updated.phone, street: updated.street, zip: updated.zip, city: updated.city, country: updated.country,
    },
  });
}
