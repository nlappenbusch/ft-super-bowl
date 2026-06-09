import { NextResponse } from 'next/server';
import { createSessionToken, localAdminPassword, isSecureRequest, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({ username: '', password: '' }));
  if (username === 'localadmin' && password && password === localAdminPassword()) {
    const token = await createSessionToken({ sub: 'localadmin', name: 'Local Admin', src: 'local' });
    const res = NextResponse.json({ success: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', secure: isSecureRequest(req), path: '/', maxAge: SESSION_MAX_AGE,
    });
    return res;
  }
  return NextResponse.json({ success: false, error: 'Falsche Zugangsdaten.' }, { status: 401 });
}
