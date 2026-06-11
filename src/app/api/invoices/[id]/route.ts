import { NextResponse } from 'next/server';
import { updateInvoiceStatus, recordPayment, getInvoiceById, getInvoiceItems } from '@/lib/invoiceStore';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate invoice exists
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Rechnung nicht gefunden' },
        { status: 404 }
      );
    }

    if (body.status) {
      if (!['open', 'partial', 'paid', 'cancelled'].includes(body.status)) {
        return NextResponse.json(
          { success: false, error: 'Ungültiger Status' },
          { status: 400 }
        );
      }
      
      const updated = await updateInvoiceStatus(id, body.status);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: 'Status konnte nicht aktualisiert werden' },
          { status: 400 }
        );
      }
    }

    if (body.payment !== undefined) {
      const paymentAmount = parseFloat(body.payment);
      
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return NextResponse.json(
          { success: false, error: 'Ungültiger Zahlungsbetrag' },
          { status: 400 }
        );
      }

      const currentInvoice = await getInvoiceById(id);
      if (!currentInvoice) {
        return NextResponse.json(
          { success: false, error: 'Rechnung nicht gefunden' },
          { status: 404 }
        );
      }

      const remainingAmount = currentInvoice.total_amount - currentInvoice.paid_amount;
      
      if (paymentAmount > remainingAmount + 0.01) { // Allow 1 cent tolerance
        return NextResponse.json(
          { 
            success: false, 
            error: `Zahlungsbetrag überschreitet offenen Betrag von CHF ${remainingAmount.toFixed(2)}` 
          },
          { status: 400 }
        );
      }

      const success = await recordPayment(id, paymentAmount);
      if (!success) {
        return NextResponse.json(
          { success: false, error: 'Zahlung konnte nicht verbucht werden' },
          { status: 400 }
        );
      }
    }

    const updatedInvoice = await getInvoiceById(id);

    return NextResponse.json({
      success: true,
      data: {
        ...updatedInvoice,
        items: await getInvoiceItems(id)
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

// DELETE/Cancel invoice
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const invoice = await getInvoiceById(id);
    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Rechnung nicht gefunden' },
        { status: 404 }
      );
    }

    if (invoice.status === 'paid') {
      return NextResponse.json(
        { success: false, error: 'Bezahlte Rechnungen können nicht storniert werden' },
        { status: 400 }
      );
    }

    const success = await updateInvoiceStatus(id, 'cancelled');
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Rechnung konnte nicht storniert werden' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Rechnung wurde storniert'
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
