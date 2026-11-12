import { NextResponse } from 'next/server';
import { mailUser, fail, signaturesFor } from '@/lib/mailbox/api';
import { mailboxesFor, allMailboxes, invalidateMailboxDirectory } from '@/lib/mailbox/access';
import { getPersonalPrefs, getGlobalMailConfig } from '@/lib/mailbox/prefs';
import { isWorkspaceAiConfigured } from '@/lib/workspace/claude';
import { listEmployees } from '@/lib/staffStore';

export const dynamic = 'force-dynamic';

/** GET /api/admin/mailbox/accounts — Postfächer, Signaturen, Einstellungen der angemeldeten Person. */
export async function GET(req: Request) {
  try {
    const user = await mailUser();
    if (new URL(req.url).searchParams.get('refresh') === '1') invalidateMailboxDirectory();
    const [{ mailboxes, warning }, prefs] = await Promise.all([mailboxesFor(user.email), getPersonalPrefs(user.email || 'local')]);
    const signatures = await signaturesFor(user, mailboxes);
    const employees = (await listEmployees(false).catch(() => [])).map((e) => ({ id: e.id, name: e.name, email: e.email }));
    const admin = user.isAdmin
      ? { global: await getGlobalMailConfig(), tenantMailboxes: await allMailboxes().catch(() => []) }
      : null;
    return NextResponse.json({
      success: true,
      user: { email: user.email, name: user.name, firstName: user.firstName, isAdmin: user.isAdmin, employeeId: user.employeeId },
      mailboxes,
      warning,
      signatures,
      prefs,
      employees,
      aiReady: isWorkspaceAiConfigured(),
      admin,
    });
  } catch (e) {
    return fail(e);
  }
}
