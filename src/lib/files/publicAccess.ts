/**
 * files/publicAccess.ts — Zugriffsprüfung für öffentliche Teil-Links (/s/[token]).
 * Der Token ist die Berechtigung; bei Passwort zusätzlich das Freischalt-Cookie.
 */
import { cookies } from 'next/headers';
import { getPublicShare, isUnlocked, unlockCookieName, type FileShare } from './store';

export type PublicAccess =
  | { status: 'ok'; share: FileShare }
  | { status: 'locked'; share: FileShare }
  | { status: 'expired' }
  | { status: 'missing' };

export async function resolvePublicShare(token: string): Promise<PublicAccess> {
  const r = await getPublicShare(token);
  if (!r) return { status: 'missing' };
  if ('expired' in r) return { status: 'expired' };
  const jar = await cookies();
  const ok = isUnlocked(token, r.passwordHash, jar.get(unlockCookieName(token))?.value);
  return ok ? { status: 'ok', share: r.share } : { status: 'locked', share: r.share };
}
