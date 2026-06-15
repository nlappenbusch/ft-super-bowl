import { db } from './database';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getGraphCredentials } from './graphMailer';
import { cookies } from 'next/headers';

export const TIPPSPIEL_SESSION_COOKIE = 'ft_tippspiel_session';
const MAGIC_LINK_MAX_AGE = 30 * 60;
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

type TokenPayload = {
  email: string;
  purpose: 'magic-link' | 'session';
  exp: number;
  jti?: string;
};

function secret(): string {
  return process.env.AUTH_SECRET || getGraphCredentials().clientSecret || 'ft-dev-insecure-secret-bitte-AUTH_SECRET-setzen';
}

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signature(body: string): string {
  return Buffer.from(
    createHmac('sha256', secret()).update(body).digest()
  ).toString('base64url');
}

function createToken(email: string, purpose: TokenPayload['purpose'], maxAge: number, jti?: string): string {
  const body = encode(JSON.stringify({
    email: email.trim().toLowerCase(),
    purpose,
    exp: Math.floor(Date.now() / 1000) + maxAge,
    ...(jti ? { jti } : {}),
  } satisfies TokenPayload));
  return `${body}.${signature(body)}`;
}

export function createMagicLinkToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const jti = randomBytes(24).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + MAGIC_LINK_MAX_AGE;
  db.prepare(`DELETE FROM tippspiel_magic_tokens WHERE expires_at < ? OR used_at IS NOT NULL`).run(Math.floor(Date.now() / 1000));
  db.prepare(`INSERT INTO tippspiel_magic_tokens (id, email, expires_at) VALUES (?, ?, ?)`).run(jti, normalized, expiresAt);
  return createToken(normalized, 'magic-link', MAGIC_LINK_MAX_AGE, jti);
}

export function createTippspielSessionToken(email: string): string {
  return createToken(email, 'session', SESSION_MAX_AGE);
}

export function verifyTippspielToken(token: string | null | undefined, purpose: TokenPayload['purpose']): TokenPayload | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = Buffer.from(signature(body));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(decode(body)) as TokenPayload;
    if (payload.purpose !== purpose || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function consumeMagicLinkToken(token: string | null | undefined): TokenPayload | null {
  const payload = verifyTippspielToken(token, 'magic-link');
  if (!payload?.jti) return null;
  const result = db.prepare(`
    UPDATE tippspiel_magic_tokens SET used_at = ?
    WHERE id = ? AND email = ? AND used_at IS NULL AND expires_at >= ?
  `).run(Math.floor(Date.now() / 1000), payload.jti, payload.email, Math.floor(Date.now() / 1000));
  return result.changes === 1 ? payload : null;
}

export type TippspielUser = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  last_login_at: string;
};

export function upsertTippspielUser(email: string): TippspielUser {
  const normalized = email.trim().toLowerCase();
  const defaultName = normalized.split('@')[0].slice(0, 60);
  db.prepare(`
    INSERT INTO tippspiel_users (id, email, display_name, created_at, last_login_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(email) DO UPDATE SET last_login_at = datetime('now')
  `).run(crypto.randomUUID(), normalized, defaultName);
  return db.prepare(`SELECT id, email, display_name, created_at, last_login_at FROM tippspiel_users WHERE email = ?`).get(normalized) as TippspielUser;
}

export function getTippspielUserByEmail(email: string): TippspielUser | null {
  return (db.prepare(`SELECT id, email, display_name, created_at, last_login_at FROM tippspiel_users WHERE email = ?`).get(email) as TippspielUser | undefined) || null;
}

export async function getTippspielSession(): Promise<{ token: TokenPayload; user: TippspielUser } | null> {
  const jar = await cookies();
  const token = verifyTippspielToken(jar.get(TIPPSPIEL_SESSION_COOKIE)?.value, 'session');
  if (!token) return null;
  const user = getTippspielUserByEmail(token.email);
  return user ? { token, user } : null;
}
