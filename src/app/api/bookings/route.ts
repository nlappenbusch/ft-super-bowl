import { NextResponse } from 'next/server';
import { createBooking, listBookings, addMessage } from '@/lib/bookingStore';
import { getEventBySlug, getPackageBySlug } from '@/lib/eventData';
import { addContactToBrevoList } from '@/lib/brevo';
import { sendGraphMail, isGraphConfigured, getMailbox, getNotifyTo } from '@/lib/graphMailer';
import {
  confirmationEmailHtml, confirmationSubject,
  internalNotificationHtml, internalNotificationSubject,
  autoReplyHtml, autoReplySubjectDefault, subjectTag,
} from '@/lib/emailTemplates';
import { linkBookingToCustomer, normalizeSalutation } from '@/lib/customerStore';
import { readAutoReplyPdfBase64 } from '@/lib/autoReplyStore';

/**
 * CORS: erlaubt das Anfrage-Formular auf WordPress ([faltin_anfrage]).
 * Werte identisch mit next.config.ts (/api/:path*), damit keine doppelten,
 * widersprüchlichen Header entstehen.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'https://faltintravel.com',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.email || !body.phone || !body.travelers || body.travelers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Fehlende Pflichtfelder' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Paket für Reisezeitraum/Nächte (wird an der Buchung fixiert + Team-Mail)
    const pkgRecord = body.eventSlug && body.packageSlug ? await getPackageBySlug(body.eventSlug, body.packageSlug) : null;
    const travelPeriodDisplay = [pkgRecord?.travel_period, pkgRecord?.nights ? `${pkgRecord.nights} Nächte` : '']
      .filter(Boolean).join(' · ') || undefined;

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
      totalPrice: body.totalPrice || 0,
      source: typeof body.source === 'string' ? body.source.slice(0, 200) : '',
      travelPeriod: travelPeriodDisplay || ''
    });

    const consent = !!body.consent;
    const firstTraveler = Array.isArray(body.travelers) ? body.travelers[0] : null;
    // Hauptbucher/Kontakt hat Vorrang vor erstem Reisenden.
    const firstName = body.firstName || firstTraveler?.firstName || firstTraveler?.first_name || body.email.split('@')[0];
    const lastName = body.lastName || firstTraveler?.lastName || firstTraveler?.last_name || '';
    const salutation = normalizeSalutation(body.salutation || firstTraveler?.salutation || '');

    // Kunde herleiten/verknüpfen (E-Mail = eindeutige ID)
    try {
      await linkBookingToCustomer((booking as { id: string }).id, body.email, {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        name: [firstName, lastName].filter(Boolean).join(' ') || undefined,
        phone: body.phone,
        salutation: salutation || undefined,
        street: typeof body.street === 'string' ? body.street.slice(0, 200) : undefined,
        zip: typeof body.zip === 'string' ? body.zip.slice(0, 20) : undefined,
        city: typeof body.city === 'string' ? body.city.slice(0, 100) : undefined,
        country: typeof body.country === 'string' ? body.country.slice(0, 100) : undefined,
      });
    } catch (custErr) {
      console.warn('[Customer] Verknuepfung fehlgeschlagen (non-fatal):', custErr);
    }

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
    const customerAddress = [body.street, [body.zip, body.city].filter(Boolean).join(' '), body.country]
      .filter((x: unknown) => typeof x === 'string' && (x as string).trim()).join(', ') || undefined;

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

    // E-Mails (via M365 Graph): Kundenbestätigung + interne Team-Benachrichtigung
    const requestNumber = (booking as { request_number?: string })?.request_number || '';
    const customerName = [firstName, lastName].filter(Boolean).join(' ') || undefined;
    const mail: {
      customer?: { success: boolean; error?: string };
      team?: { success: boolean; error?: string };
    } = {};

    if (requestNumber && isGraphConfigured()) {
      // 1) Bestätigung an den Kunden – per-Event Auto-Antwort (mit PDF) hat Vorrang,
      //    sonst die Standard-Bestätigung.
      try {
        const useAutoReply = !!(event?.auto_reply_enabled && (event.auto_reply_message || '').trim());

        let subject: string;
        let html: string;
        let attachments: { name: string; contentType: string; contentBytes: string }[] | undefined;
        let pdfCount = 0;

        if (useAutoReply) {
          subject = (event!.auto_reply_subject || '').trim() || autoReplySubjectDefault(eventName, requestNumber);
          // RQ-Tag fürs Threading anhängen, falls nicht bereits im Custom-Betreff enthalten.
          if (!/RQ-\d/i.test(subject)) subject = `${subject} ${subjectTag(requestNumber)}`;
          html = autoReplyHtml({ message: event!.auto_reply_message || '', firstName, lastName, salutation, eventName, requestNumber, consent });

          // Anhänge: neue Mehrfach-Liste (auto_reply_pdfs) hat Vorrang, sonst Legacy-Einzelfeld.
          const pdfList = Array.isArray(event!.auto_reply_pdfs) && event!.auto_reply_pdfs.length > 0
            ? event!.auto_reply_pdfs
            : (event!.auto_reply_pdf
                ? [{ file: event!.auto_reply_pdf, name: event!.auto_reply_pdf_name || 'Angebot.pdf' }]
                : []);

          for (const pdfMeta of pdfList) {
            const pdf = await readAutoReplyPdfBase64(pdfMeta.file);
            if (pdf) {
              (attachments ||= []).push({
                name: pdfMeta.name || 'Angebot.pdf',
                contentType: 'application/pdf',
                contentBytes: pdf.base64,
              });
            } else {
              console.warn('[AutoReply] PDF nicht gefunden:', pdfMeta.file);
            }
          }
          pdfCount = attachments?.length ?? 0;
        } else {
          subject = confirmationSubject(requestNumber, eventName);
          html = confirmationEmailHtml({ firstName, lastName, salutation, requestNumber, eventName, message: body.message || '', consent });
        }

        const sendRes = await sendGraphMail({ to: body.email, toName: customerName, subject, html, attachments });
        mail.customer = { success: sendRes.success, error: sendRes.error };
        if (sendRes.success) {
          await addMessage({
            booking_id: (booking as { id: string }).id,
            direction: 'out',
            from_email: getMailbox(),
            to_email: body.email,
            subject,
            body: useAutoReply
              ? `Automatische Event-Antwort gesendet${pdfCount > 0 ? ` (mit ${pdfCount === 1 ? 'PDF-Anhang' : `${pdfCount} PDF-Anhängen`})` : ''}.`
              : 'Automatische Bestätigung der Anfrage gesendet.',
            graph_message_id: null,
          });
        } else {
          console.error('[Graph] Kundenbestaetigung fehlgeschlagen:', sendRes.error);
        }
      } catch (mailErr) {
        mail.customer = { success: false, error: (mailErr as Error).message };
        console.error('[Graph] Kundenbestaetigung Exception:', mailErr);
      }

      // 2) Interne Benachrichtigung ans Team (request@ bzw. notify_to)
      try {
        const subject = internalNotificationSubject(requestNumber, eventName);
        const html = internalNotificationHtml({
          requestNumber,
          eventName,
          packageTitle: body.packageTitle,
          customerName,
          email: body.email,
          phone: body.phone,
          startDate: body.startDate,
          numberOfPersons: body.numberOfPersons,
          doubleRooms: body.doubleRooms,
          singleRooms: body.singleRooms,
          totalPrice: body.totalPrice,
          address: customerAddress,
          travelPeriod: travelPeriodDisplay,
          source: body.source || undefined,
          message: body.message || '',
          consent,
        });
        const teamRes = await sendGraphMail({ to: getNotifyTo(), subject, html });
        mail.team = { success: teamRes.success, error: teamRes.error };
        if (!teamRes.success) console.error('[Graph] Team-Benachrichtigung fehlgeschlagen:', teamRes.error);
      } catch (mailErr) {
        mail.team = { success: false, error: (mailErr as Error).message };
        console.error('[Graph] Team-Benachrichtigung Exception:', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      data: booking,
      requestNumber,
      mail,
      message: 'Buchungsanfrage erfolgreich gespeichert'
    }, { headers: CORS_HEADERS });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500, headers: CORS_HEADERS }
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
