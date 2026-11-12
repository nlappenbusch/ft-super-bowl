import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes } from '@/lib/mailbox/api';
import { listFolders } from '@/lib/mailbox/graph';

export const dynamic = 'force-dynamic';

/** GET /api/admin/mailbox/folders?mb=<adresse>[&parent=<ordner-id>] */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const user = await mailUser();
    const [mb] = await resolveMailboxes(user, sp.get('mb'));
    if (!mb) return NextResponse.json({ success: true, folders: [] });
    const folders = await listFolders(mb.address, sp.get('parent') || undefined);
    return NextResponse.json({ success: true, folders });
  } catch (e) {
    return fail(e);
  }
}
