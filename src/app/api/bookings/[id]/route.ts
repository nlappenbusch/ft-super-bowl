import { NextResponse } from 'next/server';
import { updateBookingStatus, updateBookingNotes, getBookingById } from '@/lib/database';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.status) {
      const success = updateBookingStatus(id, body.status);
      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Buchung nicht gefunden' },
          { status: 404 }
        );
      }
    }

    if (body.notes !== undefined) {
      const success = updateBookingNotes(id, body.notes);
      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Buchung nicht gefunden' },
          { status: 404 }
        );
      }
    }

    const updatedBooking = getBookingById(id);

    return NextResponse.json({
      success: true,
      data: updatedBooking
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
