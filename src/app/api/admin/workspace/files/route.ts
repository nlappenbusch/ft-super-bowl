import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { ingestFile, MAX_UPLOAD_BYTES } from '@/lib/workspace/files';
import { isWorkspaceAiConfigured, describeAiError } from '@/lib/workspace/claude';

export const runtime = 'nodejs';
export const maxDuration = 120;

/** POST multipart (Feld „file“) — Datei für den Chat vorbereiten. Antwort: { id, filename, size }. */
export async function POST(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  if (!isWorkspaceAiConfigured()) {
    return NextResponse.json({ success: false, error: 'Kein Anthropic API-Key hinterlegt.' }, { status: 503 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ success: false, error: 'Keine Datei übermittelt.' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ success: false, error: 'Datei zu gross (max. 20 MB).' }, { status: 413 });
  }
  try {
    const f = await ingestFile({
      employeeId: ws.ownerKey,
      conversationId: null,
      filename: file.name || 'datei',
      mime: file.type || 'application/octet-stream',
      bytes: Buffer.from(await file.arrayBuffer()),
      source: 'upload',
    });
    return NextResponse.json({ success: true, data: { id: f.id, filename: f.filename, size: f.size, kind: f.block_type } });
  } catch (e) {
    return NextResponse.json({ success: false, error: describeAiError(e) }, { status: 400 });
  }
}
