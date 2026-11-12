import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';
import { voicemailFetch } from '@/lib/voicemailBoard';

export const dynamic = 'force-dynamic';

/** POST /api/admin/voicemails/erledigt { key, erledigt, notiz } – vermerkt, wer sich gekümmert hat. */
export async function POST(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const key = typeof body.key === 'string' ? body.key : '';
  if (!key) return NextResponse.json({ success: false, error: 'key fehlt' }, { status: 400 });

  try {
    const r = await voicemailFetch('/api/erledigt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key,
        erledigt: !!body.erledigt,
        notiz: typeof body.notiz === 'string' ? body.notiz.slice(0, 500) : '',
        wer: session.name || session.email || 'unbekannt',
      }),
    });
    if (!r.ok) throw new Error(`Dienst antwortet ${r.status}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 502 });
  }
}
