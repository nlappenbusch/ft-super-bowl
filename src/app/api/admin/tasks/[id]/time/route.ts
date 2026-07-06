import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { listTaskTime, addTaskTime, sumTaskMinutes, deleteTaskTime } from '@/lib/staffStore';

/** GET → { entries, totalMinutes }. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [entries, totalMinutes] = await Promise.all([listTaskTime(id), sumTaskMinutes(id)]);
  return NextResponse.json({ success: true, data: { entries, totalMinutes } });
}

/** POST { minutes, note?, work_date? } → Zeit buchen (mit Datums-Stempel). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const minutes = Math.round(Number(body?.minutes));
  if (!minutes || minutes <= 0) return NextResponse.json({ success: false, error: 'minutes > 0 erforderlich' }, { status: 400 });
  const ctx = await getSessionEmployee();
  const workDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.work_date || '')) ? String(body.work_date) : undefined;
  const data = await addTaskTime(id, minutes, (body?.note || '').trim() || undefined, ctx?.employee?.id ?? null, workDate);
  return NextResponse.json({ success: true, data });
}

/** DELETE ?entryId=… → Buchung löschen (rapportierte Einträge sind gesperrt). */
export async function DELETE(req: Request) {
  const entryId = new URL(req.url).searchParams.get('entryId');
  if (!entryId) return NextResponse.json({ success: false, error: 'entryId erforderlich' }, { status: 400 });
  const ok = await deleteTaskTime(entryId);
  if (!ok) return NextResponse.json({ success: false, error: 'Eintrag nicht gefunden oder bereits rapportiert' }, { status: 400 });
  return NextResponse.json({ success: true });
}
