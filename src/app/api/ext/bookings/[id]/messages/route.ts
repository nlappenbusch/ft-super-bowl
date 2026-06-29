import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { listMessages } from '@/lib/bookingStore';

/** GET → Mail-Verlauf (CRM) einer Anfrage. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const data = await listMessages(id);
  return NextResponse.json({ success: true, data });
}
