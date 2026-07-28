import { NextResponse } from 'next/server';
import { getCalculation, setCalculationInvoice } from '@/lib/calculationStore';
import { computeTotals, buildIncludedServices, fmtPeriod } from '@/lib/calcModel';
import { hotelInfoLine } from '@/lib/hotelLookup';
import { createInvoiceRecord } from '@/lib/invoiceStore';
import { createBooking, getBooking } from '@/lib/bookingStore';
import { getCustomer } from '@/lib/customerStore';

/**
 * POST /api/admin/calculations/[id]/invoice
 * { persons?, due_in_days?, included_services?, event_name?, description? }
 * → erzeugt aus der Kalkulation eine Rechnung im Stil der bestehenden
 *   Rechnungen: EINE Pauschalposition (persons × VK p.P.), Leistungen als
 *   „inkludierte Leistungen" ohne Einzelpreise. Verknüpft REQ/Kunde und
 *   speichert die Rechnung an der Kalkulation.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const calc = await getCalculation(id);
    if (!calc) return NextResponse.json({ success: false, error: 'Kalkulation nicht gefunden' }, { status: 404 });
    if (calc.invoice_id) {
      return NextResponse.json({ success: false, error: `Es existiert bereits eine Rechnung zu dieser Kalkulation.` }, { status: 409 });
    }
    if (!calc.rates_snapshot) {
      return NextResponse.json({ success: false, error: 'Keine Kurse festgeschrieben — bitte zuerst „Kurse festschreiben".' }, { status: 400 });
    }
    const totals = computeTotals(calc.items, calc.target_currency, calc.rates_snapshot, calc.margin_mode, calc.margin_value);
    if (!totals || totals.vkTarget <= 0) {
      return NextResponse.json({ success: false, error: 'Kein Verkaufspreis vorhanden — bitte Positionen/Marge prüfen.' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      persons?: unknown; due_in_days?: unknown; included_services?: unknown; event_name?: unknown; description?: unknown;
    };

    // Buchung bestimmen: zugeordnete Anfrage (REQ) ODER individuelle Buchung aus dem Kunden.
    let bookingId = calc.booking_id || '';
    let personsDefault = 1;
    if (bookingId) {
      const booking = await getBooking(bookingId);
      if (!booking) return NextResponse.json({ success: false, error: 'Zugeordnete Anfrage nicht gefunden' }, { status: 404 });
      personsDefault = Number((booking as { number_of_persons?: number }).number_of_persons) || 1;
    }
    const persons = Math.max(1, Math.round(Number(body.persons)) || personsDefault);
    const vkPP = Math.round(totals.vkTarget * 100) / 100;

    if (!bookingId) {
      if (!calc.customer_id) {
        return NextResponse.json(
          { success: false, error: 'Bitte der Kalkulation zuerst eine Anfrage (REQ) oder einen Kunden zuordnen.' },
          { status: 400 }
        );
      }
      const customer = await getCustomer(calc.customer_id);
      if (!customer) return NextResponse.json({ success: false, error: 'Zugeordneter Kunde nicht gefunden' }, { status: 404 });
      const created = await createBooking({
        eventSlug: null,
        packageSlug: null,
        packageId: 'kalkulation',
        packageTitle: calc.title || `Arrangement ${calc.calc_number}`,
        startDate: calc.travel_start || '',
        numberOfPersons: persons,
        doubleRooms: 0,
        singleRooms: 0,
        travelers: [{ salutation: customer.salutation || '', firstName: customer.first_name || '', lastName: customer.last_name || '', birthDate: '' }],
        email: customer.emails.find((e) => e.is_primary)?.email || customer.emails[0]?.email || '',
        phone: customer.phone || '',
        message: `Aus Angebotskalkulation ${calc.calc_number}`,
        totalPrice: vkPP * persons,
      });
      bookingId = (created as { id: string }).id;
    }

    const period = fmtPeriod(calc.travel_start, calc.travel_end);
    const description = typeof body.description === 'string' && body.description.trim()
      ? body.description
      : [
          calc.title || `Reise-Arrangement ${calc.calc_number}`,
          period || '',
          `Pauschalarrangement, Preis pro Person`,
        ].filter(Boolean).join('\n');

    const includedServices = typeof body.included_services === 'string' && body.included_services.trim()
      ? body.included_services
      : buildIncludedServices(calc.items);

    const hotelDescription = calc.hotel_info
      ? hotelInfoLine(calc.hotel_info) + (() => {
          const rooms = calc.items
            .filter((i) => i.category === 'hotel' && (i.room_category || '').trim())
            .map((i) => String(i.room_category).trim());
          return rooms.length ? ` — ${Array.from(new Set(rooms)).join(', ')}` : '';
        })()
      : calc.items.find((i) => i.category === 'hotel' && i.description.trim())?.description || '';

    const destination = calc.hotel_info
      ? [calc.hotel_info.city, calc.hotel_info.country].filter(Boolean).join(', ')
      : '';

    const notesJson = JSON.stringify({
      event_name: typeof body.event_name === 'string' && body.event_name.trim() ? body.event_name : (calc.title || ''),
      destination,
      hotel_description: hotelDescription,
      ticket_details: includedServices,
      thank_you_text: '',
    });

    const dueInDays = Math.max(1, Math.round(Number(body.due_in_days)) || 14);
    const invoice = await createInvoiceRecord(
      bookingId,
      [{ description, quantity: persons, unit_price: vkPP, total_price: Math.round(vkPP * persons * 100) / 100 }],
      dueInDays,
      notesJson
    );

    await setCalculationInvoice(id, (invoice as { id: string }).id);

    return NextResponse.json({
      success: true,
      data: {
        invoice,
        booking_id: bookingId,
        pdf_url: `/api/invoices/${(invoice as { id: string }).id}/pdf`,
        currency_warning: calc.target_currency !== 'EUR'
          ? `Achtung: Die Kalkulation ist in ${calc.target_currency}, das Rechnungs-PDF weist EUR aus.`
          : null,
      },
    });
  } catch (error) {
    console.error('Rechnung-aus-Kalkulation-Fehler:', error);
    return NextResponse.json(
      { success: false, error: 'Rechnung konnte nicht erstellt werden: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
