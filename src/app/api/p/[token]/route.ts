/**
 * GET /api/p/[token] – PDF einer freigegebenen Präsentation.
 * Bewusst öffentlich (wie /p/[token]): der Token ist die Berechtigung, und
 * `getDeckByToken` liefert nur Decks mit aktiver Freigabe.
 */
import { NextResponse } from 'next/server';
import { getDeckByToken } from '@/lib/presentation/store';
import { buildDeckPdf } from '@/lib/presentation/pdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function fileName(title: string): string {
  const base = (title || 'Praesentation')
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe').replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_').slice(0, 80) || 'Praesentation';
  return `${base}.pdf`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const deck = await getDeckByToken(token);
  if (!deck) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  try {
    const pdf = await buildDeckPdf(deck);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName(deck.title)}"`,
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
