import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/portalSession';
import { getBooking, addMessage } from '@/lib/bookingStore';
import { addMessageAttachment, MAX_FILE_BYTES } from '@/lib/documentStore';
import { sendGraphMail, getMailbox, isGraphConfigured } from '@/lib/graphMailer';
import { subjectTag, publicBaseUrl } from '@/lib/emailTemplates';

/** POST /api/portal/messages  (multipart: bookingId, body, files[]) */
export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ success: false, error: 'Ungültige Anfrage' }, { status: 400 }); }

  const bookingId = String(form.get('bookingId') || '');
  const text = String(form.get('body') || '').trim();
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

  if (!text && files.length === 0) {
    return NextResponse.json({ success: false, error: 'Bitte eine Nachricht oder einen Anhang angeben.' }, { status: 400 });
  }

  const booking = await getBooking(bookingId).catch(() => null) as
    | { id: string; customer_id?: string | null; request_number?: string | null; email?: string } | null;
  if (!booking || booking.customer_id !== session.cid) {
    return NextResponse.json({ success: false, error: 'Anfrage nicht gefunden' }, { status: 404 });
  }

  const requestNumber = booking.request_number || '';
  const subject = `Nachricht aus dem Portal ${requestNumber ? subjectTag(requestNumber) : ''}`.trim();

  const saved = await addMessage({
    booking_id: booking.id,
    direction: 'in',
    from_email: session.email,
    to_email: getMailbox() || '',
    subject,
    body: text || '(nur Anhang)',
    graph_message_id: null,
  });

  // Anhänge speichern (base64) + für Team-Mail sammeln (Graph-Limit ~3 MB inline).
  const mailAttach: { name: string; contentType: string; contentBytes: string }[] = [];
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) continue;
    const b64 = Buffer.from(await f.arrayBuffer()).toString('base64');
    await addMessageAttachment({
      message_id: saved.id, filename: f.name || 'datei', mime: f.type || 'application/octet-stream', size: f.size, data_b64: b64,
    });
    if (f.size <= 3 * 1024 * 1024) {
      mailAttach.push({ name: f.name || 'datei', contentType: f.type || 'application/octet-stream', contentBytes: b64 });
    }
  }

  // Team benachrichtigen
  if (isGraphConfigured() && getMailbox()) {
    const adminLink = `${publicBaseUrl()}/admin/crm`;
    const html = `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#143047;">
      <p style="font-size:15px;"><strong>${session.email}</strong> hat im Kundenportal zur Anfrage
      <strong>${requestNumber || booking.id}</strong> geschrieben:</p>
      <div style="background:#f5f7fa;border:1px solid #e5e8ed;border-radius:10px;padding:12px 14px;white-space:pre-wrap;font-size:14px;">${escapeHtml(text || '(nur Anhang)')}</div>
      ${files.length ? `<p style="font-size:13px;color:#6b7280;">${files.length} Anhang/Anhänge im Portal hinterlegt.</p>` : ''}
      <p style="margin-top:14px;"><a href="${adminLink}" style="background:#d9531e;color:#fff;padding:9px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Im CRM öffnen →</a></p>
    </div>`;
    await sendGraphMail({
      to: getMailbox(),
      subject: `💬 Portal-Nachricht ${requestNumber ? subjectTag(requestNumber) : ''} von ${session.email}`.trim(),
      html,
      attachments: mailAttach,
    }).catch((e) => console.warn('[portal] Team-Notify:', (e as Error).message));
  }

  return NextResponse.json({ success: true, id: saved.id });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
