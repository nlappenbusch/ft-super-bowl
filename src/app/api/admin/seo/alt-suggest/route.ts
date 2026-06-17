import { NextResponse } from 'next/server';
import { isAiConfigured, anthropicMessage } from '@/lib/aiAssist';
import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function extToMime(u: string): string {
  const e = (u.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  if (e === 'png') return 'image/png';
  if (e === 'webp') return 'image/webp';
  if (e === 'gif') return 'image/gif';
  if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
  return 'image/jpeg';
}

/** POST /api/admin/seo/alt-suggest  body: { url }  → KI-Alt-Text per Bild-Erkennung (Vision). */
export async function POST(request: Request) {
  try {
    if (!isAiConfigured()) return NextResponse.json({ success: false, error: 'Kein Anthropic-Key (Admin → KI-Redaktion).' }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const url: string = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return NextResponse.json({ success: false, error: 'Keine Bild-URL.' }, { status: 400 });

    const mediaType = extToMime(url);
    if (mediaType === 'image/svg+xml' || url.toLowerCase().includes('.svg')) {
      return NextResponse.json({ success: false, error: 'SVG kann nicht analysiert werden.' }, { status: 400 });
    }

    let buf: Buffer;
    if (/^https?:\/\//i.test(url)) {
      const r = await fetch(url, { redirect: 'follow' });
      if (!r.ok) return NextResponse.json({ success: false, error: `Bild nicht erreichbar (HTTP ${r.status}).` }, { status: 400 });
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      const p = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
      buf = await readFile(p);
    }

    const res = await anthropicMessage({
      system: 'Du schreibst prägnante deutsche Alt-Texte für Bilder (SEO + Barrierefreiheit). Beschreibe sachlich, was zu sehen ist. Maximal 120 Zeichen, EIN Satz, KEINE Einleitung wie "Bild von"/"Foto von", keine Anführungszeichen.',
      userText: 'Erzeuge einen Alt-Text für dieses Bild.',
      image: { data: buf.toString('base64'), mediaType },
      maxTokens: 120,
    });
    if (!res.ok || !res.text) return NextResponse.json({ success: false, error: res.error || 'KI-Fehler' }, { status: 400 });

    const alt = res.text.trim().replace(/^["']+|["']+$/g, '').replace(/\s+/g, ' ').slice(0, 160);
    return NextResponse.json({ success: true, alt });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
