/**
 * portalSession.ts – Zugriff auf die Kundenportal-Session in Route-Handlern /
 * Server-Komponenten (liest das ft_portal-Cookie).
 */
import { cookies } from 'next/headers';
import { verifyPortalToken, PORTAL_COOKIE, type PortalSession } from './portalAuth';

export async function getPortalSession(): Promise<PortalSession | null> {
  const jar = await cookies();
  return verifyPortalToken(jar.get(PORTAL_COOKIE)?.value);
}

/** Liest die Session aus einem Request (für Edge/Route ohne next/headers). */
export async function getPortalSessionFromRequest(req: Request): Promise<PortalSession | null> {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${PORTAL_COOKIE}=([^;]+)`));
  return verifyPortalToken(m ? decodeURIComponent(m[1]) : null);
}
