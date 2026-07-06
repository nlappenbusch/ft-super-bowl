/**
 * cf7Match.ts — Schlägt zu Contact-Form-7-Formularen (bzw. deren Titeln) das am
 * besten passende Event dieser Plattform vor, inkl. fertigem [faltin_anfrage]-Shortcode.
 * Genutzt vom Admin-Assistenten und vom WordPress-Plugin (über /api/wp/match).
 */
import { getEventsList, getSeriesList } from './eventData';

// Wörter, die fürs Matching irrelevant sind (CF7-/Seitentitel enthalten oft Generika).
const STOP = new Set([
  'contact', 'form', 'formular', 'formulare', 'kontakt', 'kontaktformular',
  'anfrage', 'anfragen', 'anfrageseite', 'the', 'und', 'and', 'der', 'die', 'das',
  'reise', 'reisen', 'travel', 'faltin', 'tickets', 'ticket', 'hospitality',
  'packages', 'package', 'pauschalreise', 'pauschalreisen', 'angebot', 'angebote',
  'offer', 'offers', 'booking', 'buchen', 'buchung', 'seite', 'page', 'kopie', 'copy',
  'neu', 'new', 'de', 'en', 'fr', 'it',
]);

function norm(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')    // Diakritika
    .replace(/\b(19|20)\d{2}\b/g, ' ')                   // Jahreszahlen raus
    .replace(/[^a-z0-9\s]/g, ' ')                        // Sonderzeichen (inkl. _ und Bindestriche) raus
    .replace(/\s+/g, ' ').trim();
}

function tokens(s: string): string[] {
  // Reine Zahlen (z. B. "Kontaktformular 12") tragen nichts bei und verwässern den Score nur.
  return norm(s).split(' ').filter((t) => t.length > 1 && !/^\d+$/.test(t) && !STOP.has(t));
}

export interface MatchItem {
  title: string;
  id?: string;
  /** Titel der Seiten, auf denen das Formular eingebettet ist — zusätzlicher Match-Kontext. */
  pages?: string[];
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
// Score, wenn der komplette Event-Name in einem (ggf. verrauschten) Titel enthalten ist.
const CONTAINMENT_SCORE = 0.85;

interface Candidate {
  slug: string;
  name: string;
  seriesSlug: string | null;
  tok: Set<string>;
  nameTok: string[];
}

function scoreAgainst(tt: string[], candidates: Candidate[]): { c: Candidate; score: number }[] {
  const ttSet = new Set(tt);
  return candidates.map((c) => {
    let overlap = 0;
    for (const t of tt) if (c.tok.has(t)) overlap++;
    // Basis-Score: Anteil der Titel-Tokens, die im Event vorkommen (0..1)
    let score = overlap / tt.length;
    // Containment-Bonus: Steht der komplette Event-Name im Titel, ist das ein starkes
    // Signal — Rauschwörter ("Kombi", Sprachkürzel, …) drücken den Score dann nicht
    // mehr unter die Schwelle.
    if (score < CONTAINMENT_SCORE && c.nameTok.length > 0 && c.nameTok.every((t) => ttSet.has(t))) {
      score = CONTAINMENT_SCORE;
    }
    return { c, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}

export async function suggestForTitles(items: MatchItem[]): Promise<MatchResult[]> {
  const [events, series] = await Promise.all([getEventsList(), getSeriesList()]);
  const seriesById = new Map(series.map((s) => [s.id, s]));

  const candidates: Candidate[] = events
    .filter((e) => (e.status || 'active') !== 'archived')
    .map((e) => {
      const s = e.series_id ? seriesById.get(e.series_id) : null;
      const name = e.name || e.title || e.slug;
      const tok = new Set(tokens([e.name, e.title, s?.title, e.slug.replace(/-/g, ' '), s?.slug?.replace(/-/g, ' ')].filter(Boolean).join(' ')));
      const nameTok = tokens(name);
      return { slug: e.slug, name, seriesSlug: s?.slug || null, tok, nameTok };
    });

  return items.map(({ title, id, pages }) => {
    // Formular-Titel zuerst; Titel der Seiten, auf denen das Formular steht, als
    // Fallback-Kontext (hilft bei generischen Formulartiteln wie "Kontaktformular 12").
    const texts = [title, ...(pages || [])].map((t) => String(t || '')).filter((t) => t.trim());
    if (!texts.length || candidates.length === 0) return { title, id, suggestion: null, alternatives: [] };

    let scored: { c: Candidate; score: number }[] = [];
    for (const text of texts) {
      const tt = tokens(text);
      if (!tt.length) continue;
      const s = scoreAgainst(tt, candidates);
      if ((s[0]?.score || 0) > (scored[0]?.score || 0)) scored = s;
    }

    const toSug = (x: { c: Candidate; score: number }): MatchSuggestion => ({
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
