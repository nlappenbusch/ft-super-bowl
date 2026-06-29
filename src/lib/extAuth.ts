/**
 * extAuth.ts — Authentifizierung der externen API (/api/ext/*) per API-Key.
 * Diese Routen liegen NICHT hinter der Session-Middleware (siehe middleware.ts:
 * matcher nur /admin + /api/admin), daher prüfen wir den Key hier in-route.
 */
import { NextResponse } from 'next/server';
import { verifyApiKey, extractApiKey, type ApiKey } from './apiKeyStore';

/**
 * Liefert entweder den gültigen Key-Datensatz oder eine fertige 401-Response.
 * Nutzung:
 *   const a = await apiKeyOr401(req); if ('res' in a) return a.res;
 *   …a.key…
 */
export async function apiKeyOr401(req: Request): Promise<{ key: ApiKey } | { res: NextResponse }> {
  const key = await verifyApiKey(extractApiKey(req));
  if (!key) {
    return { res: NextResponse.json({ success: false, error: 'Ungültiger oder fehlender API-Key' }, { status: 401 }) };
  }
  return { key };
}
