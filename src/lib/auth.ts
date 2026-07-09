/**
 * auth.ts – schlanke, abhängigkeitsfreie Session via signiertem Cookie (HMAC-SHA256).
 * Nutzt Web Crypto (crypto.subtle) → läuft sowohl in der Edge-Middleware als auch in
 * Node-Route-Handlern und Server Components.
 */

export const SESSION_COOKIE = 'ft_session';
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12h
export const OAUTH_STATE_COOKIE = 'ft_oauth_state';

export interface Session {
  sub: string;
  name: string;
  email?: string;
  src: 'microsoft' | 'local';
  iat: number;
  exp: number;
}

export function authSecret(): string {
  return process.env.AUTH_SECRET || 'ft-dev-insecure-secret-bitte-AUTH_SECRET-setzen';
}
const secret = authSecret;

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

export async function createSessionToken(data: { sub: string; name: string; email?: string; src: 'microsoft' | 'local' }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Session = { ...data, iat: now, exp: now + SESSION_MAX_AGE };
  const body = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sigBuf = await crypto.subtle.sign('HMAC', await hmacKey(), new TextEncoder().encode(body) as BufferSource);
  return `${body}.${b64url(new Uint8Array(sigBuf))}`;
}

export async function verifySessionToken(token?: string | null): Promise<Session | null> {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(), b64urlToBytes(sig) as BufferSource, new TextEncoder().encode(body) as BufferSource);
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body))) as Session;
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** localadmin-Fallback-Passwort (per Env überschreibbar). */
export function localAdminPassword(): string {
  return process.env.LOCAL_ADMIN_PASSWORD || 'faltin-localadmin-2026';
}

/** Secure-Cookie nur über HTTPS (sonst funktioniert Login über http-LAN nicht). */
export function isSecureRequest(req: Request): boolean {
  try { if (new URL(req.url).protocol === 'https:') return true; } catch { /* ignore */ }
  return req.headers.get('x-forwarded-proto') === 'https';
}

/** Decodiert den Payload eines (vom vertrauenswürdigen Token-Endpoint stammenden) JWT. */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(jwt.split('.')[1] || '')));
  } catch {
    return null;
  }
}
