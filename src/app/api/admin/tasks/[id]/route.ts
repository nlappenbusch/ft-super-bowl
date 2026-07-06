import { NextResponse } from 'next/server';
import {
  getStaffTask, updateStaffTask, deleteStaffTask,
  addNotification, formatTicketNo, TASK_STATUS_VALUES, type TaskStatus,
} from '@/lib/staffStore';
import { getSessionEmployee } from '@/lib/serverSession';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.status !== undefined && !TASK_STATUS_VALUES.includes(body.status as TaskStatus)) {
    return NextResponse.json({ success: false, error: 'Ungültiger Status' }, { status: 400 });
  }

  const before = await getStaffTask(id);
  const updated = await updateStaffTask(id, body);
  if (!updated) return NextResponse.json({ success: false, error: 'Aufgabe nicht gefunden' }, { status: 404 });

  // Neue Zuweisung → Benachrichtigung an den Assignee (außer er hat sie selbst vorgenommen).
  if (body.assignee_id && before && body.assignee_id !== before.assignee_id) {
    const ctx = await getSessionEmployee().catch(() => null);
    const actorName = ctx?.employee?.name || ctx?.session.name || '';
    if (ctx?.employee?.id !== body.assignee_id) {
      await addNotification({
        employee_id: String(body.assignee_id),
        type: 'task_assigned',
        task_id: id,
        title: `${formatTicketNo(updated.ticket_number) || 'Ticket'} wurde dir zugewiesen – ${updated.title}`,
        body: (updated.description || '').slice(0, 300),
        created_by: actorName,
      }).catch(() => { /* Benachrichtigung nie blockierend */ });
    }
  }

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteStaffTask(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Aufgabe nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true });
}
