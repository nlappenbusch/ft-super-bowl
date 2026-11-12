/**
 * trafficsModel.ts — Reine Logik der Traffics-Connector-Suche (DERTOUR).
 * ─────────────────────────────────────────────────────────────────────────────
 * Client- UND serverseitig nutzbar, bewusst OHNE Imports (läuft so auch direkt
 * unter `node --test`): Suchparameter absichern, Query bauen (stabil sortiert →
 * Cache-Schlüssel), Antwort von `/offers` bzw. `/offers/flight` in eine flache
 * Trefferliste überführen und Treffer in Kalkulationspositionen umrechnen.
 *
 * API-Referenz: https://docs.traffics.de/connector/v3/ (Connector API 3.21.x).
 * `/offers` liefert je Angebot Hotel, Zimmer, Verpflegung UND Flugzeiten in
 * EINER Anfrage — deshalb nutzt die Suche `/offers` statt `/hotels` (dort fehlen
 * Zimmer/Verpflegung/Flug, man bräuchte je Hotel eine Folgeanfrage).
 */

export type TrafficsProductType = 'pauschal' | 'hotelonly' | 'flight';

export interface TrafficsSearchParams {
  productType: TrafficsProductType;
  /** ISO "YYYY-MM-DD" — Anreise / Hinflug. */
  fromDate: string;
  /** ISO "YYYY-MM-DD" — Abreise / Rückflug. */
  toDate: string;
  /** Nächte (= Reisedauer); leer → aus fromDate/toDate. */
  duration: number;
  /** Erwachsene pro Zimmer (1 = EZ-Preis p.P.). */
  adults: number;
  departureAirports: string[];
  arrivalAirports: string[];
  minCategory: number;
  roomTypes: string[];
  boardTypes: string[];
  tourOperators: string[];
  carrierCodes: string[];
  directOnly: boolean;
  hotelName: string;
  /** Anzahl Treffer (1…40). */
  limit: number;
}

export const TRAFFICS_MAX_LIMIT = 40;

const IATA = /^[A-Z0-9]{2,3}$/;
const CODE = /^[A-Z0-9+]{1,4}$/;

function isoDate(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime()) ? s : '';
}

function codeList(v: unknown, re: RegExp, max = 10): string[] {
  const raw = Array.isArray(v) ? v.join(',') : typeof v === 'string' ? v : '';
  const out: string[] = [];
  for (const part of raw.split(/[\s,;]+/)) {
    const c = part.trim().toUpperCase();
    if (c && re.test(c) && !out.includes(c)) out.push(c);
    if (out.length >= max) break;
  }
  return out.sort();
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Nächte zwischen zwei ISO-Daten (0, wenn unvollständig/negativ). */
export function nightsBetweenIso(fromIso: string, toIso: string): number {
  const a = isoDate(fromIso);
  const b = isoDate(toIso);
  if (!a || !b) return 0;
  const n = Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
  return n > 0 ? n : 0;
}

export type SanitizeResult = { ok: true; params: TrafficsSearchParams } | { ok: false; error: string };

/** Request-Body → abgesicherte Suchparameter (oder Fehlermeldung für die UI). */
export function sanitizeSearchParams(raw: unknown, defaultOperators: string[] = ['DER']): SanitizeResult {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const productType: TrafficsProductType =
    o.productType === 'hotelonly' || o.productType === 'flight' ? o.productType : 'pauschal';
  const fromDate = isoDate(o.fromDate);
  const toDate = isoDate(o.toDate);
  if (!fromDate || !toDate) return { ok: false, error: 'Bitte Anreise- und Abreisedatum angeben.' };
  const nights = nightsBetweenIso(fromDate, toDate);
  if (nights <= 0) return { ok: false, error: 'Das Abreisedatum muss nach dem Anreisedatum liegen.' };
  if (nights > 60) return { ok: false, error: 'Maximal 60 Nächte je Suche.' };

  const departureAirports = codeList(o.departureAirports, IATA, 5);
  const arrivalAirports = codeList(o.arrivalAirports, IATA, 5);
  if (productType !== 'hotelonly' && departureAirports.length === 0) {
    return { ok: false, error: 'Für Pauschal- und Flugsuche bitte einen Abflughafen (IATA, z. B. ZRH) angeben.' };
  }
  if (arrivalAirports.length === 0) {
    return { ok: false, error: 'Bitte einen Zielflughafen (IATA, z. B. AGP) angeben — Traffics sucht nach Zielgebiet über den Flughafen.' };
  }
  const tourOperators = codeList(o.tourOperators, /^[A-Z0-9]{2,5}$/, 5);
  return {
    ok: true,
    params: {
      productType,
      fromDate,
      toDate,
      duration: clampInt(o.duration, 1, 60, nights),
      adults: clampInt(o.adults, 1, 8, 1),
      departureAirports: productType === 'hotelonly' ? [] : departureAirports,
      arrivalAirports,
      minCategory: clampInt(o.minCategory, 0, 6, 0),
      roomTypes: productType === 'flight' ? [] : codeList(o.roomTypes, CODE, 6),
      boardTypes: productType === 'flight' ? [] : codeList(o.boardTypes, CODE, 6),
      tourOperators: tourOperators.length ? tourOperators : [...defaultOperators].sort(),
      carrierCodes: productType === 'hotelonly' ? [] : codeList(o.carrierCodes, /^[A-Z0-9]{2}$/, 5),
      directOnly: productType !== 'hotelonly' && o.directOnly === true,
      hotelName: productType === 'flight' ? '' : (typeof o.hotelName === 'string' ? o.hotelName.trim().slice(0, 80) : ''),
      limit: clampInt(o.limit, 1, TRAFFICS_MAX_LIMIT, TRAFFICS_MAX_LIMIT),
    },
  };
}

/** Pfad des Connector-Endpunkts für eine Suche. */
export function searchPath(p: TrafficsSearchParams): string {
  return p.productType === 'flight' ? '/offers/flight' : '/offers';
}

/**
 * Query-Parameter für den Connector, stabil sortiert (→ identische Suchen
 * ergeben denselben Cache-Schlüssel). Listen kommasepariert (style=form,
 * explode=false laut Spezifikation).
 */
export function buildSearchQuery(p: TrafficsSearchParams): Array<[string, string]> {
  const q: Array<[string, string]> = [];
  const add = (k: string, v: string | number | undefined | null) => {
    if (v === undefined || v === null || v === '') return;
    q.push([k, String(v)]);
  };
  const list = (k: string, v: string[]) => { if (v.length) add(k, v.join(',')); };

  if (p.productType !== 'flight') add('productType', p.productType);
  add('fromDate', p.fromDate);
  add('toDate', p.toDate);
  add('duration', p.duration);
  add('adults', p.adults);
  list('departureAirportList', p.departureAirports);
  list('arrivalAirportList', p.arrivalAirports);
  if (p.productType !== 'flight') {
    if (p.minCategory > 0) add('minCategory', p.minCategory);
    list('roomTypeList', p.roomTypes);
    list('boardTypeList', p.boardTypes);
    list('tourOperatorList', p.tourOperators);
    add('hotelName', p.hotelName);
    add('sortBy', 'price');
  }
  if (p.carrierCodes.length) add('flight[carrierCodeList]', p.carrierCodes.join(','));
  if (p.directOnly) {
    add('flight[directness]', 'N');
    add('returnFlight[directness]', 'N');
  }
  add('navigation', `1,${p.limit}`);
  return q.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/* ─── Antwort normalisieren ──────────────────────────────────────────────── */

export interface TrafficsFlightLeg {
  from: string;
  to: string;
  date: string;
  departure: string;
  arrival: string;
  carrier: string;
  flightNumber: string;
}

export interface TrafficsOffer {
  code: string;
  productType: string;
  tourOperator: string;
  tourOperatorName: string;
  hotelName: string;
  category: number;
  location: string;
  region: string;
  country: string;
  giataId: string;
  roomType: string;
  roomCode: string;
  board: string;
  boardCode: string;
  /** Preis pro Person für den gesamten Zeitraum (Pauschal: inkl. Flug). */
  personPrice: number;
  totalPrice: number;
  currency: string;
  fromDate: string;
  toDate: string;
  nights: number;
  outbound: TrafficsFlightLeg[];
  inbound: TrafficsFlightLeg[];
  pictureUrl: string;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number => {
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  return Number.isFinite(n) ? n : 0;
};

function legs(list: unknown): TrafficsFlightLeg[] {
  if (!Array.isArray(list)) return [];
  return list.map((l) => {
    const o = obj(l);
    return {
      from: str(o.departureAirportCode),
      to: str(o.arrivalAirportCode),
      date: str(o.departureDate),
      departure: str(o.departureTime),
      arrival: str(o.arrivalTime),
      carrier: str(o.flightCarrierCode),
      flightNumber: str(o.flightNumber),
    };
  });
}

function flightLegs(flightOffer: Obj, dir: 'outbound' | 'inbound'): TrafficsFlightLeg[] {
  const flight = obj(flightOffer.flight);
  const primary = legs(flight[`${dir}LegList`]);
  return primary.length ? primary : legs(obj(flight[dir]).legList);
}

/** `/offers`- bzw. `/offers/flight`-Antwort → flache Trefferliste. */
export function normalizeOffers(json: unknown): { total: number; offers: TrafficsOffer[] } {
  const root = obj(json);
  const list = Array.isArray(root.offerList) ? root.offerList : [];
  const offers: TrafficsOffer[] = [];
  for (const raw of list) {
    const o = obj(raw);
    const code = str(o.code);
    if (!code) continue;
    const hotelOffer = obj(o.hotelOffer);
    const hotel = obj(hotelOffer.hotel);
    const location = obj(hotel.location);
    const travel = obj(o.travelDate);
    const flightOffer = obj(o.flightOffer);
    const person = obj(o.personPrice);
    const total = obj(o.totalPrice);
    const op = obj(o.tourOperator);
    const fromDate = str(travel.fromDate);
    const toDate = str(travel.toDate);
    offers.push({
      code,
      productType: str(o.productType),
      tourOperator: str(op.code),
      tourOperatorName: str(op.name),
      hotelName: str(hotel.name),
      category: num(hotel.category),
      location: str(location.name),
      region: str(obj(location.region).name),
      country: str(obj(hotel.country).name),
      giataId: str(obj(hotel.giata).hotelId),
      roomType: str(obj(hotelOffer.roomType).name),
      roomCode: str(obj(hotelOffer.roomType).code),
      board: str(obj(hotelOffer.boardType).name),
      boardCode: str(obj(hotelOffer.boardType).code),
      personPrice: num(person.value),
      totalPrice: num(total.value),
      currency: str(person.currency) || str(total.currency) || 'EUR',
      fromDate,
      toDate,
      nights: num(travel.duration) || nightsBetweenIso(fromDate, toDate),
      outbound: flightLegs(flightOffer, 'outbound'),
      inbound: flightLegs(flightOffer, 'inbound'),
      pictureUrl: str(obj(hotel.mediaData).pictureUrl),
    });
  }
  return { total: num(root.totalResultCount) || offers.length, offers };
}

/* ─── Treffer → Kalkulationspositionen ───────────────────────────────────── */

/** Strukturell kompatibel zu `CalcItem` (calcModel.ts) — ohne Import. */
export interface AdoptedItem {
  id: string;
  category: 'hotel' | 'flug';
  description: string;
  room_category: string;
  currency: string;
  amount: number;
  qty: number;
  service_from: string;
  service_to: string;
  source: string;
}

/** "ZRH–AGP LX2110 09:35–12:10" (mehrere Legs mit " / "). */
export function fmtLegs(list: TrafficsFlightLeg[]): string {
  return list
    .map((l) => `${l.from}–${l.to} ${l.carrier}${l.flightNumber} ${l.departure}${l.arrival ? `–${l.arrival}` : ''}`.trim())
    .join(' / ');
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Nachtpreis mit 4 Nachkommastellen, damit Nächte × Preis wieder den Pauschalbetrag ergibt. */
const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/**
 * Treffer in Positionen umrechnen (EK pro Person):
 *  - hotelonly: Hotel, EK je Nacht × Nächte.
 *  - pauschal:  Hotel inkl. Flug als EK je Nacht × Nächte, dazu eine Flug-Position
 *               mit EK 0 und den Flugzeiten („im Pauschalpreis enthalten").
 *  - flight:    Flug, Menge 1.
 */
export function offerToItems(offer: TrafficsOffer, newId: () => string): AdoptedItem[] {
  const source = `traffics:${offer.tourOperator || 'DER'}:${offer.code.slice(0, 40)}`;
  const flightText = [fmtLegs(offer.outbound), fmtLegs(offer.inbound)].filter(Boolean).join(' · ');
  const flightDate = (fallback: string, list: TrafficsFlightLeg[]) => list[0]?.date || fallback;

  if (offer.productType === 'flight' || !offer.hotelName) {
    return [{
      id: newId(), category: 'flug',
      description: `Flug ${flightText || `${offer.fromDate} – ${offer.toDate}`}`.trim(),
      room_category: '', currency: offer.currency, amount: round2(offer.personPrice), qty: 1,
      service_from: flightDate(offer.fromDate, offer.outbound), service_to: flightDate(offer.toDate, offer.inbound),
      source,
    }];
  }

  const nights = Math.max(1, offer.nights || nightsBetweenIso(offer.fromDate, offer.toDate) || 1);
  const stars = offer.category > 0 ? ` (${offer.category}*)` : '';
  const place = [offer.location, offer.region].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  const isPackage = offer.productType === 'pauschal';
  const items: AdoptedItem[] = [{
    id: newId(), category: 'hotel',
    description: `${offer.hotelName}${stars}${place ? `, ${place}` : ''}${isPackage ? ' — Pauschale inkl. Flug' : ''}`,
    room_category: [offer.roomType, offer.board].filter(Boolean).join(' · '),
    currency: offer.currency, amount: round4(offer.personPrice / nights), qty: nights,
    service_from: offer.fromDate, service_to: offer.toDate, source,
  }];
  if (isPackage && flightText) {
    items.push({
      id: newId(), category: 'flug',
      description: `Flug ${flightText} (im Pauschalpreis enthalten)`,
      room_category: '', currency: offer.currency, amount: 0, qty: 1,
      service_from: flightDate(offer.fromDate, offer.outbound), service_to: flightDate(offer.toDate, offer.inbound),
      source,
    });
  }
  return items;
}

/* ─── Vergleich Pauschal vs. Flug + Hotel ────────────────────────────────── */

export const COMPARE_PRODUCTS: TrafficsProductType[] = ['pauschal', 'flight', 'hotelonly'];

export interface CompareRow {
  hotelName: string;
  category: number;
  giataId: string;
  /** Günstigste Pauschale für dieses Hotel (p.P.), sonst null. */
  packagePrice: number | null;
  packageCode: string;
  /** Günstigstes Nur-Hotel-Angebot für dieses Hotel (p.P.), sonst null. */
  hotelPrice: number | null;
  hotelCode: string;
  /** Günstigster Nur-Flug (p.P.), für alle Zeilen gleich. */
  flightPrice: number | null;
  /** Flug + Hotel einzeln (p.P.), null wenn ein Teil fehlt. */
  separatePrice: number | null;
  /** separat − Pauschal (> 0 = Pauschale günstiger). */
  diff: number | null;
  currency: string;
}

const hotelKey = (o: TrafficsOffer) => (o.giataId ? `g:${o.giataId}` : `n:${o.hotelName.trim().toLowerCase()}`);

/** Günstigstes Angebot je Hotel (Schlüssel: GIATA-ID, sonst Name). */
function cheapestByHotel(list: TrafficsOffer[]): Map<string, TrafficsOffer> {
  const m = new Map<string, TrafficsOffer>();
  for (const o of list) {
    if (!o.hotelName || o.personPrice <= 0) continue;
    const k = hotelKey(o);
    const cur = m.get(k);
    if (!cur || o.personPrice < cur.personPrice) m.set(k, o);
  }
  return m;
}

/**
 * Vergleicht je Hotel die günstigste Pauschale mit „günstigster Nur-Flug +
 * günstigstes Nur-Hotel". Preise pro Person; Währungen werden NICHT umgerechnet —
 * weichen sie ab, bleibt separatePrice/diff leer.
 * Sortierung: Hotels mit beiden Varianten zuerst, dann nach günstigstem Preis.
 */
export function compareOffers(packages: TrafficsOffer[], flights: TrafficsOffer[], hotels: TrafficsOffer[]): {
  cheapestFlight: TrafficsOffer | null;
  rows: CompareRow[];
} {
  const cheapestFlight = flights.filter((f) => f.personPrice > 0).sort((a, b) => a.personPrice - b.personPrice)[0] || null;
  const pk = cheapestByHotel(packages);
  const ho = cheapestByHotel(hotels);
  const keys = Array.from(new Set([...pk.keys(), ...ho.keys()]));
  const rows: CompareRow[] = keys.map((k) => {
    const p = pk.get(k) || null;
    const h = ho.get(k) || null;
    const ref = (p || h) as TrafficsOffer;
    const currency = ref.currency;
    const sameCur = !!h && !!cheapestFlight && h.currency === cheapestFlight.currency;
    const separate = h && cheapestFlight && sameCur ? Math.round((h.personPrice + cheapestFlight.personPrice) * 100) / 100 : null;
    return {
      hotelName: ref.hotelName,
      category: ref.category,
      giataId: ref.giataId,
      packagePrice: p ? p.personPrice : null,
      packageCode: p ? p.code : '',
      hotelPrice: h ? h.personPrice : null,
      hotelCode: h ? h.code : '',
      flightPrice: cheapestFlight ? cheapestFlight.personPrice : null,
      separatePrice: separate,
      diff: separate !== null && p && p.currency === currency && h?.currency === p.currency
        ? Math.round((separate - p.personPrice) * 100) / 100 : null,
      currency,
    };
  });
  const best = (r: CompareRow) => Math.min(r.packagePrice ?? Infinity, r.separatePrice ?? r.hotelPrice ?? Infinity);
  rows.sort((a, b) => {
    const both = (r: CompareRow) => (r.packagePrice !== null && r.separatePrice !== null ? 0 : 1);
    return both(a) - both(b) || best(a) - best(b);
  });
  return { cheapestFlight, rows };
}
