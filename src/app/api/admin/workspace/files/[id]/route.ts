import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { getFile, getFileData } from '@/lib/workspace/store';

/** GET — hochgeladene Datei herunterladen (nur eigene). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const { id } = await params;
  const meta = await getFile(id);
  if (!meta || meta.employee_id !== ws.ownerKey) {
    return NextResponse.json({ success: false, error: 'Datei nicht gefunden' }, { status: 404 });
  }
  const data = await getFileData(id);
  if (!data?.data_b64) {
    return NextResponse.json({ success: false, error: 'Datei ist nur bei der KI hinterlegt (zu gross zum Aufbewahren).' }, { status: 404 });
  }
  // Typ serverseitig festlegen: nur PDF und Bilder inline, alles andere (HTML, XML, …) als Download.
  const ext = (data.filename.split('.').pop() || '').toLowerCase();
  const INLINE: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
  const inlineType = INLINE[ext];
  return new Response(Buffer.from(data.data_b64, 'base64'), {
    headers: {
      'Content-Type': inlineType || 'application/octet-stream',
      'Content-Disposition': `${inlineType ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(data.filename)}`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': 'sandbox; default-src \'none\'; img-src \'self\' data:; style-src \'unsafe-inline\'',
      'Cache-Control': 'private, no-store',
    },
  });
}
