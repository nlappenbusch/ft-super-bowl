import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes, HttpError } from '@/lib/mailbox/api';
import { getMessage, conversationMessages, updateMessage, moveMessage } from '@/lib/mailbox/graph';
import { mirrorThread, mirrorPatch, mirrorRemove } from '@/lib/mailbox/mirror';

/** Verlauf live; hängt Microsoft, kommt er aus dem Spiegel. */
const threadOf = (mb: string, cid: string) =>
  conversationMessages(mb, cid, THREAD_TIMING).catch(() => mirrorThread(mb, cid).catch(() => []));

export const dynamic = 'force-dynamic';

/**
 * GET ?mb=&id=[&cid=] — Mail vollständig + Verlauf (ordnerübergreifend, ohne Bodies). Markiert NICHT als gelesen.
 * Mit cid (conversationId aus der Liste) laufen Mail und Verlauf parallel statt nacheinander.
 * &thread=0 liefert nur die Mail; ?part=thread&cid= nur den Verlauf (der Client lädt ihn getrennt,
 * damit die Mail sofort erscheint). Der Verlauf ist Beiwerk: knappes Zeitlimit, bei Fehler leer.
 */
const DETAIL_TIMING = { timeoutMs: 12_000, deadlineMs: 20_000 };
const THREAD_TIMING = { timeoutMs: 6_000, deadlineMs: 9_000 };

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const user = await mailUser();
    const [mb] = await resolveMailboxes(user, sp.get('mb'));
    const id = sp.get('id');
    const cid = sp.get('cid') || '';
    if (sp.get('part') === 'thread') {
      if (!mb || !cid) throw new HttpError(400, 'mb und cid erforderlich');
      const thread = await threadOf(mb.address, cid);
      return NextResponse.json({ success: true, thread });
    }
    if (!mb || !id) throw new HttpError(400, 'mb und id erforderlich');
    const withThread = sp.get('thread') !== '0';
    const threadP = withThread && cid ? threadOf(mb.address, cid) : null;
    const message = await getMessage(mb.address, id, DETAIL_TIMING);
    const thread = !withThread ? [] : await (threadP ?? threadOf(mb.address, message.conversationId));
    return NextResponse.json({ success: true, message, thread });
  } catch (e) {
    return fail(e);
  }
}

/** PATCH { mb, id, isRead?, flagged?, done? } */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const user = await mailUser();
    const [mb] = await resolveMailboxes(user, body.mb);
    if (!mb || !body.id) throw new HttpError(400, 'mb und id erforderlich');
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [body.id];
    const patch = { isRead: body.isRead, flagged: body.flagged, done: body.done };
    await Promise.all(ids.map((id) => updateMessage(mb.address, id, patch)));
    await mirrorPatch(mb.address, ids, patch).catch((e) => console.warn('[Mail-Spiegel] patch:', (e as Error).message));
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail(e);
  }
}

/** POST { mb, id, action: 'move', destination: 'archive'|'deleteditems'|'inbox'|'junkemail'|<ordner-id> } */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = await mailUser();
    const [mb] = await resolveMailboxes(user, body.mb);
    if (!mb || !body.id) throw new HttpError(400, 'mb und id erforderlich');
    if (body.action !== 'move' || !body.destination) throw new HttpError(400, 'Unbekannte Aktion');
    const newId = await moveMessage(mb.address, body.id, String(body.destination));
    await mirrorRemove(mb.address, body.id).catch((e) => console.warn('[Mail-Spiegel] remove:', (e as Error).message));
    return NextResponse.json({ success: true, id: newId });
  } catch (e) {
    return fail(e);
  }
}
