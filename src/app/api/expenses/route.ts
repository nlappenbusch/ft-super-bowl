import { NextResponse } from 'next/server';
import { createExpenseRecord, listExpenses } from '@/lib/expenseStore';
import { requireAdminSession } from '@/lib/apiGuard';

// Get all expenses (optionally filtered by event or booking)
export async function GET(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const eventSlug = searchParams.get('eventSlug');
    const bookingId = searchParams.get('bookingId');

    const expenses = await listExpenses({ eventSlug, bookingId });
    return NextResponse.json({ success: true, data: expenses });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

// Create expense
export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  try {
    const body = await request.json();

    if (!body.description || !body.description.trim()) {
      return NextResponse.json(
        { success: false, error: 'Beschreibung ist erforderlich' },
        { status: 400 }
      );
    }
    if (!body.amount || Number(body.amount) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Betrag muss größer als 0 sein' },
        { status: 400 }
      );
    }

    const expense = await createExpenseRecord({
      expense_date: body.expense_date,
      event_slug: body.event_slug || '',
      booking_id: body.booking_id || '',
      category: body.category || 'sonstiges',
      description: body.description,
      vendor: body.vendor || '',
      amount: Number(body.amount),
      notes: body.notes || '',
    });

    return NextResponse.json({ success: true, data: expense });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
