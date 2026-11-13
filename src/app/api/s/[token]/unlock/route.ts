/**
 * POST /api/s/[token]/unlock { password } — schaltet einen passwortgeschützten Teil-Link frei
 * (setzt ein httpOnly-Cookie, das am Passwort-Hash hängt).
 */
import { NextResponse } from 'next/server';
import { getPublicShare, unlockCookieName, unlockCookieValue, verifySharePassword } from '@/lib/files/store';
import { isSecureRequest } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const key = `${ip}:${token}`;
  const a = attempts.get(key);
  if (a && a.n >= 8 && a.until > Date.now()) {
    return NextResponse.json({ success: false, error: 'Zu viele Versuche – bitte in 15 Minuten erneut' }, { status: 429 });
  }
  const r = await getPublicShare(token);
  if (!r || 'expired' in r) return NextResponse.json({ success: false, error: 'Link nicht verfügbar' }, { status: 404 });
  const { password } = await req.json().catch(() => ({})) as { password?: string };
  if (!verifySharePassword(String(password || ''), r.passwordHash)) {
    attempts.set(key, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 15 * 60_000 });
    return NextResponse.json({ success: false, error: 'Passwort falsch' }, { status: 401 });
  }
  attempts.delete(key);
  const res = NextResponse.json({ success: true });
  res.cookies.set(unlockCookieName(token), unlockCookieValue(token, r.passwordHash), {
    httpOnly: true, sameSite: 'lax', secure: isSecureRequest(req), path: '/', maxAge: 60 * 60 * 12,
  });
  return res;
}
