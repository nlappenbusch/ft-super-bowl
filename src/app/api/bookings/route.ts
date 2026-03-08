import { NextResponse } from 'next/server';
import { createBooking, listBookings } from '@/lib/bookingStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate required fields
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

    return NextResponse.json({
      success: true,
      data: booking,
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

// GET endpoint to fetch all bookings (for admin dashboard)
export async function GET() {
  try {
    const bookings = await listBookings();

    return NextResponse.json({
      success: true,
      data: bookings
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
