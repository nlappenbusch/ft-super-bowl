import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { listTriagedMails, syncInbox, MAIL_CATEGORIES } from '@/lib/workspace/mailTriage';
import { isWorkspaceAiConfigured, describeAiError } from '@/lib/workspace/claude';
import { isGraphConfigured, getMailbox } from '@/lib/graphMailer';

export const dynamic = 'force-dynamic';
export const maxDuration = 180;

/** GET ?status=offen|erledigt|ignoriert|alle — KI-sortierter Posteingang. */
export async function GET(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const status = new URL(req.url).searchParams.get('status') || 'offen';
  const rows = await listTriagedMails({ status, limit: 120 });
  return NextResponse.json({
    success: true,
    data: {
      mailbox: isGraphConfigured() ? getMailbox() : null,
      categories: MAIL_CATEGORIES,
      mails: rows.map((m) => ({ ...m, suggestion: undefined, has_suggestion: !!m.suggestion })),
    },
  });
}

/** POST { action: 'sync' } — neue Mails abholen und durch die KI einsortieren. */
export async function POST(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== 'sync') return NextResponse.json({ success: false, error: 'Unbekannte Aktion' }, { status: 400 });
  if (!isGraphConfigured()) return NextResponse.json({ success: false, error: 'Microsoft 365 ist nicht eingerichtet (Admin → E-Mail / M365).' }, { status: 503 });
  if (!isWorkspaceAiConfigured()) return NextResponse.json({ success: false, error: 'Kein Anthropic API-Key hinterlegt.' }, { status: 503 });
  try {
    const r = await syncInbox();
    return NextResponse.json({ success: true, data: r });
  } catch (e) {
    return NextResponse.json({ success: false, error: describeAiError(e) }, { status: 500 });
  }
}
