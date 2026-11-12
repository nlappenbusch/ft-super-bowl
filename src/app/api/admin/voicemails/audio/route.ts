import { NextRequest, NextResponse } from 'next/server';
import { voicemailFetch } from '@/lib/voicemailBoard';

export const dynamic = 'force-dynamic';

/** GET /api/admin/voicemails/audio?key=… – Originalaufnahme (MP3) zum Abspielen. */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key') || '';
  if (!key) return NextResponse.json({ success: false, error: 'key fehlt' }, { status: 400 });
  try {
    const r = await voicemailFetch('/audio/' + encodeURIComponent(key));
    if (!r.ok) return new NextResponse('Aufnahme nicht gefunden', { status: 404 });
    const buf = await r.arrayBuffer();
    return new NextResponse(buf, {
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(buf.byteLength), 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return new NextResponse('Voicemail-Dienst nicht erreichbar', { status: 502 });
  }
}
