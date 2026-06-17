import { NextResponse } from 'next/server';
import { getCustomer } from '@/lib/customerStore';
import {
  addCustomerDocument, listCustomerDocuments, getCustomerDocument, deleteCustomerDocument,
  DOC_CATEGORY_LABEL, type DocCategory, MAX_FILE_BYTES,
} from '@/lib/documentStore';

/** GET /api/admin/customers/[id]/documents – alle Dokumente des Kunden (inkl. unsichtbare). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docs = await listCustomerDocuments(id, false);
  return NextResponse.json({
    success: true,
    data: docs.map((d) => ({
      ...d, categoryLabel: DOC_CATEGORY_LABEL[(d.category as DocCategory)] || 'Dokument',
    })),
  });
}

/** POST (multipart) – Dokument hochladen (Kategorie, Titel, optional booking_id). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) return NextResponse.json({ success: false, error: 'Kunde nicht gefunden' }, { status: 404 });

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ success: false, error: 'Ungültige Anfrage' }, { status: 400 }); }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: 'Keine Datei' }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ success: false, error: 'Datei zu groß (max. 10 MB)' }, { status: 400 });
  }
  const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const docId = await addCustomerDocument({
    customer_id: id,
    booking_id: String(form.get('booking_id') || ''),
    category: String(form.get('category') || 'other'),
    title: String(form.get('title') || '') || file.name,
    filename: file.name || 'datei',
    mime: file.type || 'application/octet-stream',
    size: file.size,
    data_b64: b64,
    visible: String(form.get('visible') || '1') !== '0',
    created_by: 'admin',
  });
  return NextResponse.json({ success: true, id: docId });
}

/** DELETE ?docId=... – Dokument löschen (muss zum Kunden gehören). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docId = new URL(req.url).searchParams.get('docId') || '';
  const doc = await getCustomerDocument(docId);
  if (!doc || doc.customer_id !== id) {
    return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  }
  await deleteCustomerDocument(docId);
  return NextResponse.json({ success: true });
}
