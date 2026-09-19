/**
 * workspace/store.ts — Datenzugriff des KI-Arbeitsplatzes (Chats, Dateien, Teamwissen).
 * Läuft über die Backend-Abstraktion `dbq` (SQLite ODER Postgres).
 */
import { dbGet, dbAll, dbRun, withTx } from '../dbq';
import { ensureWorkspaceSchema, nowIso } from './schema';

/* ── Chats ─────────────────────────────────────────────────────────────────── */

export interface Conversation {
  id: string;
  employee_id: string;
  title: string;
  /** Beim Anlegen eingefrorener System-Prompt (bleibt für den ganzen Verlauf gleich). */
  system_prompt: string;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface StoredMessage {
  id: string;
  conversation_id: string;
  seq: number;
  role: 'user' | 'assistant' | 'system';
  /** JSON-String der Anthropic-Content-Blöcke. */
  content: string;
  created_at: string;
}

export async function createConversation(employeeId: string, title: string, systemPrompt: string): Promise<Conversation> {
  await ensureWorkspaceSchema();
  const id = crypto.randomUUID();
  const now = nowIso();
  await dbRun(
    `INSERT INTO ws_conversations (id, employee_id, title, system_prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, employeeId, title.slice(0, 120), systemPrompt, now, now],
  );
  return (await getConversation(id))!;
}

export async function getConversation(id: string): Promise<Conversation | null> {
  await ensureWorkspaceSchema();
  return (await dbGet<Conversation>(`SELECT * FROM ws_conversations WHERE id = ?`, [id])) ?? null;
}

export async function listConversations(employeeId: string, limit = 40): Promise<Conversation[]> {
  await ensureWorkspaceSchema();
  return dbAll<Conversation>(
    `SELECT id, employee_id, title, '' AS system_prompt, archived, created_at, updated_at
     FROM ws_conversations WHERE employee_id = ? AND archived = 0 ORDER BY updated_at DESC LIMIT ?`,
    [employeeId, limit],
  );
}

export async function updateConversation(id: string, u: { title?: string; archived?: boolean }): Promise<void> {
  await ensureWorkspaceSchema();
  const cur = await getConversation(id);
  if (!cur) return;
  await dbRun(`UPDATE ws_conversations SET title = ?, archived = ?, updated_at = ? WHERE id = ?`, [
    (u.title ?? cur.title).slice(0, 120),
    u.archived === undefined ? cur.archived : u.archived ? 1 : 0,
    nowIso(),
    id,
  ]);
}

export async function touchConversation(id: string): Promise<void> {
  await dbRun(`UPDATE ws_conversations SET updated_at = ? WHERE id = ?`, [nowIso(), id]);
}

export async function deleteConversation(id: string): Promise<string[]> {
  await ensureWorkspaceSchema();
  const files = await dbAll<{ anthropic_file_id: string }>(
    `SELECT anthropic_file_id FROM ws_files WHERE conversation_id = ?`, [id],
  );
  await dbRun(`DELETE FROM ws_messages WHERE conversation_id = ?`, [id]);
  await dbRun(`DELETE FROM ws_files WHERE conversation_id = ?`, [id]);
  await dbRun(`DELETE FROM ws_conversations WHERE id = ?`, [id]);
  return files.map((f) => f.anthropic_file_id).filter(Boolean);
}

export async function listMessages(conversationId: string): Promise<StoredMessage[]> {
  await ensureWorkspaceSchema();
  return dbAll<StoredMessage>(
    `SELECT * FROM ws_messages WHERE conversation_id = ? ORDER BY seq ASC`, [conversationId],
  );
}

/**
 * Hängt Nachrichten an (append-only — frühere Einträge werden nie verändert).
 * Alle Nachrichten eines Aufrufs landen gemeinsam in einer Transaktion (z.B.
 * tool_use + tool_result), die Reihenfolge sichert ein eindeutiger Index.
 */
export async function appendMessages(
  conversationId: string,
  msgs: Array<{ role: 'user' | 'assistant' | 'system'; content: unknown }>,
): Promise<void> {
  if (!msgs.length) return;
  await ensureWorkspaceSchema();
  await withTx(async (q) => {
    const last = await q.get<{ m: number | null }>(
      `SELECT MAX(seq) AS m FROM ws_messages WHERE conversation_id = ?`, [conversationId],
    );
    let seq = (last?.m ?? 0) + 1;
    for (const m of msgs) {
      await q.run(
        `INSERT INTO ws_messages (id, conversation_id, seq, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), conversationId, seq++, m.role, JSON.stringify(m.content), nowIso()],
      );
    }
    await q.run(`UPDATE ws_conversations SET updated_at = ? WHERE id = ?`, [nowIso(), conversationId]);
  });
}

/* ── Dateien ───────────────────────────────────────────────────────────────── */

export interface WsFile {
  id: string;
  employee_id: string;
  conversation_id: string | null;
  filename: string;
  mime: string;
  size: number;
  source: 'upload' | 'sharepoint';
  source_ref: string;
  /** Wie die Datei an Claude geht: 'document' (PDF/Text), 'image' oder 'text' (extrahiert). */
  block_type: 'document' | 'image' | 'text';
  anthropic_file_id: string;
  created_at: string;
}

export async function addFile(f: Omit<WsFile, 'id' | 'created_at'> & { data_b64?: string }): Promise<WsFile> {
  await ensureWorkspaceSchema();
  const id = crypto.randomUUID();
  await dbRun(
    `INSERT INTO ws_files (id, employee_id, conversation_id, filename, mime, size, source, source_ref, block_type, anthropic_file_id, data_b64, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, f.employee_id, f.conversation_id, f.filename, f.mime, f.size, f.source, f.source_ref, f.block_type,
      f.anthropic_file_id, f.data_b64 || '', nowIso()],
  );
  return (await getFile(id))!;
}

const FILE_COLS = `id, employee_id, conversation_id, filename, mime, size, source, source_ref, block_type, anthropic_file_id, created_at`;

export async function getFile(id: string): Promise<WsFile | null> {
  await ensureWorkspaceSchema();
  return (await dbGet<WsFile>(`SELECT ${FILE_COLS} FROM ws_files WHERE id = ?`, [id])) ?? null;
}

export async function getFileData(id: string): Promise<{ filename: string; mime: string; data_b64: string } | null> {
  await ensureWorkspaceSchema();
  return (await dbGet<{ filename: string; mime: string; data_b64: string }>(
    `SELECT filename, mime, data_b64 FROM ws_files WHERE id = ?`, [id],
  )) ?? null;
}

export async function attachFileToConversation(id: string, conversationId: string): Promise<void> {
  await dbRun(`UPDATE ws_files SET conversation_id = ? WHERE id = ? AND conversation_id IS NULL`, [conversationId, id]);
}

/** Bereits aufbereitete Datei im SELBEN Chat finden (nie chatübergreifend — Löschen eines Chats löscht seine Dateien). */
export async function findFileBySourceRef(source: string, ref: string, conversationId: string): Promise<WsFile | null> {
  await ensureWorkspaceSchema();
  return (await dbGet<WsFile>(
    `SELECT ${FILE_COLS} FROM ws_files WHERE source = ? AND source_ref = ? AND conversation_id = ? ORDER BY created_at DESC LIMIT 1`,
    [source, ref, conversationId],
  )) ?? null;
}

/* ── Teamwissen ────────────────────────────────────────────────────────────── */

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string;
  source: string;
  pinned: number;
  uses: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export async function listKnowledge(): Promise<KnowledgeEntry[]> {
  await ensureWorkspaceSchema();
  return dbAll<KnowledgeEntry>(`SELECT * FROM ws_knowledge ORDER BY pinned DESC, updated_at DESC`);
}

export async function getKnowledge(id: string): Promise<KnowledgeEntry | null> {
  await ensureWorkspaceSchema();
  return (await dbGet<KnowledgeEntry>(`SELECT * FROM ws_knowledge WHERE id = ?`, [id])) ?? null;
}

export async function createKnowledge(input: {
  title: string; content: string; tags?: string; source?: string; pinned?: boolean;
  created_by: string; created_by_name: string;
}): Promise<KnowledgeEntry> {
  await ensureWorkspaceSchema();
  const id = crypto.randomUUID();
  const now = nowIso();
  await dbRun(
    `INSERT INTO ws_knowledge (id, title, content, tags, source, pinned, created_by, created_by_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.title.trim().slice(0, 200), input.content.trim(), normalizeTags(input.tags || ''), input.source || '',
      input.pinned ? 1 : 0, input.created_by, input.created_by_name, now, now],
  );
  return (await getKnowledge(id))!;
}

export async function updateKnowledge(id: string, u: { title?: string; content?: string; tags?: string; pinned?: boolean }): Promise<KnowledgeEntry | null> {
  const cur = await getKnowledge(id);
  if (!cur) return null;
  await dbRun(`UPDATE ws_knowledge SET title = ?, content = ?, tags = ?, pinned = ?, updated_at = ? WHERE id = ?`, [
    (u.title ?? cur.title).trim().slice(0, 200),
    (u.content ?? cur.content).trim(),
    u.tags === undefined ? cur.tags : normalizeTags(u.tags),
    u.pinned === undefined ? cur.pinned : u.pinned ? 1 : 0,
    nowIso(),
    id,
  ]);
  return getKnowledge(id);
}

export async function deleteKnowledge(id: string): Promise<boolean> {
  await ensureWorkspaceSchema();
  return (await dbRun(`DELETE FROM ws_knowledge WHERE id = ?`, [id])).changes > 0;
}

function normalizeTags(raw: string): string {
  return Array.from(new Set(raw.split(/[,;#]/).map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 12).join(', ');
}

/** Für Suche: Kleinbuchstaben, Umlaute vereinheitlicht, nur Wortzeichen. */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9@.\- ]+/g, ' ');
}

const STOPWORDS = new Set(['der', 'die', 'das', 'und', 'oder', 'ein', 'eine', 'ist', 'sind', 'wie', 'was', 'wer', 'mit', 'fuer', 'von', 'zu', 'im', 'in', 'am', 'an', 'auf', 'den', 'dem', 'des', 'es', 'ich', 'wir', 'sie', 'du', 'bei', 'nicht', 'auch', 'the', 'and']);

/** Einfache Stichwortsuche mit Gewichtung (Titel > Tags > Inhalt). Zählt Treffer als Nutzung. */
export async function searchKnowledge(query: string, limit = 6): Promise<KnowledgeEntry[]> {
  const all = await listKnowledge();
  const terms = normalizeForSearch(query).split(/\s+/).filter((t) => t.length > 2 && !STOPWORDS.has(t));
  if (!terms.length) return all.slice(0, limit);
  const scored = all.map((k) => {
    const title = normalizeForSearch(k.title);
    const tags = normalizeForSearch(k.tags);
    const content = normalizeForSearch(k.content);
    let score = 0;
    for (const t of terms) {
      if (title.includes(t)) score += 5;
      if (tags.includes(t)) score += 3;
      if (content.includes(t)) score += 1;
    }
    return { k, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  for (const { k } of scored) {
    await dbRun(`UPDATE ws_knowledge SET uses = uses + 1 WHERE id = ?`, [k.id]).catch(() => {});
  }
  return scored.map((x) => x.k);
}

export async function pinnedKnowledge(): Promise<KnowledgeEntry[]> {
  await ensureWorkspaceSchema();
  return dbAll<KnowledgeEntry>(`SELECT * FROM ws_knowledge WHERE pinned = 1 ORDER BY created_at ASC LIMIT 30`);
}

export async function listConversationFiles(conversationId: string): Promise<WsFile[]> {
  await ensureWorkspaceSchema();
  return dbAll<WsFile>(`SELECT ${FILE_COLS} FROM ws_files WHERE conversation_id = ?`, [conversationId]);
}

/* ── Entwurfs-Aktionen (damit gesendete Entwürfe nach dem Neuladen nicht erneut sendbar sind) ── */

export interface DraftAction { draft_id: string; conversation_id: string; action: 'sent' | 'outlook'; web_link: string; by_name: string; created_at: string }

export async function recordDraftAction(a: { draft_id: string; conversation_id: string; action: 'sent' | 'outlook'; web_link?: string; by_name: string }): Promise<void> {
  await ensureWorkspaceSchema();
  await dbRun(
    `INSERT OR IGNORE INTO ws_draft_actions (draft_id, conversation_id, action, web_link, by_name, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [a.draft_id, a.conversation_id, a.action, a.web_link || '', a.by_name, nowIso()],
  );
}

export async function listDraftActions(conversationId: string): Promise<DraftAction[]> {
  await ensureWorkspaceSchema();
  return dbAll<DraftAction>(`SELECT * FROM ws_draft_actions WHERE conversation_id = ?`, [conversationId]);
}
