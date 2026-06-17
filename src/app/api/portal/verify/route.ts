import { NextResponse } from 'next/server';
import { consumeLoginToken } from '@/lib/portalStore';
import { createPortalToken, PORTAL_COOKIE, PORTAL_MAX_AGE, isSecureRequest } from '@/lib/portalAuth';

/**
 * GET /api/portal/verify?token=...
 * Löst den Magic-Link ein, setzt das Portal-Cookie und leitet ins Dashboard.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') || '';
  const fail = NextResponse.redirect(new URL('/portal?error=link', url.origin));

  const res = await consumeLoginToken(token).catch(() => null);
  if (!res) return fail;

  const jwt = await createPortalToken({ cid: res.customer_id, email: res.email });
  const redirect = NextResponse.redirect(new URL('/portal/app', url.origin));
  redirect.cookies.set(PORTAL_COOKIE, jwt, {
    httpOnly: true,
    secure: isSecureRequest(req),
    sameSite: 'lax',
    path: '/',
    maxAge: PORTAL_MAX_AGE,
  });
  return redirect;
}
