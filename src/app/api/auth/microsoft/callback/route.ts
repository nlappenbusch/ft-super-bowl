import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  createSessionToken, decodeJwtPayload, isSecureRequest,
  SESSION_COOKIE, SESSION_MAX_AGE, OAUTH_STATE_COOKIE,
} from '@/lib/auth';
import { siteConfig } from '@/lib/siteConfig';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const base = (process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url).replace(/\/+$/, '');
  const fail = (e: string) => NextResponse.redirect(`${base}/admin/login?error=${e}`);

  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value;
  if (!code || !state || !expected || state !== expected) return fail('state');

  const tenant = process.env.GRAPH_TENANT_ID;
  const client = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;
  if (!tenant || !client || !clientSecret) return fail('config');

  const redirectUri = `${base}/api/auth/microsoft/callback`;
  let tok: { id_token?: string; error_description?: string };
  try {
    const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: client, client_secret: clientSecret, grant_type: 'authorization_code',
        code, redirect_uri: redirectUri, scope: 'openid profile email',
      }),
    });
    tok = await r.json();
  } catch {
    return fail('token');
  }
  if (!tok.id_token) return fail('token');

  const payload = decodeJwtPayload(tok.id_token);
  if (!payload) return fail('token');
  // Tenant-Restriktion: nur Nutzer des konfigurierten Tenants (alle davon sind Admin)
  if (payload.tid && payload.tid !== tenant) return fail('tenant');

  const name = (payload.name as string) || (payload.preferred_username as string) || 'M365 Nutzer';
  const sub = (payload.oid as string) || (payload.sub as string) || name;
  const email = (payload.preferred_username as string) || (payload.email as string) || undefined;

  const token = await createSessionToken({ sub, name, email, src: 'microsoft' });
  const res = NextResponse.redirect(`${base}/admin`);
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isSecureRequest(req), path: '/', maxAge: SESSION_MAX_AGE });
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
