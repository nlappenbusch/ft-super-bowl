/**
 * traffics.ts — Traffics Connector API v3 (DERTOUR), nur serverseitig.
 * ─────────────────────────────────────────────────────────────────────────────
 * Hotel-/Pauschal-/Flugsuche für die Angebotskalkulation.
 *
 *   GET {base}/offers         productType=pauschal|hotelonly  (Hotel + Zimmer + Verpflegung + Flug)
 *   GET {base}/offers/flight  reine Flüge
 *   GET {base}/offers/{code}  Einzelangebot prüfen (Live-Abfrage beim Veranstalter!)
 *   Header: Authorization: <authKey>
 *
 * SPARSAM (DERTOUR hat sich am 22.09.2026 über zu viele Vorabfragen beschwert):
 *  - Anfragen nur auf ausdrücklichen Klick, KEIN Hintergrund-Polling, keine Vorschläge beim Tippen.
 *  - Identische Suchen kommen aus dem Cache (Standard 60 min), parallele identische
 *    Suchen teilen sich EINE laufende Anfrage.
 *  - Harte Obergrenze pro Stunde (Standard 30) — darüber gibt es eine Fehlermeldung statt Anfrage.
 *  - Die Einzelprüfung `/offers/{code}` (geht bis zum Veranstalter durch) nur per eigenem Klick.
 *
 * Key: settings.json → traffics.auth_key (Admin trägt ihn ein), Fallback ENV TRAFFICS_API_KEY.
 * Sonderwert "mock" (oder ENV TRAFFICS_MOCK=1): liefert Beispieldaten ohne Netzwerk — für lokale Tests.
 */
import { getSettings } from './settingsStore';
import {
  buildSearchQuery, normalizeOffers, searchPath,
  type TrafficsOffer, type TrafficsSearchParams,
} from './trafficsModel';

export const TRAFFICS_DEFAULT_BASE = 'https://connector.traffics.de/v3/rest';

export class TrafficsError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

export interface TrafficsConfig {
  authKey: string;
  baseUrl: string;
  tourOperators: string[];
  cacheMs: number;
  maxPerHour: number;
  mock: boolean;
  keySource: 'settings' | 'env' | 'none';
}

export function getTrafficsConfig(): TrafficsConfig {
  const t = getSettings().traffics;
  const fromSettings = (t?.auth_key || '').trim();
  const fromEnv = (process.env.TRAFFICS_API_KEY || '').trim();
  const authKey = fromSettings || fromEnv;
  const ops = (t?.tour_operators || 'DER').split(/[\s,;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
  return {
    authKey,
    baseUrl: ((t?.base_url || '').trim() || TRAFFICS_DEFAULT_BASE).replace(/\/+$/, ''),
    tourOperators: ops.length ? ops : ['DER'],
    cacheMs: Math.max(1, Math.min(24 * 60, Number(t?.cache_minutes) || 60)) * 60_000,
    maxPerHour: Math.max(1, Math.min(500, Number(t?.max_requests_per_hour) || 30)),
    mock: authKey.toLowerCase() === 'mock' || process.env.TRAFFICS_MOCK === '1',
    keySource: fromSettings ? 'settings' : fromEnv ? 'env' : 'none',
  };
}

/* ─── Cache, Deduplizierung, Drossel (pro Prozess) ───────────────────────── */

const MAX_CACHE_ENTRIES = 200;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
/** Zeitstempel der echten Connector-Anfragen (letzte Stunde). */
const requestLog: number[] = [];
let lastError: { at: string; message: string } | null = null;

function pruneLog(now: number) {
  while (requestLog.length && now - requestLog[0] > 3_600_000) requestLog.shift();
}

export function trafficsUsage() {
  const now = Date.now();
  pruneLog(now);
  return { requests_last_hour: requestLog.length, cached_searches: cache.size, last_error: lastError };
}

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<{ data: T; cached: boolean }> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < ttlMs) return { data: hit.data as T, cached: true };
  const running = inflight.get(key);
  if (running) return { data: (await running) as T, cached: true };

  const p = load();
  inflight.set(key, p);
  try {
    const data = await p;
    cache.set(key, { at: Date.now(), data });
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return { data, cached: false };
  } finally {
    inflight.delete(key);
  }
}

async function connectorGet(cfg: TrafficsConfig, path: string, query: Array<[string, string]>): Promise<unknown> {
  const now = Date.now();
  pruneLog(now);
  if (requestLog.length >= cfg.maxPerHour) {
    throw new TrafficsError(
      `Anfrage-Limit erreicht (${cfg.maxPerHour} Connector-Anfragen pro Stunde). Bitte später erneut suchen — bereits gesuchte Kombinationen kommen weiter aus dem Cache.`,
      429
    );
  }
  requestLog.push(now);

  const url = new URL(cfg.baseUrl + path);
  for (const [k, v] of query) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: cfg.authKey, Accept: 'application/json', 'Accept-Encoding': 'gzip' },
      signal: AbortSignal.timeout(45_000),
      cache: 'no-store',
    });
  } catch (e) {
    lastError = { at: new Date().toISOString(), message: (e as Error).message };
    throw new TrafficsError(`Traffics nicht erreichbar: ${(e as Error).message}`, 502);
  }
  const text = await res.text();
  if (!res.ok) {
    // Fehltext kürzen, Key taucht in Antworten nicht auf — trotzdem nichts Rohes durchreichen.
    const snippet = text.replace(/\s+/g, ' ').slice(0, 240);
    lastError = { at: new Date().toISOString(), message: `HTTP ${res.status}` };
    if (res.status === 401 || res.status === 403) {
      throw new TrafficsError('Traffics lehnt den Zugang ab (401/403) — authKey in der Kalkulation unter „DERTOUR-Suche → Zugang" prüfen.', 502);
    }
    if (res.status === 404) return { totalResultCount: 0, offerList: [] }; // Connector: keine Treffer
    throw new TrafficsError(`Traffics-Fehler HTTP ${res.status}: ${snippet}`, 502);
  }
  try {
    lastError = null;
    return JSON.parse(text);
  } catch {
    throw new TrafficsError('Traffics lieferte keine gültige JSON-Antwort.', 502);
  }
}

/* ─── Öffentliche Funktionen ─────────────────────────────────────────────── */

export interface TrafficsSearchResult {
  total: number;
  offers: TrafficsOffer[];
  cached: boolean;
  mock: boolean;
  fetched_at: string;
}

export async function searchOffers(params: TrafficsSearchParams): Promise<TrafficsSearchResult> {
  const cfg = getTrafficsConfig();
  if (!cfg.authKey && !cfg.mock) throw new TrafficsError('Kein Traffics-authKey hinterlegt.', 400);
  const path = searchPath(params);
  const query = buildSearchQuery(params);
  const key = `search:${path}?${new URLSearchParams(query).toString()}`;

  const { data, cached: fromCache } = await cached(key, cfg.cacheMs, async () => {
    const raw = cfg.mock ? mockOffers(params) : await connectorGet(cfg, path, query);
    return { ...normalizeOffers(raw), fetched_at: new Date().toISOString() };
  });
  return { ...data, cached: fromCache, mock: cfg.mock };
}

/** Einzelangebot prüfen (`/offers/{code}`) — geht live bis zum Veranstalter, daher nur auf Klick. */
export async function verifyOffer(code: string, adults: number): Promise<{ status: string; message: string; cached: boolean; raw: unknown }> {
  const cfg = getTrafficsConfig();
  if (!cfg.authKey && !cfg.mock) throw new TrafficsError('Kein Traffics-authKey hinterlegt.', 400);
  const clean = code.trim();
  if (!/^[A-Za-z0-9_=+\-/]{4,600}$/.test(clean)) throw new TrafficsError('Ungültiger Angebotscode.', 400);
  const a = Math.min(8, Math.max(1, Math.round(adults) || 1));
  const key = `verify:${clean}:${a}`;
  const { data, cached: fromCache } = await cached(key, Math.min(cfg.cacheMs, 15 * 60_000), async () => {
    if (cfg.mock) return { statusCode: 'OK', trafficsReturnMessage: 'Buchbar (Beispieldaten)' };
    return connectorGet(cfg, `/offers/${encodeURIComponent(clean)}`, [['adults', String(a)]]);
  });
  const o = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return {
    status: String(o.statusCode || ''),
    message: String(o.trafficsReturnMessage || o.tomaMessage || ''),
    cached: fromCache,
    raw: { statusCode: o.statusCode, trafficsReturnCode: o.trafficsReturnCode, trafficsReturnMessage: o.trafficsReturnMessage, tomaInfo: o.tomaInfo },
  };
}

/* ─── Beispieldaten (authKey "mock") ─────────────────────────────────────── */

function mockOffers(p: TrafficsSearchParams): unknown {
  const nights = p.duration;
  const dep = p.departureAirports[0] || 'ZRH';
  const arr = p.arrivalAirports[0] || 'AGP';
  const flight = p.productType === 'hotelonly' ? null : {
    flight: {
      outboundLegList: [{ departureAirportCode: dep, arrivalAirportCode: arr, departureDate: p.fromDate, departureTime: '09:35', arrivalTime: '12:20', flightCarrierCode: 'LX', flightNumber: '2110' }],
      inboundLegList: [{ departureAirportCode: arr, arrivalAirportCode: dep, departureDate: p.toDate, departureTime: '16:50', arrivalTime: '19:30', flightCarrierCode: 'LX', flightNumber: '2111' }],
    },
  };
  const hotels = [
    { name: 'Gran Hotel Miramar GL', loc: 'Málaga', cat: '5', perNight: 310 },
    { name: 'Hotel Los Monteros Spa & Golf Resort', loc: 'Marbella', cat: '5', perNight: 285 },
    { name: 'Kempinski Hotel Bahía', loc: 'Estepona', cat: '5', perNight: 260 },
  ];
  const flightAdd = p.productType === 'pauschal' ? 380 : 0;
  if (p.productType === 'flight') {
    return { totalResultCount: '1', offerList: [{ code: 'MOCKFLIGHT1', productType: 'flight', personPrice: { value: '412', currency: 'EUR' }, totalPrice: { value: String(412 * p.adults), currency: 'EUR' }, travelDate: { fromDate: p.fromDate, toDate: p.toDate, duration: String(nights) }, tourOperator: { code: 'DER', name: 'DERTOUR (Beispiel)' }, flightOffer: flight }] };
  }
  return {
    totalResultCount: String(hotels.length),
    offerList: hotels.map((h, i) => {
      const pp = h.perNight * nights + flightAdd;
      return {
        code: `MOCK${p.productType.toUpperCase()}${i + 1}`,
        productType: p.productType,
        personPrice: { value: String(pp), currency: 'EUR' },
        totalPrice: { value: String(pp * p.adults), currency: 'EUR' },
        travelDate: { fromDate: p.fromDate, toDate: p.toDate, duration: String(nights) },
        tourOperator: { code: 'DER', name: 'DERTOUR (Beispiel)' },
        flightOffer: flight,
        hotelOffer: {
          hotel: { name: h.name, category: h.cat, country: { code: 'ES', name: 'Spanien' }, location: { name: h.loc, region: { name: 'Costa del Sol' } }, giata: { hotelId: String(1000 + i) } },
          roomType: { code: p.roomTypes[0] || 'EZ', name: p.roomTypes[0] === 'DZ' ? 'Doppelzimmer' : 'Einzelzimmer' },
          boardType: { code: p.boardTypes[0] || 'F', name: p.boardTypes[0] === 'HP' ? 'Halbpension' : 'Frühstück' },
        },
      };
    }),
  };
}
