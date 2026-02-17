import { NextResponse } from 'next/server';
import { insertBooking, getAllBookings } from '@/lib/database';

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

    // Insert booking into SQLite database
    const booking = insertBooking({
      package_id: body.packageId,
      package_title: body.packageTitle,
      start_date: body.startDate,
      number_of_persons: body.numberOfPersons,
      double_rooms: body.doubleRooms,
      single_rooms: body.singleRooms,
      travelers: JSON.stringify(body.travelers),
      email: body.email,
      phone: body.phone,
      message: body.message || '',
      status: 'new',
      total_price: body.totalPrice || 0,
      notes: ''
    } as any);

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
    const bookings = getAllBookings();

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
