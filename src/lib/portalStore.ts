/**
 * portalStore.ts – Magic-Link-Login fürs Kundenportal.
 * Einmal-Token (im Klartext per Mail, gehasht in der DB) mit kurzer Gültigkeit.
 */
import './database';
import { dbGet, dbRun } from './dbq';
import crypto from 'node:crypto';

/** Gültigkeitsdauer eines Magic-Links. */
export const LOGIN_TOKEN_TTL_MIN = 30;

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex');
}

/** Erzeugt einen Einmal-Login-Token, speichert nur den Hash, liefert das Klartext-Token. */
export async function createLoginToken(customerId: string, email: string): Promise<string> {
  const raw = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + LOGIN_TOKEN_TTL_MIN * 60_000).toISOString();
  await dbRun(
    `INSERT INTO portal_login_tokens (token_hash, customer_id, email, expires_at, used) VALUES (?, ?, ?, ?, 0)`,
    [sha256(raw), customerId, email, expires]
  );
  return raw;
}

/** Löst einen Magic-Link ein (einmalig). Liefert {customer_id,email} oder null. */
export async function consumeLoginToken(raw: string): Promise<{ customer_id: string; email: string } | null> {
  if (!raw) return null;
  const row = await dbGet<{ token_hash: string; customer_id: string; email: string; expires_at: string; used: number }>(
    `SELECT token_hash, customer_id, email, expires_at, used FROM portal_login_tokens WHERE token_hash = ?`,
    [sha256(raw)]
  );
  if (!row) return null;
  if (Number(row.used) === 1) return null;
  const exp = new Date(row.expires_at).getTime();
  if (!exp || exp < Date.now()) return null;
  await dbRun(`UPDATE portal_login_tokens SET used = 1 WHERE token_hash = ?`, [sha256(raw)]);
  return { customer_id: row.customer_id, email: row.email };
}

/** Aufräumen abgelaufener/verbrauchter Tokens (best effort). */
export async function purgeExpiredLoginTokens(): Promise<void> {
  try {
    await dbRun(`DELETE FROM portal_login_tokens WHERE used = 1 OR expires_at < ?`, [new Date().toISOString()]);
  } catch { /* ignore */ }
}
