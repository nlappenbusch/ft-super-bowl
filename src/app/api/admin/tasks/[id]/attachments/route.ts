import { NextResponse } from 'next/server';
import { listTaskAttachments, addTaskAttachment, getTaskAttachment, deleteTaskAttachment } from '@/lib/staffStore';

/** GET → Liste (Metadaten). GET ?attId=… → Datei-Download. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const attId = new URL(req.url).searchParams.get('attId');
  if (attId) {
    const a = await getTaskAttachment(attId);
    if (!a) return NextResponse.json({ success: false, error: 'nicht gefunden' }, { status: 404 });
    const buf = Buffer.from(a.data_b64, 'base64');
    return new NextResponse(buf, {
      headers: {
        'Content-Type': a.mime || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${encodeURIComponent(a.filename)}"`,
      },
    });
  }
  const data = await listTaskAttachments(id);
  return NextResponse.json({ success: true, data });
}

/** POST (multipart, Feld "file") → Datei anhängen. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'Datei fehlt' }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const data = await addTaskAttachment(id, {
    filename: file.name || 'datei',
    mime: file.type || 'application/octet-stream',
    size: buf.length,
    data_b64: buf.toString('base64'),
  });
  return NextResponse.json({ success: true, data });
}

/** DELETE ?attId=… → Datei löschen. */
export async function DELETE(req: Request) {
  const attId = new URL(req.url).searchParams.get('attId');
  if (!attId) return NextResponse.json({ success: false, error: 'attId erforderlich' }, { status: 400 });
  const ok = await deleteTaskAttachment(attId);
  return NextResponse.json({ success: ok });
}
