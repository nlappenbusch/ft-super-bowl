import { mailUser, fail, resolveMailboxes, HttpError } from '@/lib/mailbox/api';
import { getAttachmentBytes } from '@/lib/mailbox/graph';

export const dynamic = 'force-dynamic';

/** GET ?mb=&id=&att=[&inline=1] — Anhang herunterladen bzw. Inline-Bild ausliefern. */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const user = await mailUser();
    const [mb] = await resolveMailboxes(user, sp.get('mb'));
    const id = sp.get('id');
    const att = sp.get('att');
    if (!mb || !id || !att) throw new HttpError(400, 'mb, id und att erforderlich');
    const a = await getAttachmentBytes(mb.address, id, att);
    const inline = sp.get('inline') === '1' || sp.get('view') === '1';
    const safeName = a.name.replace(/[\r\n"]/g, '_');
    return new Response(a.bytes, {
      headers: {
        'Content-Type': a.contentType,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(a.name)}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        // Anhänge nie als aktive Seite ausführen
        'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch (e) {
    return fail(e);
  }
}
