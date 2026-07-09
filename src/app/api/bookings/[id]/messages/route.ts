import { NextResponse } from 'next/server';
import { listMessages } from '@/lib/bookingStore';
import { listAttachmentsForBooking } from '@/lib/documentStore';
import { requireAdminSession } from '@/lib/apiGuard';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  try {
    const { id } = await params;
    const messages = await listMessages(id);
    const atts = await listAttachmentsForBooking(id);
    const byMsg = new Map<string, { id: string; filename: string; mime: string; size: number }[]>();
    for (const a of atts) {
      const arr = byMsg.get(a.message_id) || [];
      arr.push({ id: a.id, filename: a.filename, mime: a.mime, size: a.size });
      byMsg.set(a.message_id, arr);
    }
    const data = messages.map((m) => ({ ...m, attachments: byMsg.get(m.id) || [] }));
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
