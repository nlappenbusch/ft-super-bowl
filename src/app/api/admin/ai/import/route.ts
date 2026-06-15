import { NextResponse } from 'next/server';
import { isAiConfigured, generateModuleContent, type AiImage } from '@/lib/aiAssist';
import { fetchUrlText } from '@/lib/urlFetch';

/**
 * KI-Modul-Import.
 * Body: {
 *   moduleKey: string,
 *   eventName?: string,
 *   sourceUrl?: string,        // optional: Seite wird gefetcht
 *   instruction?: string,      // optional: freie Anweisung
 *   currentContent?: string,   // optional: aktueller Inhalt
 *   image?: { data: base64, mediaType }  // optional: Screenshot
 * }
 * Antwort: { success, data (Modul-JSON), sourceTitle?, error? }
 */
export async function POST(request: Request) {
  try {
    if (!isAiConfigured()) {
      return NextResponse.json(
        { success: false, error: 'KI ist nicht konfiguriert. Bitte Anthropic API-Key im Admin → KI hinterlegen.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const moduleKey: string = (body.moduleKey || '').trim();
    if (!moduleKey) {
      return NextResponse.json({ success: false, error: 'moduleKey fehlt' }, { status: 400 });
    }

    let sourceText: string | undefined;
    let sourceTitle: string | undefined;
    if (body.sourceUrl && String(body.sourceUrl).trim()) {
      const fetched = await fetchUrlText(String(body.sourceUrl).trim());
      if (!fetched.ok) {
        return NextResponse.json(
          { success: false, error: `URL-Abruf fehlgeschlagen: ${fetched.error}` },
          { status: 422 }
        );
      }
      sourceText = fetched.text;
      sourceTitle = fetched.title;
    }

    if (!sourceText && !body.instruction && !body.image) {
      return NextResponse.json(
        { success: false, error: 'Bitte eine URL, eine Anweisung oder einen Screenshot angeben.' },
        { status: 400 }
      );
    }

    let image: AiImage | null = null;
    if (body.image?.data) {
      image = { data: String(body.image.data), mediaType: String(body.image.mediaType || 'image/png') };
    }

    const result = await generateModuleContent({
      moduleKey,
      eventName: body.eventName,
      sourceText,
      instruction: body.instruction,
      currentContent: body.currentContent,
      image,
    });

    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error, raw: result.raw }, { status: 502 });
    }

    return NextResponse.json({ success: true, data: result.data, sourceTitle });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Interner Serverfehler: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
