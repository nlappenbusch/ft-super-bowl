/**
 * incentive/weather.ts – Bestwetter-Ranking via Open-Meteo (kostenlos, kein Key).
 * Nutzt das Archiv des Vorjahres für denselben Kalenderzeitraum als Klima-Proxy.
 */
import type { DestinationOption, DateRange, WeatherInfo } from './types';

function shiftYear(dateStr: string, delta: number): string {
  const [y, m, d] = (dateStr || '').split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) return dateStr;
  return `${y + delta}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function scoreWeather(tempMaxAvg: number, precipMm: number): number {
  // Ideal ~25 °C; Abweichung und Niederschlag senken den Score.
  const tempScore = Math.max(0, 100 - Math.abs(tempMaxAvg - 25) * 4);
  const precipPenalty = Math.min(45, Math.max(0, precipMm));
  return Math.round(Math.max(0, Math.min(100, tempScore - precipPenalty)));
}

function summarize(tempMaxAvg: number, precipMm: number): string {
  const t = isFinite(tempMaxAvg) ? `Ø ${Math.round(tempMaxAvg)} °C tagsüber` : 'Temperatur unbekannt';
  const r = precipMm < 8 ? 'überwiegend trocken' : precipMm < 25 ? 'vereinzelt Niederschlag' : 'eher feucht';
  return `${t}, ${r}`;
}

/** Holt Klima-Proxy (Vorjahr) für eine Destination + Zeitraum. */
export async function fetchWeather(lat: number, lon: number, period: DateRange): Promise<WeatherInfo | undefined> {
  const start = shiftYear(period.start, -1);
  const end = shiftYear(period.end || period.start, -1);
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${start}&end_date=${end}&daily=temperature_2m_max,precipitation_sum&timezone=auto`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { daily?: { temperature_2m_max?: number[]; precipitation_sum?: number[] } };
    const temps = (j.daily?.temperature_2m_max || []).filter((n) => typeof n === 'number');
    const precs = (j.daily?.precipitation_sum || []).filter((n) => typeof n === 'number');
    if (!temps.length) return undefined;
    const tempMaxAvg = temps.reduce((a, b) => a + b, 0) / temps.length;
    const precipMm = precs.reduce((a, b) => a + b, 0);
    return {
      score: scoreWeather(tempMaxAvg, precipMm),
      tempMaxAvg: Math.round(tempMaxAvg * 10) / 10,
      precipMm: Math.round(precipMm * 10) / 10,
      summary: summarize(tempMaxAvg, precipMm),
      basis: 'Vorjahres-Klima, gleicher Zeitraum',
    };
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

/** Reichert Destinationen mit Wetter an und sortiert nach Score (beste zuerst). */
export async function rankByWeather(options: DestinationOption[], period: DateRange): Promise<DestinationOption[]> {
  const enriched = await Promise.all(
    options.map(async (o) => ({ ...o, weather: await fetchWeather(o.lat, o.lon, period) }))
  );
  return enriched.sort((a, b) => (b.weather?.score ?? -1) - (a.weather?.score ?? -1));
}
