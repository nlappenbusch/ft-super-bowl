/**
 * portalAuth.ts – Session fürs KUNDENPORTAL (getrennt vom Admin-Login).
 * Signiertes Cookie (HMAC-SHA256, Web Crypto → Edge + Node). Eigener Cookie-Name,
 * eigene Payload (Kunden-ID statt Admin-User). Nutzt dasselbe AUTH_SECRET.
 */

export const PORTAL_COOKIE = 'ft_portal';
export const PORTAL_MAX_AGE = 60 * 60 * 24 * 30; // 30 Tage

export interface PortalSession {
  cid: string;     // customers.id
  email: string;   // E-Mail, über die eingeloggt wurde
  iat: number;
  exp: number;
}

function secret(): string {
  return process.env.AUTH_SECRET || 'ft-dev-insecure-secret-bitte-AUTH_SECRET-setzen';
}

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlToBytes(str: string): Uint8Array {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createPortalToken(data: { cid: string; email: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: PortalSession = { ...data, iat: now, exp: now + PORTAL_MAX_AGE };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sigBuf = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(body) as BufferSource);
  return `${body}.${b64url(new Uint8Array(sigBuf))}`;
}

export async function verifyPortalToken(token?: string | null): Promise<PortalSession | null> {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), b64urlToBytes(sig) as BufferSource, new TextEncoder().encode(body) as BufferSource);
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as PortalSession;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.cid) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Secure-Cookie nur über HTTPS (LAN-http-Fallback). */
export function isSecureRequest(req: Request): boolean {
  try { if (new URL(req.url).protocol === 'https:') return true; } catch { /* ignore */ }
  return req.headers.get('x-forwarded-proto') === 'https';
}
