import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/portalSession';
import { getCustomerDocument } from '@/lib/documentStore';

/** GET /api/portal/documents/[id] – Kundendokument / Reiseakte (nur Eigentümer, sichtbar). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  const { id } = await params;
  const d = await getCustomerDocument(id);
  if (!d || d.customer_id !== session.cid || Number(d.visible) !== 1) {
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
