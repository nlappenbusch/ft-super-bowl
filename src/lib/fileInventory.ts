/**
 * fileInventory.ts — Mediathek / Datei-Inventar (TASK-00120)
 * ─────────────────────────────────────────────────────────────────────────────
 * Sammelt ALLE auf dem Webserver gespeicherten Dateien aus den vier
 * unterschiedlichen Ablagen an einer Stelle, damit im Admin sichtbar ist,
 * wo eine Datei liegt und unter welcher URL sie erreichbar ist:
 *
 *   1. bild            public/uploads/media + übrige Bilder unter public/   (öffentlich)
 *   2. anhang          data/uploads/auto-reply  → öffentlich via /dokumente/<datei>
 *   3. kundendokument  DB-Tabelle customer_documents          (nur mit Login)
 *   4. aufgabe         DB-Tabelle task_attachments            (nur mit Login)
 *   5. nachricht       DB-Tabelle booking_message_attachments (nur mit Login)
 *
 * „usedIn" zeigt, wo die Datei verwendet wird (Event, Kunde, Aufgabe …).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import {
  autoReplyPublicPath,
  listAutoReplyFiles,
  autoReplyContentType,
} from './autoReplyStore';
import { listMediaLibrary } from './mediaLibrary';
import { getEvents, getPackages, getSeries } from './contentStore';
import { dbAll } from './dbq';

export type FileKind = 'bild' | 'anhang' | 'kundendokument' | 'aufgabe' | 'nachricht';

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  bild: 'Bilder',
  anhang: 'Anhänge (Auto-Antwort)',
  kundendokument: 'Kundendokumente',
  aufgabe: 'Aufgaben-Anhänge',
  nachricht: 'Mail-Anhänge (Buchungen)',
};

export interface InventoryUsage {
  label: string;
  href?: string;
}

export interface InventoryFile {
  /** Eindeutige ID innerhalb des Inventars */
  id: string;
  kind: FileKind;
  /** Anzeigename (Originalname, wenn bekannt) */
  name: string;
  /** Technischer Dateiname auf der Platte bzw. in der DB */
  fileName: string;
  mime: string;
  size: number;
  updatedAt: string;
  /** Ohne Login erreichbare URL – null, wenn die Datei nur intern abrufbar ist */
  publicUrl: string | null;
  /** URL zum Öffnen/Download (mit Admin-Session) */
  href: string;
  /** Ablageort in Klartext */
  storage: string;
  /** Wo die Datei verwendet wird */
  usedIn: InventoryUsage[];
  /** Datei ist in einem Datensatz referenziert, liegt aber nicht (mehr) auf der Platte */
  missing?: boolean;
  /** Datei liegt auf der Platte, wird aber nirgends verwendet */
  orphan?: boolean;
}

const IMAGE_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
};

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

function mimeForImage(name: string): string {
  return IMAGE_MIME[extOf(name)] || 'application/octet-stream';
}

/* ─── 1. Bilder (public/) ─────────────────────────────────────────────────── */

/** Index: Bild-URL → Verwendungsstellen in Events/Serien/Packages. */
function buildImageUsageIndex(): Map<string, InventoryUsage[]> {
  const index = new Map<string, InventoryUsage[]>();
  const add = (url: string, usage: InventoryUsage) => {
    if (!url || !url.startsWith('/')) return;
    const list = index.get(url) || [];
    if (!list.some((u) => u.label === usage.label)) list.push(usage);
    index.set(url, list);
  };

  // Bild-URLs aus einem beliebigen Datensatz einsammeln (rekursiv über alle Strings).
  const collect = (value: unknown, out: Set<string>) => {
    if (typeof value === 'string') {
      if (value.startsWith('/') && IMAGE_MIME[extOf(value)]) out.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => collect(v, out));
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach((v) => collect(v, out));
    }
  };

  try {
    for (const event of getEvents()) {
      const urls = new Set<string>();
      collect(event, urls);
      urls.forEach((u) => add(u, { label: `Event: ${event.title || event.name || event.slug}`, href: '/admin/events' }));
    }
  } catch { /* Content-Datei nicht lesbar – Index bleibt unvollständig */ }

  try {
    for (const series of getSeries()) {
      const urls = new Set<string>();
      collect(series, urls);
      urls.forEach((u) => add(u, { label: `Serie: ${series.title || series.slug}`, href: '/admin/series' }));
    }
  } catch { /* ignore */ }

  try {
    for (const pkg of getPackages()) {
      const urls = new Set<string>();
      collect(pkg, urls);
      urls.forEach((u) => add(u, { label: `Package: ${pkg.title || pkg.slug}`, href: '/admin/packages' }));
    }
  } catch { /* ignore */ }

  return index;
}

async function collectImages(): Promise<InventoryFile[]> {
  const usageIndex = buildImageUsageIndex();
  const items = await listMediaLibrary();
  return items.map((item) => {
    const usedIn = usageIndex.get(item.url) || [];
    return {
      id: `bild:${item.relativePath}`,
      kind: 'bild' as const,
      name: item.name,
      fileName: item.relativePath,
      mime: mimeForImage(item.name),
      size: item.size,
      updatedAt: item.updatedAt,
      publicUrl: item.url,
      href: item.url,
      storage: item.source === 'upload' ? 'public/uploads/media' : 'public/',
      usedIn,
      orphan: item.source === 'upload' && usedIn.length === 0,
    };
  });
}

/* ─── 2. Auto-Antwort-Anhänge (data/uploads/auto-reply) ───────────────────── */

interface AutoReplyRef {
  file: string;
  name?: string | null;
  usage: InventoryUsage;
}

/** Alle in Events referenzierten Auto-Antwort-Anhänge. */
function autoReplyReferences(): AutoReplyRef[] {
  const refs: AutoReplyRef[] = [];
  let events: ReturnType<typeof getEvents> = [];
  try {
    events = getEvents();
  } catch {
    return refs;
  }

  for (const event of events) {
    const usage: InventoryUsage = {
      label: `Event: ${event.title || event.name || event.slug} → Automatische Antwort`,
      href: '/admin/events',
    };
    const legacy = (event as { auto_reply_pdf?: string | null }).auto_reply_pdf;
    const legacyName = (event as { auto_reply_pdf_name?: string | null }).auto_reply_pdf_name;
    if (legacy) refs.push({ file: legacy, name: legacyName, usage });

    const list = (event as { auto_reply_pdfs?: Array<{ file: string; name?: string | null }> | null }).auto_reply_pdfs;
    if (Array.isArray(list)) {
      for (const entry of list) {
        if (entry?.file) refs.push({ file: entry.file, name: entry.name, usage });
      }
    }
  }
  return refs;
}

async function collectAutoReplyFiles(): Promise<InventoryFile[]> {
  const [stored, refs] = [await listAutoReplyFiles(), autoReplyReferences()];
  const byFile = new Map<string, AutoReplyRef[]>();
  for (const ref of refs) {
    const list = byFile.get(ref.file) || [];
    list.push(ref);
    byFile.set(ref.file, list);
  }

  const out: InventoryFile[] = stored.map((file) => {
    const usedRefs = byFile.get(file.file) || [];
    const usedIn: InventoryUsage[] = [];
    for (const ref of usedRefs) {
      if (!usedIn.some((u) => u.label === ref.usage.label)) usedIn.push(ref.usage);
    }
    return {
      id: `anhang:${file.file}`,
      kind: 'anhang' as const,
      name: usedRefs[0]?.name || file.file,
      fileName: file.file,
      mime: file.mime,
      size: file.size,
      updatedAt: file.updatedAt,
      publicUrl: autoReplyPublicPath(file.file),
      href: autoReplyPublicPath(file.file),
      storage: 'data/uploads/auto-reply',
      usedIn,
      orphan: usedIn.length === 0,
    };
  });

  // In Events referenziert, aber nicht (mehr) auf der Platte
  const storedNames = new Set(stored.map((f) => f.file));
  for (const [file, list] of byFile) {
    if (storedNames.has(file)) continue;
    out.push({
      id: `anhang:${file}`,
      kind: 'anhang',
      name: list[0]?.name || file,
      fileName: file,
      mime: autoReplyContentType(file),
      size: 0,
      updatedAt: '',
      publicUrl: null,
      href: autoReplyPublicPath(file),
      storage: 'data/uploads/auto-reply (Datei fehlt)',
      usedIn: list.map((r) => r.usage),
      missing: true,
    });
  }

  return out;
}

/* ─── 3.–5. Dateien in der Datenbank ──────────────────────────────────────── */

interface DbFileRow {
  id: string;
  filename: string;
  mime: string;
  size: number;
  created_at: string;
  ref_id: string | null;
  ref_label: string | null;
  extra: string | null;
}

async function collectCustomerDocuments(): Promise<InventoryFile[]> {
  const rows = await dbAll<DbFileRow>(
    `SELECT d.id, d.filename, d.mime, d.size, d.created_at,
            d.customer_id AS ref_id,
            COALESCE(NULLIF(c.name, ''), NULLIF(c.company, ''), d.customer_id) AS ref_label,
            d.title AS extra
       FROM customer_documents d
       LEFT JOIN customers c ON c.id = d.customer_id
      ORDER BY d.created_at DESC`
  ).catch(() => [] as DbFileRow[]);

  return rows.map((r) => ({
    id: `kundendokument:${r.id}`,
    kind: 'kundendokument' as const,
    name: r.extra || r.filename,
    fileName: r.filename,
    mime: r.mime || 'application/octet-stream',
    size: Number(r.size) || 0,
    updatedAt: r.created_at || '',
    publicUrl: null,
    href: `/api/admin/customers/${r.ref_id}/documents/${r.id}`,
    storage: 'Datenbank: customer_documents',
    usedIn: [{ label: `Kunde: ${r.ref_label || 'unbekannt'}`, href: r.ref_id ? `/admin/kunden/${r.ref_id}` : undefined }],
  }));
}

async function collectTaskAttachments(): Promise<InventoryFile[]> {
  const rows = await dbAll<DbFileRow>(
    `SELECT a.id, a.filename, a.mime, a.size, a.created_at,
            a.task_id AS ref_id,
            t.title AS ref_label,
            CAST(t.ticket_number AS TEXT) AS extra
       FROM task_attachments a
       LEFT JOIN staff_tasks t ON t.id = a.task_id
      ORDER BY a.created_at DESC`
  ).catch(() => [] as DbFileRow[]);

  return rows.map((r) => {
    const ticket = r.extra ? `TASK-${String(r.extra).padStart(5, '0')}` : null;
    return {
      id: `aufgabe:${r.id}`,
      kind: 'aufgabe' as const,
      name: r.filename,
      fileName: r.filename,
      mime: r.mime || 'application/octet-stream',
      size: Number(r.size) || 0,
      updatedAt: r.created_at || '',
      publicUrl: null,
      href: `/api/admin/tasks/${r.ref_id}/attachments?attId=${r.id}`,
      storage: 'Datenbank: task_attachments',
      usedIn: [
        {
          label: `Aufgabe: ${[ticket, r.ref_label].filter(Boolean).join(' · ') || 'unbekannt'}`,
          href: '/admin/aufgaben',
        },
      ],
    };
  });
}

async function collectMessageAttachments(): Promise<InventoryFile[]> {
  const rows = await dbAll<DbFileRow>(
    `SELECT a.id, a.filename, a.mime, a.size, a.created_at,
            m.booking_id AS ref_id,
            COALESCE(NULLIF(b.booking_number, ''), NULLIF(b.request_number, ''), m.booking_id) AS ref_label,
            m.subject AS extra
       FROM booking_message_attachments a
       LEFT JOIN booking_messages m ON m.id = a.message_id
       LEFT JOIN booking_requests b ON b.id = m.booking_id
      ORDER BY a.created_at DESC`
  ).catch(() => [] as DbFileRow[]);

  return rows.map((r) => ({
    id: `nachricht:${r.id}`,
    kind: 'nachricht' as const,
    name: r.filename,
    fileName: r.filename,
    mime: r.mime || 'application/octet-stream',
    size: Number(r.size) || 0,
    updatedAt: r.created_at || '',
    publicUrl: null,
    href: `/api/admin/attachments/${r.id}`,
    storage: 'Datenbank: booking_message_attachments',
    usedIn: [
      {
        label: `Buchung: ${r.ref_label || 'unbekannt'}${r.extra ? ` · ${r.extra}` : ''}`,
        href: r.ref_id ? `/admin/buchungen?id=${r.ref_id}` : undefined,
      },
    ],
  }));
}

/* ─── Aggregation ─────────────────────────────────────────────────────────── */

export interface FileInventory {
  files: InventoryFile[];
  counts: Record<FileKind, number>;
  totalBytes: number;
}

export async function listFileInventory(): Promise<FileInventory> {
  const groups = await Promise.all([
    collectImages().catch(() => [] as InventoryFile[]),
    collectAutoReplyFiles().catch(() => [] as InventoryFile[]),
    collectCustomerDocuments(),
    collectTaskAttachments(),
    collectMessageAttachments(),
  ]);

  const files = groups.flat().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  const counts = { bild: 0, anhang: 0, kundendokument: 0, aufgabe: 0, nachricht: 0 } as Record<FileKind, number>;
  let totalBytes = 0;
  for (const file of files) {
    counts[file.kind] += 1;
    totalBytes += file.size || 0;
  }

  return { files, counts, totalBytes };
}
