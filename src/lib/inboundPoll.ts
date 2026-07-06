/**
 * inboundPoll.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Kernlogik für das Inbound-Polling: liest ungelesene Mails aus dem
 * request@-Postfach, ordnet sie über die RQ-/TASK-Nummer im Betreff der
 * passenden Anfrage bzw. dem Ticket zu, protokolliert sie im CRM und markiert
 * sie als gelesen. Optional (settings.mail.ticket_auto_create) werden
 * unzugeordnete Mails automatisch als neues Ticket angelegt (Mail-to-Ticket).
 *
 * Wird vom geschützten Cron-Endpoint (/api/inbound/poll), vom Admin-Panel
 * (/api/admin/mail/poll) und vom internen Scheduler (src/instrumentation.ts)
 * genutzt.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  listInboxMessages, markMessageRead, isGraphConfigured, getMailbox, getFromName,
  sendGraphMail, type GraphInboxMessage,
} from './graphMailer';
import { findBookingByRequestNumber, graphMessageExists, addMessage } from './bookingStore';
import {
  findTaskByTicketNumber, taskGraphMessageExists, addTaskMessage,
  createStaffTask, formatTicketNo,
} from './staffStore';
import { parseRequestNumber, parseTicketNumber } from './emailTemplates';
import { getSettings } from './settingsStore';

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

/** Grober HTML→Text-Konverter für die Ticket-Beschreibung (kein perfektes Parsing nötig). */
function htmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;| /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Erkennt automatisierte Absender (Bounces, Autoresponder), aus denen kein Ticket entstehen soll. */
function looksAutomated(fromAddress: string, subject: string): boolean {
  if (/(noreply|no-reply|mailer-daemon)/i.test(fromAddress)) return true;
  if (/^(automatische antwort|automatic reply|autoreply|out of office|abwesenheit)/i.test((subject || '').trim())) return true;
  return false;
}

/** Prüft, ob die Absender-Domain in der Komma-Allowlist steht (leer = alle erlaubt). */
function senderDomainAllowed(fromAddress: string, allowlist: string): boolean {
  const domains = (allowlist || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
  if (domains.length === 0) return true;
  const at = (fromAddress || '').lastIndexOf('@');
  if (at < 0) return false;
  const domain = fromAddress.slice(at + 1).toLowerCase();
  return domains.includes(domain);
}

/**
 * Legt aus einer unzugeordneten Mail ein neues Ticket an, protokolliert die Mail
 * als Ticket-Nachricht und schickt (best effort) eine Bestätigung mit der
 * TASK-Nummer im Betreff, damit Antworten künftig automatisch zugeordnet werden.
 */
async function createTicketFromMail(m: GraphInboxMessage, mailbox: string): Promise<void> {
  const subject = (m.subject || '').trim();
  const rawBody = stripQuotedReply(m.bodyHtml || m.bodyPreview);
  const textBody = htmlToText(rawBody) || m.bodyPreview || '';
  const fromLabel = m.fromName ? `${m.fromName} <${m.fromAddress}>` : m.fromAddress;

  const task = await createStaffTask({
    title: subject || 'Mail ohne Betreff',
    description: `Von: ${fromLabel}\n\n${textBody}`,
    created_by: `Mail: ${m.fromAddress}`,
  });

  await addTaskMessage({
    task_id: task.id,
    direction: 'in',
    from_email: m.fromAddress,
    to_email: mailbox,
    subject: m.subject,
    body: rawBody,
    graph_message_id: m.id,
    created_by: m.fromAddress,
  });

  // Bestätigungsmail (best effort) — TASK-Nummer im Betreff sorgt für Auto-Zuordnung der Antworten.
  try {
    const ticketNo = formatTicketNo(task.ticket_number);
    const confirmSubject = `[${ticketNo}] ${subject || 'Ihre Anfrage'}`;
    const html =
      `<p>Guten Tag,</p>` +
      `<p>vielen Dank für Ihre Nachricht. Ihr Ticket <strong>${ticketNo}</strong> wurde erstellt und wird bearbeitet. ` +
      `Bitte behalten Sie die Ticketnummer im Betreff, damit Antworten zugeordnet werden.</p>` +
      `<p>Freundliche Grüsse<br/>${getFromName()}</p>`;
    const sent = await sendGraphMail({
      to: m.fromAddress,
      toName: m.fromName || undefined,
      subject: confirmSubject,
      html,
    });
    if (sent.success) {
      await addTaskMessage({
        task_id: task.id,
        direction: 'out',
        from_email: mailbox,
        to_email: m.fromAddress,
        subject: confirmSubject,
        body: html,
        created_by: 'System (Auto-Create)',
      });
    } else {
      // Fehlschlag SICHTBAR am Ticket protokollieren statt nur in der
      // Server-Console — sonst fällt ein kaputter Mail-Versand nie auf.
      await addTaskMessage({
        task_id: task.id,
        direction: 'out',
        from_email: mailbox,
        to_email: m.fromAddress,
        subject: `⚠️ Eingangsbestätigung NICHT gesendet`,
        body: `Der Versand der Eingangsbestätigung an ${m.fromAddress} ist fehlgeschlagen: ${sent.error || 'unbekannter Fehler'}. Bitte Graph-/Postfach-Konfiguration prüfen (Admin → E-Mail) und manuell antworten.`,
        created_by: 'System (Auto-Create)',
      });
      console.error('[inbound-poll] Bestätigungsmail fehlgeschlagen:', sent.error);
    }
  } catch (err) {
    console.error('[inbound-poll] Bestätigungsmail fehlgeschlagen:', err);
    try {
      await addTaskMessage({
        task_id: task.id,
        direction: 'out',
        from_email: mailbox,
        to_email: m.fromAddress,
        subject: `⚠️ Eingangsbestätigung NICHT gesendet`,
        body: `Der Versand der Eingangsbestätigung an ${m.fromAddress} ist fehlgeschlagen: ${(err as Error).message}. Bitte Graph-/Postfach-Konfiguration prüfen und manuell antworten.`,
        created_by: 'System (Auto-Create)',
      });
    } catch { /* non-fatal */ }
  }
}

export interface InboundPollResult {
  success: boolean;
  configured: boolean;
  scanned: number;
  matched: number;
  skipped: number;
  /** Anzahl automatisch erstellter Tickets (Mail-to-Ticket) */
  created: number;
  unmatched: string[];
}

export async function runInboundPoll(): Promise<InboundPollResult> {
  if (!isGraphConfigured()) {
    return { success: false, configured: false, scanned: 0, matched: 0, skipped: 0, created: 0, unmatched: [] };
  }

  const messages = await listInboxMessages(true, 25);
  const selfAddr = getMailbox().toLowerCase();
  let matched = 0;
  let skipped = 0;
  let created = 0;
  const unmatched: string[] = [];
  /** Unzugeordnete Mails als Kandidaten für die automatische Ticket-Erstellung. */
  const unmatchedMsgs: Array<{ msg: GraphInboxMessage; label: string }> = [];

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
      unmatchedMsgs.push({ msg: m, label: m.subject });
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

    unmatchedMsgs.push({ msg: m, label: `${rq || `TASK-${ticketNo}`}: ${m.subject}` });
  }

  // ── Mail-to-Ticket: aus unzugeordneten Mails automatisch Tickets erstellen ──
  const mailSettings = getSettings().mail;
  const autoCreate = !!mailSettings.ticket_auto_create;
  const allowlist = mailSettings.ticket_auto_create_domains ?? '';

  for (const { msg, label } of unmatchedMsgs) {
    if (!autoCreate || !senderDomainAllowed(msg.fromAddress, allowlist) || looksAutomated(msg.fromAddress, msg.subject)) {
      unmatched.push(label);
      continue;
    }
    try {
      // Dedupe: Mail wurde bereits als Ticket-Nachricht verarbeitet.
      if (await taskGraphMessageExists(msg.id)) {
        skipped++;
        await markMessageRead(msg.id);
        continue;
      }
      await createTicketFromMail(msg, selfAddr);
      await markMessageRead(msg.id);
      created++;
    } catch (err) {
      console.error('[inbound-poll] Ticket-Auto-Create fehlgeschlagen:', err);
      unmatched.push(label);
    }
  }

  return { success: true, configured: true, scanned: messages.length, matched, skipped, created, unmatched };
}
