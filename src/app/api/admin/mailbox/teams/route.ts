import { NextResponse } from 'next/server';
import { mailUser, fail } from '@/lib/mailbox/api';
import { teamsStatus } from '@/lib/mailbox/teams';

export const dynamic = 'force-dynamic';

/** GET /api/admin/mailbox/teams?emails=a@x.ch,b@y.de — ist die Person in Teams erreichbar? */
export async function GET(req: Request) {
  try {
    await mailUser();
    const emails = (new URL(req.url).searchParams.get('emails') || '').split(',');
    return NextResponse.json({ success: true, people: await teamsStatus(emails) });
  } catch (e) {
    return fail(e);
  }
}
