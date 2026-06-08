import { NextResponse } from 'next/server';
import { sendGraphMail, isGraphConfigured } from '@/lib/graphMailer';
import { replyEmailHtml } from '@/lib/emailTemplates';

export async function POST(request: Request) {
  try {
    if (!isGraphConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Microsoft 365 Graph ist nicht konfiguriert.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const to: string = (body.to || '').trim();
    if (!to || !to.includes('@')) {
      return NextResponse.json({ success: false, error: 'Bitte gültige Test-Empfängeradresse angeben.' }, { status: 400 });
    }

    const html = replyEmailHtml({
      bodyText:
        'Dies ist eine Test-E-Mail aus dem Faltin-Admin-Panel.\n\n' +
        'Wenn Sie diese Nachricht sehen, funktioniert der Versand über Microsoft 365 Graph einwandfrei. ✅',
      requestNumber: 'TEST',
      eventName: 'Verbindungstest',
    });

    const res = await sendGraphMail({
      to,
      subject: 'Faltin Travel – Test-E-Mail (Verbindung OK) [TEST]',
      html,
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error || 'Versand fehlgeschlagen' }, { status: 502 });
    }
    return NextResponse.json({ success: true, message: `Test-E-Mail an ${to} gesendet.` });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
