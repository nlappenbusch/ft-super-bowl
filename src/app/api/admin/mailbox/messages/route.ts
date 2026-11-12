import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes } from '@/lib/mailbox/api';
import { listMessages, searchMessages, type MailSummary } from '@/lib/mailbox/graph';
import { rememberContacts } from '@/lib/mailbox/contacts';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/mailbox/messages
 *   ?mb=<adresse>|all   (all = alle Posteingänge zusammen)
 *   &folder=<id|inbox|sentitems|…>  &before=<ISO>  &unread=1 &flagged=1 &attachments=1
 *   &q=<suche>          (Microsoft-Suche; deutsche Kürzel von:, an:, betreff:, anhang)
 */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const user = await mailUser();
    const boxes = (await resolveMailboxes(user, sp.get('mb') || 'all')).filter((m) => m.canRead);
    const q = (sp.get('q') || '').trim();
    const flag = (k: string) => sp.get(k) === '1';
    const top = q ? 25 : boxes.length > 1 ? 25 : 50;

    const lists = await Promise.all(boxes.map(async (m) => {
      try {
        return q
          ? await searchMessages(m.address, q, top)
          : await listMessages(m.address, {
            folder: sp.get('folder') || 'inbox', before: sp.get('before') || undefined,
            unread: flag('unread'), flagged: flag('flagged'), attachments: flag('attachments'), top,
          });
      } catch (e) {
        console.error(`[Mail] ${m.address}:`, (e as Error).message);
        return [] as MailSummary[];
      }
    }));
    let messages = lists.flat().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    // Beim Zusammenführen mehrerer Postfächer nur bis zum ältesten „vollständigen“ Zeitpunkt zeigen,
    // damit das Nachladen (before=…) keine Lücken erzeugt.
    if (!q && boxes.length > 1) {
      const cut = lists.filter((l) => l.length >= top).map((l) => l[l.length - 1].receivedAt).sort().pop();
      if (cut) messages = messages.filter((m) => m.receivedAt >= cut);
    }
    rememberContacts(user.email, messages);
    const more = !q && lists.some((l) => l.length >= top);
    return NextResponse.json({ success: true, messages, more });
  } catch (e) {
    return fail(e);
  }
}
