import { NextResponse } from 'next/server';
import { getCustomerDocument } from '@/lib/documentStore';

/** GET /api/admin/customers/[id]/documents/[docId] – Download (admin-gated via Middleware). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const d = await getCustomerDocument(docId);
  if (!d || d.customer_id !== id) {
    return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  }
  const buf = Buffer.from(d.data_b64 || '', 'base64');
  const inline = /^(application\/pdf|image\/)/.test(d.mime);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': d.mime || 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(d.filename)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
