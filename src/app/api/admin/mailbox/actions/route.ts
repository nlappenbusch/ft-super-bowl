import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes, HttpError } from '@/lib/mailbox/api';
import { getMessage } from '@/lib/mailbox/graph';
import { mailText } from '@/lib/mailbox/context';
import { ensureMailSchema } from '@/lib/mailbox/schema';
import { dbRun, dbGet } from '@/lib/dbq';
import { createStaffTask, addTaskMessage, addNotification, formatTicketNo } from '@/lib/staffStore';
import { insertBooking } from '@/lib/database';
import { addMessage } from '@/lib/bookingStore';
import { linkBookingToCustomer, upsertCustomerByEmail } from '@/lib/customerStore';

export const dynamic = 'force-dynamic';

async function link(user: { name: string }, m: { mailbox: string; id: string; internetMessageId: string; conversationId: string; subject: string },
  type: 'request' | 'task' | 'customer', targetId: string, label: string) {
  await ensureMailSchema();
  const exists = await dbGet('SELECT 1 AS x FROM mail_links WHERE message_id = ? AND target_type = ? AND target_id = ?', [m.id, type, targetId]);
  if (exists) return;
  await dbRun(
    `INSERT INTO mail_links (id, mailbox, message_id, internet_message_id, conversation_id, subject, target_type, target_id, target_label, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), m.mailbox, m.id, m.internetMessageId, m.conversationId, m.subject.slice(0, 300), type, targetId, label.slice(0, 200), user.name, new Date().toISOString()],
  );
}

/**
 * POST /api/admin/mailbox/actions — Mail in Geschäftsprozesse übernehmen.
 *   { action:'create_task', mb, id, title, description, assignee_id?, due_date?, priority?, booking_id? }
 *   { action:'create_request', mb, id, kunde{…}, reise{…}, zusammenfassung }
 *   { action:'link', mb, id, target_type:'request'|'task'|'customer', target_id, label }
 *   { action:'unlink', link_id }
 *   { action:'save_customer', mb, id, kunde{…} }
 */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const user = await mailUser();

    if (b.action === 'unlink') {
      await ensureMailSchema();
      await dbRun('DELETE FROM mail_links WHERE id = ?', [String(b.link_id || '')]);
      return NextResponse.json({ success: true });
    }

    const [mb] = await resolveMailboxes(user, b.mb);
    if (!mb || !b.id) throw new HttpError(400, 'mb und id erforderlich');
    const m = await getMessage(mb.address, String(b.id));
    const body = mailText(m).slice(0, 20000);

    if (b.action === 'create_task') {
      const title = String(b.title || m.subject || 'Aufgabe aus Mail').trim().slice(0, 200);
      const task = await createStaffTask({
        title,
        description: String(b.description || '').slice(0, 5000) || `Aus Mail von ${m.from.name || m.from.address} (${m.receivedAt.slice(0, 10)}): ${m.subject}`,
        assignee_id: b.assignee_id || undefined,
        due_date: b.due_date || undefined,
        booking_id: b.booking_id || undefined,
        priority: ['niedrig', 'normal', 'hoch'].includes(b.priority) ? b.priority : 'normal',
        created_by: user.name,
      });
      await addTaskMessage({
        task_id: task.id, direction: 'in', from_email: m.from.address, to_email: mb.address,
        subject: m.subject, body, graph_message_id: m.id, created_by: user.name,
      }).catch((e) => console.error('[Mail] Ticket-Nachricht:', e));
      const nr = formatTicketNo(task.ticket_number) || 'Ticket';
      if (task.assignee_id && task.assignee_id !== user.employeeId) {
        await addNotification({ employee_id: task.assignee_id, type: 'task_assigned', task_id: task.id, title: `${nr} wurde dir zugewiesen – ${task.title}` }).catch(() => undefined);
      }
      await link(user, m, 'task', task.id, `${nr} ${title}`);
      return NextResponse.json({ success: true, task: { id: task.id, ticket: nr, url: `/admin/aufgaben?task=${task.id}` } });
    }

    if (b.action === 'create_request') {
      const k = b.kunde || {};
      const r = b.reise || {};
      const email = String(k.email || m.from.address || '').trim().toLowerCase();
      if (!email) throw new HttpError(400, 'Keine E-Mail-Adresse für die Anfrage.');
      const wishes = Array.isArray(r.wuensche) ? r.wuensche.filter(Boolean).map((w: string) => `- ${w}`).join('\n') : '';
      const message = [b.zusammenfassung, wishes, r.budget ? `Budget: ${r.budget}` : '', r.zimmer ? `Zimmer: ${r.zimmer}` : '', r.ort ? `Ort: ${r.ort}` : '', r.bis ? `Bis: ${r.bis}` : '']
        .filter(Boolean).join('\n\n');
      const created = await insertBooking({
        event_slug: '', package_slug: '', travel_period: '', package_id: '',
        package_title: String(r.event || m.subject || 'Anfrage per Mail').slice(0, 200),
        start_date: String(r.von || ''),
        number_of_persons: Number(r.personen) || 1, double_rooms: 0, single_rooms: 0,
        travelers: '[]', email, phone: String(k.telefon || ''), message,
        status: 'new', total_price: 0, notes: `Aus Mail übernommen von ${user.name} (${mb.address})`, source: 'mail',
      } as never);
      const bookingId = (created as { id?: string })?.id;
      const row = bookingId ? await dbGet<{ id: string; request_number: string }>('SELECT id, request_number FROM booking_requests WHERE id = ?', [bookingId]) : undefined;
      if (!row) throw new HttpError(500, 'Anfrage konnte nicht angelegt werden.');
      await linkBookingToCustomer(row.id, email, {
        firstName: k.vorname || undefined, lastName: k.nachname || undefined, phone: k.telefon || undefined, salutation: k.anrede || undefined,
      }).catch((e) => console.error('[Mail] Kunde verknüpfen:', e));
      await addMessage({
        booking_id: row.id, direction: 'in', from_email: m.from.address, to_email: mb.address, subject: m.subject, body, graph_message_id: m.id,
      }).catch((e) => console.error('[Mail] CRM-Nachricht:', e));
      await link(user, m, 'request', row.id, `${row.request_number} ${r.event || m.subject}`);
      return NextResponse.json({ success: true, request: { id: row.id, request_number: row.request_number, url: `/admin/crm?rq=${row.request_number}` } });
    }

    if (b.action === 'link') {
      const type = ['request', 'task', 'customer'].includes(b.target_type) ? b.target_type : null;
      if (!type || !b.target_id) throw new HttpError(400, 'Ziel fehlt');
      await link(user, m, type, String(b.target_id), String(b.label || ''));
      if (type === 'request') {
        await addMessage({ booking_id: String(b.target_id), direction: m.from.address === mb.address ? 'out' : 'in', from_email: m.from.address, to_email: mb.address, subject: m.subject, body, graph_message_id: m.id })
          .catch(() => undefined);
      }
      return NextResponse.json({ success: true });
    }

    if (b.action === 'save_customer') {
      const k = b.kunde || {};
      const email = String(k.email || m.from.address || '').trim().toLowerCase();
      const id = await upsertCustomerByEmail(email, {
        firstName: k.vorname || undefined, lastName: k.nachname || undefined, phone: k.telefon || undefined, salutation: k.anrede || undefined,
      });
      await link(user, m, 'customer', id, [k.vorname, k.nachname].filter(Boolean).join(' ') || email);
      return NextResponse.json({ success: true, customer: { id, url: `/admin/kunden/${id}` } });
    }

    throw new HttpError(400, 'Unbekannte Aktion');
  } catch (e) {
    return fail(e);
  }
}
