/**
 * autoReplyStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Speicher für die optionalen Auto-Antwort-PDFs (pro Event).
 *
 * WICHTIG: Dateien liegen unter data/uploads/auto-reply/ — also im PERSISTENTEN
 * Docker-Volume (./data:/app/data). public/uploads ist NICHT persistent und würde
 * bei jedem Redeploy verloren gehen.
 *
 * Die PDF wird ausschließlich serverseitig gelesen und als Mail-Anhang (base64)
 * versendet — sie braucht keine öffentliche URL.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { mkdir, writeFile, readFile, stat, unlink } from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'uploads', 'auto-reply');

/** Max. Größe pro PDF-Anhang (3,5 MB). Große Mails gehen via Graph Draft + Upload-Session raus. */
export const MAX_AUTO_REPLY_PDF_BYTES = Math.floor(3.5 * 1024 * 1024);

export interface AutoReplyPdfMeta {
  /** Gespeicherter Dateiname (im Event-Datensatz hinterlegt) */
  file: string;
  /** Original-Anzeigename (wird als Anhang-Name in der Mail genutzt) */
  name: string;
  /** Dateigröße in Bytes */
  size: number;
}

function sanitizeBase(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'dokument'
  );
}

/** Nur den reinen Dateinamen zulassen (kein Path-Traversal). */
function safeStoredName(file: string): string {
  return path.basename(file || '').replace(/[^a-zA-Z0-9._-]/g, '');
}

/** Speichert eine hochgeladene PDF und gibt Metadaten zurück. */
export async function saveAutoReplyPdf(file: File, eventSlug?: string): Promise<AutoReplyPdfMeta> {
  const originalName = file.name || 'dokument.pdf';
  const ext = path.extname(originalName).toLowerCase();
  if (ext !== '.pdf') {
    throw new Error('Nur PDF-Dateien sind als Auto-Antwort-Anhang erlaubt.');
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  // Versand großer Anhänge läuft über die Graph Upload-Session (graphMailer.ts),
  // daher gilt nur noch das eigene Limit pro Datei.
  if (bytes.length > MAX_AUTO_REPLY_PDF_BYTES) {
    throw new Error('PDF ist zu groß (max. 3,5 MB pro Anhang).');
  }

  await mkdir(DATA_DIR, { recursive: true });

  const slugPart = eventSlug ? `${sanitizeBase(eventSlug)}-` : '';
  const timeStamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalName = `${slugPart}${timeStamp}-${sanitizeBase(originalName)}.pdf`;
  const finalPath = path.join(DATA_DIR, finalName);
  await writeFile(finalPath, bytes);

  return { file: finalName, name: originalName, size: bytes.length };
}

/** Liest eine gespeicherte PDF als Base64 (für den Mail-Versand). null wenn nicht vorhanden. */
export async function readAutoReplyPdfBase64(file: string): Promise<{ base64: string; size: number } | null> {
  const name = safeStoredName(file);
  if (!name) return null;
  try {
    const full = path.join(DATA_DIR, name);
    const buf = await readFile(full);
    return { base64: buf.toString('base64'), size: buf.length };
  } catch {
    return null;
  }
}

/** Existenz-/Größen-Check (für Admin-Anzeige). */
export async function statAutoReplyPdf(file: string): Promise<{ size: number } | null> {
  const name = safeStoredName(file);
  if (!name) return null;
  try {
    const s = await stat(path.join(DATA_DIR, name));
    return { size: s.size };
  } catch {
    return null;
  }
}

/** Löscht eine gespeicherte PDF (best effort). */
export async function deleteAutoReplyPdf(file: string): Promise<void> {
  const name = safeStoredName(file);
  if (!name) return;
  await unlink(path.join(DATA_DIR, name)).catch(() => {});
}
