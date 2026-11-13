/**
 * mailbox/graph.ts — Postfach-Operationen über Microsoft Graph (app-only),
 * IMMER mit explizitem Postfach. Zugriffsprüfung macht der Aufrufer (assertMailbox).
 */
import { graphRequest } from '../graphMailer';
import { hedged, isNetError } from './hedge';
import { loadMailState, saveMailState } from './prefs';

const enc = encodeURIComponent;
const base = (mb: string) => `/users/${enc(mb)}`;

export interface MailAddress { name: string; address: string }

export interface MailSummary {
  id: string;
  mailbox: string;
  conversationId: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  receivedAt: string;
  preview: string;
  isRead: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  importance: string;
  isDraft: boolean;
  folderId: string;
  categories: string[];
}

export interface MailAttachmentInfo {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  contentId: string;
}

export interface MailDetail extends MailSummary {
  cc: MailAddress[];
  bcc: MailAddress[];
  replyTo: MailAddress[];
  sentAt: string;
  bodyHtml: string;
  bodyIsHtml: boolean;
  internetMessageId: string;
  webLink: string;
  attachments: MailAttachmentInfo[];
}

export interface MailFolder {
  id: string;
  name: string;
  /** inbox | sentitems | drafts | deleteditems | archive | junkemail | '' */
  key: string;
  unread: number;
  total: number;
  childCount: number;
  parentId: string;
}

export const SUMMARY_SELECT = 'id,conversationId,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,flag,hasAttachments,importance,isDraft,parentFolderId,categories';

type GAddr = { emailAddress?: { name?: string; address?: string } };
export type GMsg = {
  id: string; conversationId?: string; subject?: string; from?: GAddr; sender?: GAddr;
  toRecipients?: GAddr[]; ccRecipients?: GAddr[]; bccRecipients?: GAddr[]; replyTo?: GAddr[];
  receivedDateTime?: string; sentDateTime?: string; bodyPreview?: string; isRead?: boolean;
  flag?: { flagStatus?: string }; hasAttachments?: boolean; importance?: string; isDraft?: boolean;
  parentFolderId?: string; categories?: string[]; body?: { contentType?: string; content?: string };
  internetMessageId?: string; webLink?: string;
};

const addr = (a?: GAddr): MailAddress => ({ name: a?.emailAddress?.name || '', address: (a?.emailAddress?.address || '').toLowerCase() });

export function toSummary(mb: string, m: GMsg): MailSummary {
  return {
    id: m.id,
    mailbox: mb,
    conversationId: m.conversationId || '',
    subject: m.subject || '',
    from: addr(m.from || m.sender),
    to: (m.toRecipients || []).map(addr),
    receivedAt: m.receivedDateTime || m.sentDateTime || '',
    preview: m.bodyPreview || '',
    isRead: !!m.isRead,
    flagged: m.flag?.flagStatus === 'flagged',
    hasAttachments: !!m.hasAttachments,
    importance: m.importance || 'normal',
    isDraft: !!m.isDraft,
    folderId: m.parentFolderId || '',
    categories: m.categories || [],
  };
}

export class GraphError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Vorübergehende Graph-/Exchange-Störungen (Drosselung, 5xx). */
const TRANSIENT = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GraphCallOptions {
  /** Zeitlimit je Versuch (Standard 15 s lesend, 60 s schreibend). */
  timeoutMs?: number;
  /** Gesamtbudget inkl. Wiederholungen (Standard 30 s). */
  deadlineMs?: number;
  /** Lesend: nach so vielen ms ohne Antwort parallel ein zweiter Aufruf (Standard 2,5 s, 0 = aus). */
  hedgeMs?: number;
}

/** Ab hier gilt ein lesender Aufruf als «hängt» (normal antwortet Graph in 0,2–1 s). */
const HEDGE_MS = 2_500;

/**
 * Graph-Aufruf mit JSON-Antwort. Lesende Aufrufe (GET) werden bei vorübergehenden Fehlern und
 * Zeitüberschreitung wiederholt, solange das Gesamtbudget reicht (Retry-After bzw. 0,8 s / 2 s).
 * Schreibende nie, sonst könnte z. B. eine Mail doppelt rausgehen. Einzelne Postfächer hängen bei
 * Exchange gelegentlich 20–60 s; das Zeitlimit verhindert, dass dann die ganze Ansicht wartet.
 * Zusätzlich läuft bei lesenden Aufrufen nach 2,5 s ohne Antwort ein zweiter gleicher Aufruf
 * (hedge.ts) — bei Exchange-Störungen hängen einzelne Anfragen, die Wiederholung kommt meist sofort.
 */
export async function gjson<T>(path: string, init?: RequestInit, o: GraphCallOptions = {}): Promise<T> {
  const idempotent = !init?.method || init.method.toUpperCase() === 'GET';
  const perTry = o.timeoutMs ?? (idempotent ? 15_000 : 60_000);
  const deadline = Date.now() + (o.deadlineMs ?? 30_000);
  const hedgeMs = idempotent ? (o.hedgeMs ?? HEDGE_MS) : 0;
  const left = () => Math.max(1000, Math.min(perTry, deadline - Date.now()));
  const attempt = async (): Promise<Response | null> => {
    if (hedgeMs > 0) {
      return hedged((signal) => graphRequest(path, { ...init, signal }), {
        hedgeMs, timeoutMs: left, transient: (s) => TRANSIENT.has(s),
      });
    }
    try {
      return await graphRequest(path, { ...init, signal: AbortSignal.timeout(left()) });
    } catch (e) {
      // Zeitüberschreitung oder Verbindungsfehler («fetch failed») → wie vorübergehender Fehler behandeln
      if (isNetError(e)) return null;
      throw e;
    }
  };
  let res = await attempt();
  for (let i = 0; idempotent && i < 2 && (!res || TRANSIENT.has(res.status)); i++) {
    const ra = res ? Number(res.headers.get('retry-after')) : 0;
    const wait = ra > 0 ? Math.min(ra, 10) * 1000 : res ? (i ? 2000 : 800) : 0;
    if (Date.now() + wait + 1000 > deadline) break;
    await sleep(wait);
    res = await attempt();
  }
  if (!res) throw new GraphError(504, 'Microsoft 365 antwortet nicht rechtzeitig (Zeitüberschreitung).');
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    let msg = t.slice(0, 300);
    try { msg = (JSON.parse(t) as { error?: { message?: string } }).error?.message || msg; } catch { /* roh */ }
    throw new GraphError(res.status, `Microsoft 365 (${res.status}): ${msg}`);
  }
  if (res.status === 202 || res.status === 204) return {} as T;
  const txt = await res.text();
  return (txt ? JSON.parse(txt) : {}) as T;
}

// ───────────────────────── Ordner ─────────────────────────

const WELL_KNOWN = ['inbox', 'sentitems', 'drafts', 'archive', 'deleteditems', 'junkemail'] as const;
/**
 * Zuordnung Ordner-ID → well-known Name (inbox …). Die IDs ändern sich praktisch nie, deshalb liegt
 * die Zuordnung dauerhaft in mail_prefs (übersteht Neustarts/Deploys) und wird nur wöchentlich im
 * Hintergrund aufgefrischt. Vorher kostete sie nach jedem Neustart 6 Graph-Aufrufe je Postfach —
 * und ein einziger hängender Aufruf hielt die ganze Ordnerliste auf.
 */
type WkState = { at: number; ids: Record<string, string> };
const wkKey = (mb: string) => `wellknown:${mb}`;
const WK_REFRESH_MS = 7 * 24 * 3600_000;
const wkCache = new Map<string, { until: number; ids: Record<string, string> }>();
const wkRunning = new Map<string, Promise<Record<string, string>>>();

async function fetchWellKnown(mb: string, prev: Record<string, string>): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  let complete = true;
  await Promise.all(WELL_KNOWN.map(async (k) => {
    try {
      const f = await gjson<{ id: string }>(`${base(mb)}/mailFolders/${k}?$select=id`, undefined, { timeoutMs: 8_000, deadlineMs: 15_000 });
      if (f.id) ids[f.id] = k;
    } catch (e) {
      // 404 = Ordner gibt es nicht (z. B. Archiv) — alles andere ist eine Störung
      if (!(e instanceof GraphError && e.status === 404)) complete = false;
    }
  }));
  if (complete) {
    wkCache.set(mb, { until: Date.now() + 3600_000, ids });
    await saveMailState<WkState>(wkKey(mb), { at: Date.now(), ids }).catch(() => {});
    return ids;
  }
  // Lückenhaft (Störung): nichts dauerhaft speichern, Bekanntes behalten, bald erneut versuchen
  const merged = { ...prev, ...ids };
  wkCache.set(mb, { until: Date.now() + 60_000, ids: merged });
  return merged;
}

function refreshWellKnown(mb: string, prev: Record<string, string>): Promise<Record<string, string>> {
  let p = wkRunning.get(mb);
  if (!p) {
    p = fetchWellKnown(mb, prev).finally(() => wkRunning.delete(mb));
    wkRunning.set(mb, p);
  }
  return p;
}

async function wellKnownIds(mailbox: string): Promise<Record<string, string>> {
  const mb = mailbox.toLowerCase();
  const c = wkCache.get(mb);
  if (c && Date.now() < c.until) return c.ids;
  const saved = await loadMailState<WkState>(wkKey(mb)).catch(() => null);
  if (saved?.ids && Object.keys(saved.ids).length) {
    wkCache.set(mb, { until: Date.now() + 3600_000, ids: saved.ids });
    if (Date.now() - (saved.at || 0) > WK_REFRESH_MS) void refreshWellKnown(mb, saved.ids).catch(() => {});
    return saved.ids;
  }
  return refreshWellKnown(mb, c?.ids || {});
}

type GFolder = { id: string; displayName: string; unreadItemCount?: number; totalItemCount?: number; childFolderCount?: number; parentFolderId?: string };

/** Letzte erfolgreich geladene Ordnerliste (oberste Ebene) je Postfach. */
type FolderState = { at: number; folders: MailFolder[] };
const foldersKey = (mb: string) => `folders:${mb.toLowerCase()}`;

/** Gespeicherter Stand der Ordnerliste — sofort verfügbar, auch wenn Microsoft gerade hängt. */
export async function cachedFolders(mb: string): Promise<FolderState | null> {
  const s = await loadMailState<FolderState>(foldersKey(mb)).catch(() => null);
  return s && Array.isArray(s.folders) ? s : null;
}

export async function listFolders(mb: string, parentId?: string): Promise<MailFolder[]> {
  const path = parentId
    ? `${base(mb)}/mailFolders/${enc(parentId)}/childFolders?$top=200`
    : `${base(mb)}/mailFolders?$top=200`;
  const [r, wk] = await Promise.all([gjson<{ value: GFolder[] }>(path), wellKnownIds(mb)]);
  const order = (k: string) => { const i = (WELL_KNOWN as readonly string[]).indexOf(k); return i < 0 ? 99 : i; };
  const folders = (r.value || [])
    .map((f) => ({
      id: f.id, name: f.displayName, key: wk[f.id] || '', unread: f.unreadItemCount || 0, total: f.totalItemCount || 0,
      childCount: f.childFolderCount || 0, parentId: f.parentFolderId || '',
    }))
    .filter((f) => !/^(Conversation History|Unterhaltungsverlauf|Sync Issues|Synchronisierungsprobleme|Outbox|Postausgang|RSS|Junk-E-Mail)$/i.test(f.name) || f.key)
    .sort((a, b) => order(a.key) - order(b.key) || a.name.localeCompare(b.name, 'de'));
  // Nur mit Posteingang speichern — fehlt er, war die Zuordnung lückenhaft (Störung)
  if (!parentId && folders.some((f) => f.key === 'inbox')) {
    void saveMailState<FolderState>(foldersKey(mb), { at: Date.now(), folders }).catch(() => {});
  }
  return folders;
}

// ───────────────────────── Listen & Suche ─────────────────────────

export interface ListOptions {
  folder?: string;       // Ordner-ID oder well-known Name (Standard inbox)
  before?: string;       // ISO-Zeit: nur ältere (Paging)
  unread?: boolean;
  flagged?: boolean;
  attachments?: boolean;
  top?: number;
  /** Zeitlimits (z. B. knapp in der Sammelansicht, damit ein hängendes Postfach nicht alle bremst). */
  timing?: GraphCallOptions;
}

export async function listMessages(mb: string, o: ListOptions = {}): Promise<MailSummary[]> {
  const folder = o.folder || 'inbox';
  const filters: string[] = [];
  if (o.before) filters.push(`receivedDateTime lt ${new Date(o.before).toISOString()}`);
  else filters.push(`receivedDateTime ge 1900-01-01T00:00:00Z`);
  if (o.unread) filters.push('isRead eq false');
  if (o.flagged) filters.push(`flag/flagStatus eq 'flagged'`);
  if (o.attachments) filters.push('hasAttachments eq true');
  const qs = new URLSearchParams({
    $top: String(Math.min(o.top || 40, 100)),
    $select: SUMMARY_SELECT,
    $orderby: 'receivedDateTime desc',
    $filter: filters.join(' and '),
  });
  const r = await gjson<{ value: GMsg[] }>(`${base(mb)}/mailFolders/${enc(folder)}/messages?${qs}`, undefined, o.timing);
  return (r.value || []).map((m) => toSummary(mb, m));
}

/**
 * Freitext → KQL für Graph $search. Deutsche Kürzel werden übersetzt:
 *   von:  an:  betreff:  anhang  (bzw. hat:anhang)  datei:x
 */
export function buildKql(q: string): string {
  let s = q.trim();
  s = s.replace(/\bvon:/gi, 'from:').replace(/\ban:/gi, 'to:').replace(/\bbetreff:/gi, 'subject:')
    .replace(/\bdatei:/gi, 'attachment:').replace(/\b(hat:)?anhang\b/gi, 'hasattachments:true');
  return s.replace(/"/g, '\\"');
}

export async function searchMessages(mb: string, q: string, top = 25): Promise<MailSummary[]> {
  const qs = new URLSearchParams({ $search: `"${buildKql(q)}"`, $top: String(Math.min(top, 50)), $select: SUMMARY_SELECT });
  // Zeitlimit: ein hängendes Postfach soll Suche und KI-Suche nicht minutenlang aufhalten.
  const r = await gjson<{ value: GMsg[] }>(`${base(mb)}/messages?${qs}`, { headers: { ConsistencyLevel: 'eventual' } }, { timeoutMs: 10_000, deadlineMs: 15_000 });
  return (r.value || []).map((m) => toSummary(mb, m)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
}

/** Alle Mails eines Verlaufs (ordnerübergreifend: Posteingang, Gesendet, Archiv …). */
export async function conversationMessages(mb: string, conversationId: string, timing?: GraphCallOptions): Promise<MailSummary[]> {
  if (!conversationId) return [];
  const qs = new URLSearchParams({
    $filter: `conversationId eq '${conversationId.replace(/'/g, "''")}'`,
    $select: SUMMARY_SELECT,
    $top: '50',
  });
  const r = await gjson<{ value: GMsg[] }>(`${base(mb)}/messages?${qs}`, undefined, timing);
  return (r.value || []).map((m) => toSummary(mb, m)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}

// ───────────────────────── Einzelne Mail ─────────────────────────

export async function getMessage(mb: string, id: string, timing?: GraphCallOptions): Promise<MailDetail> {
  const m = await gjson<GMsg>(
    `${base(mb)}/messages/${enc(id)}?$select=${SUMMARY_SELECT},ccRecipients,bccRecipients,replyTo,sentDateTime,body,internetMessageId,webLink,sender`,
    undefined, timing,
  );
  let attachments: MailAttachmentInfo[] = [];
  if (m.hasAttachments || /cid:/i.test(m.body?.content || '')) {
    const a = await gjson<{ value: Array<{ id: string; name?: string; contentType?: string; size?: number; isInline?: boolean; contentId?: string }> }>(
      `${base(mb)}/messages/${enc(id)}/attachments?$select=id,name,contentType,size,isInline`,
      undefined, timing,
    ).catch(() => ({ value: [] }));
    attachments = (a.value || []).map((x) => ({
      id: x.id, name: x.name || 'Anhang', contentType: x.contentType || 'application/octet-stream', size: x.size || 0,
      isInline: !!x.isInline, contentId: (x.contentId || '').replace(/^<|>$/g, ''),
    }));
  }
  const isHtml = (m.body?.contentType || '').toLowerCase() === 'html';
  let html = m.body?.content || '';
  // Inline-Bilder (cid:) über die eigene Anhang-Route ausliefern
  for (const att of attachments) {
    const url = `/api/admin/mailbox/attachment?mb=${enc(mb)}&id=${enc(id)}&att=${enc(att.id)}&inline=1`;
    if (att.contentId) html = html.split(`cid:${att.contentId}`).join(url);
    html = html.split(`cid:${att.name}`).join(url);
  }
  return {
    ...toSummary(mb, m),
    cc: (m.ccRecipients || []).map(addr),
    bcc: (m.bccRecipients || []).map(addr),
    replyTo: (m.replyTo || []).map(addr),
    sentAt: m.sentDateTime || '',
    bodyHtml: html,
    bodyIsHtml: isHtml,
    internetMessageId: m.internetMessageId || '',
    webLink: m.webLink || '',
    // Inline-Bilder, die im Text referenziert sind, nicht nochmal als Anhang zeigen
    attachments: attachments.filter((a) => !(a.isInline && a.contentId && (m.body?.content || '').includes(`cid:${a.contentId}`))),
  };
}

export async function getAttachmentBytes(mb: string, id: string, attId: string): Promise<{ bytes: ArrayBuffer; name: string; contentType: string }> {
  const meta = await gjson<{ name?: string; contentType?: string }>(
    `${base(mb)}/messages/${enc(id)}/attachments/${enc(attId)}?$select=name,contentType`,
  );
  const res = await graphRequest(`${base(mb)}/messages/${enc(id)}/attachments/${enc(attId)}/$value`);
  if (!res.ok) throw new GraphError(res.status, `Anhang nicht lesbar (${res.status})`);
  return { bytes: await res.arrayBuffer(), name: meta.name || 'Anhang', contentType: meta.contentType || 'application/octet-stream' };
}

export async function updateMessage(mb: string, id: string, patch: { isRead?: boolean; flagged?: boolean; done?: boolean; categories?: string[] }): Promise<void> {
  const body: Record<string, unknown> = {};
  if (typeof patch.isRead === 'boolean') body.isRead = patch.isRead;
  if (typeof patch.flagged === 'boolean') body.flag = { flagStatus: patch.flagged ? 'flagged' : 'notFlagged' };
  if (patch.done) body.flag = { flagStatus: 'complete' };
  if (patch.categories) body.categories = patch.categories;
  await gjson(`${base(mb)}/messages/${enc(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

/** Verschieben (Archiv, Gelöschte Elemente, beliebiger Ordner). Endgültiges Löschen gibt es bewusst nicht. */
export async function moveMessage(mb: string, id: string, destination: string): Promise<string> {
  const r = await gjson<{ id?: string }>(`${base(mb)}/messages/${enc(id)}/move`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ destinationId: destination }),
  });
  return r.id || id;
}

// ───────────────────────── Senden ─────────────────────────

export interface OutgoingAttachment {
  name: string; contentType: string; contentBytes: string;
  /** Eingebettetes Bild: im HTML per `cid:<contentId>` referenziert (nur kleine Dateien). */
  isInline?: boolean; contentId?: string;
}

export interface OutgoingMail {
  mailbox: string;
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  subject: string;
  html: string;
  attachments?: OutgoingAttachment[];
  /** Antwort/Weiterleitung auf eine Mail im selben Postfach (Verlauf + Zitat bleiben erhalten). */
  reference?: { messageId: string; mode: 'reply' | 'replyAll' | 'forward' };
  importance?: 'low' | 'normal' | 'high';
  /** Nur als Entwurf im Postfach ablegen (nicht senden). */
  draftOnly?: boolean;
}

const recips = (list?: MailAddress[]) => (list || []).filter((a) => a.address).map((a) => ({ emailAddress: { address: a.address, ...(a.name ? { name: a.name } : {}) } }));

/** Eigenen Text vor das Zitat setzen, das Graph beim createReply/Forward erzeugt. */
function prependToBody(existing: string, ours: string): string {
  const sep = '<div id="faltin-reply-sep" style="margin:16px 0 8px 0"></div>';
  const m = existing.match(/<body[^>]*>/i);
  if (!m) return `${ours}${sep}${existing}`;
  const i = (m.index || 0) + m[0].length;
  return existing.slice(0, i) + ours + sep + existing.slice(i);
}

const INLINE_LIMIT = Math.floor(2.5 * 1024 * 1024);
const CHUNK = 10 * 320 * 1024;

async function addAttachment(mb: string, draftId: string, a: OutgoingAttachment) {
  const raw = Buffer.from(a.contentBytes, 'base64');
  if (raw.length <= INLINE_LIMIT) {
    await gjson(`${base(mb)}/messages/${enc(draftId)}/attachments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        '@odata.type': '#microsoft.graph.fileAttachment', name: a.name, contentType: a.contentType, contentBytes: a.contentBytes,
        ...(a.isInline && a.contentId ? { isInline: true, contentId: a.contentId } : {}),
      }),
    });
    return;
  }
  const s = await gjson<{ uploadUrl?: string }>(`${base(mb)}/messages/${enc(draftId)}/attachments/createUploadSession`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ AttachmentItem: { attachmentType: 'file', name: a.name, size: raw.length } }),
  });
  if (!s.uploadUrl) throw new Error(`Upload für ${a.name} nicht möglich`);
  for (let start = 0; start < raw.length; start += CHUNK) {
    const end = Math.min(start + CHUNK, raw.length);
    const r = await fetch(s.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${start}-${end - 1}/${raw.length}` },
      body: new Uint8Array(raw.subarray(start, end)),
    });
    if (!r.ok) throw new Error(`Upload ${a.name}: ${r.status}`);
  }
}

// Exchange antwortet beim Schreiben gelegentlich mit 502/503/504 oder gar nicht. Wiederholt wird
// nur, was sich gefahrlos wiederholen lässt; der eigentliche Versand nur, wenn feststeht, dass er
// NICHT durchging (sonst bekäme der Kunde die Mail doppelt).
const WRITE_TIMING: GraphCallOptions = { timeoutMs: 40_000, deadlineMs: 45_000 };
const isTransient = (e: unknown) => e instanceof GraphError && TRANSIENT.has(e.status);

async function retryWrite<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (!isTransient(e) || i >= tries - 1) throw e;
      console.warn(`[Mail] ${label}: ${(e as Error).message.slice(0, 120)} – neuer Versuch`);
      await sleep(1500 * (i + 1));
    }
  }
}

/** Anhang anhängen; scheitert es vorübergehend, erst nachsehen, ob er trotzdem dran ist (nie doppelt). */
async function addAttachmentSafe(mb: string, draftId: string, a: OutgoingAttachment): Promise<void> {
  for (let i = 0; ; i++) {
    try { await addAttachment(mb, draftId, a); return; } catch (e) {
      if (!isTransient(e) || i >= 2) throw e;
      await sleep(1500 * (i + 1));
      const have = await gjson<{ value?: Array<{ name?: string }> }>(`${base(mb)}/messages/${enc(draftId)}/attachments?$select=name`)
        .catch(() => null);
      if (have?.value?.some((x) => x.name === a.name)) return;
    }
  }
}

/** Zustand eines Entwurfs nach einem gescheiterten /send: weg = gesendet, noch Entwurf = nicht gesendet. */
async function draftState(mb: string, id: string): Promise<'sent' | 'draft' | 'unknown'> {
  try {
    const m = await gjson<{ isDraft?: boolean }>(`${base(mb)}/messages/${enc(id)}?$select=isDraft`, undefined, { timeoutMs: 10_000, deadlineMs: 12_000 });
    return m.isDraft === false ? 'sent' : 'draft';
  } catch (e) {
    return e instanceof GraphError && e.status === 404 ? 'sent' : 'unknown';
  }
}

/** Versand eines fertigen Entwurfs, abgesichert gegen Doppel-Versand. */
async function sendDraft(mb: string, id: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await gjson(`${base(mb)}/messages/${enc(id)}/send`, { method: 'POST', body: '' }, WRITE_TIMING);
      return;
    } catch (e) {
      if (!isTransient(e)) throw e;
      console.warn(`[Mail] Senden ${mb}: ${(e as Error).message.slice(0, 120)} – prüfe, ob die Mail trotzdem raus ist`);
      // Exchange verschiebt gesendete Entwürfe mit etwas Verzögerung → bis zu ~15 s beobachten.
      let state: 'sent' | 'draft' | 'unknown' = 'unknown';
      for (let i = 0; i < 5; i++) {
        await sleep(3000);
        state = await draftState(mb, id);
        if (state === 'sent') return;
      }
      if (state === 'unknown') {
        throw new GraphError(502, 'Microsoft 365 hat beim Senden nicht geantwortet. Ob die Mail raus ist, ist unklar – bitte erst in «Gesendete Elemente» nachsehen, bevor du nochmals sendest.');
      }
      // Liegt nach 15 s immer noch als Entwurf da → ging nicht raus → genau ein neuer Versuch.
    }
  }
  throw new GraphError(502, 'Microsoft 365 hat den Versand wegen einer Störung zweimal abgelehnt. Die Mail wurde NICHT gesendet – bitte in ein paar Minuten nochmals senden.');
}

/** Mail senden (oder als Entwurf ablegen). Immer über einen Entwurf: so klappen Verlauf, Zitat und grosse Anhänge. */
export async function sendMessage(o: OutgoingMail): Promise<{ draftId: string; webLink: string; sent: boolean }> {
  const mb = o.mailbox;
  let draft: GMsg;
  if (o.reference) {
    const action = o.reference.mode === 'replyAll' ? 'createReplyAll' : o.reference.mode === 'forward' ? 'createForward' : 'createReply';
    draft = await retryWrite('Antwort-Entwurf', () => gjson<GMsg>(`${base(mb)}/messages/${enc(o.reference!.messageId)}/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }, WRITE_TIMING));
  } else {
    draft = await retryWrite('Entwurf', () => gjson<GMsg>(`${base(mb)}/messages`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: o.subject,
        body: { contentType: 'HTML', content: o.html },
        toRecipients: recips(o.to), ccRecipients: recips(o.cc), bccRecipients: recips(o.bcc),
        ...(o.importance ? { importance: o.importance } : {}),
      }),
    }, WRITE_TIMING));
  }
  try {
    if (o.reference) {
      const patch = JSON.stringify({
        subject: o.subject,
        body: { contentType: 'HTML', content: prependToBody(draft.body?.content || '', o.html) },
        toRecipients: recips(o.to), ccRecipients: recips(o.cc), bccRecipients: recips(o.bcc),
        ...(o.importance ? { importance: o.importance } : {}),
      });
      // PATCH setzt denselben Inhalt → gefahrlos wiederholbar
      await retryWrite('Entwurf füllen', () => gjson(`${base(mb)}/messages/${enc(draft.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: patch,
      }, WRITE_TIMING));
    }
    for (const a of o.attachments || []) await addAttachmentSafe(mb, draft.id, a);
  } catch (e) {
    // Halbfertigen Entwurf nicht liegen lassen (sonst sammeln sich Leichen in «Entwürfe»)
    await gjson(`${base(mb)}/messages/${enc(draft.id)}`, { method: 'DELETE' }, { timeoutMs: 10_000, deadlineMs: 12_000 }).catch(() => {});
    throw e;
  }
  if (o.draftOnly) {
    const d = await gjson<{ webLink?: string }>(`${base(mb)}/messages/${enc(draft.id)}?$select=webLink`).catch(() => ({ webLink: '' }));
    return { draftId: draft.id, webLink: d.webLink || '', sent: false };
  }
  await sendDraft(mb, draft.id);
  return { draftId: draft.id, webLink: '', sent: true };
}
