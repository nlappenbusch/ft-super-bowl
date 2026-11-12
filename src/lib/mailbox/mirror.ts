/**
 * mailbox/mirror.ts — Spiegel der Postfächer in der eigenen DB (wie Outlooks OST, nur zentral).
 *
 * Warum: Einzelne Exchange-Postfächer hängen sporadisch 20–60 s. Liest die Liste live bei
 * Microsoft, hängt der Client mit. Aus dem Spiegel kommt sie sofort; ein Hänger verzögert
 * nur den Abgleich im Hintergrund.
 *
 * Was: NUR Kopfdaten (Betreff, Absender, Datum, Vorschau, Status) – ca. 1–2 KB je Mail.
 * Inhalte und Anhänge kommen weiter live beim Öffnen. Je Postfach einmal, nicht je Person;
 * wer was sehen darf, prüft weiter resolveMailboxes().
 *
 * Wie:
 *  - Ordner werden beim ersten Anzeigen registriert (mail_sync_folders) und danach per
 *    Graph-Delta abgeglichen (nur Änderungen, inkl. Löschungen). Posteingang alle 60 s,
 *    andere Ordner alle 3 min, plus sofort beim Anzeigen, wenn der Stand älter als 15 s ist.
 *  - Zeitfenster MIRROR_MONTHS (12 Monate). Ältere Mails liefert die Liste live nach.
 *  - Ordner, die 30 Tage niemand ansieht, fliegen samt Mails raus.
 *  - Je Postfach läuft höchstens eine Abgleich-Anfrage gleichzeitig (Graph drosselt ab 4).
 *  - Abschaltbar mit MAIL_MIRROR=off (dann alles live wie früher).
 */
import { sqlite, dbAll, dbGet, dbRun, withTx } from '../dbq';
import { pgEnabled } from '../pg';
import { ensureMailSchema } from './schema';
import { gjson, toSummary, listMessages, GraphError, SUMMARY_SELECT, type GMsg, type MailSummary, type GraphCallOptions } from './graph';

export const MIRROR_MONTHS = 12;
const INBOX_EVERY_MS = 60_000;
const OTHER_EVERY_MS = 180_000;
const FRESH_MS = 15_000;
const WAIT_FOR_FRESH_MS = 1_200;
const UNUSED_DROP_MS = 30 * 86_400_000;
const TOUCH_EVERY_MS = 5 * 60_000;
const ERROR_BACKOFF_MS = 60_000;
const PRUNE_EVERY_MS = 6 * 3_600_000;
const WELL_KNOWN = new Set(['inbox', 'sentitems', 'drafts', 'archive', 'deleteditems', 'junkemail']);

export const mirrorEnabled = () => (process.env.MAIL_MIRROR || '').toLowerCase() !== 'off';

type FolderRow = {
  mailbox: string; ref: string; real_id: string; link: string; since: string; ready: number; older: number;
  last_sync: string; last_used: string; error: string;
};
type MsgRow = {
  mailbox: string; id: string; ref: string; folder_id: string; conversation_id: string; subject: string;
  from_name: string; from_addr: string; to_json: string; received_at: string; preview: string;
  is_read: number; flagged: number; has_attachments: number; importance: string; is_draft: number; categories: string;
};

const nowIso = () => new Date().toISOString();
const ms = (iso: string) => Date.parse(iso || '') || 0;
const enc = encodeURIComponent;
const sleep = (t: number) => new Promise((r) => setTimeout(r, t));
const parseJson = <T>(s: string, d: T): T => { try { return JSON.parse(s) as T; } catch { return d; } };

function windowStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - MIRROR_MONTHS);
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function rowToSummary(r: MsgRow): MailSummary {
  return {
    id: r.id, mailbox: r.mailbox, conversationId: r.conversation_id, subject: r.subject,
    from: { name: r.from_name, address: r.from_addr },
    to: parseJson(r.to_json, []),
    receivedAt: r.received_at, preview: r.preview,
    isRead: !!Number(r.is_read), flagged: !!Number(r.flagged), hasAttachments: !!Number(r.has_attachments),
    importance: r.importance, isDraft: !!Number(r.is_draft), folderId: r.folder_id,
    categories: parseJson(r.categories, []),
  };
}

// ───────────────────────── Schreiben (gebündelt) ─────────────────────────

type Stmt = [string, unknown[]];

async function runBatch(stmts: Stmt[]): Promise<void> {
  if (!stmts.length) return;
  if (pgEnabled()) {
    await withTx(async (q) => { for (const [s, p] of stmts) await q.run(s, p); });
    return;
  }
  const tx = sqlite.transaction((list: Stmt[]) => { for (const [s, p] of list) sqlite.prepare(s).run(...(p as never[])); });
  tx(stmts);
}

const UPSERT = `INSERT INTO mail_sync_msgs
  (mailbox, id, ref, folder_id, conversation_id, subject, from_name, from_addr, to_json, received_at, preview,
   is_read, flagged, has_attachments, importance, is_draft, categories)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (mailbox, id) DO UPDATE SET
    ref = excluded.ref, folder_id = excluded.folder_id, conversation_id = excluded.conversation_id,
    subject = excluded.subject, from_name = excluded.from_name, from_addr = excluded.from_addr,
    to_json = excluded.to_json, received_at = excluded.received_at, preview = excluded.preview,
    is_read = excluded.is_read, flagged = excluded.flagged, has_attachments = excluded.has_attachments,
    importance = excluded.importance, is_draft = excluded.is_draft, categories = excluded.categories`;

function upsertStmt(ref: string, s: MailSummary): Stmt {
  return [UPSERT, [
    s.mailbox, s.id, ref, s.folderId, s.conversationId, s.subject.slice(0, 500), s.from.name.slice(0, 200), s.from.address,
    JSON.stringify(s.to.slice(0, 10)), s.receivedAt, s.preview.slice(0, 300),
    s.isRead ? 1 : 0, s.flagged ? 1 : 0, s.hasAttachments ? 1 : 0, s.importance, s.isDraft ? 1 : 0, JSON.stringify(s.categories),
  ]];
}

// ───────────────────────── Ordner-Verwaltung ─────────────────────────

const getFolder = (mb: string, ref: string) =>
  dbGet<FolderRow>('SELECT * FROM mail_sync_folders WHERE mailbox = ? AND ref = ?', [mb, ref]);

/** Ordner-ID einer well-known Mappe (inbox …) auf deren Namen abbilden, damit nichts doppelt gespiegelt wird. */
async function normalizeRef(mb: string, folder: string): Promise<string> {
  if (WELL_KNOWN.has(folder)) return folder;
  const r = await dbGet<{ ref: string }>('SELECT ref FROM mail_sync_folders WHERE mailbox = ? AND real_id = ? AND ref <> ?', [mb, folder, folder]);
  return r?.ref && WELL_KNOWN.has(r.ref) ? r.ref : folder;
}

const touched = new Map<string, number>();
async function touch(mb: string, ref: string): Promise<void> {
  const k = `${mb}|${ref}`;
  if (Date.now() - (touched.get(k) || 0) < TOUCH_EVERY_MS) return;
  touched.set(k, Date.now());
  await dbRun(
    `INSERT INTO mail_sync_folders (mailbox, ref, last_used) VALUES (?, ?, ?)
     ON CONFLICT (mailbox, ref) DO UPDATE SET last_used = excluded.last_used`,
    [mb, ref, nowIso()],
  );
}

// ───────────────────────── Abgleich ─────────────────────────

const running = new Map<string, Promise<void>>();
const errorUntil = new Map<string, number>();

/** Einen Ordner abgleichen (dedupliziert: läuft er schon, wird auf denselben Lauf gewartet). */
export function syncFolder(mb: string, ref: string): Promise<void> {
  const k = `${mb}|${ref}`;
  const cur = running.get(k);
  if (cur) return cur;
  const p = doSync(mb, ref).finally(() => running.delete(k));
  running.set(k, p);
  return p;
}

type DeltaPage = { value?: Array<GMsg & { '@removed'?: unknown }>; '@odata.nextLink'?: string; '@odata.deltaLink'?: string };

async function doSync(mb: string, ref: string): Promise<void> {
  const k = `${mb}|${ref}`;
  await ensureMailSchema();
  const f = await getFolder(mb, ref);
  if (!f) return; // nur registrierte Ordner
  let { link, since } = f;
  let ready = !!Number(f.ready);
  let realId = f.real_id;
  try {
    if (!link) {
      since = windowStart();
      const qs = new URLSearchParams({ $select: SUMMARY_SELECT, $filter: `receivedDateTime ge ${since}` });
      link = `/users/${enc(mb)}/mailFolders/${enc(ref)}/messages/delta?${qs}`;
      ready = false;
      await runBatch([
        ['DELETE FROM mail_sync_msgs WHERE mailbox = ? AND ref = ?', [mb, ref]],
        ['UPDATE mail_sync_folders SET link = ?, since = ?, ready = 0, error = ? WHERE mailbox = ? AND ref = ?', [link, since, '', mb, ref]],
      ]);
    }
    // Erstabgleich in Etappen (je Lauf max. 15 Seiten à 100), damit ein grosses Postfach den Takt nicht blockiert.
    const maxPages = ready ? 60 : 15;
    const timing: GraphCallOptions = { timeoutMs: 25_000, deadlineMs: 45_000 };
    let finished = false;
    for (let page = 0; page < maxPages; page++) {
      let r: DeltaPage;
      try {
        r = await gjson<DeltaPage>(link, { headers: { Prefer: 'odata.maxpagesize=100' } }, timing);
      } catch (e) {
        const st = e instanceof GraphError ? e.status : 0;
        if (st === 404) { await dropFolder(mb, ref); return; } // Ordner gibt es nicht mehr
        if (st === 410 || (st === 400 && ready)) { // Delta-Stand abgelaufen → neu aufbauen
          await dbRun('UPDATE mail_sync_folders SET link = ?, ready = 0 WHERE mailbox = ? AND ref = ?', ['', mb, ref]);
          return;
        }
        throw e;
      }
      const items = r.value || [];
      const stmts: Stmt[] = [];
      for (const it of items) {
        if (it['@removed']) stmts.push(['DELETE FROM mail_sync_msgs WHERE mailbox = ? AND id = ?', [mb, it.id]]);
        else {
          const s = toSummary(mb, it);
          if (!realId && s.folderId) realId = s.folderId;
          stmts.push(upsertStmt(ref, s));
        }
      }
      await runBatch(stmts);
      if (r['@odata.nextLink']) {
        link = r['@odata.nextLink'];
        // Im Erstabgleich Zwischenstand sichern: nach Neustart geht es dort weiter.
        if (!ready) await dbRun('UPDATE mail_sync_folders SET link = ?, real_id = ? WHERE mailbox = ? AND ref = ?', [link, realId, mb, ref]);
        continue;
      }
      if (r['@odata.deltaLink']) link = r['@odata.deltaLink'];
      finished = true;
      break;
    }
    if (!finished) return; // nächste Etappe im nächsten Takt
    let older = Number(f.older) || 0;
    if (!ready) {
      // Gibt es ältere Mails als das Fenster? Dann darf die Liste live «mehr laden».
      const o = await gjson<{ value?: unknown[] }>(
        `/users/${enc(mb)}/mailFolders/${enc(ref)}/messages?$top=1&$select=id&$filter=${enc(`receivedDateTime lt ${since}`)}`,
        undefined, { timeoutMs: 15_000, deadlineMs: 20_000 },
      ).catch(() => ({ value: [1] }));
      older = (o.value || []).length ? 1 : 0;
    }
    await dbRun(
      'UPDATE mail_sync_folders SET link = ?, real_id = ?, ready = 1, older = ?, last_sync = ?, error = ? WHERE mailbox = ? AND ref = ?',
      [link, realId, older, nowIso(), '', mb, ref],
    );
    if (!ready) console.log(`[Mail-Spiegel] ${mb}/${ref} erstmals abgeglichen`);
    errorUntil.delete(k);
  } catch (e) {
    errorUntil.set(k, Date.now() + ERROR_BACKOFF_MS);
    await dbRun('UPDATE mail_sync_folders SET error = ? WHERE mailbox = ? AND ref = ?', [(e as Error).message.slice(0, 300), mb, ref]).catch(() => {});
    throw e;
  }
}

async function dropFolder(mb: string, ref: string): Promise<void> {
  await runBatch([
    ['DELETE FROM mail_sync_msgs WHERE mailbox = ? AND ref = ?', [mb, ref]],
    ['DELETE FROM mail_sync_folders WHERE mailbox = ? AND ref = ?', [mb, ref]],
  ]);
}

let ticking = false;
let lastPrune = 0;

/** Hintergrund-Takt (instrumentation.ts, alle 30 s): fällige Ordner abgleichen, ab und zu aufräumen. */
export async function mirrorTick(): Promise<{ synced: number; errors: number }> {
  if (!mirrorEnabled() || ticking) return { synced: 0, errors: 0 };
  ticking = true;
  let synced = 0;
  let errors = 0;
  try {
    await ensureMailSchema();
    const now = Date.now();
    if (now - lastPrune > PRUNE_EVERY_MS) { lastPrune = now; await prune().catch((e) => console.error('[Mail-Spiegel] Aufräumen:', (e as Error).message)); }
    const rows = await dbAll<FolderRow>('SELECT * FROM mail_sync_folders');
    const due = rows.filter((f) => {
      if ((errorUntil.get(`${f.mailbox}|${f.ref}`) || 0) > now) return false;
      if (!Number(f.ready)) return true;
      return now - ms(f.last_sync) >= (f.ref === 'inbox' ? INBOX_EVERY_MS : OTHER_EVERY_MS);
    });
    const byMailbox = new Map<string, FolderRow[]>();
    for (const f of due) byMailbox.set(f.mailbox, [...(byMailbox.get(f.mailbox) || []), f]);
    const queue = [...byMailbox.values()];
    // 3 Postfächer parallel, je Postfach nacheinander (Graph-Drossel: max. 4 gleichzeitig je Postfach)
    await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
      for (let list = queue.shift(); list; list = queue.shift()) {
        for (const f of list) {
          try { await syncFolder(f.mailbox, f.ref); synced++; } catch (e) {
            errors++;
            console.warn(`[Mail-Spiegel] ${f.mailbox}/${f.ref}:`, (e as Error).message);
          }
        }
      }
    }));
  } finally {
    ticking = false;
  }
  return { synced, errors };
}

/** Ungenutzte Ordner entfernen, Fenster nachziehen (nur die letzten MIRROR_MONTHS behalten). */
async function prune(): Promise<void> {
  const stale = new Date(Date.now() - UNUSED_DROP_MS).toISOString();
  const old = await dbAll<{ mailbox: string; ref: string }>(
    `SELECT mailbox, ref FROM mail_sync_folders WHERE last_used < ?`, [stale],
  );
  for (const f of old) await dropFolder(f.mailbox, f.ref);
  const cut = windowStart();
  await runBatch([
    ['DELETE FROM mail_sync_msgs WHERE received_at < ?', [cut]],
    ['UPDATE mail_sync_folders SET since = ?, older = 1 WHERE ready = 1 AND since < ?', [cut, cut]],
  ]);
  if (old.length) console.log(`[Mail-Spiegel] ${old.length} ungenutzte Ordner entfernt`);
}

// ───────────────────────── Lesen ─────────────────────────

export interface MirrorListOptions {
  folder?: string; before?: string; unread?: boolean; flagged?: boolean; attachments?: boolean; top: number;
  /** Zeitlimits für das Live-Nachladen älterer Mails (jenseits des Fensters). */
  timing?: GraphCallOptions;
}

/**
 * Liste aus dem Spiegel. null = Ordner (noch) nicht gespiegelt → Aufrufer liest live.
 * Registriert den Ordner nebenbei und stösst einen Abgleich an, wenn der Stand älter als 15 s ist
 * (wartet darauf höchstens 1,2 s, sonst kommt der neue Stand mit der nächsten Aktualisierung).
 */
export async function mirrorList(mb: string, o: MirrorListOptions): Promise<{ messages: MailSummary[]; more: boolean } | null> {
  if (!mirrorEnabled()) return null;
  await ensureMailSchema();
  const ref = await normalizeRef(mb, o.folder || 'inbox');
  await touch(mb, ref);
  const f = await getFolder(mb, ref);
  if (!f || !Number(f.ready)) {
    if ((errorUntil.get(`${mb}|${ref}`) || 0) < Date.now()) void syncFolder(mb, ref).catch(() => {});
    return null;
  }
  if (Date.now() - ms(f.last_sync) > FRESH_MS && (errorUntil.get(`${mb}|${ref}`) || 0) < Date.now()) {
    await Promise.race([syncFolder(mb, ref).catch(() => {}), sleep(WAIT_FOR_FRESH_MS)]);
  }
  const where = ['mailbox = ?', 'ref = ?'];
  const params: unknown[] = [mb, ref];
  if (o.before) { where.push('received_at < ?'); params.push(new Date(o.before).toISOString().replace(/\.\d{3}Z$/, 'Z')); }
  if (o.unread) where.push('is_read = 0');
  if (o.flagged) where.push('flagged = 1');
  if (o.attachments) where.push('has_attachments = 1');
  const rows = await dbAll<MsgRow>(
    `SELECT * FROM mail_sync_msgs WHERE ${where.join(' AND ')} ORDER BY received_at DESC LIMIT ${Math.max(1, Math.min(o.top, 200))}`,
    params,
  );
  const messages = rows.map(rowToSummary);
  if (messages.length >= o.top) return { messages, more: true };
  if (!Number(f.older)) return { messages, more: false };
  // Fenster ausgeschöpft, aber es gibt ältere Mails: den Rest live holen.
  const from = messages.length ? messages[messages.length - 1].receivedAt : (o.before || f.since);
  const rest = o.top - messages.length;
  try {
    const live = await listMessages(mb, {
      folder: o.folder || 'inbox', before: from, unread: o.unread, flagged: o.flagged, attachments: o.attachments, top: rest, timing: o.timing,
    });
    const seen = new Set(messages.map((m) => m.id));
    const merged = [...messages, ...live.filter((m) => !seen.has(m.id))];
    if (!live.length && !o.unread && !o.flagged && !o.attachments) {
      await dbRun('UPDATE mail_sync_folders SET older = 0 WHERE mailbox = ? AND ref = ?', [mb, ref]).catch(() => {});
    }
    return { messages: merged, more: live.length >= rest };
  } catch {
    return { messages, more: true }; // Microsoft hängt: Gespiegeltes zeigen, «mehr laden» bleibt möglich
  }
}

/** Verlauf aus dem Spiegel (Ersatz, wenn Microsoft nicht antwortet; nur gespiegelte Ordner). */
export async function mirrorThread(mb: string, conversationId: string): Promise<MailSummary[]> {
  if (!mirrorEnabled() || !conversationId) return [];
  await ensureMailSchema();
  const rows = await dbAll<MsgRow>(
    'SELECT * FROM mail_sync_msgs WHERE mailbox = ? AND conversation_id = ? ORDER BY received_at ASC LIMIT 50',
    [mb, conversationId],
  );
  return rows.map(rowToSummary);
}

/** Einfache Suche im Spiegel (Betreff, Absender, Vorschau) – Ersatz, wenn die Microsoft-Suche hängt. */
export async function mirrorSearch(mb: string, q: string, top: number): Promise<MailSummary[]> {
  if (!mirrorEnabled()) return [];
  const terms = q.toLowerCase().replace(/\b(von|an|betreff|datei|from|to|subject):/g, ' ').replace(/["']/g, ' ')
    .split(/\s+/).filter((t) => t.length > 1 && !/^(hat:)?anhang$/.test(t)).slice(0, 5);
  if (!terms.length) return [];
  await ensureMailSchema();
  const where = ['mailbox = ?'];
  const params: unknown[] = [mb];
  for (const t of terms) {
    where.push('(lower(subject) LIKE ? OR lower(from_name) LIKE ? OR lower(from_addr) LIKE ? OR lower(preview) LIKE ?)');
    const like = `%${t.replace(/[%_]/g, '')}%`;
    params.push(like, like, like, like);
  }
  const rows = await dbAll<MsgRow>(
    `SELECT * FROM mail_sync_msgs WHERE ${where.join(' AND ')} ORDER BY received_at DESC LIMIT ${Math.max(1, Math.min(top, 50))}`,
    params,
  );
  return rows.map(rowToSummary);
}

// ───────────────────────── Durchschreiben (eigene Aktionen sofort sichtbar) ─────────────────────────

export async function mirrorPatch(mb: string, ids: string[], patch: { isRead?: boolean; flagged?: boolean; done?: boolean }): Promise<void> {
  if (!mirrorEnabled() || !ids.length) return;
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof patch.isRead === 'boolean') { sets.push('is_read = ?'); vals.push(patch.isRead ? 1 : 0); }
  if (typeof patch.flagged === 'boolean') { sets.push('flagged = ?'); vals.push(patch.flagged ? 1 : 0); }
  if (patch.done) { sets.push('flagged = ?'); vals.push(0); }
  if (!sets.length) return;
  await ensureMailSchema();
  await runBatch(ids.map((id) => [`UPDATE mail_sync_msgs SET ${sets.join(', ')} WHERE mailbox = ? AND id = ?`, [...vals, mb, id]] as Stmt));
}

/** Nach Verschieben/Löschen: aus dem Quellordner nehmen. Im Zielordner taucht sie mit dem nächsten Abgleich auf. */
export async function mirrorRemove(mb: string, id: string): Promise<void> {
  if (!mirrorEnabled()) return;
  await ensureMailSchema();
  await dbRun('DELETE FROM mail_sync_msgs WHERE mailbox = ? AND id = ?', [mb, id]);
}

/** Stand für die Diagnose (Admin). */
export async function mirrorStatus(): Promise<Array<{ mailbox: string; ref: string; ready: boolean; lastSync: string; error: string; count: number }>> {
  await ensureMailSchema();
  const rows = await dbAll<FolderRow & { n: number }>(
    `SELECT f.*, (SELECT COUNT(*) FROM mail_sync_msgs m WHERE m.mailbox = f.mailbox AND m.ref = f.ref) AS n
     FROM mail_sync_folders f ORDER BY f.mailbox, f.ref`,
  );
  return rows.map((r) => ({ mailbox: r.mailbox, ref: r.ref, ready: !!Number(r.ready), lastSync: r.last_sync, error: r.error, count: Number(r.n) }));
}
