import { NextResponse } from 'next/server';
import { createInvoiceRecord, listInvoices, getInvoiceItems } from '@/lib/invoiceStore';
import { getBooking } from '@/lib/bookingStore';

// Create invoice
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, items, dueInDays, notes } = body;

    if (!bookingId || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Booking ID und Items sind erforderlich' },
        { status: 400 }
      );
    }

    // Verify booking exists
    const booking = await getBooking(bookingId);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Buchung nicht gefunden' },
        { status: 404 }
      );
    }

    const invoice = await createInvoiceRecord(bookingId, items, dueInDays || 14, notes || '');

    return NextResponse.json({
      success: true,
      data: {
        invoice,
        items: await getInvoiceItems(invoice.id)
      }
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// Get all invoices or by booking ID
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('bookingId');

    const invoices = await listInvoices(bookingId);

    // Add items to each invoice
    const invoicesWithItems = await Promise.all(
      invoices.map(async (invoice) => ({
        ...invoice,
        items: await getInvoiceItems(invoice.id)
      }))
    );

    return NextResponse.json({
      success: true,
      data: invoicesWithItems
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
