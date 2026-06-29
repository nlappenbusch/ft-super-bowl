import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { listCustomers } from '@/lib/customerStore';

/** GET /api/ext/customers?q= → Kundenliste (read-only). */
export async function GET(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const q = new URL(req.url).searchParams.get('q') || undefined;
  const data = await listCustomers(q);
  return NextResponse.json({ success: true, data });
}
