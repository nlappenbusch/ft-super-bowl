/**
 * apiGuard.ts – Session-Guard für sensible API-Routen AUSSERHALB von /api/admin.
 *
 * Die Middleware (src/middleware.ts) schützt nur /admin/* und /api/admin/*.
 * Routen wie /api/bookings (GET), /api/invoices oder /api/settings liegen
 * außerhalb und müssen selbst prüfen – sonst sind Kundendaten (PII),
 * Rechnungen und Secrets öffentlich abrufbar.
 *
 * Verwendung im Route-Handler (erste Zeile):
 *   const denied = await requireAdminSession();
 *   if (denied) return denied;
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { getSession } from './serverSession';
import { authSecret } from './auth';

/** 401-Response, wenn keine gültige Admin-Session vorliegt – sonst null. */
export async function requireAdminSession(): Promise<NextResponse | null> {
  if (await getSession()) return null;
  return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
}

export const INTERNAL_KEY_HEADER = 'x-internal-key';

/**
 * Schlüssel für interne Server-zu-Server-Loopback-Aufrufe (z.B. Portal →
 * Rechnungs-PDF). Aus AUTH_SECRET abgeleitet, damit kein zusätzliches
 * Secret gepflegt werden muss.
 */
export function internalApiKey(): string {
  return createHmac('sha256', authSecret()).update('ft-internal-api').digest('hex');
}

/** Trägt der Request den gültigen internen Loopback-Schlüssel? */
export function isInternalRequest(request: Request): boolean {
  const provided = request.headers.get(INTERNAL_KEY_HEADER) || '';
  const expected = internalApiKey();
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
