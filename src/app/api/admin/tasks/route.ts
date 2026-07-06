import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { listStaffTasks, createStaffTask, addNotification, formatTicketNo } from '@/lib/staffStore';

/** GET ?assignee=<id>&status=<status>&booking=<id> → Aufgabenliste. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tasks = await listStaffTasks({
    assignee_id: url.searchParams.get('assignee') || undefined,
    status: url.searchParams.get('status') || undefined,
    booking_id: url.searchParams.get('booking') || undefined,
  });
  return NextResponse.json({ success: true, data: tasks });
}

/** POST: neue Aufgabe { title, description?, assignee_id?, booking_id?, due_date?, priority? } */
export async function POST(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const body = await req.json();
  if (!body.title) return NextResponse.json({ success: false, error: 'title erforderlich' }, { status: 400 });
  const task = await createStaffTask({ ...body, created_by: ctx.session.name });

  // Direkt bei Anlage zugewiesen → Assignee benachrichtigen (außer Selbstzuweisung).
  if (task.assignee_id && task.assignee_id !== ctx.employee?.id) {
    await addNotification({
      employee_id: task.assignee_id,
      type: 'task_assigned',
      task_id: task.id,
      title: `${formatTicketNo(task.ticket_number) || 'Ticket'} wurde dir zugewiesen – ${task.title}`,
      body: (task.description || '').slice(0, 300),
      created_by: ctx.session.name,
    }).catch(() => { /* nie blockierend */ });
  }

  return NextResponse.json({ success: true, data: task });
}
