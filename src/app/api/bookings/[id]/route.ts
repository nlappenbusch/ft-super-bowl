import { NextResponse } from 'next/server';
import { updateBooking } from '@/lib/bookingStore';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updatedBooking = await updateBooking(id, {
      status: body.status,
      notes: body.notes,
      assigned_to: body.assigned_to,
      offer_sent: typeof body.offer_sent === 'boolean' ? body.offer_sent : undefined,
      docs_ready: typeof body.docs_ready === 'boolean' ? body.docs_ready : undefined,
    });

    if (!updatedBooking) {
      return NextResponse.json(
        { success: false, error: 'Buchung nicht gefunden' },
        { status: 404 }
      );
    }

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
