/**
 * cf7Match.ts — Schlägt zu Contact-Form-7-Formularen (bzw. deren Titeln) das am
 * besten passende Event dieser Plattform vor, inkl. fertigem [faltin_anfrage]-Shortcode.
 * Genutzt vom Admin-Assistenten und vom WordPress-Plugin (über /api/wp/match).
 */
import { getEventsList, getSeriesList } from './eventData';

// Wörter, die fürs Matching irrelevant sind (CF7-Titel enthalten oft Generika).
const STOP = new Set([
  'contact', 'form', 'formular', 'kontakt', 'anfrage', 'anfragen', 'the', 'und', 'and',
  'der', 'die', 'das', 'reise', 'reisen', 'travel', 'faltin', 'tickets', 'ticket', 'hospitality',
]);

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')    // Diakritika
    .replace(/\b(19|20)\d{2}\b/g, ' ')                   // Jahreszahlen raus
    .replace(/[^a-z0-9\s]/g, ' ')                        // Sonderzeichen (inkl. _) raus
    .replace(/\s+/g, ' ').trim();
}

function tokens(s: string): string[] {
  return norm(s).split(' ').filter((t) => t.length > 1 && !STOP.has(t));
}

export interface MatchSuggestion {
  event_slug: string;
  event_name: string;
  series_slug: string | null;
  score: number;          // 0..1
  shortcode: string;
}
export interface MatchResult {
  title: string;
  id?: string;
  suggestion: MatchSuggestion | null;
  alternatives: MatchSuggestion[];
}

const THRESHOLD = 0.34;

export async function suggestForTitles(items: { title: string; id?: string }[]): Promise<MatchResult[]> {
  const [events, series] = await Promise.all([getEventsList(), getSeriesList()]);
  const seriesById = new Map(series.map((s) => [s.id, s]));

  const candidates = events
    .filter((e) => (e.status || 'active') !== 'archived')
    .map((e) => {
      const s = e.series_id ? seriesById.get(e.series_id) : null;
      const name = e.name || e.title || e.slug;
      const tok = new Set(tokens([e.name, e.title, s?.title, e.slug.replace(/-/g, ' '), s?.slug?.replace(/-/g, ' ')].filter(Boolean).join(' ')));
      return { slug: e.slug, name, seriesSlug: s?.slug || null, tok };
    });

  return items.map(({ title, id }) => {
    const tt = tokens(title);
    if (!tt.length || candidates.length === 0) return { title, id, suggestion: null, alternatives: [] };

    const scored = candidates.map((c) => {
      let overlap = 0;
      for (const t of tt) if (c.tok.has(t)) overlap++;
      // Score: Anteil der CF7-Tokens, die im Event vorkommen (0..1)
      const score = overlap / tt.length;
      return { c, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);

    const toSug = (x: { c: typeof candidates[number]; score: number }): MatchSuggestion => ({
      event_slug: x.c.slug,
      event_name: x.c.name,
      series_slug: x.c.seriesSlug,
      score: Math.round(x.score * 100) / 100,
      shortcode: `[faltin_anfrage event="${x.c.slug}" name="${x.c.name}"]`,
    });

    const best = scored[0];
    const suggestion = best && best.score >= THRESHOLD ? toSug(best) : null;
    const alternatives = scored.slice(suggestion ? 1 : 0, suggestion ? 3 : 2).map(toSug);
    return { title, id, suggestion, alternatives };
  });
}

/** Hilfsparser: extrahiert {id,title} aus einer CF7-Shortcode-Zeile oder nimmt die Zeile als Titel. */
export function parseCf7Line(line: string): { id?: string; title: string } | null {
  const l = line.trim();
  if (!l) return null;
  const title = l.match(/title="([^"]*)"/i)?.[1] || l.match(/title='([^']*)'/i)?.[1];
  const id = l.match(/id="([^"]*)"/i)?.[1] || l.match(/id='([^']*)'/i)?.[1];
  if (title) return { id, title };
  // Keine title=-Angabe: ganze Zeile (ohne [shortcode]-Klammern) als Titel
  return { id, title: l.replace(/^\[|\]$/g, '').replace(/^contact-form-7\s*/i, '').trim() || l };
}
