import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getStaffTask, updateStaffTask, formatTicketNo } from '@/lib/staffStore';

/** GET → einzelnes Ticket. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const t = await getStaffTask(id);
  if (!t) return NextResponse.json({ success: false, error: 'Ticket nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: { ...t, ticket_no: formatTicketNo(t.ticket_number) } });
}

/** PATCH { status?, priority?, assignee_id?, due_date?, title?, description?, booking_id? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const updated = await updateStaffTask(id, body);
  if (!updated) return NextResponse.json({ success: false, error: 'Ticket nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: { ...updated, ticket_no: formatTicketNo(updated.ticket_number) } });
}
