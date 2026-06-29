import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { listTaskTime, sumTaskMinutes, addTaskTime } from '@/lib/staffStore';

/** GET → { entries, totalMinutes }. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const [entries, totalMinutes] = await Promise.all([listTaskTime(id), sumTaskMinutes(id)]);
  return NextResponse.json({ success: true, data: { entries, totalMinutes } });
}

/** POST { minutes, note?, work_date? } → Zeit buchen (Datums-Stempel optional, Standard heute). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const minutes = Math.round(Number(body?.minutes));
  if (!minutes || minutes <= 0) return NextResponse.json({ success: false, error: 'minutes > 0 erforderlich' }, { status: 400 });
  const workDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.work_date || '')) ? String(body.work_date) : undefined;
  const data = await addTaskTime(id, minutes, (body?.note || '').trim() || undefined, null, workDate);
  return NextResponse.json({ success: true, data });
}
