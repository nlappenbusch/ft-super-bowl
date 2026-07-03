import { NextResponse } from 'next/server';
import { getBooking } from '@/lib/bookingStore';
import { getCustomer } from '@/lib/customerStore';
import { findEventBySlug, findPackagesByEvent, type ContentPackageRecord } from '@/lib/contentStore';

/**
 * Rechnungs-Vorbefüllung aus einer Buchungsanfrage: lädt Buchung + Package +
 * Event + Kunde und liefert fertige Positionen (Stefans Preismodell:
 * N × Reisepreis p. P. + M × Einzelbelegungs-Zuschlag), PDF-Metadaten
 * (Veranstaltung, Destination, Hotel, echte Package-Leistungen) sowie den
 * Rechnungsempfänger. Der Admin muss nur noch validieren/anpassen.
 */

interface PrefillItem { description: string; quantity: number; unit_price: number }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get('bookingId') || '';
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'bookingId fehlt' }, { status: 400 });
  }

  const booking = await getBooking(bookingId) as {
    id: string; event_slug?: string | null; package_slug?: string | null; package_title?: string;
    number_of_persons?: number; double_rooms?: number; single_rooms?: number;
    total_price?: number; email?: string; phone?: string; customer_id?: string | null;
    travelers?: unknown; source?: string;
  } | null;
  if (!booking) {
    return NextResponse.json({ success: false, error: 'Buchung nicht gefunden' }, { status: 404 });
  }

  const event = booking.event_slug ? findEventBySlug(booking.event_slug) : null;
  const eventPackages = (event ? findPackagesByEvent(event.id) : []) as ContentPackageRecord[];
  const pkg = eventPackages.find((p) => p.slug === booking.package_slug || p.title === booking.package_title) || null;

  const persons = Number(booking.number_of_persons || 0) || Math.max(1, Number(booking.double_rooms || 0) * 2 + Number(booking.single_rooms || 0));
  const singles = Number(booking.single_rooms || 0);
  const price = Number(pkg?.price || 0);
  const supplement = Number(pkg?.single_supplement || 0);
  const nights = Number(pkg?.nights || 0);
  const travelPeriod = (pkg as ContentPackageRecord & { travel_period?: string })?.travel_period || '';
  const warnings: string[] = [];

  // ── Positionen nach Stefans Modell ──
  let items: PrefillItem[];
  if (pkg && price > 0) {
    const detail = [travelPeriod, nights ? `${nights} Nächte` : ''].filter(Boolean).join(' · ');
    items = [{
      description: `${pkg.title || booking.package_title} – Reisepreis pro Person (Package)${detail ? `\n${detail}` : ''}`,
      quantity: persons,
      unit_price: price,
    }];
    if (singles > 0 && supplement > 0) {
      items.push({
        description: `Einzelbelegungs-Zuschlag${pkg.hotel ? ` – ${pkg.hotel}` : ''}`,
        quantity: singles,
        unit_price: supplement,
      });
    } else if (singles > 0 && supplement <= 0) {
      warnings.push(`${singles}× Einzelbelegung angefragt, aber am Package ist kein EZ-Zuschlag hinterlegt.`);
    }
    const expected = persons * price + singles * supplement;
    const requested = Number(booking.total_price || 0);
    if (requested > 0 && Math.abs(expected - requested) > 0.01) {
      warnings.push(`Positionssumme (${expected.toLocaleString('de-DE')} €) weicht vom angefragten Gesamtpreis (${requested.toLocaleString('de-DE')} €) ab — bitte prüfen.`);
    }
  } else {
    // Fallback: Package nicht auffindbar → eine Pauschalposition wie bisher
    items = [{
      description: `${booking.event_slug ? booking.event_slug + ' - ' : ''}${booking.package_title || 'Pauschalreise'}\n${persons} Personen, ${booking.double_rooms ?? 0}× Doppel-, ${booking.single_rooms ?? 0}× Einzelbelegung`,
      quantity: 1,
      unit_price: Number(booking.total_price || 0),
    }];
    if (booking.package_slug) warnings.push('Package nicht gefunden — Pauschalposition aus dem angefragten Gesamtpreis erstellt.');
  }

  // ── PDF-Metadaten aus Event + Package ──
  const includes = (pkg?.includes || []) as Array<{ name?: string; type?: string; category?: string }>;
  const ticketDetails = includes
    .filter((i) => i && i.name)
    .map((i) => (i.name!.toLowerCase().startsWith('inkl') ? i.name! : `Inkl. ${i.name}`));
  const meta = {
    event_name: event?.name || event?.title || booking.event_slug || '',
    destination: [event?.location_name || event?.venue, event?.location_city, event?.location_country].filter(Boolean).join(', '),
    hotel_description: pkg?.hotel || pkg?.title || booking.package_title || '',
    ticket_details: ticketDetails.join('\n'),
    travel_period: travelPeriod,
    nights,
    currency: (pkg?.currency || 'EUR').toUpperCase(),
  };

  // ── Rechnungsempfänger ──
  let customer: {
    name: string; salutation?: string; street?: string; zip?: string; city?: string; country?: string; email?: string; phone?: string;
  } | null = null;
  if (booking.customer_id) {
    const c = await getCustomer(booking.customer_id);
    if (c) {
      customer = {
        name: c.name || [c.first_name, c.last_name].filter(Boolean).join(' '),
        salutation: c.salutation || '',
        street: c.street || '', zip: c.zip || '', city: c.city || '', country: c.country || '',
        email: booking.email || '', phone: booking.phone || '',
      };
    }
  }
  if (!customer) {
    let name = booking.email || '';
    try {
      const t = typeof booking.travelers === 'string' ? JSON.parse(booking.travelers) : booking.travelers;
      if (Array.isArray(t) && t[0]) name = [t[0].firstName, t[0].lastName].filter(Boolean).join(' ') || name;
    } catch { /* ignore */ }
    customer = { name, email: booking.email || '', phone: booking.phone || '' };
  }
  if (!customer.street || !customer.zip || !customer.city) {
    warnings.push('Keine vollständige Rechnungsadresse hinterlegt — bitte im Kunden ergänzen (ältere Anfragen haben keine Adresse übermittelt).');
  }

  return NextResponse.json({ success: true, data: { items, meta, customer, warnings } });
}
