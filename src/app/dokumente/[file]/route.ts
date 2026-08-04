/**
 * GET /dokumente/<datei>  (TASK-00120)
 * ─────────────────────────────────────────────────────────────────────────────
 * Liefert einen in der automatischen Antwort hinterlegten Anhang aus
 * data/uploads/auto-reply aus — bewusst OHNE Login, damit auf ein Angebots-PDF
 * direkt verlinkt werden kann (z.B. aus einer Mail oder von WordPress aus).
 *
 * Die Dateinamen sind nicht erratbar (Event-Slug + Zeitstempel), es werden
 * ausschließlich Dateien aus diesem einen Verzeichnis ausgeliefert
 * (Path-Traversal-Schutz in autoReplyStore.safeStoredName).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { NextResponse } from 'next/server';
import { readAutoReplyFile } from '@/lib/autoReplyStore';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const requested = decodeURIComponent(file || '');

  const found = await readAutoReplyFile(requested);
  if (!found) {
    return new NextResponse('Datei nicht gefunden', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const inline = /^(application\/pdf|image\/)/.test(found.mime);
  return new NextResponse(new Uint8Array(found.buf), {
    headers: {
      'Content-Type': found.mime,
      'Content-Length': String(found.buf.length),
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(requested)}"`,
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
