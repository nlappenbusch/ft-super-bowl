/**
 * files/store.ts — Faltin Files: Freigaben, Dateien, Ablauf und Aufräumen.
 * ─────────────────────────────────────────────────────────────────────────────
 * Eine Freigabe (fs_shares) bündelt 1..n Dateien (fs_items) unter EINEM Link
 * `/s/<token>`. Bytes liegen im persistenten Daten-Volume unter
 * `data/files/<shareId>/<itemId>` (nie im Webroot). Alle internen Nutzer:innen
 * sehen und verwalten alle Freigaben.
 *
 * Ablauf: `expires_at` (Standard 30 Tage). `runFilesCleanup()` (stündlich via
 * instrumentation.ts) löscht abgelaufene Freigaben inkl. Dateien endgültig und
 * räumt abgebrochene Uploads weg. Gelöschte Freigaben bleiben als Zeile (Protokoll)
 * ohne Dateien erhalten und werden nach 180 Tagen ganz entfernt.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs';
import path from 'path';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHmac } from 'crypto';
import { dbAll, dbGet, dbRun } from '../dbq';
import { authSecret } from '../auth';
import { ensureFilesSchema } from './schema';
import { FILES_DEFAULT_DAYS, FILES_MAX_DAYS, filesPublicBase } from './config';
import { cleanFileName, resolveExpiry as resolveExpiryPure } from './model';

export { cleanFileName };

function resolveExpiry(input: { days?: unknown; expires_at?: unknown }): string {
  return resolveExpiryPure(input, Date.now(), { defaultDays: FILES_DEFAULT_DAYS, maxDays: FILES_MAX_DAYS });
}


export const FILES_ROOT = path.join(process.cwd(), 'data', 'files');

const DAY_MS = 86_400_000;
const STALE_UPLOAD_MS = DAY_MS;
const PURGE_DELETED_MS = 180 * DAY_MS;

export interface FileItem {
  id: string;
  share_id: string;
  name: string;
  mime: string;
  size: number;
  received: number;
  complete: boolean;
  downloads: number;
  created_at: string;
}

export interface FileShare {
  id: string;
  token: string;
  title: string;
  message: string;
  created_by: string;
  created_by_name: string;
  created_by_email: string;
  has_password: boolean;
  expires_at: string;
  deleted_at: string | null;
  deleted_by: string;
  downloads: number;
  last_download_at: string | null;
  created_at: string;
  updated_at: string;
  url: string;
  items: FileItem[];
  total_size: number;
}

interface ShareRow {
  id: string; token: string; title: string; message: string;
  created_by: string; created_by_name: string; created_by_email: string;
  password_hash: string; expires_at: string; deleted_at: string | null; deleted_by: string;
  downloads: number; last_download_at: string | null; created_at: string; updated_at: string;
}
interface ItemRow {
  id: string; share_id: string; name: string; mime: string; size: number; received: number;
  complete: number; downloads: number; created_at: string;
}

export interface Actor { id: string; name: string; email?: string }

// ───────────────────────── Helfer ─────────────────────────

function nowIso(): string { return new Date().toISOString(); }

function toItem(r: ItemRow): FileItem {
  return { ...r, size: Number(r.size), received: Number(r.received), complete: !!Number(r.complete), downloads: Number(r.downloads) };
}

function toShare(r: ShareRow, items: ItemRow[]): FileShare {
  const its = items.map(toItem);
  const { password_hash, ...rest } = r;
  return {
    ...rest,
    downloads: Number(r.downloads),
    has_password: !!password_hash,
    url: `${filesPublicBase()}/s/${r.token}`,
    items: its,
    total_size: its.reduce((s, i) => s + i.size, 0),
  };
}

function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function checkPasswordHash(pw: string, stored: string): boolean {
  const [kind, saltB64, hashB64] = stored.split('$');
  if (kind !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const got = scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function shareDir(shareId: string): string {
  return path.join(FILES_ROOT, shareId.replace(/[^a-zA-Z0-9-]/g, ''));
}
export function itemPath(shareId: string, itemId: string): string {
  return path.join(shareDir(shareId), itemId.replace(/[^a-zA-Z0-9-]/g, ''));
}

function removeShareFiles(shareId: string): void {
  try { fs.rmSync(shareDir(shareId), { recursive: true, force: true }); } catch (e) {
    console.error('[files] Löschen der Dateien fehlgeschlagen:', shareId, e);
  }
}

/** Freier Platz im Daten-Volume (Bytes) oder null, wenn unbekannt. */
export function freeDiskBytes(): number | null {
  try {
    fs.mkdirSync(FILES_ROOT, { recursive: true });
    const s = fs.statfsSync(FILES_ROOT);
    return Number(s.bavail) * Number(s.bsize);
  } catch { return null; }
}

// ───────────────────────── Lesen ─────────────────────────

async function itemsFor(shareIds: string[]): Promise<ItemRow[]> {
  if (!shareIds.length) return [];
  const marks = shareIds.map(() => '?').join(',');
  return dbAll<ItemRow>(`SELECT * FROM fs_items WHERE share_id IN (${marks}) ORDER BY created_at, name`, shareIds);
}

/** Alle aktiven Freigaben (neueste zuerst); optional inkl. gelöschter (Protokoll). */
export async function listShares(opts: { includeDeleted?: boolean } = {}): Promise<FileShare[]> {
  await ensureFilesSchema();
  const rows = await dbAll<ShareRow>(
    opts.includeDeleted
      ? `SELECT * FROM fs_shares ORDER BY created_at DESC LIMIT 500`
      : `SELECT * FROM fs_shares WHERE deleted_at IS NULL ORDER BY created_at DESC`,
  );
  const items = await itemsFor(rows.map((r) => r.id));
  return rows.map((r) => toShare(r, items.filter((i) => i.share_id === r.id)));
}

export async function getShare(id: string): Promise<FileShare | null> {
  await ensureFilesSchema();
  const r = await dbGet<ShareRow>(`SELECT * FROM fs_shares WHERE id = ?`, [id]);
  if (!r) return null;
  return toShare(r, await itemsFor([r.id]));
}

/** Öffentlicher Zugriff: nur aktive, nicht abgelaufene Freigaben mit fertigen Dateien. */
export async function getPublicShare(token: string): Promise<{ share: FileShare; passwordHash: string } | { expired: true } | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token || '')) return null;
  await ensureFilesSchema();
  const r = await dbGet<ShareRow>(`SELECT * FROM fs_shares WHERE token = ?`, [token]);
  if (!r) return null;
  if (r.deleted_at || r.expires_at <= nowIso()) return { expired: true };
  const share = toShare(r, await itemsFor([r.id]));
  share.items = share.items.filter((i) => i.complete);
  share.total_size = share.items.reduce((s, i) => s + i.size, 0);
  return { share, passwordHash: r.password_hash };
}

export async function getItem(itemId: string): Promise<FileItem | null> {
  await ensureFilesSchema();
  const r = await dbGet<ItemRow>(`SELECT * FROM fs_items WHERE id = ?`, [itemId]);
  return r ? toItem(r) : null;
}

// ───────────────────────── Schreiben ─────────────────────────

export async function createShare(actor: Actor, input: { title?: string; message?: string; days?: unknown; expires_at?: unknown; password?: string }): Promise<FileShare> {
  await ensureFilesSchema();
  const id = randomUUID();
  const token = randomBytes(18).toString('base64url');
  const pw = (input.password || '').trim();
  await dbRun(
    `INSERT INTO fs_shares (id, token, title, message, created_by, created_by_name, created_by_email, password_hash, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, token, String(input.title || '').trim().slice(0, 200), String(input.message || '').trim().slice(0, 2000),
      actor.id, actor.name, actor.email || '', pw ? hashPassword(pw) : '', resolveExpiry(input), nowIso(), nowIso()],
  );
  fs.mkdirSync(shareDir(id), { recursive: true });
  return (await getShare(id))!;
}

export async function updateShare(id: string, input: {
  title?: string; message?: string; days?: unknown; extend_days?: unknown; expires_at?: unknown; password?: string | null;
}): Promise<FileShare | null> {
  const cur = await getShare(id);
  if (!cur || cur.deleted_at) return null;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof input.title === 'string') { sets.push('title = ?'); vals.push(input.title.trim().slice(0, 200)); }
  if (typeof input.message === 'string') { sets.push('message = ?'); vals.push(input.message.trim().slice(0, 2000)); }
  if (input.extend_days !== undefined) {
    // Verlängern ab dem späteren von "jetzt" und dem bisherigen Ablauf
    const base = Math.max(Date.now(), new Date(cur.expires_at).getTime());
    const days = Number(input.extend_days);
    const target = base + (Number.isFinite(days) && days > 0 ? days : FILES_DEFAULT_DAYS) * DAY_MS;
    sets.push('expires_at = ?');
    vals.push(resolveExpiry({ expires_at: new Date(target).toISOString() }));
  } else if (input.expires_at !== undefined || input.days !== undefined) {
    sets.push('expires_at = ?'); vals.push(resolveExpiry(input));
  }
  if (input.password === null || input.password === '') { sets.push('password_hash = ?'); vals.push(''); }
  else if (typeof input.password === 'string' && input.password.trim()) { sets.push('password_hash = ?'); vals.push(hashPassword(input.password.trim())); }
  if (!sets.length) return cur;
  sets.push('updated_at = ?'); vals.push(nowIso());
  await dbRun(`UPDATE fs_shares SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  return getShare(id);
}

/** Sofort löschen: Dateien weg, Zeile bleibt als Protokoll (deleted_at). */
export async function deleteShare(id: string, by: string): Promise<boolean> {
  await ensureFilesSchema();
  const r = await dbRun(`UPDATE fs_shares SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`, [nowIso(), by, nowIso(), id]);
  removeShareFiles(id);
  await dbRun(`DELETE FROM fs_items WHERE share_id = ?`, [id]);
  return r.changes > 0;
}

export async function addItem(shareId: string, input: { name: string; size: number; mime?: string }): Promise<FileItem> {
  await ensureFilesSchema();
  const id = randomUUID();
  await dbRun(
    `INSERT INTO fs_items (id, share_id, name, mime, size, received, complete, created_at) VALUES (?, ?, ?, ?, ?, 0, 0, ?)`,
    [id, shareId, cleanFileName(input.name), String(input.mime || 'application/octet-stream').slice(0, 150), Math.max(0, Math.floor(input.size)), nowIso()],
  );
  fs.mkdirSync(shareDir(shareId), { recursive: true });
  fs.writeFileSync(itemPath(shareId, id), '');
  if (input.size === 0) await dbRun(`UPDATE fs_items SET complete = 1 WHERE id = ?`, [id]);
  await dbRun(`UPDATE fs_shares SET updated_at = ? WHERE id = ?`, [nowIso(), shareId]);
  return (await getItem(id))!;
}

export async function setItemProgress(itemId: string, received: number, complete: boolean): Promise<void> {
  await dbRun(`UPDATE fs_items SET received = ?, complete = ? WHERE id = ?`, [received, complete ? 1 : 0, itemId]);
}

export async function deleteItem(itemId: string): Promise<boolean> {
  const it = await getItem(itemId);
  if (!it) return false;
  try { fs.rmSync(itemPath(it.share_id, it.id), { force: true }); } catch { /* egal */ }
  await dbRun(`DELETE FROM fs_items WHERE id = ?`, [itemId]);
  return true;
}

export async function countDownload(shareId: string, itemIds: string[]): Promise<void> {
  try {
    await dbRun(`UPDATE fs_shares SET downloads = downloads + 1, last_download_at = ? WHERE id = ?`, [nowIso(), shareId]);
    for (const id of itemIds) await dbRun(`UPDATE fs_items SET downloads = downloads + 1 WHERE id = ?`, [id]);
  } catch (e) { console.error('[files] Download-Zähler:', e); }
}

// ───────────────────────── Passwort-Freischaltung (Cookie) ─────────────────────────

export function unlockCookieName(token: string): string { return `ft_fs_${token.slice(0, 12)}`; }

/** Cookie-Wert hängt am Passwort-Hash → Passwortwechsel macht alte Freischaltungen ungültig. */
export function unlockCookieValue(token: string, passwordHash: string): string {
  return createHmac('sha256', authSecret()).update(`files-unlock:${token}:${passwordHash}`).digest('base64url');
}

export function isUnlocked(token: string, passwordHash: string, cookieValue: string | undefined): boolean {
  if (!passwordHash) return true;
  if (!cookieValue) return false;
  const a = Buffer.from(cookieValue);
  const b = Buffer.from(unlockCookieValue(token, passwordHash));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifySharePassword(pw: string, passwordHash: string): boolean {
  if (!passwordHash) return true;
  try { return checkPasswordHash(pw, passwordHash); } catch { return false; }
}

// ───────────────────────── Aufräumen ─────────────────────────

export interface CleanupResult { expired: number; staleItems: number; emptyShares: number; purged: number }

/** Abgelaufene Freigaben löschen, abgebrochene Uploads und alte Protokollzeilen entfernen. */
export async function runFilesCleanup(): Promise<CleanupResult> {
  await ensureFilesSchema();
  const now = nowIso();
  const res: CleanupResult = { expired: 0, staleItems: 0, emptyShares: 0, purged: 0 };

  const expired = await dbAll<{ id: string }>(`SELECT id FROM fs_shares WHERE deleted_at IS NULL AND expires_at <= ?`, [now]);
  for (const s of expired) { if (await deleteShare(s.id, 'Automatisch (abgelaufen)')) res.expired++; }

  const staleBefore = new Date(Date.now() - STALE_UPLOAD_MS).toISOString();
  const stale = await dbAll<{ id: string }>(`SELECT id FROM fs_items WHERE complete = 0 AND created_at < ?`, [staleBefore]);
  for (const it of stale) { if (await deleteItem(it.id)) res.staleItems++; }

  // Freigaben ohne eine einzige Datei (Upload nie zustande gekommen) nach 24 h entfernen
  const empty = await dbAll<{ id: string }>(
    `SELECT s.id FROM fs_shares s WHERE s.deleted_at IS NULL AND s.created_at < ?
       AND NOT EXISTS (SELECT 1 FROM fs_items i WHERE i.share_id = s.id)`, [staleBefore]);
  for (const s of empty) { if (await deleteShare(s.id, 'Automatisch (leer)')) res.emptyShares++; }

  const purgeBefore = new Date(Date.now() - PURGE_DELETED_MS).toISOString();
  const p = await dbRun(`DELETE FROM fs_shares WHERE deleted_at IS NOT NULL AND deleted_at < ?`, [purgeBefore]);
  res.purged = p.changes;

  // Verwaiste Ordner (z. B. nach manuellem DB-Eingriff) entfernen
  try {
    if (fs.existsSync(FILES_ROOT)) {
      const live = new Set((await dbAll<{ id: string }>(`SELECT id FROM fs_shares WHERE deleted_at IS NULL`)).map((r) => r.id));
      for (const d of fs.readdirSync(FILES_ROOT)) {
        if (!live.has(d)) {
          const st = fs.statSync(path.join(FILES_ROOT, d));
          if (Date.now() - st.mtimeMs > STALE_UPLOAD_MS) removeShareFiles(d);
        }
      }
    }
  } catch (e) { console.error('[files] Ordner-Abgleich:', e); }

  return res;
}
