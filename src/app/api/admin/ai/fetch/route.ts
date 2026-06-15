import { NextResponse } from 'next/server';
import { fetchUrlText } from '@/lib/urlFetch';

/** Holt eine URL und gibt Titel + extrahierten Text (gekürzt) zurück – für die Vorschau. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = String(body.url || '').trim();
    if (!url) return NextResponse.json({ success: false, error: 'URL fehlt' }, { status: 400 });

    const r = await fetchUrlText(url);
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 422 });

    const text = r.text || '';
    return NextResponse.json({
      success: true,
      title: r.title || '',
      chars: text.length,
      preview: text.slice(0, 2500),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
