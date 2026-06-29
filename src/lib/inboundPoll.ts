/**
 * inboundPoll.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Kernlogik für das Inbound-Polling: liest ungelesene Mails aus dem
 * request@-Postfach, ordnet sie über die RQ-Nummer im Betreff der passenden
 * Anfrage zu, protokolliert sie im CRM und markiert sie als gelesen.
 *
 * Wird sowohl vom geschützten Cron-Endpoint (/api/inbound/poll) als auch vom
 * Admin-Panel (/api/admin/mail/poll) genutzt.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { listInboxMessages, markMessageRead, isGraphConfigured, getMailbox } from './graphMailer';
import { findBookingByRequestNumber, graphMessageExists, addMessage } from './bookingStore';
import { findTaskByTicketNumber, taskGraphMessageExists, addTaskMessage } from './staffStore';
import { parseRequestNumber, parseTicketNumber } from './emailTemplates';

/**
 * Entfernt den zitierten Original-Verlauf aus einer eingehenden Antwort, sodass
 * im CRM nur der neue Text des Kunden steht (nicht die komplette mitzitierte Mail).
 * Schneidet beim frühesten bekannten Zitat-Marker (Apple Mail, Outlook, Gmail,
 * Thunderbird, "Am … schrieb", "On … wrote", "Von: … Gesendet:" usw.).
 */
export function stripQuotedReply(raw: string): string {
  if (!raw) return raw;
  const markers: RegExp[] = [
    /<blockquote/i,
    /<div[^>]*id=["']?divRplyFwdMsg/i,
    /<div[^>]*id=["']?appendonsend/i,
    /<div[^>]*class=["']?gmail_quote/i,
    /<div[^>]*class=["']?moz-cite-prefix/i,
    /-----\s*Ursprüngliche Nachricht\s*-----/i,
    /-----\s*Original Message\s*-----/i,
    /\bAm\s+\d{1,2}\.\s*\d{1,2}\.\s*\d{4}.{0,60}?schrieb\b/i,
    /\bOn\s+.{0,80}?\bwrote:/i,
    /<b>\s*Von:\s*<\/b>/i,
    /\bVon:\s*.{0,120}?\bGesendet:/i,
  ];
  let cut = -1;
  for (const re of markers) {
    const mm = raw.match(re);
    if (mm && mm.index !== undefined && (cut === -1 || mm.index < cut)) cut = mm.index;
  }
  if (cut <= 0) return raw;
  let head = raw.slice(0, cut).replace(/(\s|<br\s*\/?>|<div>\s*<\/div>|&nbsp;| )+$/i, '');
  const textOnly = head.replace(/<[^>]+>/g, '').replace(/&nbsp;| /g, ' ').trim();
  // Falls vor dem Zitat praktisch nichts steht (reine Weiterleitung), Original behalten.
  return textOnly.length < 1 ? raw : head;
}

export interface InboundPollResult {
  success: boolean;
  configured: boolean;
  scanned: number;
  matched: number;
  skipped: number;
  unmatched: string[];
}

export async function runInboundPoll(): Promise<InboundPollResult> {
  if (!isGraphConfigured()) {
    return { success: false, configured: false, scanned: 0, matched: 0, skipped: 0, unmatched: [] };
  }

  const messages = await listInboxMessages(true, 25);
  const selfAddr = getMailbox().toLowerCase();
  let matched = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const m of messages) {
    // Eigene/interne Mails (Bestätigungen, Team-Benachrichtigungen) überspringen
    if (m.fromAddress && m.fromAddress.toLowerCase() === selfAddr) {
      skipped++;
      await markMessageRead(m.id);
      continue;
    }
    const rq = parseRequestNumber(m.subject) || parseRequestNumber(m.bodyPreview);
    const ticketNo = parseTicketNumber(m.subject) || parseTicketNumber(m.bodyPreview);
    if (!rq && !ticketNo) {
      unmatched.push(m.subject);
      continue;
    }

    // 1) Anfrage (RQ) hat Vorrang — bestehendes CRM-Threading.
    if (rq) {
      if (await graphMessageExists(m.id)) {
        skipped++;
        await markMessageRead(m.id);
        continue;
      }
      const booking = await findBookingByRequestNumber(rq);
      if (booking) {
        await addMessage({
          booking_id: (booking as { id: string }).id,
          direction: 'in',
          from_email: m.fromAddress,
          to_email: '',
          subject: m.subject,
          body: stripQuotedReply(m.bodyHtml || m.bodyPreview),
          graph_message_id: m.id,
        });
        await markMessageRead(m.id);
        matched++;
        continue;
      }
      // RQ im Betreff, aber keine passende Buchung → ggf. Ticket prüfen.
    }

    // 2) Ticket (TASK-xxxxx) — Antwort dem internen Ticket zuordnen.
    if (ticketNo) {
      if (await taskGraphMessageExists(m.id)) {
        skipped++;
        await markMessageRead(m.id);
        continue;
      }
      const task = await findTaskByTicketNumber(ticketNo);
      if (task) {
        await addTaskMessage({
          task_id: task.id,
          direction: 'in',
          from_email: m.fromAddress,
          to_email: '',
          subject: m.subject,
          body: stripQuotedReply(m.bodyHtml || m.bodyPreview),
          graph_message_id: m.id,
        });
        await markMessageRead(m.id);
        matched++;
        continue;
      }
    }

    unmatched.push(`${rq || `TASK-${ticketNo}`}: ${m.subject}`);
  }

  return { success: true, configured: true, scanned: messages.length, matched, skipped, unmatched };
}
