import { NextResponse } from 'next/server';
import { listTimeReports, createTimeReport } from '@/lib/staffStore';
import { getSessionEmployee } from '@/lib/serverSession';

/** GET /api/admin/time-reports → Rapport-Liste mit Summen. */
export async function GET() {
  const reports = await listTimeReports();
  return NextResponse.json({ success: true, data: reports });
}

/**
 * POST /api/admin/time-reports { entry_ids: string[], title?, hourly_rate?, currency?, note? }
 * → legt einen Rapport (Entwurf) aus offenen Zeitbuchungen an.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const entryIds = Array.isArray(body?.entry_ids) ? body.entry_ids.map(String) : [];
  const rate = body?.hourly_rate === null || body?.hourly_rate === undefined || body?.hourly_rate === ''
    ? null : Number(body.hourly_rate);
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
    return NextResponse.json({ success: false, error: 'Ungültiger Stundensatz' }, { status: 400 });
  }
  const ctx = await getSessionEmployee().catch(() => null);
  const result = await createTimeReport({
    entry_ids: entryIds,
    title: body?.title,
    hourly_rate: rate,
    currency: body?.currency,
    note: body?.note,
    created_by: ctx?.employee?.name || ctx?.session?.name || '',
  });
  if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: result.report });
}
