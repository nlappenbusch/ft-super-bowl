/**
 * GET /api/presentation/seal – Siegel „Schweizer Reisegarantie", freigestellt.
 * Bewusst öffentlich: reine Logo-Grafik, wird auch von geteilten Kundenlinks
 * (/p/[token]) gebraucht. PDF und PPTX beziehen dieselbe Grafik direkt aus
 * `assets.ts`, damit alle drei Ausgaben identisch aussehen.
 */
import { NextResponse } from 'next/server';
import { sealPng } from '@/lib/presentation/assets';

export async function GET() {
  const buf = await sealPng(520);
  if (!buf) return NextResponse.json({ error: 'Siegel nicht verfügbar' }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  });
}
