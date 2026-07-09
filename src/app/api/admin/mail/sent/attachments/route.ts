import { NextResponse } from 'next/server';
import { isGraphConfigured, getSentMessageAttachments } from '@/lib/graphMailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/mail/sent/attachments?id=<graphMessageId>
 *
 * Liefert die Anhänge einer versendeten Mail inkl. Base64-Inhalt — zum
 * Zurückholen der Auto-Antwort-PDFs aus den Sent Items (Vorfall 09.07.).
 * Auth über die Admin-Middleware (/api/admin/*).
 */
export async function GET(request: Request) {
  if (!isGraphConfigured()) {
    return NextResponse.json({ success: false, error: 'Graph/M365 ist nicht konfiguriert.' }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const id = (searchParams.get('id') || '').trim();
  if (!id) {
    return NextResponse.json({ success: false, error: 'id fehlt.' }, { status: 400 });
  }
  try {
    const attachments = await getSentMessageAttachments(id);
    return NextResponse.json({ success: true, count: attachments.length, data: attachments });
  } catch (e) {
    console.error('[Admin] mail/sent/attachments Fehler:', e);
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
