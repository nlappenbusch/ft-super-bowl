import { NextResponse } from 'next/server';
import { createMagicLinkToken } from '@/lib/tippspielAuth';
import { getLoginBaseUrl, isGraphConfigured, sendGraphMail } from '@/lib/graphMailer';

const requests = new Map<string, number>();

function validEmail(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (!validEmail(body.email)) {
    return NextResponse.json({ success: false, error: 'Bitte eine gültige E-Mail-Adresse eingeben.' }, { status: 400 });
  }
  if (!isGraphConfigured()) {
    return NextResponse.json({ success: false, error: 'Der Mailversand ist aktuell nicht konfiguriert.' }, { status: 503 });
  }
  const normalized = body.email.trim().toLowerCase();
  const joinCode = typeof body.joinCode === 'string' && /^[A-Za-z0-9_-]{6,40}$/.test(body.joinCode) ? body.joinCode : '';
  const lastRequest = requests.get(normalized) || 0;
  if (Date.now() - lastRequest < 60_000) {
    return NextResponse.json({ success: false, error: 'Bitte warte eine Minute, bevor du einen neuen Link anforderst.' }, { status: 429 });
  }

  const origin = getLoginBaseUrl() || process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
  const magicToken = await createMagicLinkToken(normalized);
  const link = `${origin}/api/tippspiel/auth/callback?token=${encodeURIComponent(magicToken)}${joinCode ? `&join=${encodeURIComponent(joinCode)}` : ''}`;
  const result = await sendGraphMail({
    to: normalized,
    subject: 'Dein Anmeldelink zum Faltin Travel WM-Tippspiel',
    html: `<!doctype html><html lang="de"><body style="margin:0;background:#eef1f5;font-family:Arial,sans-serif;color:#143047">
      <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
          <tr><td style="height:6px;background:#d9531e"></td></tr>
          <tr><td style="padding:36px">
            <h1 style="margin:0 0 14px;font-size:27px">Willkommen beim WM-Tippspiel 2026</h1>
            <p style="font-size:15px;line-height:1.6">Klicke auf den Button, um dein kostenloses Konto zu erstellen oder dich anzumelden.</p>
            <p style="margin:28px 0"><a href="${link}" style="display:inline-block;background:#d9531e;color:#fff;text-decoration:none;font-weight:bold;padding:14px 20px;border-radius:6px">Jetzt anmelden & tippen</a></p>
            <p style="font-size:12px;color:#6b7280">Der Link ist 30 Minuten gültig. Falls du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren.</p>
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>`,
  });

  if (!result.success) {
    return NextResponse.json({ success: false, error: 'Der Anmeldelink konnte nicht gesendet werden.' }, { status: 502 });
  }
  requests.set(normalized, Date.now());
  return NextResponse.json({ success: true });
}
