import { NextResponse } from 'next/server';
import { mailUser, fail, HttpError } from '@/lib/mailbox/api';
import { mirrorStatus, mirrorEnabled } from '@/lib/mailbox/mirror';

export const dynamic = 'force-dynamic';

/** GET /api/admin/mailbox/mirror — Stand des Mail-Spiegels je Postfach/Ordner (nur Admins, Diagnose). */
export async function GET() {
  try {
    const user = await mailUser();
    if (!user.isAdmin) throw new HttpError(403, 'Nur für Admins');
    return NextResponse.json({ success: true, enabled: mirrorEnabled(), folders: await mirrorStatus() });
  } catch (e) {
    return fail(e);
  }
}
