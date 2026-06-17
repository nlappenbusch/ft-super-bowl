import { NextResponse } from 'next/server';
import { getPortalSession } from '@/lib/portalSession';
import { getMessageAttachment } from '@/lib/documentStore';

/** GET /api/portal/attachments/[id] – Nachrichten-Anhang (nur Eigentümer). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  const { id } = await params;
  const a = await getMessageAttachment(id);
  if (!a || a.customer_id !== session.cid) {
    return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  }
  const buf = Buffer.from(a.data_b64 || '', 'base64');
  const inline = /^(application\/pdf|image\/)/.test(a.mime);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': a.mime || 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(a.filename)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
