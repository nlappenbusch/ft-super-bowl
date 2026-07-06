import { NextResponse } from 'next/server';
import { getTimeReport, updateTimeReport, deleteTimeReport } from '@/lib/staffStore';

/** GET → { report, entries, total_minutes }. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getTimeReport(id);
  if (!data) return NextResponse.json({ success: false, error: 'Rapport nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

/** PATCH { title?, note?, hourly_rate?, currency?, status? } — final = inhaltlich gesperrt. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const u: Parameters<typeof updateTimeReport>[1] = {};
  if (body.title !== undefined) u.title = String(body.title);
  if (body.note !== undefined) u.note = String(body.note);
  if (body.currency !== undefined) u.currency = String(body.currency);
  if (body.status !== undefined) u.status = body.status;
  if (body.hourly_rate !== undefined) {
    const rate = body.hourly_rate === null || body.hourly_rate === '' ? null : Number(body.hourly_rate);
    if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
      return NextResponse.json({ success: false, error: 'Ungültiger Stundensatz' }, { status: 400 });
    }
    u.hourly_rate = rate;
  }
  const result = await updateTimeReport(id, u);
  if (!result) return NextResponse.json({ success: false, error: 'Rapport nicht gefunden' }, { status: 404 });
  if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: result });
}

/** DELETE — nur Entwürfe; enthaltene Zeiten werden wieder offen. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await deleteTimeReport(id);
  if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
