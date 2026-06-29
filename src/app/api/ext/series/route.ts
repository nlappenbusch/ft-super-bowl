import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getSeriesList } from '@/lib/eventData';

/** GET → alle Serien/Hubs (read-only). */
export async function GET(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const data = await getSeriesList();
  return NextResponse.json({ success: true, data });
}
