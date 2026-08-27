/**
 * presentation/store.ts – Persistenz der Präsentations-Decks (Tabelle `presentations`).
 * Folien und Metadaten liegen als JSON in der Zeile; gelesen/geschrieben wird immer
 * das ganze Deck (Decks sind klein, Konflikte damit ausgeschlossen).
 */
import '../database';
import { dbGet, dbAll, dbRun } from '../dbq';
import crypto from 'node:crypto';
import type { Deck, DeckLang, DeckListRow, DeckMeta, Slide } from './types';

interface DeckRow {
  id: string; created_at: string; updated_at: string; title: string; lang: string;
  status: string; share_token: string; share_enabled: number; meta: string; slides: string;
}

function parseDeck(row: DeckRow): Deck {
  let meta: DeckMeta = {};
  let slides: Slide[] = [];
  try { meta = row.meta ? JSON.parse(row.meta) : {}; } catch { meta = {}; }
  try { slides = row.slides ? JSON.parse(row.slides) : []; } catch { slides = []; }
  return {
    id: row.id,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(row.created_at).toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(row.updated_at).toISOString(),
    title: row.title,
    lang: (['de', 'en', 'fr'].includes(row.lang) ? row.lang : 'de') as DeckLang,
    status: row.status === 'final' ? 'final' : 'draft',
    share_token: row.share_token || '',
    share_enabled: !!row.share_enabled,
    meta,
    slides: Array.isArray(slides) ? slides : [],
  };
}

export function newSlideId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function newShareToken(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export async function createDeck(
  title: string, lang: DeckLang, meta: DeckMeta, slides: Slide[]
): Promise<string> {
  const id = crypto.randomUUID();
  await dbRun(
    `INSERT INTO presentations (id, title, lang, status, share_token, share_enabled, meta, slides)
     VALUES (?, ?, ?, 'draft', ?, 0, ?, ?)`,
    [id, title || 'Präsentation', lang, newShareToken(), JSON.stringify(meta || {}), JSON.stringify(slides || [])]
  );
  return id;
}

export async function listDecks(): Promise<DeckListRow[]> {
  const rows = await dbAll<DeckRow>(
    `SELECT id, created_at, updated_at, title, lang, status, share_token, share_enabled, meta, slides
     FROM presentations ORDER BY updated_at DESC`
  );
  return rows.map((r) => {
    const d = parseDeck(r);
    return {
      id: d.id, created_at: d.created_at, updated_at: d.updated_at, title: d.title,
      status: d.status, lang: d.lang, slide_count: d.slides.length,
      share_enabled: d.share_enabled, share_token: d.share_token,
    };
  });
}

export async function getDeck(id: string): Promise<Deck | null> {
  const row = await dbGet<DeckRow>(
    `SELECT id, created_at, updated_at, title, lang, status, share_token, share_enabled, meta, slides
     FROM presentations WHERE id = ?`, [id]
  );
  return row ? parseDeck(row) : null;
}

/** Öffentlicher Zugriff über den Teil-Link – nur wenn die Freigabe aktiv ist. */
export async function getDeckByToken(token: string): Promise<Deck | null> {
  if (!token || token.length < 8) return null;
  const row = await dbGet<DeckRow>(
    `SELECT id, created_at, updated_at, title, lang, status, share_token, share_enabled, meta, slides
     FROM presentations WHERE share_token = ?`, [token]
  );
  if (!row) return null;
  const deck = parseDeck(row);
  return deck.share_enabled ? deck : null;
}

export async function updateDeck(id: string, fields: {
  title?: string; lang?: DeckLang; status?: string; meta?: DeckMeta;
  slides?: Slide[]; share_enabled?: boolean; share_token?: string;
}): Promise<void> {
  const sets: string[] = []; const vals: unknown[] = [];
  if (fields.title !== undefined) { sets.push('title = ?'); vals.push(fields.title); }
  if (fields.lang !== undefined) { sets.push('lang = ?'); vals.push(fields.lang); }
  if (fields.status !== undefined) { sets.push('status = ?'); vals.push(fields.status); }
  if (fields.meta !== undefined) { sets.push('meta = ?'); vals.push(JSON.stringify(fields.meta)); }
  if (fields.slides !== undefined) { sets.push('slides = ?'); vals.push(JSON.stringify(fields.slides)); }
  if (fields.share_enabled !== undefined) { sets.push('share_enabled = ?'); vals.push(fields.share_enabled ? 1 : 0); }
  if (fields.share_token !== undefined) { sets.push('share_token = ?'); vals.push(fields.share_token); }
  if (!sets.length) return;
  sets.push("updated_at = datetime('now')");
  await dbRun(`UPDATE presentations SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
}

export async function deleteDeck(id: string): Promise<void> {
  await dbRun(`DELETE FROM presentations WHERE id = ?`, [id]);
}

/** Legt eine Kopie an (z.B. als Basis für eine andere Sprache oder einen anderen Kunden). */
export async function duplicateDeck(id: string, newTitle?: string): Promise<string | null> {
  const src = await getDeck(id);
  if (!src) return null;
  const slides = src.slides.map((s) => ({ ...s, id: newSlideId() }));
  return createDeck(newTitle || `${src.title} (Kopie)`, src.lang, src.meta, slides);
}
