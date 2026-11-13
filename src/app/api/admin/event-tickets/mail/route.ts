import { NextResponse } from 'next/server';
import { getTickets, markDrafted } from '@/lib/eventTicketStore';
import { previewTicketMail, createTicketDraft } from '@/lib/eventTicketMail';
import { mailUser, resolveMailboxes, fail, HttpError } from '@/lib/mailbox/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST { ids[], action: 'preview' } → { subject, html, errors[] }
 * POST { ids[], action: 'draft', mailbox, attach } → Entwurf im Postfach (wird NICHT gesendet).
 * Postfach-Rechte wie in Faltin Mail: «Senden als» bzw. Vollzugriff laut Exchange.
 */
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { ids?: unknown; action?: string; mailbox?: string; attach?: boolean };
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const tickets = await getTickets(ids);
    if (!tickets.length) throw new HttpError(400, 'Keine Tickets ausgewählt.');

    if (b.action !== 'draft') {
      return NextResponse.json({ success: true, ...previewTicketMail(tickets, b.attach !== false) });
    }

    const user = await mailUser();
    // Ohne Angabe würde resolveMailboxes ALLE Postfächer liefern — Absender muss bewusst gewählt sein.
    if (!b.mailbox || b.mailbox === 'all') throw new HttpError(400, 'Bitte ein Absender-Postfach wählen.');
    const [mb] = await resolveMailboxes(user, String(b.mailbox), 'send');
    if (!mb) throw new HttpError(400, 'Bitte ein Absender-Postfach wählen.');
    let r;
    try {
      r = await createTicketDraft(tickets, mb.address, b.attach !== false);
    } catch (e) {
      if (e instanceof Error && !(e as { status?: number }).status) throw new HttpError(400, e.message);
      throw e;
    }
    await markDrafted(tickets.map((t) => t.id), { mailbox: mb.address, webLink: r.webLink, by: user.name });
    return NextResponse.json({ success: true, mailbox: mb.address, ...r });
  } catch (e) {
    return fail(e);
  }
}
