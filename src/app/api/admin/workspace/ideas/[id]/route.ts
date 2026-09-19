import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { getStaffTask, addTaskMessage, listTaskMessages } from '@/lib/staffStore';
import { VOTE_MARK } from '@/lib/workspace/tools';

/** POST — „Brauche ich auch“ (+1) als Notiz an der Idee; einmal pro Person. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const { id } = await params;
  const task = await getStaffTask(id);
  if (!task) return NextResponse.json({ success: false, error: 'Idee nicht gefunden' }, { status: 404 });
  const notes = await listTaskMessages(id);
  if (notes.some((n) => n.direction === 'note' && n.body.startsWith(VOTE_MARK) && n.created_by === ws.personName)) {
    return NextResponse.json({ success: true, data: { already: true } });
  }
  await addTaskMessage({ task_id: id, direction: 'note', body: `${VOTE_MARK} (${ws.personName})`, created_by: ws.personName });
  return NextResponse.json({ success: true });
}
