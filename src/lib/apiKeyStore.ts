/**
 * apiKeyStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Verwaltung von API-Keys für den externen Zugriff (MCP-Server, Integrationen).
 * Der Klartext-Key wird NUR bei der Erstellung zurückgegeben; gespeichert wird
 * ausschließlich der SHA-256-Hash. Läuft über die Backend-Abstraktion `dbq`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createHash, randomBytes } from 'crypto';
import { dbGet, dbAll, dbRun } from './dbq';
import './database';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  created_by: string;
  last_used_at: string | null;
  revoked: number;
  /** 'all' oder Komma-Liste von MCP-Tool-Gruppen (content, bookings, customers, offers, tasks). */
  scopes: string;
}

/** Scope-String normalisieren: leere/ungültige Eingabe → 'all'. */
export function normalizeScopes(raw: unknown, validGroups: readonly string[]): string {
  if (raw === 'all' || raw === undefined || raw === null || raw === '') return 'all';
  const parts = String(Array.isArray(raw) ? raw.join(',') : raw)
    .split(',').map((x) => x.trim()).filter((x) => validGroups.includes(x));
  return parts.length ? Array.from(new Set(parts)).join(',') : 'all';
}

const PREFIX = 'ftk_';

function hashKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/** Erzeugt einen neuen Key. Gibt den Klartext NUR EINMAL zurück. */
export async function createApiKey(name: string, createdBy?: string, scopes = 'all'): Promise<{ key: ApiKey; plaintext: string }> {
  const id = crypto.randomUUID();
  const secret = randomBytes(24).toString('hex'); // 48 hex chars
  const plaintext = `${PREFIX}${secret}`;
  const key_prefix = plaintext.slice(0, 12); // z.B. "ftk_1a2b3c4d"
  const key_hash = hashKey(plaintext);
  await dbRun(
    `INSERT INTO api_keys (id, name, key_prefix, key_hash, created_by, scopes) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, (name || '').trim() || 'Unbenannt', key_prefix, key_hash, createdBy || '', scopes || 'all'],
  );
  const key = (await dbGet<ApiKey>(
    `SELECT id, name, key_prefix, created_at, created_by, last_used_at, revoked, scopes FROM api_keys WHERE id = ?`,
    [id],
  ))!;
  return { key, plaintext };
}

export async function listApiKeys(): Promise<ApiKey[]> {
  return dbAll<ApiKey>(
    `SELECT id, name, key_prefix, created_at, created_by, last_used_at, revoked, scopes FROM api_keys ORDER BY created_at DESC`,
  );
}

export async function updateApiKeyScopes(id: string, scopes: string): Promise<boolean> {
  return (await dbRun(`UPDATE api_keys SET scopes = ? WHERE id = ?`, [scopes || 'all', id])).changes > 0;
}

export async function revokeApiKey(id: string): Promise<boolean> {
  return (await dbRun(`UPDATE api_keys SET revoked = 1 WHERE id = ?`, [id])).changes > 0;
}

export async function deleteApiKey(id: string): Promise<boolean> {
  return (await dbRun(`DELETE FROM api_keys WHERE id = ?`, [id])).changes > 0;
}

/**
 * Prüft einen Klartext-Key. Liefert den Datensatz bei gültigem, nicht widerrufenem
 * Key (und aktualisiert last_used_at), sonst null.
 */
export async function verifyApiKey(plaintext: string | null | undefined): Promise<ApiKey | null> {
  if (!plaintext || !plaintext.startsWith(PREFIX)) return null;
  const key_hash = hashKey(plaintext.trim());
  const row = await dbGet<ApiKey>(
    `SELECT id, name, key_prefix, created_at, created_by, last_used_at, revoked, scopes FROM api_keys WHERE key_hash = ?`,
    [key_hash],
  );
  if (!row || row.revoked) return null;
  await dbRun(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`, [row.id]).catch(() => {});
  return row;
}

/** Extrahiert den Key aus dem Request (Authorization: Bearer … ODER x-api-key). */
export function extractApiKey(req: Request): string | null {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return m[1].trim();
  const x = req.headers.get('x-api-key');
  return x ? x.trim() : null;
}
