import { NextResponse } from 'next/server';
import { mailUser, fail } from '@/lib/mailbox/api';
import { searchContacts } from '@/lib/mailbox/contacts';

export const dynamic = 'force-dynamic';

/** GET /api/admin/mailbox/contacts?q=… — Adressvorschläge (Kunden, Team, zuletzt). */
export async function GET(req: Request) {
  try {
    const user = await mailUser();
    const q = new URL(req.url).searchParams.get('q') || '';
    return NextResponse.json({ success: true, contacts: await searchContacts(user.email, q) });
  } catch (e) {
    return fail(e);
  }
}
