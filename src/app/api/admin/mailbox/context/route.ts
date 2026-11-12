import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes, HttpError } from '@/lib/mailbox/api';
import { getMessage } from '@/lib/mailbox/graph';
import { buildContext } from '@/lib/mailbox/context';

export const dynamic = 'force-dynamic';

/** GET ?mb=&id= — Kunde, Anfragen, Tickets und verwandte Mails zu einer Mail. */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const user = await mailUser();
    const all = await resolveMailboxes(user, 'all');
    const [mb] = await resolveMailboxes(user, sp.get('mb'));
    const id = sp.get('id');
    if (!mb || !id) throw new HttpError(400, 'mb und id erforderlich');
    const msg = await getMessage(mb.address, id);
    const context = await buildContext(msg, { mailboxes: all.filter((m) => m.canRead).map((m) => m.address) });
    return NextResponse.json({ success: true, context });
  } catch (e) {
    return fail(e);
  }
}
