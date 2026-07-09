import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getBooking, addMessage } from '@/lib/bookingStore';
import { bookingEventName } from '@/lib/eventData';
import { sendGraphMail, isGraphConfigured, getMailbox, getFromName } from '@/lib/graphMailer';
import { replyEmailHtml, replySubject } from '@/lib/emailTemplates';

/** POST { body, agentName? } → Antwort-Mail an den Kunden (RQ-Threading), wird im CRM protokolliert. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text = String(body?.body || body?.message || '').trim();
  if (!text) return NextResponse.json({ success: false, error: 'body fehlt' }, { status: 400 });
  if (!isGraphConfigured()) return NextResponse.json({ success: false, error: 'Mailversand nicht konfiguriert' }, { status: 503 });

  const booking = await getBooking(id);
  if (!booking) return NextResponse.json({ success: false, error: 'Anfrage nicht gefunden' }, { status: 404 });
  const b = booking as { id: string; email: string; request_number?: string | null; event_slug?: string | null; package_title?: string | null };
  const requestNumber = b.request_number || '';
  if (!requestNumber) return NextResponse.json({ success: false, error: 'Anfrage hat keine RQ-Nummer' }, { status: 400 });

  // Event-Name für Betreff (Fallback Paket-Titel, TASK-00097)
  const eventName = await bookingEventName(b);

  const subject = replySubject(requestNumber, eventName);
  const html = replyEmailHtml({ bodyText: text, requestNumber, eventName, agentName: body?.agentName || undefined });
  const sendRes = await sendGraphMail({ to: b.email, subject, html });
  if (!sendRes.success) return NextResponse.json({ success: false, error: sendRes.error || 'Versand fehlgeschlagen' }, { status: 502 });

  const saved = await addMessage({
    booking_id: b.id, direction: 'out', from_email: getMailbox() || getFromName(), to_email: b.email,
    subject, body: text, graph_message_id: null,
  });
  return NextResponse.json({ success: true, data: saved });
}
