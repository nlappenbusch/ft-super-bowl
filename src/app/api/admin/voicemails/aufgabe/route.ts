import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { createStaffTask, addNotification, formatTicketNo } from '@/lib/staffStore';
import { voicemailFetch } from '@/lib/voicemailBoard';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/voicemails/aufgabe
 * { key, title, description, assignee_id?, due_date?, priority?, booking_id? }
 * Legt aus einer Voicemail ein Ticket an (wie /api/admin/tasks), benachrichtigt die
 * zugewiesene Person und verknüpft die Voicemail mit dem Ticket (gilt dann als erledigt).
 */
export async function POST(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === 'string' ? body.key : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  if (!key || !title) return NextResponse.json({ success: false, error: 'key und title erforderlich' }, { status: 400 });

  const priority = ['niedrig', 'normal', 'hoch'].includes(body.priority) ? body.priority : 'normal';
  const task = await createStaffTask({
    title,
    description: typeof body.description === 'string' ? body.description.slice(0, 5000) : '',
    assignee_id: body.assignee_id || undefined,
    due_date: body.due_date || undefined,
    booking_id: body.booking_id || undefined,
    priority,
    created_by: ctx.session.name,
  });
  const nr = formatTicketNo(task.ticket_number) || 'Ticket';

  if (task.assignee_id && task.assignee_id !== ctx.employee?.id) {
    await addNotification({
      employee_id: task.assignee_id,
      type: 'task_assigned',
      task_id: task.id,
      title: `${nr} wurde dir zugewiesen – ${task.title}`,
      body: (task.description || '').slice(0, 2000),
      created_by: ctx.session.name,
    }).catch(() => { /* nie blockierend */ });
  }

  // Verknüpfung im Voicemail-Dienst; scheitert sie, bleibt das Ticket trotzdem bestehen.
  let verknuepft = true;
  try {
    const r = await voicemailFetch('/api/aufgabe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, id: task.id, nr, wer: ctx.session.name }),
    });
    verknuepft = r.ok;
  } catch {
    verknuepft = false;
  }

  return NextResponse.json({ success: true, data: { id: task.id, nr, verknuepft } });
}
