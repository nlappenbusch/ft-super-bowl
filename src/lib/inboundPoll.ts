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
import { listInboxMessages, markMessageRead, isGraphConfigured } from './graphMailer';
import { findBookingByRequestNumber, graphMessageExists, addMessage } from './bookingStore';
import { parseRequestNumber } from './emailTemplates';

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
  let matched = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const m of messages) {
    const rq = parseRequestNumber(m.subject) || parseRequestNumber(m.bodyPreview);
    if (!rq) {
      unmatched.push(m.subject);
      continue;
    }

    if (await graphMessageExists(m.id)) {
      skipped++;
      await markMessageRead(m.id);
      continue;
    }

    const booking = await findBookingByRequestNumber(rq);
    if (!booking) {
      unmatched.push(`${rq}: ${m.subject}`);
      continue;
    }

    await addMessage({
      booking_id: (booking as { id: string }).id,
      direction: 'in',
      from_email: m.fromAddress,
      to_email: '',
      subject: m.subject,
      body: m.bodyHtml || m.bodyPreview,
      graph_message_id: m.id,
    });
    await markMessageRead(m.id);
    matched++;
  }

  return { success: true, configured: true, scanned: messages.length, matched, skipped, unmatched };
}
