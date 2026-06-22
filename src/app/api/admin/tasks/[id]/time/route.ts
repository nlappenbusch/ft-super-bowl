import { NextResponse } from 'next/server';
import { listTaskTime, addTaskTime, sumTaskMinutes, deleteTaskTime } from '@/lib/staffStore';

/** GET → { entries, totalMinutes }. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entries, totalMinutes] = await Promise.all([listTaskTime(id), sumTaskMinutes(id)]);
  return NextResponse.json({ success: true, data: { entries, totalMinutes } });
}

/** POST { minutes, note? } → Zeit buchen. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const minutes = Math.round(Number(body?.minutes));
  if (!minutes || minutes <= 0) return NextResponse.json({ success: false, error: 'minutes > 0 erforderlich' }, { status: 400 });
  const data = await addTaskTime(id, minutes, (body?.note || '').trim() || undefined);
  return NextResponse.json({ success: true, data });
}

/** DELETE ?entryId=… → Buchung löschen. */
export async function DELETE(req: Request) {
  const entryId = new URL(req.url).searchParams.get('entryId');
  if (!entryId) return NextResponse.json({ success: false, error: 'entryId erforderlich' }, { status: 400 });
  const ok = await deleteTaskTime(entryId);
  return NextResponse.json({ success: ok });
}
