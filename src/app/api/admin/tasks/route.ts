import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { listStaffTasks, createStaffTask, addNotification, formatTicketNo } from '@/lib/staffStore';

/** GET ?assignee=<id>&status=<status>&booking=<id>&project=<id|none> → Aufgabenliste. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tasks = await listStaffTasks({
    assignee_id: url.searchParams.get('assignee') || undefined,
    status: url.searchParams.get('status') || undefined,
    booking_id: url.searchParams.get('booking') || undefined,
    project_id: url.searchParams.get('project') || undefined,
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
      body: (task.description || '').slice(0, 2000),
      created_by: ctx.session.name,
    }).catch(() => { /* nie blockierend */ });
  }

  // KI-Umsetzung angefragt → Bestätigung an die Ersteller:in (Mail + Glocke), nie blockierend.
  if (task.ai_requested && ctx.employee?.email) {
    const ticket = formatTicketNo(task.ticket_number) || 'Ticket';
    addNotification({
      employee_id: ctx.employee.id,
      type: 'info',
      task_id: task.id,
      title: `🤖 ${ticket} für KI-Umsetzung vorgemerkt – ${task.title}`,
      body: 'Du bekommst eine Mail, sobald die KI mit der Umsetzung startet und wenn sie fertig ist.',
      created_by: 'KI-Assistent',
    }).catch(() => { /* nie blockierend */ });
    (async () => {
      const { isGraphConfigured, sendGraphMail } = await import('@/lib/graphMailer');
      if (!isGraphConfigured()) return;
      const { taskNotifyEmailHtml, taskSubjectTag } = await import('@/lib/emailTemplates');
      const { getSettings } = await import('@/lib/settingsStore');
      const base = (getSettings().mail?.login_base_url || 'https://next.faltintravel.com').replace(/\/+$/, '');
      await sendGraphMail({
        to: ctx.employee!.email,
        toName: ctx.employee!.name,
        subject: `🤖 KI-Auftrag registriert ${taskSubjectTag(ticket)} – ${task.title}`.slice(0, 200),
        html: taskNotifyEmailHtml({
          bodyText: 'Deine Aufgabe wurde für die Umsetzung durch die KI vorgemerkt. Sobald die KI startet bzw. fertig ist, bekommst du je eine Mail mit dem Stand direkt am Ticket.',
          ticketNo: ticket,
          taskTitle: task.title,
          kindLabel: 'KI-Auftrag registriert',
          ticketUrl: `${base}/admin/aufgaben/${task.id}`,
        }),
      });
    })().catch((e) => console.warn('[ai-task] Bestätigungs-Mail fehlgeschlagen:', (e as Error).message));
  }

  return NextResponse.json({ success: true, data: task });
}
