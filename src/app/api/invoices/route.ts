import { NextResponse } from 'next/server';
import { createInvoiceRecord, listInvoices, getInvoiceItems } from '@/lib/invoiceStore';
import { getBooking, createBooking } from '@/lib/bookingStore';

interface ManualCustomer {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  packageTitle?: string;
}

// Create invoice (für bestehenden Lead ODER individuelle/manuelle Buchung)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { bookingId, items, dueInDays, notes } = body;
    const manual = body.manualCustomer as ManualCustomer | undefined;

    if ((!bookingId && !manual) || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lead oder Kundendaten sowie Positionen sind erforderlich' },
        { status: 400 }
      );
    }

    // Positionen normalisieren (total_price immer setzen – SQLite erwartet es)
    const normItems = (items as { description: string; quantity: number; unit_price: number; total_price?: number }[])
      .map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.total_price ?? i.quantity * i.unit_price,
      }));

    let effectiveBookingId = bookingId as string;

    if (!bookingId && manual) {
      // Individuelle Buchung on-the-fly anlegen, dann Rechnung dagegen erstellen
      const total = normItems.reduce((s, i) => s + i.total_price, 0);
      const created = await createBooking({
        eventSlug: null,
        packageSlug: null,
        packageId: 'manual-invoice',
        packageTitle: manual.packageTitle?.trim() || 'Individuelle Buchung',
        startDate: '',
        numberOfPersons: 1,
        doubleRooms: 0,
        singleRooms: 0,
        travelers: [{ salutation: '', firstName: manual.firstName || '', lastName: manual.lastName || '', birthDate: '' }],
        email: manual.email || '',
        phone: manual.phone || '',
        message: 'Individuelle/manuelle Rechnung',
        totalPrice: total,
      });
      effectiveBookingId = (created as { id: string }).id;
    } else {
      const booking = await getBooking(bookingId);
      if (!booking) {
        return NextResponse.json({ success: false, error: 'Buchung nicht gefunden' }, { status: 404 });
      }
    }

    const invoice = await createInvoiceRecord(effectiveBookingId, normItems, dueInDays || 14, notes || '');

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
