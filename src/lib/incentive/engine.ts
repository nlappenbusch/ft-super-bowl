/**
 * incentive/engine.ts – KI-Orchestrierung des Incentive Builders.
 * Schritte: Ziele vorschlagen (KI) → Wetter-Ranking (Open-Meteo) → Itinerary (KI)
 * → emotionale Texte (Teil der Itinerary) → Konsistenz-Check (KI) → Bilder.
 */
import { anthropicMessage, parseJsonLoose, isAiConfigured } from '../aiAssist';
import { rankByWeather } from './weather';
import { findImage } from './images';
import type { IncentiveBrief, DestinationOption, DayPlan, IncentivePlan, Feasibility, DateRange } from './types';

const SYSTEM = 'Du bist ein erfahrener Incentive-Reise-Designer für Faltin Travel (Schweiz, Slogan „Wir liefern Emotionen"). ' +
  'Du planst hochwertige Gruppen-Incentives. Du schreibst auf Deutsch in der Sie-Form, emotional aber präzise, ohne erfundene Garantien oder Fixpreise. ' +
  'Antworte AUSSCHLIESSLICH mit gültigem JSON nach dem vorgegebenen Schema – kein Text drumherum.';

function briefContext(b: IncentiveBrief, period: DateRange): string {
  return [
    `Gruppengröße: ${b.groupSize} Personen`,
    `Dauer: ${b.days} Tage`,
    `Reisezeitraum: ${period.start} bis ${period.end}`,
    b.exclusions?.length ? `Auszuschließen: ${b.exclusions.map((e) => `${e.start}–${e.end}`).join(', ')}` : '',
    `Abflug-/Startregion: ${b.departureRegion || 'unbekannt'}`,
    `Budget-Niveau: ${b.budgetLevel}`,
    `Stil/Schwerpunkte: ${(b.styles || []).join(', ') || 'offen'}`,
    b.notes ? `Zusatzwünsche: ${b.notes}` : '',
  ].filter(Boolean).join('\n');
}

async function callJson(userText: string, maxTokens: number): Promise<Record<string, unknown>> {
  const res = await anthropicMessage({ system: SYSTEM, userText, maxTokens });
  if (!res.ok) throw new Error(res.error || 'KI-Aufruf fehlgeschlagen');
  const parsed = parseJsonLoose(res.text || '');
  if (!parsed) throw new Error('KI-Antwort war kein gültiges JSON');
  return parsed as Record<string, unknown>;
}

/** Schritt 1: Zielvorschläge mit Koordinaten. */
async function proposeDestinations(b: IncentiveBrief, period: DateRange): Promise<DestinationOption[]> {
  const userText = `Schlage 6 sehr unterschiedliche, zum Brief passende Incentive-Reiseziele vor (gut erreichbar ab der Startregion, passend zur Jahreszeit des Zeitraums, zum Stil und Budget).\n\nBRIEF:\n${briefContext(b, period)}\n\nSchema:\n{ "destinations": [ { "name": string, "country": string, "region": string, "lat": number, "lon": number, "rationale": string (1-2 Sätze, warum ideal) } ] }\nWICHTIG: lat/lon als Dezimalgrad der Hauptstadt/Hauptort des Ziels.`;
  const j = await callJson(userText, 1800);
  const arr = Array.isArray(j.destinations) ? j.destinations : [];
  return (arr as Record<string, unknown>[]).map((d) => ({
    name: String(d.name || ''), country: String(d.country || ''), region: d.region ? String(d.region) : undefined,
    lat: Number(d.lat), lon: Number(d.lon), rationale: String(d.rationale || ''),
  })).filter((d) => d.name && isFinite(d.lat) && isFinite(d.lon));
}

/** Schritt 3: Vollständige Itinerary inkl. emotionaler Texte. */
async function buildItinerary(b: IncentiveBrief, dest: DestinationOption, period: DateRange) {
  const w = dest.weather ? `Wetter-Erwartung: ${dest.weather.summary} (${dest.weather.basis}).` : '';
  const userText = `Erstelle eine vollständige, durchdachte ${b.days}-tägige Incentive-Reise nach ${dest.name}, ${dest.country} für ${b.groupSize} Personen.\n${w}\n\nBRIEF:\n${briefContext(b, period)}\n\nLiefere einen logisch sinnvollen Ablauf (realistische Wege/Zeiten, Anreisetag berücksichtigen), eine starke Unterkunfts-Empfehlung, Transport, und je Tag einen WOW-Moment. Schreibe pro Tag einen kurzen, emotionalen Präsentationstext (2-3 Sätze).\n\nSchema:\n{\n  "introTitle": string (packender Titel der Reise),\n  "introText": string (3-5 Sätze, emotionales Intro),\n  "summary": string (1-2 Sätze Kurzfassung),\n  "estBudgetPerPerson": string (grobe Spanne, z.B. "ca. CHF 1.800–2.400 p.P." – ohne Garantie),\n  "accommodation": { "name": string, "description": string, "bookingHint": string },\n  "logistics": string (Anreise/Transfers kompakt),\n  "wowHighlights": string[] (3-5 herausragende Signature-Momente der Reise),\n  "days": [ { "day": number, "title": string, "theme": string, "morning": string, "afternoon": string, "evening": string, "activities": [ { "name": string, "description": string, "durationH": number, "bookingHint": string } ], "transport": string, "accommodation": string, "wow": string, "text": string } ]\n}\nGenau ${b.days} Tage. Halte Texte konkret und vorzeigbar.`;
  const j = await callJson(userText, 6000);
  const days: DayPlan[] = (Array.isArray(j.days) ? j.days : []).map((d: Record<string, unknown>, i: number) => ({
    day: Number(d.day) || i + 1,
    title: String(d.title || `Tag ${i + 1}`),
    theme: String(d.theme || ''),
    morning: String(d.morning || ''), afternoon: String(d.afternoon || ''), evening: String(d.evening || ''),
    activities: (Array.isArray(d.activities) ? d.activities : []).map((a: Record<string, unknown>) => ({
      name: String(a.name || ''), description: String(a.description || ''),
      durationH: a.durationH != null ? Number(a.durationH) : undefined, bookingHint: a.bookingHint ? String(a.bookingHint) : undefined,
    })),
    transport: d.transport ? String(d.transport) : undefined,
    accommodation: d.accommodation ? String(d.accommodation) : undefined,
    wow: d.wow ? String(d.wow) : undefined,
    text: String(d.text || ''),
  }));
  const acc = (j.accommodation || {}) as Record<string, unknown>;
  return {
    introTitle: String(j.introTitle || `Incentive nach ${dest.name}`),
    introText: String(j.introText || ''),
    summary: String(j.summary || ''),
    estBudgetPerPerson: j.estBudgetPerPerson ? String(j.estBudgetPerPerson) : undefined,
    accommodation: { name: String(acc.name || ''), description: String(acc.description || ''), bookingHint: acc.bookingHint ? String(acc.bookingHint) : undefined },
    logistics: String(j.logistics || ''),
    wowHighlights: (Array.isArray(j.wowHighlights) ? j.wowHighlights : []).map((x: unknown) => String(x)),
    days,
  };
}

/** Schritt 4: Konsistenz-/Machbarkeits-Check. */
async function feasibilityCheck(b: IncentiveBrief, dest: DestinationOption, itin: { days: DayPlan[]; logistics: string }): Promise<Feasibility> {
  const compact = itin.days.map((d) => `Tag ${d.day}: ${d.title} | ${d.morning} / ${d.afternoon} / ${d.evening} | Transport: ${d.transport || '-'}`).join('\n');
  const userText = `Prüfe diese ${b.days}-tägige Incentive-Reise nach ${dest.name} für ${b.groupSize} Personen auf MACHBARKEIT und KONSISTENZ: realistische Reisezeiten/Wege, sinnvolle Reihenfolge, Saison/Wetter, Gruppentauglichkeit, Budget-Plausibilität (${b.budgetLevel}). Sei kritisch aber konstruktiv.\n\nLOGISTIK: ${itin.logistics}\nABLAUF:\n${compact}\n\nSchema:\n{ "ok": boolean, "score": number (0-100), "issues": string[] (konkrete Risiken/Konflikte, leer wenn keine), "notes": string (1-2 Sätze Gesamteinschätzung) }`;
  const j = await callJson(userText, 1200);
  return {
    ok: Boolean(j.ok),
    score: Number(j.score) || 0,
    issues: (Array.isArray(j.issues) ? j.issues : []).map((x: unknown) => String(x)),
    notes: String(j.notes || ''),
  };
}

/** Bilder anreichern (Destination-Hero + je Tag). */
async function attachImages(dest: DestinationOption, days: DayPlan[]): Promise<void> {
  const hero = await findImage(`${dest.name} ${dest.country}`);
  if (hero) { dest.imageUrl = hero.url; dest.imageCredit = hero.credit; }
  await Promise.all(days.map(async (d) => {
    const q = `${d.theme || d.title} ${dest.name}`.trim();
    const img = await findImage(q);
    if (img) { d.imageUrl = img.url; d.imageCredit = img.credit; }
    else if (hero) { d.imageUrl = hero.url; d.imageCredit = hero.credit; }
  }));
}

/** Gesamtlauf: Brief → fertiger Plan. */
export async function generateIncentivePlan(brief: IncentiveBrief): Promise<IncentivePlan> {
  if (!isAiConfigured()) throw new Error('KI ist nicht konfiguriert (Admin → KI).');
  if (!brief.periods?.length) throw new Error('Mindestens ein Reisezeitraum erforderlich.');
  const period = brief.periods[0];

  const candidates = await proposeDestinations(brief, period);
  if (!candidates.length) throw new Error('Keine Zielvorschläge erhalten.');
  const ranked = await rankByWeather(candidates, period);
  const top = ranked[0];

  const itin = await buildItinerary(brief, top, period);
  const feasibility = await feasibilityCheck(brief, top, itin);
  await attachImages(top, itin.days);

  return {
    destination: top,
    rankedAlternatives: ranked.slice(1),
    chosenPeriod: period,
    introTitle: itin.introTitle,
    introText: itin.introText,
    summary: itin.summary,
    days: itin.days,
    accommodation: itin.accommodation,
    logistics: itin.logistics,
    wowHighlights: itin.wowHighlights,
    estBudgetPerPerson: itin.estBudgetPerPerson,
    feasibility,
  };
}
