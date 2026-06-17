/**
 * documentStore.ts – Datei-Anhänge an Nachrichten (beide Richtungen) und
 * kuratierte Kundendokumente / digitale Reiseakte (Tickets, Hotel, Voucher, Angebote).
 * Inhalt als base64-TEXT → liegt in der DB (und damit im Backup-Scope).
 */
import './database';
import { dbGet, dbAll, dbRun } from './dbq';
import crypto from 'node:crypto';

export const DOC_CATEGORIES = ['ticket', 'hotel', 'voucher', 'offer', 'invoice', 'other'] as const;
export type DocCategory = (typeof DOC_CATEGORIES)[number];

export const DOC_CATEGORY_LABEL: Record<DocCategory, string> = {
  ticket: 'Ticket',
  hotel: 'Hotel-Info',
  voucher: 'Voucher',
  offer: 'Angebot',
  invoice: 'Rechnung',
  other: 'Dokument',
};

/** Max. Dateigröße (Base64 bläht ~33 % auf; Graph-Inline-Limit ~3 MB pro Mailanhang). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

// ─────────────────────────── Nachrichten-Anhänge ───────────────────────────

export interface AttachmentMeta {
  id: string;
  message_id: string;
  filename: string;
  mime: string;
  size: number;
  created_at: string;
}

export async function addMessageAttachment(input: {
  message_id: string; filename: string; mime: string; size: number; data_b64: string;
}): Promise<string> {
  const id = crypto.randomUUID();
  await dbRun(
    `INSERT INTO booking_message_attachments (id, message_id, filename, mime, size, data_b64) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.message_id, input.filename || 'datei', input.mime || 'application/octet-stream', input.size || 0, input.data_b64 || '']
  );
  return id;
}

/** Anhänge (ohne Inhalt) zu allen Nachrichten einer Anfrage. */
export async function listAttachmentsForBooking(bookingId: string): Promise<AttachmentMeta[]> {
  return dbAll<AttachmentMeta>(
    `SELECT a.id, a.message_id, a.filename, a.mime, a.size, a.created_at
     FROM booking_message_attachments a
     JOIN booking_messages m ON a.message_id = m.id
     WHERE m.booking_id = ? ORDER BY a.created_at ASC`,
    [bookingId]
  );
}

/** Einzelner Anhang inkl. Inhalt + Kundenzuordnung (für owner-gated Download). */
export async function getMessageAttachment(id: string): Promise<
  { id: string; filename: string; mime: string; data_b64: string; customer_id: string | null } | undefined
> {
  return dbGet(
    `SELECT a.id, a.filename, a.mime, a.data_b64, br.customer_id
     FROM booking_message_attachments a
     JOIN booking_messages m ON a.message_id = m.id
     JOIN booking_requests br ON m.booking_id = br.id
     WHERE a.id = ?`,
    [id]
  );
}

// ─────────────────────────── Kundendokumente / Reiseakte ───────────────────────────

export interface CustomerDocumentMeta {
  id: string;
  customer_id: string;
  booking_id: string;
  category: DocCategory;
  title: string;
  filename: string;
  mime: string;
  size: number;
  visible: number;
  created_at: string;
  created_by: string;
}

export async function addCustomerDocument(input: {
  customer_id: string; booking_id?: string; category: string; title?: string;
  filename: string; mime: string; size: number; data_b64: string; created_by?: string; visible?: boolean;
}): Promise<string> {
  const id = crypto.randomUUID();
  const cat = (DOC_CATEGORIES as readonly string[]).includes(input.category) ? input.category : 'other';
  await dbRun(
    `INSERT INTO customer_documents (id, customer_id, booking_id, category, title, filename, mime, size, data_b64, visible, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.customer_id, input.booking_id || '', cat, input.title || '', input.filename || 'datei',
     input.mime || 'application/octet-stream', input.size || 0, input.data_b64 || '',
     input.visible === false ? 0 : 1, input.created_by || '']
  );
  return id;
}

export async function listCustomerDocuments(customerId: string, onlyVisible = false): Promise<CustomerDocumentMeta[]> {
  const where = onlyVisible ? `customer_id = ? AND visible = 1` : `customer_id = ?`;
  return dbAll<CustomerDocumentMeta>(
    `SELECT id, customer_id, booking_id, category, title, filename, mime, size, visible, created_at, created_by
     FROM customer_documents WHERE ${where} ORDER BY created_at DESC`,
    [customerId]
  );
}

export async function getCustomerDocument(id: string): Promise<
  { id: string; customer_id: string; filename: string; mime: string; data_b64: string; visible: number } | undefined
> {
  return dbGet(
    `SELECT id, customer_id, filename, mime, data_b64, visible FROM customer_documents WHERE id = ?`,
    [id]
  );
}

export async function deleteCustomerDocument(id: string): Promise<void> {
  await dbRun(`DELETE FROM customer_documents WHERE id = ?`, [id]);
}
