import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getStaffTask, listTaskMessages, addTaskMessage, formatTicketNo, notifyTaskParticipants } from '@/lib/staffStore';
import { sendGraphMail, isGraphConfigured, getMailbox, getFromName } from '@/lib/graphMailer';
import { taskEmailHtml, taskSubjectTag } from '@/lib/emailTemplates';

/** GET → Mail-/Verlauf-Liste. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const data = await listTaskMessages(id);
  return NextResponse.json({ success: true, data });
}

/** POST { kind: 'email'|'note', to?, toName?, subject?, body } → Mail senden oder Notiz speichern. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const kind: 'email' | 'note' = body?.kind === 'note' ? 'note' : 'email';
  const text = String(body?.body || '').trim();
  if (!text) return NextResponse.json({ success: false, error: 'body fehlt' }, { status: 400 });

  const task = await getStaffTask(id);
  if (!task) return NextResponse.json({ success: false, error: 'Ticket nicht gefunden' }, { status: 404 });
  const ticketNo = formatTicketNo(task.ticket_number) || 'TASK';
  const agentName = `API: ${a.key.name}`;

  if (kind === 'note') {
    const saved = await addTaskMessage({ task_id: id, direction: 'note', from_email: agentName, body: text, created_by: agentName });
    // Beteiligte informieren (Glocke + E-Mail) — wie bei Notizen aus dem Admin.
    await notifyTaskParticipants(task, { type: 'task_note', body: text, actorName: agentName }).catch(() => {});
    return NextResponse.json({ success: true, data: saved });
  }

  const to = String(body?.to || '').trim();
  if (!to) return NextResponse.json({ success: false, error: 'to (Empfänger) fehlt' }, { status: 400 });
  if (!isGraphConfigured()) return NextResponse.json({ success: false, error: 'Mailversand nicht konfiguriert' }, { status: 503 });

  let subject = String(body?.subject || '').trim() || `Ticket ${ticketNo}${task.title ? ` – ${task.title}` : ''}`;
  if (!/TASK-\d/i.test(subject)) subject = `${subject} ${taskSubjectTag(ticketNo)}`;
  const html = taskEmailHtml({ bodyText: text, ticketNo, taskTitle: task.title, agentName: 'Faltin Travel Team' });
  const sendRes = await sendGraphMail({ to, toName: body?.toName || undefined, subject, html });
  if (!sendRes.success) return NextResponse.json({ success: false, error: sendRes.error || 'Versand fehlgeschlagen' }, { status: 502 });

  const saved = await addTaskMessage({ task_id: id, direction: 'out', from_email: getMailbox() || getFromName(), to_email: to, subject, body: text, created_by: agentName });
  return NextResponse.json({ success: true, data: saved });
}
