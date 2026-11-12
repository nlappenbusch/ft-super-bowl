import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes, HttpError } from '@/lib/mailbox/api';
import { sendMessage, type MailAddress } from '@/lib/mailbox/graph';
import { savePersonalPrefs } from '@/lib/mailbox/prefs';
import { countTemplateUse } from '@/lib/mailbox/templates';
import { addTaskMessage } from '@/lib/staffStore';
import { addMessage } from '@/lib/bookingStore';
import { dbAll } from '@/lib/dbq';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

function cleanList(v: unknown): MailAddress[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? { name: '', address: x } : { name: String(x?.name || ''), address: String(x?.address || '') }))
    .map((a) => ({ name: a.name.trim(), address: a.address.trim().toLowerCase() }))
    .filter((a) => EMAIL.test(a.address));
}

const toText = (html: string) => html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

/**
 * POST /api/admin/mailbox/send
 * { from, to[], cc[], bcc[], subject, html, attachments[{name,contentType,contentBytes}],
 *   reference?: {mb, id, mode: reply|replyAll|forward}, draftOnly?, templateIds?[] }
 * Der Versand erfolgt IMMER durch einen Klick der Person — nie automatisch durch die KI.
 */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const user = await mailUser();
    const [from] = await resolveMailboxes(user, b.from, b.draftOnly ? 'read' : 'send');
    if (!from) throw new HttpError(400, 'Absender-Postfach fehlt');
    const to = cleanList(b.to);
    const cc = cleanList(b.cc);
    const bcc = cleanList(b.bcc);
    if (!b.draftOnly && !to.length && !cc.length && !bcc.length) throw new HttpError(400, 'Bitte mindestens eine gültige Empfängeradresse angeben.');
    const subject = String(b.subject || '').slice(0, 400);
    const html = String(b.html || '');
    if (!b.draftOnly && !subject.trim() && !toText(html)) throw new HttpError(400, 'Die Mail ist leer.');
    const attachments = Array.isArray(b.attachments) ? b.attachments.slice(0, 20).map((a: { name?: string; contentType?: string; contentBytes?: string }) => ({
      name: String(a.name || 'Anhang'), contentType: String(a.contentType || 'application/octet-stream'), contentBytes: String(a.contentBytes || ''),
    })) : [];
    const totalBytes = attachments.reduce((s: number, a: { contentBytes: string }) => s + a.contentBytes.length * 0.75, 0);
    if (totalBytes > 30 * 1024 * 1024) throw new HttpError(400, 'Anhänge zusammen grösser als 30 MB.');

    // Antworten nur im selben Postfach möglich (Graph createReply). Sonst als neue Mail.
    let reference: { messageId: string; mode: 'reply' | 'replyAll' | 'forward' } | undefined;
    if (b.reference?.id && ['reply', 'replyAll', 'forward'].includes(b.reference.mode)) {
      if (String(b.reference.mb || '').toLowerCase() === from.address) reference = { messageId: String(b.reference.id), mode: b.reference.mode };
    }

    const r = await sendMessage({
      mailbox: from.address, to, cc, bcc, subject, html, attachments, reference,
      importance: b.importance === 'high' ? 'high' : undefined, draftOnly: !!b.draftOnly,
    });

    if (!b.draftOnly) {
      await savePersonalPrefs(user.email || 'local', { default_from: from.address }).catch(() => undefined);
      for (const id of Array.isArray(b.templateIds) ? b.templateIds.slice(0, 10) : []) await countTemplateUse(String(id));
      // In CRM-Verlauf bzw. Ticket mitschreiben, wenn eine RQ-/TASK-Nummer im Betreff steht
      const rq = subject.match(/RQ-\d{3,}/i)?.[0]?.toUpperCase();
      const task = subject.match(/TASK-(\d{3,})/i)?.[1];
      const recipients = [...to, ...cc].map((a) => a.address).join(', ');
      if (rq) {
        const rows = await dbAll<{ id: string }>('SELECT id FROM booking_requests WHERE upper(request_number) = ? LIMIT 1', [rq]).catch(() => []);
        if (rows[0]) await addMessage({ booking_id: rows[0].id, direction: 'out', from_email: from.address, to_email: recipients, subject, body: toText(html).slice(0, 20000), graph_message_id: null }).catch((e) => console.error('[Mail] CRM-Verlauf:', e));
      }
      if (task) {
        const rows = await dbAll<{ id: string }>('SELECT id FROM staff_tasks WHERE ticket_number = ? LIMIT 1', [parseInt(task, 10)]).catch(() => []);
        if (rows[0]) await addTaskMessage({ task_id: rows[0].id, direction: 'out', from_email: from.address, to_email: recipients, subject, body: toText(html).slice(0, 20000), created_by: user.name }).catch((e) => console.error('[Mail] Ticket-Verlauf:', e));
      }
    }
    return NextResponse.json({ success: true, sent: r.sent, webLink: r.webLink });
  } catch (e) {
    return fail(e);
  }
}
