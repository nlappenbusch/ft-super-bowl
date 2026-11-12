import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes, HttpError } from '@/lib/mailbox/api';
import { getMessage, conversationMessages, updateMessage, moveMessage } from '@/lib/mailbox/graph';

export const dynamic = 'force-dynamic';

/** GET ?mb=&id= — Mail vollständig + Verlauf (ordnerübergreifend, ohne Bodies). Markiert NICHT automatisch als gelesen. */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const user = await mailUser();
    const [mb] = await resolveMailboxes(user, sp.get('mb'));
    const id = sp.get('id');
    if (!mb || !id) throw new HttpError(400, 'mb und id erforderlich');
    const message = await getMessage(mb.address, id);
    const thread = await conversationMessages(mb.address, message.conversationId).catch(() => []);
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
    await Promise.all(ids.map((id) => updateMessage(mb.address, id, { isRead: body.isRead, flagged: body.flagged, done: body.done })));
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
    return NextResponse.json({ success: true, id: newId });
  } catch (e) {
    return fail(e);
  }
}
