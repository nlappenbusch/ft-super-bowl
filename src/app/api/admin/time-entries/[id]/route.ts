import { NextResponse } from 'next/server';
import { updateTaskTime, deleteTaskTime } from '@/lib/staffStore';

/**
 * PATCH /api/admin/time-entries/[id] { minutes?, note?, work_date?, employee_id? }
 * → Zeitbuchung justieren. employee_id '' oder null = Extern (API).
 * Einträge in finalisierten Rapporten sind gesperrt.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const u: Parameters<typeof updateTaskTime>[1] = {};
  if (body.minutes !== undefined) u.minutes = Number(body.minutes);
  if (body.note !== undefined) u.note = String(body.note);
  if (body.work_date !== undefined) u.work_date = String(body.work_date);
  if (body.employee_id !== undefined) u.employee_id = body.employee_id ? String(body.employee_id) : null;
  const result = await updateTaskTime(id, u);
  if (!result) return NextResponse.json({ success: false, error: 'Zeiteintrag nicht gefunden' }, { status: 404 });
  if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: result });
}

/** DELETE — nur offene (nicht rapportierte) Einträge; rapportierte sind gesperrt. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteTaskTime(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Eintrag nicht gefunden oder bereits rapportiert' }, { status: 400 });
  return NextResponse.json({ success: true });
}
