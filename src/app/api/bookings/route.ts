import { NextResponse } from 'next/server';
import { createBooking, listBookings, addMessage } from '@/lib/bookingStore';
import { getEventBySlug } from '@/lib/eventData';
import { addContactToBrevoList } from '@/lib/brevo';
import { sendGraphMail, isGraphConfigured, getMailbox } from '@/lib/graphMailer';
import { confirmationEmailHtml, confirmationSubject } from '@/lib/emailTemplates';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.email || !body.phone || !body.travelers || body.travelers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Fehlende Pflichtfelder' },
        { status: 400 }
      );
    }

    const booking = await createBooking({
      eventSlug: body.eventSlug,
      packageSlug: body.packageSlug,
      packageId: body.packageId,
      packageTitle: body.packageTitle,
      startDate: body.startDate,
      numberOfPersons: body.numberOfPersons,
      doubleRooms: body.doubleRooms,
      singleRooms: body.singleRooms,
      travelers: body.travelers,
      email: body.email,
      phone: body.phone,
      message: body.message || '',
      totalPrice: body.totalPrice || 0
    });

    const firstTraveler = Array.isArray(body.travelers) ? body.travelers[0] : null;
    const firstName = firstTraveler?.firstName || firstTraveler?.first_name || body.email.split('@')[0];
    const lastName = firstTraveler?.lastName || firstTraveler?.last_name || '';

    // Event laden (für Brevo-Liste + Event-Name in der Mail)
    let event: Awaited<ReturnType<typeof getEventBySlug>> = null;
    if (body.eventSlug) {
      try {
        event = await getEventBySlug(body.eventSlug);
      } catch {
        event = null;
      }
    }
    const eventName = event?.name || event?.title || body.packageTitle || undefined;

    // Brevo sync: Kontakt der Event-Liste zuordnen (additiv – bestehende Listen bleiben)
    if (event?.brevo_list_id) {
      try {
        const listId = parseInt(String(event.brevo_list_id), 10);
        if (!isNaN(listId)) {
          await addContactToBrevoList(body.email, firstName, lastName, body.phone, listId);
        }
      } catch (brevoErr) {
        console.warn('[Brevo] Sync failed (non-fatal):', brevoErr);
      }
    }

    // Bestätigungsmail an den Kunden (via M365 Graph) + Konversations-Log
    const requestNumber = (booking as { request_number?: string })?.request_number || '';
    if (requestNumber && isGraphConfigured()) {
      try {
        const subject = confirmationSubject(requestNumber, eventName);
        const html = confirmationEmailHtml({
          firstName,
          requestNumber,
          eventName,
          message: body.message || '',
        });
        const sendRes = await sendGraphMail({
          to: body.email,
          toName: [firstName, lastName].filter(Boolean).join(' ') || undefined,
          subject,
          html,
        });
        if (sendRes.success) {
          await addMessage({
            booking_id: (booking as { id: string }).id,
            direction: 'out',
            from_email: getMailbox(),
            to_email: body.email,
            subject,
            body: 'Automatische Bestätigung der Anfrage gesendet.',
            graph_message_id: null,
          });
        }
      } catch (mailErr) {
        console.warn('[Graph] Bestätigungsmail fehlgeschlagen (non-fatal):', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: booking,
      requestNumber,
      message: 'Buchungsanfrage erfolgreich gespeichert'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const bookings = await listBookings();
    return NextResponse.json({ success: true, data: bookings });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
