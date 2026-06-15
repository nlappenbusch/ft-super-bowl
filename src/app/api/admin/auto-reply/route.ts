import { NextResponse } from 'next/server';
import { saveAutoReplyPdf } from '@/lib/autoReplyStore';

/**
 * POST /api/admin/auto-reply
 * Lädt eine Auto-Antwort-PDF hoch (multipart/form-data, Feld "file").
 * Optional "eventSlug" für sprechende Dateinamen.
 * Antwort: { success, data: { file, name, size } }
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const eventSlug = (formData.get('eventSlug') as string | null) || undefined;

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Keine Datei erhalten.' }, { status: 400 });
    }

    const meta = await saveAutoReplyPdf(file, eventSlug);
    return NextResponse.json({ success: true, data: meta });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
