import { NextResponse } from 'next/server';
import { createDeck, listDecks } from '@/lib/presentation/store';
import { getIncentivePlan } from '@/lib/incentive/store';
import { deckTitleFromIncentive, slidesFromIncentive, starterSlides } from '@/lib/presentation/templates';
import type { DeckLang } from '@/lib/presentation/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const decks = await listDecks();
  return NextResponse.json({ success: true, data: decks });
}

/**
 * POST – neues Deck anlegen.
 * Body: { title?, lang?, meta?, fromIncentive? }
 * Mit `fromIncentive` wird ein fertiger KI-Plan als Foliensatz übernommen.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const lang: DeckLang = ['de', 'en', 'fr'].includes(body.lang) ? body.lang : 'de';
    let title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Neue Präsentation';
    let slides = starterSlides(title, lang);

    if (body.fromIncentive) {
      const record = await getIncentivePlan(String(body.fromIncentive));
      if (!record) return NextResponse.json({ success: false, error: 'Incentive-Plan nicht gefunden.' }, { status: 404 });
      if (!record.plan) return NextResponse.json({ success: false, error: 'Dieser Incentive-Plan ist noch nicht fertig generiert.' }, { status: 400 });
      slides = slidesFromIncentive(record, lang);
      if (!body.title) title = deckTitleFromIncentive(record);
    }

    const meta = typeof body.meta === 'object' && body.meta ? body.meta : {};
    const id = await createDeck(title, lang, meta, slides);
    return NextResponse.json({ success: true, id });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
