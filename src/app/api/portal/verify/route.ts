import { NextResponse } from 'next/server';
import { consumeLoginToken } from '@/lib/portalStore';
import { createPortalToken, PORTAL_COOKIE, PORTAL_MAX_AGE } from '@/lib/portalAuth';
import { publicBaseUrl } from '@/lib/emailTemplates';

/** Öffentliche Basis-URL (hinter Reverse-Proxy NICHT aus req.url ableiten). */
function resolveBase(req: Request): string {
  const pub = publicBaseUrl();
  if (pub) return pub.replace(/\/+$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`.replace(/\/+$/, '');
  try { return new URL(req.url).origin; } catch { return ''; }
}

/**
 * GET /api/portal/verify?token=...
 * Löst den Magic-Link ein, setzt das Portal-Cookie und leitet ins Dashboard.
 */
export async function GET(req: Request) {
  const base = resolveBase(req);
  const token = new URL(req.url).searchParams.get('token') || '';
  const fail = NextResponse.redirect(`${base}/portal?error=link`);

  const res = await consumeLoginToken(token).catch(() => null);
  if (!res) return fail;

  const jwt = await createPortalToken({ cid: res.customer_id, email: res.email });
  const redirect = NextResponse.redirect(`${base}/portal/app`);
  redirect.cookies.set(PORTAL_COOKIE, jwt, {
    httpOnly: true,
    secure: base.startsWith('https'),
    sameSite: 'lax',
    path: '/',
    maxAge: PORTAL_MAX_AGE,
  });
  return redirect;
}
