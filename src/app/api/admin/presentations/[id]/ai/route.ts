import { NextResponse } from 'next/server';
import { anthropicMessage, isAiConfigured, parseJsonLoose } from '@/lib/aiAssist';
import { findImage } from '@/lib/incentive/images';
import { getDeck, updateDeck } from '@/lib/presentation/store';
import type { DeckLang, Slide } from '@/lib/presentation/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const SYSTEM =
  'Du textest für Faltin Travel (Schweiz), Veranstalter für Sport-, Event- und Incentive-Reisen. ' +
  'Ton: hochwertig, konkret, emotional ohne Kitsch, Sie-Form, Schweizer Rechtschreibung (ss statt ß). ' +
  'Keine erfundenen Preise, Garantien oder Leistungen. Hervorhebungen mit **Sternchen** beibehalten.';

const LANG_NAME: Record<DeckLang, string> = { de: 'Deutsch', en: 'Englisch', fr: 'Französisch' };

/** Textfelder einer Folie, die übersetzt bzw. überarbeitet werden. */
function slideTexts(s: Slide): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.title) out['title'] = s.title;
  if (s.kicker) out['kicker'] = s.kicker;
  if (s.body) out['body'] = s.body;
  if (s.highlight) out['highlight'] = s.highlight;
  (s.meta || []).forEach((m, i) => { if (m) out[`meta.${i}`] = m; });
  (s.bullets || []).forEach((b, i) => { if (b) out[`bullets.${i}`] = b; });
  (s.program || []).forEach((p, i) => {
    if (p.label) out[`program.${i}.label`] = p.label;
    if (p.text) out[`program.${i}.text`] = p.text;
  });
  (s.hotels || []).forEach((h, i) => { if (h.text) out[`hotels.${i}.text`] = h.text; });
  (s.services || []).forEach((v, i) => { if (v.text) out[`services.${i}.text`] = v.text; });
  (s.prices || []).forEach((p, i) => {
    if (p.label) out[`prices.${i}.label`] = p.label;
    if (p.note) out[`prices.${i}.note`] = p.note;
  });
  return out;
}

/** Übersetzte Werte zurück in die Folie schreiben. */
function applyTexts(s: Slide, values: Record<string, string>): Slide {
  const next: Slide = JSON.parse(JSON.stringify(s));
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const parts = key.split('.');
    if (parts.length === 1) {
      if (parts[0] === 'title') next.title = value;
      else if (parts[0] === 'kicker') next.kicker = value;
      else if (parts[0] === 'body') next.body = value;
      else if (parts[0] === 'highlight') next.highlight = value;
      continue;
    }
    const [field, idxRaw, sub] = parts;
    const idx = Number(idxRaw);
    if (!Number.isInteger(idx)) continue;
    if (field === 'meta' && next.meta?.[idx] !== undefined) next.meta[idx] = value;
    if (field === 'bullets' && next.bullets?.[idx] !== undefined) next.bullets[idx] = value;
    if (field === 'program' && next.program?.[idx] && (sub === 'label' || sub === 'text')) next.program[idx][sub] = value;
    if (field === 'hotels' && next.hotels?.[idx] && sub === 'text') next.hotels[idx].text = value;
    if (field === 'services' && next.services?.[idx] && sub === 'text') next.services[idx].text = value;
    if (field === 'prices' && next.prices?.[idx] && (sub === 'label' || sub === 'note')) next.prices[idx][sub] = value;
  }
  return next;
}

async function translateSlide(slide: Slide, target: DeckLang): Promise<Slide> {
  const texts = slideTexts(slide);
  if (!Object.keys(texts).length) return slide;
  const res = await anthropicMessage({
    system: SYSTEM,
    userText:
      `Übersetze die Werte dieses JSON-Objekts nach ${LANG_NAME[target]}. Die Schlüssel bleiben unverändert, ` +
      `**Hervorhebungen** und Absatzumbrüche bleiben erhalten. Eigennamen (Hotels, Orte, Marken) nicht übersetzen.\n` +
      `Antworte ausschliesslich mit dem JSON-Objekt.\n\n${JSON.stringify(texts, null, 1)}`,
    maxTokens: 4000,
  });
  if (!res.ok) throw new Error(res.error || 'Übersetzung fehlgeschlagen');
  const parsed = parseJsonLoose(res.text || '') as Record<string, string> | null;
  return parsed ? applyTexts(slide, parsed) : slide;
}

/**
 * POST – KI-Hilfen im Editor.
 * actions: improve | shorten | expand | translate (einzelner Text)
 *          image (Bildvorschlag) | translateDeck (ganzes Deck in eine Sprache)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');

  try {
    if (action === 'image') {
      const query = String(body.query || '').trim();
      if (!query) return NextResponse.json({ success: false, error: 'Suchbegriff fehlt.' }, { status: 400 });
      const img = await findImage(query);
      if (!img) return NextResponse.json({ success: false, error: 'Kein Bild gefunden.' }, { status: 404 });
      return NextResponse.json({ success: true, data: img });
    }

    if (!isAiConfigured()) {
      return NextResponse.json({ success: false, error: 'KI ist nicht konfiguriert (Admin → KI).' }, { status: 400 });
    }

    if (action === 'translateDeck') {
      const target: DeckLang = ['de', 'en', 'fr'].includes(body.targetLang) ? body.targetLang : 'en';
      const deck = await getDeck(id);
      if (!deck) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
      const slides: Slide[] = [];
      for (const s of deck.slides) slides.push(await translateSlide(s, target));
      await updateDeck(id, { slides, lang: target });
      return NextResponse.json({ success: true, data: await getDeck(id) });
    }

    const text = String(body.text || '').trim();
    if (!text) return NextResponse.json({ success: false, error: 'Kein Text übergeben.' }, { status: 400 });
    const hint = String(body.hint || '').trim();

    const instruction =
      action === 'shorten' ? 'Kürze den folgenden Text deutlich, ohne Kernaussagen zu verlieren.'
      : action === 'expand' ? 'Formuliere den folgenden Stichpunkt-Text zu einem ansprechenden Präsentationsabsatz aus (3–5 Sätze).'
      : action === 'translate' ? `Übersetze den folgenden Text nach ${LANG_NAME[(['de', 'en', 'fr'].includes(body.targetLang) ? body.targetLang : 'en') as DeckLang]}.`
      : 'Überarbeite den folgenden Text für eine hochwertige Kundenpräsentation: klarer Aufbau, konkrete Bilder, keine Floskeln.';

    const res = await anthropicMessage({
      system: SYSTEM,
      userText: `${instruction}${hint ? `\nZusätzlicher Hinweis: ${hint}` : ''}\nGib ausschliesslich den fertigen Text zurück – ohne Einleitung, ohne Anführungszeichen.\n\nTEXT:\n${text}`,
      maxTokens: 2000,
    });
    if (!res.ok) return NextResponse.json({ success: false, error: res.error || 'KI-Aufruf fehlgeschlagen' }, { status: 502 });
    return NextResponse.json({ success: true, data: { text: (res.text || '').trim() } });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
