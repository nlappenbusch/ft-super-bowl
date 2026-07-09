import { NextResponse } from 'next/server';
import { getExpense, updateExpenseRecord, deleteExpenseRecord } from '@/lib/expenseStore';
import { requireAdminSession } from '@/lib/apiGuard';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await getExpense(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Ausgabe nicht gefunden' },
        { status: 404 }
      );
    }

    await updateExpenseRecord(id, {
      ...(body.expense_date !== undefined ? { expense_date: body.expense_date } : {}),
      ...(body.event_slug !== undefined ? { event_slug: body.event_slug } : {}),
      ...(body.booking_id !== undefined ? { booking_id: body.booking_id } : {}),
      ...(body.category !== undefined ? { category: body.category } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.vendor !== undefined ? { vendor: body.vendor } : {}),
      ...(body.amount !== undefined ? { amount: Number(body.amount) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    });

    return NextResponse.json({ success: true, data: await getExpense(id) });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  try {
    const { id } = await params;
    const existing = await getExpense(id);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Ausgabe nicht gefunden' },
        { status: 404 }
      );
    }
    await deleteExpenseRecord(id);
    return NextResponse.json({ success: true, message: 'Ausgabe gelöscht' });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
