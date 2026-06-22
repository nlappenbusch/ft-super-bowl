import { NextResponse } from 'next/server';
import { listSubtasks, addSubtask, setSubtaskDone, deleteSubtask } from '@/lib/staffStore';

/** GET → Subtasks einer Aufgabe. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await listSubtasks(id);
  return NextResponse.json({ success: true, data });
}

/** POST { title } → neuen Subtask anlegen. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const title = (body?.title || '').trim();
  if (!title) return NextResponse.json({ success: false, error: 'title erforderlich' }, { status: 400 });
  const data = await addSubtask(id, title);
  return NextResponse.json({ success: true, data });
}

/** PATCH { subtaskId, done } → Subtask abhaken / zurücknehmen. */
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body?.subtaskId) return NextResponse.json({ success: false, error: 'subtaskId erforderlich' }, { status: 400 });
  const ok = await setSubtaskDone(body.subtaskId, !!body.done);
  return NextResponse.json({ success: ok });
}

/** DELETE ?subtaskId=… → Subtask löschen. */
export async function DELETE(req: Request) {
  const subtaskId = new URL(req.url).searchParams.get('subtaskId');
  if (!subtaskId) return NextResponse.json({ success: false, error: 'subtaskId erforderlich' }, { status: 400 });
  const ok = await deleteSubtask(subtaskId);
  return NextResponse.json({ success: ok });
}
