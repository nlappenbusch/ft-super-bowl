import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { getTriagedMail, readMail, setMailStatus, MAIL_STATUSES } from '@/lib/workspace/mailTriage';

type Ctx = { params: Promise<{ id: string }> };

/** GET — Mail vollständig (Text) + KI-Einordnung + ggf. gespeicherter Antwortvorschlag. */
export async function GET(_req: Request, { params }: Ctx) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const { id } = await params;
  const [triage, mail] = await Promise.all([getTriagedMail(id), readMail(id)]);
  if (!triage && !mail) return NextResponse.json({ success: false, error: 'Mail nicht gefunden' }, { status: 404 });
  let suggestion = null;
  try { suggestion = triage?.suggestion ? JSON.parse(triage.suggestion) : null; } catch { suggestion = null; }
  return NextResponse.json({ success: true, data: { triage: triage ? { ...triage, suggestion: undefined } : null, mail, suggestion } });
}

/** PATCH { status } — erledigt / ignoriert / wieder offen (teamweit sichtbar). */
export async function PATCH(req: Request, { params }: Ctx) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string };
  const status = MAIL_STATUSES.find((s) => s === body.status);
  if (!status) return NextResponse.json({ success: false, error: 'status muss offen, erledigt oder ignoriert sein' }, { status: 400 });
  await setMailStatus(id, status, ws.personName);
  return NextResponse.json({ success: true });
}
