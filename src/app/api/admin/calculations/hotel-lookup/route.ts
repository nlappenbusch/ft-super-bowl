import { NextResponse } from 'next/server';
import { lookupHotel, parseBookingUrl } from '@/lib/hotelLookup';

/**
 * GET /api/admin/calculations/hotel-lookup?url=<booking.com-Hotel-URL>
 * → Hoteldaten (Name, Adresse, Ort) zur URL. Quelle: Booking-JSON-LD,
 *   Fallback OpenStreetMap/Nominatim, Not-Fallback URL-Slug.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') || '';
  if (!parseBookingUrl(url)) {
    return NextResponse.json(
      { success: false, error: 'Bitte eine gültige Booking.com-Hotel-URL angeben (…booking.com/hotel/…).' },
      { status: 400 }
    );
  }
  const hotel = await lookupHotel(url);
  if (!hotel) {
    return NextResponse.json({ success: false, error: 'Hoteldaten konnten nicht aufgelöst werden.' }, { status: 502 });
  }
  return NextResponse.json({ success: true, data: hotel });
}
