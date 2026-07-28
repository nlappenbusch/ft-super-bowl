/**
 * fxRates.ts — Wechselkurse für die Angebotskalkulation (TASK-00115).
 * ─────────────────────────────────────────────────────────────────────────────
 * Holt aktuelle Referenzkurse (EZB via frankfurter.dev, Fallback open.er-api.com)
 * und cached sie in-process (~30 min). Kurse sind EUR-basiert gespeichert
 * (Einheiten je 1 EUR); Umrechnung beliebiger Paare über Kreuzkurs.
 *
 * Die reinen Rechen-Helfer (convertAmount) sind client-safe — der eigentliche
 * Abruf (getCurrentRates) läuft nur serverseitig in API-Routen.
 */

export const CALC_CURRENCIES = ['EUR', 'USD', 'CHF', 'GBP'] as const;
export type CalcCurrency = (typeof CALC_CURRENCIES)[number];

export function isCalcCurrency(c: unknown): c is CalcCurrency {
  return typeof c === 'string' && (CALC_CURRENCIES as readonly string[]).includes(c);
}

export interface RatesSnapshot {
  base: 'EUR';
  /** Kursdatum laut Quelle (EZB-Referenzkurs), z. B. "2026-07-28". */
  date: string;
  /** Zeitpunkt des Abrufs (ISO). */
  fetched_at: string;
  source: string;
  /** Einheiten je 1 EUR (EUR: 1). */
  rates: Record<CalcCurrency, number>;
}

/** Betrag von `from` nach `to` über den EUR-Kreuzkurs umrechnen. */
export function convertAmount(amount: number, from: string, to: string, snapshot: RatesSnapshot): number {
  if (from === to) return amount;
  const rf = snapshot.rates[from as CalcCurrency];
  const rt = snapshot.rates[to as CalcCurrency];
  if (!rf || !rt || !Number.isFinite(amount)) return 0;
  return (amount / rf) * rt;
}

// ───────────────────────── Abruf + Cache (nur Server) ─────────────────────────

const TTL_MS = 30 * 60 * 1000;
let cache: { at: number; snapshot: RatesSnapshot } | null = null;

function buildSnapshot(date: string, source: string, r: Record<string, number>): RatesSnapshot {
  return {
    base: 'EUR',
    date,
    fetched_at: new Date().toISOString(),
    source,
    rates: { EUR: 1, USD: r.USD, CHF: r.CHF, GBP: r.GBP },
  };
}

/** Primärquelle: EZB-Referenzkurse via frankfurter.dev (kein API-Key nötig). */
async function fetchFrankfurter(): Promise<RatesSnapshot> {
  const res = await fetch('https://api.frankfurter.dev/v1/latest?symbols=USD,CHF,GBP', {
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`frankfurter HTTP ${res.status}`);
  const json = (await res.json()) as { base?: string; date?: string; rates?: Record<string, number> };
  const r = json.rates || {};
  if (json.base !== 'EUR' || !r.USD || !r.CHF || !r.GBP) throw new Error('frankfurter: unerwartete Antwort');
  return buildSnapshot(json.date || new Date().toISOString().slice(0, 10), 'EZB-Referenzkurse (frankfurter.dev)', r);
}

/** Fallback: open.er-api.com (täglich aktualisiert, kein Key). */
async function fetchErApi(): Promise<RatesSnapshot> {
  const res = await fetch('https://open.er-api.com/v6/latest/EUR', {
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`er-api HTTP ${res.status}`);
  const json = (await res.json()) as { result?: string; time_last_update_unix?: number; rates?: Record<string, number> };
  const r = json.rates || {};
  if (json.result !== 'success' || !r.USD || !r.CHF || !r.GBP) throw new Error('er-api: unerwartete Antwort');
  const date = json.time_last_update_unix
    ? new Date(json.time_last_update_unix * 1000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  return buildSnapshot(date, 'open.er-api.com', r);
}

/**
 * Aktuelle Kurse (gecacht, ~30 min). Bei Abruf-Fehlern wird der letzte
 * bekannte Stand geliefert; ganz ohne Daten → null (Aufrufer zeigen Hinweis).
 */
export async function getCurrentRates(force = false): Promise<RatesSnapshot | null> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.snapshot;
  try {
    const s = await fetchFrankfurter();
    cache = { at: Date.now(), snapshot: s };
    return s;
  } catch (e1) {
    try {
      const s = await fetchErApi();
      cache = { at: Date.now(), snapshot: s };
      return s;
    } catch (e2) {
      console.warn('[fx] Kursabruf fehlgeschlagen:', (e1 as Error).message, '/', (e2 as Error).message);
      return cache?.snapshot ?? null;
    }
  }
}
