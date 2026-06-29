import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { listStaffTasks, createStaffTask, formatTicketNo, type StaffTask } from '@/lib/staffStore';

const withTicket = (t: StaffTask) => ({ ...t, ticket_no: formatTicketNo(t.ticket_number) });

/** GET /api/ext/tasks?status=&assignee=&booking= → Ticket-Liste. */
export async function GET(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const url = new URL(req.url);
  const tasks = await listStaffTasks({
    status: url.searchParams.get('status') || undefined,
    assignee_id: url.searchParams.get('assignee') || undefined,
    booking_id: url.searchParams.get('booking') || undefined,
  });
  return NextResponse.json({ success: true, data: tasks.map(withTicket) });
}

/** POST /api/ext/tasks { title, description?, priority?, due_date?, assignee_id?, booking_id? } */
export async function POST(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const body = await req.json().catch(() => ({}));
  if (!body?.title) return NextResponse.json({ success: false, error: 'title erforderlich' }, { status: 400 });
  const task = await createStaffTask({
    title: String(body.title),
    description: body.description || '',
    priority: body.priority || 'normal',
    due_date: body.due_date || null,
    assignee_id: body.assignee_id || null,
    booking_id: body.booking_id || null,
    created_by: `API: ${a.key.name}`,
  });
  return NextResponse.json({ success: true, data: withTicket(task) });
}
