import { NextResponse } from 'next/server';
import { getInquiry, sendInquiry } from '@/lib/inquiryStore';
import { getSessionEmployee } from '@/lib/serverSession';

/**
 * POST → Anfrage per Microsoft Graph aus dem Portal-Postfach senden.
 * Nur auf ausdrücklichen Klick (UI fragt nach). Die KI/MCP-Werkzeuge senden nie selbst.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string; inqId: string }> }) {
  const { id, inqId } = await params;
  const inq = await getInquiry(inqId);
  if (!inq || inq.calc_id !== id) return NextResponse.json({ success: false, error: 'Anfrage nicht gefunden' }, { status: 404 });
  const s = await getSessionEmployee().catch(() => null);
  const res = await sendInquiry(inqId, s?.employee?.name || s?.session?.name || '');
  if (!res.ok) return NextResponse.json({ success: false, error: res.error }, { status: res.status });
  return NextResponse.json({ success: true, data: res.inquiry });
}
