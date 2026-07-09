import { NextResponse } from 'next/server';
import { getBooking, addMessage } from '@/lib/bookingStore';
import { bookingEventName } from '@/lib/eventData';
import { sendGraphMail, isGraphConfigured, getMailbox, getFromName, type MailAttachment } from '@/lib/graphMailer';
import { replyEmailHtml, replySubject } from '@/lib/emailTemplates';
import { addMessageAttachment, MAX_FILE_BYTES } from '@/lib/documentStore';
import { requireAdminSession } from '@/lib/apiGuard';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  try {
    const { id } = await params;

    // JSON ODER multipart/form-data (mit Datei-Anhängen) akzeptieren.
    let text = '';
    let agentName: string | undefined;
    const uploads: { name: string; mime: string; size: number; b64: string }[] = [];
    const ctype = request.headers.get('content-type') || '';
    if (ctype.includes('multipart/form-data')) {
      const form = await request.formData();
      text = String(form.get('body') || form.get('message') || '').trim();
      agentName = (form.get('agentName') as string) || undefined;
      for (const f of form.getAll('files')) {
        if (f instanceof File && f.size > 0 && f.size <= MAX_FILE_BYTES) {
          uploads.push({ name: f.name || 'datei', mime: f.type || 'application/octet-stream', size: f.size, b64: Buffer.from(await f.arrayBuffer()).toString('base64') });
        }
      }
    } else {
      const body = await request.json();
      text = (body.body || body.message || '').trim();
      agentName = body.agentName;
    }

    if (!text && uploads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nachrichtentext fehlt' },
        { status: 400 }
      );
    }

    if (!isGraphConfigured()) {
      return NextResponse.json(
        { success: false, error: 'E-Mail-Versand (Microsoft 365 Graph) ist nicht konfiguriert.' },
        { status: 503 }
      );
    }

    const booking = await getBooking(id);
    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Anfrage nicht gefunden' },
        { status: 404 }
      );
    }

    const b = booking as {
      id: string;
      email: string;
      request_number?: string | null;
      event_slug?: string | null;
      package_title?: string | null;
    };

    const requestNumber = b.request_number || '';
    if (!requestNumber) {
      return NextResponse.json(
        { success: false, error: 'Diese Anfrage hat noch keine RQ-Nummer.' },
        { status: 400 }
      );
    }

    // Event-Name für Betreff (Fallback Paket-Titel, TASK-00097)
    const eventName = await bookingEventName(b);

    const subject = replySubject(requestNumber, eventName);
    const html = replyEmailHtml({
      bodyText: text || '(siehe Anhang)',
      requestNumber,
      eventName,
      agentName,
    });

    const mailAttachments: MailAttachment[] = uploads
      .filter((u) => u.size <= 3 * 1024 * 1024)
      .map((u) => ({ name: u.name, contentType: u.mime, contentBytes: u.b64 }));

    const sendRes = await sendGraphMail({ to: b.email, subject, html, attachments: mailAttachments });
    if (!sendRes.success) {
      return NextResponse.json(
        { success: false, error: sendRes.error || 'Versand fehlgeschlagen' },
        { status: 502 }
      );
    }

    const saved = await addMessage({
      booking_id: b.id,
      direction: 'out',
      from_email: getMailbox() || getFromName(),
      to_email: b.email,
      subject,
      body: text || '(nur Anhang)',
      graph_message_id: null,
    });

    for (const u of uploads) {
      await addMessageAttachment({ message_id: saved.id, filename: u.name, mime: u.mime, size: u.size, data_b64: u.b64 });
    }

    return NextResponse.json({ success: true, data: saved });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
