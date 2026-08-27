import { NextResponse } from 'next/server';
import { getDeck } from '@/lib/presentation/store';
import { buildDeckPdf } from '@/lib/presentation/pdf';
import { buildDeckPptx } from '@/lib/presentation/pptx';

export const dynamic = 'force-dynamic';
// Bilder werden beim Export geladen und zugeschnitten – das darf dauern.
export const maxDuration = 120;

/** Dateiname aus dem Decktitel: Umlaute aufgelöst, nur unproblematische Zeichen. */
function fileName(title: string, ext: string): string {
  const base = (title || 'Praesentation')
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'Praesentation';
  return `${base}.${ext}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get('format') === 'pptx' ? 'pptx' : 'pdf';
  const deck = await getDeck(id);
  if (!deck) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });

  try {
    if (format === 'pptx') {
      const buf = await buildDeckPptx(deck);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${fileName(deck.title, 'pptx')}"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    const pdf = await buildDeckPdf(deck);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName(deck.title, 'pdf')}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
