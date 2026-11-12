import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes } from '@/lib/mailbox/api';
import { listMessages, searchMessages, type MailSummary } from '@/lib/mailbox/graph';
import { rememberContacts } from '@/lib/mailbox/contacts';
import { mirrorList, mirrorSearch } from '@/lib/mailbox/mirror';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/mailbox/messages
 *   ?mb=<adresse>|all   (all = alle Posteingänge zusammen)
 *   &folder=<id|inbox|sentitems|…>  &before=<ISO>  &unread=1 &flagged=1 &attachments=1
 *   &q=<suche>          (Microsoft-Suche; deutsche Kürzel von:, an:, betreff:, anhang)
 *
 * Listen kommen aus dem Spiegel (mirror.ts), sobald der Ordner abgeglichen ist; sonst live.
 * Die Suche läuft live; hängt Microsoft, springt die einfache Suche im Spiegel ein.
 */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const user = await mailUser();
    const boxes = (await resolveMailboxes(user, sp.get('mb') || 'all')).filter((m) => m.canRead);
    const q = (sp.get('q') || '').trim();
    const flag = (k: string) => sp.get(k) === '1';
    const top = q ? 25 : boxes.length > 1 ? 25 : 50;

    // Sammelansicht: knappes Zeitlimit je Postfach. Ein hängendes Postfach (kommt bei Exchange
    // vor) landet in `slow`, der Client zeigt die übrigen sofort und lädt es still nach.
    const multi = boxes.length > 1;
    const timing = multi ? { timeoutMs: 6000, deadlineMs: 9000 } : { timeoutMs: 15000, deadlineMs: 25000 };
    const slow: string[] = [];
    const opts = {
      folder: sp.get('folder') || 'inbox', before: sp.get('before') || undefined,
      unread: flag('unread'), flagged: flag('flagged'), attachments: flag('attachments'), top, timing,
    };
    const results = await Promise.all(boxes.map(async (m): Promise<{ list: MailSummary[]; more: boolean }> => {
      if (!q) {
        const mirrored = await mirrorList(m.address, opts).catch((e) => {
          console.error(`[Mail-Spiegel] ${m.address}:`, (e as Error).message);
          return null;
        });
        if (mirrored) return { list: mirrored.messages, more: mirrored.more };
      }
      try {
        const list = q ? await searchMessages(m.address, q, top) : await listMessages(m.address, opts);
        return { list, more: !q && list.length >= top };
      } catch (e) {
        console.error(`[Mail] ${m.address}:`, (e as Error).message);
        slow.push(m.address);
        const local = q ? await mirrorSearch(m.address, q, top).catch(() => [] as MailSummary[]) : [];
        return { list: local, more: false };
      }
    }));
    const lists = results.map((r) => r.list);
    let messages = lists.flat().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    // Beim Zusammenführen mehrerer Postfächer nur bis zum ältesten „vollständigen“ Zeitpunkt zeigen,
    // damit das Nachladen (before=…) keine Lücken erzeugt.
    if (!q && boxes.length > 1) {
      const cut = results.filter((r) => r.more && r.list.length).map((r) => r.list[r.list.length - 1].receivedAt).sort().pop();
      if (cut) messages = messages.filter((m) => m.receivedAt >= cut);
    }
    rememberContacts(user.email, messages);
    const more = !q && results.some((r) => r.more);
    return NextResponse.json({ success: true, messages, more, slow });
  } catch (e) {
    return fail(e);
  }
}
