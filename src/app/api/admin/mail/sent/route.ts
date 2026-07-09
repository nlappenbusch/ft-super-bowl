import { NextResponse } from 'next/server';
import { isGraphConfigured, listSentMessages } from '@/lib/graphMailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/mail/sent?since=2026-06-01T00:00:00Z&top=25&skip=0
 *
 * Liest versendete Mails aus den Sent Items des konfigurierten Postfachs
 * (nur Metadaten + Body, Anhänge als Name/Größe). Grundlage für die
 * Wiederherstellung der per Event konfigurierten Auto-Antworten aus den
 * tatsächlich verschickten Mails. Auth über die Admin-Middleware (/api/admin/*).
 */
export async function GET(request: Request) {
  if (!isGraphConfigured()) {
    return NextResponse.json({ success: false, error: 'Graph/M365 ist nicht konfiguriert.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const since = searchParams.get('since') || undefined;
  const top = Math.min(Math.max(parseInt(searchParams.get('top') || '25', 10) || 25, 1), 50);
  const skip = Math.max(parseInt(searchParams.get('skip') || '0', 10) || 0, 0);

  if (since && isNaN(Date.parse(since))) {
    return NextResponse.json({ success: false, error: 'Ungültiges since-Datum (ISO erwartet).' }, { status: 400 });
  }

  try {
    const messages = await listSentMessages(since, top, skip);
    return NextResponse.json({ success: true, count: messages.length, skip, data: messages });
  } catch (e) {
    console.error('[Admin] mail/sent Fehler:', e);
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
