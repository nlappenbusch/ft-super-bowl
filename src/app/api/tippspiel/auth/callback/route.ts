import { NextResponse } from 'next/server';
import { consumeMagicLinkToken, createTippspielSessionToken, TIPPSPIEL_SESSION_COOKIE, upsertTippspielUser } from '@/lib/tippspielAuth';
import { getLoginBaseUrl } from '@/lib/graphMailer';

/** Öffentliche Basis-URL (hinter Reverse-Proxy NICHT aus req.url ableiten). */
function resolveBase(req: Request): string {
  const cfg = (getLoginBaseUrl() || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  if (cfg) return cfg;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`.replace(/\/+$/, '');
  try { return new URL(req.url).origin; } catch { return ''; }
}

export async function GET(request: Request) {
  const base = resolveBase(request);
  const url = new URL(request.url);
  const payload = await consumeMagicLinkToken(url.searchParams.get('token'));
  if (!payload) {
    return NextResponse.redirect(`${base}/tippspiel?login=invalid`);
  }

  await upsertTippspielUser(payload.email);
  const joinCode = url.searchParams.get('join');
  const target = new URL(`${base}/tippspiel?login=success`);
  if (joinCode && /^[A-Za-z0-9_-]{6,40}$/.test(joinCode)) target.searchParams.set('join', joinCode);
  const response = NextResponse.redirect(target);
  response.cookies.set(TIPPSPIEL_SESSION_COOKIE, createTippspielSessionToken(payload.email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: base.startsWith('https'),
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
