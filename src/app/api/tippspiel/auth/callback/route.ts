import { NextResponse } from 'next/server';
import { consumeMagicLinkToken, createTippspielSessionToken, TIPPSPIEL_SESSION_COOKIE, upsertTippspielUser } from '@/lib/tippspielAuth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payload = await consumeMagicLinkToken(url.searchParams.get('token'));
  if (!payload) {
    return NextResponse.redirect(new URL('/tippspiel?login=invalid', url.origin));
  }

  await upsertTippspielUser(payload.email);
  const joinCode = url.searchParams.get('join');
  const target = new URL('/tippspiel?login=success', url.origin);
  if (joinCode && /^[A-Za-z0-9_-]{6,40}$/.test(joinCode)) target.searchParams.set('join', joinCode);
  const response = NextResponse.redirect(target);
  response.cookies.set(TIPPSPIEL_SESSION_COOKIE, createTippspielSessionToken(payload.email), {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
