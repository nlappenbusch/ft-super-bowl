import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { isMailHost } from '@/lib/mailHost';

/**
 * Schützt /admin, /api/admin, den KI-Arbeitsplatz /working-dashboard und den Mail-Client /mail.
 * Ohne gültige Session → Login (Seiten) bzw. 401 (API).
 * /admin/login und /api/auth/* bleiben offen.
 * Auf mail.faltintravel.com zeigt "/" direkt den Mail-Client.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const mailHost = isMailHost(req.headers.get('x-forwarded-host') || req.headers.get('host'));

  if (pathname === '/admin/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }
  // Öffentliche Startseite auf allen anderen Hosts
  if (pathname === '/' && !mailHost) return NextResponse.next();

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    if (pathname === '/' && mailHost) {
      const url = req.nextUrl.clone();
      url.pathname = '/mail';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = `?from=${encodeURIComponent(pathname === '/' ? '/mail' : pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/', '/mail/:path*', '/admin/:path*', '/api/admin/:path*', '/working-dashboard/:path*'],
};
