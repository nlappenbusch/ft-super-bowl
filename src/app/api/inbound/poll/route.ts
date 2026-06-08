import { NextResponse } from 'next/server';
import {
  listInboxMessages,
  markMessageRead,
  isGraphConfigured,
} from '@/lib/graphMailer';
import {
  findBookingByRequestNumber,
  graphMessageExists,
  addMessage,
} from '@/lib/bookingStore';
import { parseRequestNumber } from '@/lib/emailTemplates';

/**
 * Inbound-Polling: liest ungelesene Mails aus dem request@-Postfach,
 * ordnet sie über die RQ-Nummer im Betreff der passenden Anfrage zu und
 * protokolliert sie im CRM. Anschließend werden die Mails als gelesen markiert.
 *
 * Aufruf (per Cron / manuell):
 *   GET/POST /api/inbound/poll?secret=<INBOUND_POLL_SECRET>
 *
 * Schutz: wenn INBOUND_POLL_SECRET gesetzt ist, muss es übergeben werden.
 */
async function handle(request: Request) {
  const secret = process.env.INBOUND_POLL_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided =
      url.searchParams.get('secret') || request.headers.get('x-poll-secret') || '';
    if (provided !== secret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  if (!isGraphConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Microsoft 365 Graph ist nicht konfiguriert.' },
      { status: 503 }
    );
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

    // Doppelte vermeiden
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

  return NextResponse.json({
    success: true,
    scanned: messages.length,
    matched,
    skipped,
    unmatched,
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
