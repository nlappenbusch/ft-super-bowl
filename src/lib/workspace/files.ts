/**
 * workspace/files.ts — Dateien für die Faltin-KI aufbereiten.
 * ─────────────────────────────────────────────────────────────────────────────
 * Jede Datei (Chat-Upload oder SharePoint) wird EINMAL bei der Anthropic-Files-API
 * hochgeladen und danach nur noch per file_id referenziert. So bleibt der
 * Chatverlauf klein und unverändert (append-only), egal wie oft die Datei
 * später wieder gebraucht wird.
 *   PDF            → document (nativ gelesen, inkl. Tabellen/Layout)
 *   Bild           → image
 *   Text/CSV/HTML  → document (text/plain)
 *   Word/Excel/PPT → Text extrahiert (officeText.ts) → document (text/plain)
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type Anthropic from '@anthropic-ai/sdk';
import { toFile } from '@anthropic-ai/sdk';
import { anthropicClient } from './claude';
import { addFile, type WsFile } from './store';
import { officeToText, OFFICE_EXTENSIONS } from './officeText';
import { htmlToText } from './text';

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Bytes nur bis zu dieser Größe zusätzlich lokal ablegen (für den Download-Link im Chat). */
const KEEP_LOCAL_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 400_000;

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const TEXT_EXTENSIONS = ['txt', 'csv', 'tsv', 'md', 'json', 'xml', 'html', 'htm', 'eml', 'ics', 'log'];

function extOf(name: string): string {
  return (name.split('.').pop() || '').toLowerCase();
}

/** Beschreibt, wie eine Datei an die KI geht — oder warum nicht. */
export function classifyFile(filename: string, mime: string): { kind: 'pdf' | 'image' | 'text' | 'office' } | { error: string } {
  const ext = extOf(filename);
  if (mime === 'application/pdf' || ext === 'pdf') return { kind: 'pdf' };
  if (IMAGE_TYPES.includes(mime) || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return { kind: 'image' };
  if ((OFFICE_EXTENSIONS as readonly string[]).includes(ext)) return { kind: 'office' };
  if (mime.startsWith('text/') || TEXT_EXTENSIONS.includes(ext) || mime === 'application/json') return { kind: 'text' };
  if (['doc', 'xls', 'ppt', 'msg', 'rtf', 'odt', 'ods'].includes(ext)) {
    return { error: `.${ext} (altes Format) kann die KI nicht lesen — bitte als PDF oder .${ext}x speichern.` };
  }
  return { error: `Dateityp .${ext || mime} wird nicht unterstützt (PDF, Bilder, Word/Excel/PowerPoint, Text/CSV).` };
}

function imageMime(filename: string, mime: string): string {
  if (IMAGE_TYPES.includes(mime)) return mime;
  const ext = extOf(filename);
  return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
}

/**
 * Datei aufbereiten, zu Anthropic hochladen und in ws_files registrieren.
 * Wirft mit verständlicher Meldung, wenn das Format nicht passt.
 */
export async function ingestFile(input: {
  employeeId: string;
  conversationId: string | null;
  filename: string;
  mime: string;
  bytes: Buffer;
  source: 'upload' | 'sharepoint';
  sourceRef?: string;
}): Promise<WsFile> {
  if (input.bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Datei zu groß (${Math.round(input.bytes.length / 1024 / 1024)} MB, max. 20 MB).`);
  }
  const cls = classifyFile(input.filename, input.mime);
  if ('error' in cls) throw new Error(cls.error);

  let uploadBytes: Buffer = input.bytes;
  let uploadMime = input.mime;
  let blockType: WsFile['block_type'] = 'document';

  if (cls.kind === 'pdf') {
    uploadMime = 'application/pdf';
  } else if (cls.kind === 'image') {
    uploadMime = imageMime(input.filename, input.mime);
    blockType = 'image';
  } else {
    let text = cls.kind === 'office' ? officeToText(input.bytes, input.filename) : input.bytes.toString('utf-8');
    if (['html', 'htm'].includes(extOf(input.filename)) || input.mime === 'text/html') text = htmlToText(text);
    if (!text.trim()) throw new Error('In der Datei wurde kein lesbarer Text gefunden.');
    if (text.length > MAX_TEXT_CHARS) {
      text = `${text.slice(0, MAX_TEXT_CHARS)}\n\n[Hinweis: Datei gekürzt — nur die ersten ${MAX_TEXT_CHARS.toLocaleString('de-CH')} von ${text.length.toLocaleString('de-CH')} Zeichen enthalten.]`;
    }
    uploadBytes = Buffer.from(`Datei: ${input.filename}\n\n${text}`, 'utf-8');
    uploadMime = 'text/plain';
    blockType = 'text';
  }

  const client = anthropicClient();
  const uploadName = blockType === 'text' ? `${input.filename}.txt` : input.filename;
  const meta = await client.files.upload({
    file: await toFile(uploadBytes, uploadName, { type: uploadMime }),
  });

  return addFile({
    employee_id: input.employeeId,
    conversation_id: input.conversationId,
    filename: input.filename,
    mime: input.mime || uploadMime,
    size: input.bytes.length,
    source: input.source,
    source_ref: input.sourceRef || '',
    block_type: blockType,
    anthropic_file_id: meta.id,
    data_b64: input.source === 'upload' && input.bytes.length <= KEEP_LOCAL_BYTES ? input.bytes.toString('base64') : '',
  });
}

/** Content-Block, mit dem eine registrierte Datei an Claude geht (nur per file_id). */
export function fileContentBlock(f: WsFile): Anthropic.Beta.Messages.BetaContentBlockParam {
  if (f.block_type === 'image') {
    return { type: 'image', source: { type: 'file', file_id: f.anthropic_file_id } };
  }
  return {
    type: 'document',
    source: { type: 'file', file_id: f.anthropic_file_id },
    title: f.filename.slice(0, 200),
  };
}

/** Dateien bei Anthropic löschen (z.B. wenn ein Chat gelöscht wird) — Fehler still ignorieren. */
export async function deleteAnthropicFiles(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    const client = anthropicClient();
    await Promise.all(ids.map((id) => client.files.delete(id).catch(() => undefined)));
  } catch { /* kein Key → nichts zu löschen */ }
}
