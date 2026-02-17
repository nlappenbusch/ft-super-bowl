import { NextResponse } from 'next/server';
import {
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  getInvoicesByBookingId,
  getInvoiceItems,
  updateInvoiceStatus,
  recordPayment,
  getBookingById
} from '@/lib/database';

// Create invoice
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, items, dueInDays } = body;

    if (!bookingId || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Booking ID und Items sind erforderlich' },
        { status: 400 }
      );
    }

    // Verify booking exists
    const booking = getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Buchung nicht gefunden' },
        { status: 404 }
      );
    }

    const invoice = createInvoice(bookingId, items, dueInDays || 14);

    return NextResponse.json({
      success: true,
      data: {
        invoice,
        items: getInvoiceItems(invoice.id)
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

    let invoices;
    if (bookingId) {
      invoices = getInvoicesByBookingId(bookingId);
    } else {
      invoices = getAllInvoices();
    }

    // Add items to each invoice
    const invoicesWithItems = invoices.map(invoice => ({
      ...invoice,
      items: getInvoiceItems(invoice.id)
    }));

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
