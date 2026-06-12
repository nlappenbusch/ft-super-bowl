import { NextResponse } from 'next/server';
import { OAUTH_STATE_COOKIE, isSecureRequest } from '@/lib/auth';
import { siteConfig } from '@/lib/siteConfig';
import { getGraphCredentials, getLoginBaseUrl } from '@/lib/graphMailer';

function resolveBase(req: Request): string {
  const admin = getLoginBaseUrl();
  if (admin) return admin;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`.replace(/\/+$/, '');
  return (process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url).replace(/\/+$/, '');
}

export async function GET(req: Request) {
  const { tenantId: tenant, clientId: client } = getGraphCredentials();
  const base = resolveBase(req);

  if (!tenant || !client) {
    return NextResponse.redirect(`${base}/admin/login?error=config`);
  }

  const redirectUri = `${base}/api/auth/microsoft/callback`;
  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: client,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid profile email',
    state,
    prompt: 'select_account',
  });

  const res = NextResponse.redirect(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`);
  res.cookies.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: isSecureRequest(req), path: '/', maxAge: 600 });
  return res;
}
