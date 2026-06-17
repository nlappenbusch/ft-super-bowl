import { NextResponse } from 'next/server';
import { suggestForTitles, parseCf7Line } from '@/lib/cf7Match';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * POST /api/wp/match
 * Body (eines davon):
 *   { lines: string[] }            – rohe CF7-Shortcode-Zeilen oder Titel
 *   { forms: [{id?, title}] }      – strukturiert (WP-Plugin)
 *   { titles: string[] }           – nur Titel
 * → { success, results: [{ title, id?, suggestion, alternatives }] }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    let items: { id?: string; title: string }[] = [];

    if (Array.isArray(body.lines)) {
      for (const ln of body.lines) { const p = parseCf7Line(String(ln)); if (p) items.push(p); }
    } else if (Array.isArray(body.forms)) {
      items = body.forms.map((f: { id?: unknown; title?: unknown }) => ({ id: f.id != null ? String(f.id) : undefined, title: String(f.title || '') }));
    } else if (Array.isArray(body.titles)) {
      items = body.titles.map((t: unknown) => ({ title: String(t || '') }));
    }
    items = items.filter((i) => i.title.trim());
    if (items.length === 0) return NextResponse.json({ success: false, error: 'Keine CF7-Formulare/Titel übergeben.' }, { status: 400 });

    const results = await suggestForTitles(items);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
