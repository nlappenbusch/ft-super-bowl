import { NextResponse } from 'next/server';
import { getBooking, addMessage } from '@/lib/bookingStore';
import { getEventBySlug } from '@/lib/eventData';
import { sendGraphMail, isGraphConfigured, getMailbox, getFromName } from '@/lib/graphMailer';
import { replyEmailHtml, replySubject } from '@/lib/emailTemplates';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const text: string = (body.body || body.message || '').trim();

    if (!text) {
      return NextResponse.json(
        { success: false, error: 'Nachrichtentext fehlt' },
        { status: 400 }
      );
    }

    if (!isGraphConfigured()) {
      return NextResponse.json(
        { success: false, error: 'E-Mail-Versand (Microsoft 365 Graph) ist nicht konfiguriert.' },
        { status: 503 }
      );
    }

    const booking = await getBooking(id);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Anfrage nicht gefunden' },
        { status: 404 }
      );
    }

    const b = booking as {
      id: string;
      email: string;
      request_number?: string | null;
      event_slug?: string | null;
    };

    const requestNumber = b.request_number || '';
    if (!requestNumber) {
      return NextResponse.json(
        { success: false, error: 'Diese Anfrage hat noch keine RQ-Nummer.' },
        { status: 400 }
      );
    }

    // Event-Name für Betreff
    let eventName: string | undefined;
    if (b.event_slug) {
      const ev = await getEventBySlug(b.event_slug).catch(() => null);
      eventName = ev?.name || ev?.title || undefined;
    }

    const subject = replySubject(requestNumber, eventName);
    const html = replyEmailHtml({
      bodyText: text,
      requestNumber,
      eventName,
      agentName: body.agentName,
    });

    const sendRes = await sendGraphMail({ to: b.email, subject, html });
    if (!sendRes.success) {
      return NextResponse.json(
        { success: false, error: sendRes.error || 'Versand fehlgeschlagen' },
        { status: 502 }
      );
    }

    const saved = await addMessage({
      booking_id: b.id,
      direction: 'out',
      from_email: getMailbox() || getFromName(),
      to_email: b.email,
      subject,
      body: text,
      graph_message_id: null,
    });

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
