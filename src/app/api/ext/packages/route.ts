import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getPackagesList, getPackagesByEventSlug } from '@/lib/eventData';

/** GET /api/ext/packages?event=<slug> → Pakete (alle oder eines Events), read-only. */
export async function GET(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const event = new URL(req.url).searchParams.get('event');
  const data = event ? await getPackagesByEventSlug(event) : await getPackagesList();
  return NextResponse.json({ success: true, data });
}
