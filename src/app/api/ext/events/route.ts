import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getEventsList } from '@/lib/eventData';

/** GET → alle Events (read-only). */
export async function GET(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const data = await getEventsList();
  return NextResponse.json({ success: true, data });
}
