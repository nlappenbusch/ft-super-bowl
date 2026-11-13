import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken, SESSION_COOKIE } from '@/lib/auth';
import { isMailHost } from '@/lib/mailHost';
import { isFilesHost } from '@/lib/files/config';
import { isBelegeHost } from '@/lib/belege/config';

/**
 * Schützt /admin, /api/admin, den KI-Arbeitsplatz /working-dashboard und den Mail-Client /mail.
 * Ohne gültige Session → Login (Seiten) bzw. 401 (API).
 * /admin/login und /api/auth/* bleiben offen.
 * Auf mail.faltintravel.com zeigt "/" direkt den Mail-Client.
 * Auf files.faltintravel.com zeigt "/" direkt Faltin Files (/files); Teil-Links /s/* sind öffentlich.
 * Auf belege.faltintravel.com zeigt "/" direkt Faltin Belege (/belege).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const mailHost = isMailHost(host);
  const filesHost = isFilesHost(host);
  const belegeHost = isBelegeHost(host);

  if (pathname === '/admin/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }
  // Öffentliche Startseite auf allen anderen Hosts
  if (pathname === '/' && !mailHost && !filesHost && !belegeHost) return NextResponse.next();

  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) {
    if (pathname === '/' && mailHost) {
      const url = req.nextUrl.clone();
      url.pathname = '/mail';
      return NextResponse.redirect(url);
    }
    if (pathname === '/' && filesHost) {
      const url = req.nextUrl.clone();
      url.pathname = '/files';
      return NextResponse.rewrite(url);
    }
    if (pathname === '/' && belegeHost) {
      const url = req.nextUrl.clone();
      url.pathname = '/belege';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  url.search = `?from=${encodeURIComponent(pathname === '/' ? (filesHost ? '/files' : belegeHost ? '/belege' : '/mail') : pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/', '/mail/:path*', '/admin/:path*', '/api/admin/:path*', '/working-dashboard/:path*', '/files/:path*', '/belege/:path*'],
};
