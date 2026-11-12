import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes } from '@/lib/mailbox/api';
import { listFolders, cachedFolders } from '@/lib/mailbox/graph';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/mailbox/folders?mb=<adresse>[&parent=<ordner-id>][&cache=1]
 * cache=1: nur der zuletzt gespeicherte Stand (sofort, ohne Microsoft; folders=null, wenn keiner da).
 * Live: hängt/scheitert Microsoft, kommt der gespeicherte Stand mit stale=true zurück.
 */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const user = await mailUser();
    const [mb] = await resolveMailboxes(user, sp.get('mb'));
    if (!mb) return NextResponse.json({ success: true, folders: [] });
    const parent = sp.get('parent') || undefined;
    if (sp.get('cache') === '1') {
      const c = parent ? null : await cachedFolders(mb.address);
      return NextResponse.json({ success: true, folders: c?.folders ?? null, at: c?.at ?? null });
    }
    try {
      const folders = await listFolders(mb.address, parent);
      return NextResponse.json({ success: true, folders });
    } catch (e) {
      const c = parent ? null : await cachedFolders(mb.address);
      if (c) return NextResponse.json({ success: true, folders: c.folders, stale: true, at: c.at });
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}
