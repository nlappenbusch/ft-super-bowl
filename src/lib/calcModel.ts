/**
 * calcModel.ts — Reine Domänen-Logik der Angebotskalkulation (TASK-00115).
 * ─────────────────────────────────────────────────────────────────────────────
 * Client- UND serverseitig nutzbar (keine DB-/Node-Abhängigkeiten):
 * Kategorien, Positions-Typ, Summen-/Margen-Berechnung und der Vergleich
 * Kurs-Snapshot vs. aktuelle Kurse (Basis für den FX-Alert).
 */
import { convertAmount, isCalcCurrency, type CalcCurrency, type RatesSnapshot } from './fxRates';

/* ─── Kategorien ─────────────────────────────────────────────────────────── */

export const CALC_CATEGORIES = [
  { id: 'ticket', label: 'Ticket', hint: '' },
  { id: 'hotel', label: 'Unterkunft (Hotel)', hint: 'Mit Zimmerkategorie als Freitext.' },
  { id: 'flug', label: 'Anreise (Flug)', hint: '' },
  { id: 'transfer', label: 'Transfer', hint: '' },
  { id: 'extras', label: 'Extras', hint: 'Freitext — z. B. Reiseführer, Gifts, Hospitality, City Tax …' },
] as const;

export type CalcCategoryId = (typeof CALC_CATEGORIES)[number]['id'];

/** Entfernte Alt-Kategorien laufen unter Extras weiter. */
const LEGACY_CATEGORY_MAP: Record<string, CalcCategoryId> = {
  reisefuehrer: 'extras',
  gifts: 'extras',
};

export function normalizeCategory(id: unknown): string {
  const s = typeof id === 'string' && id ? id : 'extras';
  return LEGACY_CATEGORY_MAP[s] || s;
}

export function categoryLabel(id: string): string {
  return CALC_CATEGORIES.find((c) => c.id === id)?.label || id;
}

/** Schnellauswahl-Vorschläge für Extras-Positionen. */
export const EXTRAS_QUICK = [
  'Reiseführer',
  'Trikot',
  'Faltin Travel Lanyard',
  'Faltin Travel Ladekabel (Gift)',
  'Gepäckanhänger (Gift)',
] as const;

/** Standard-Extras, die jede NEUE Kalkulation vorbelegt bekommt (EK 0 — reine Inklusivleistungen). */
export const DEFAULT_EXTRAS = [
  'Faltin Travel Lanyard',
  'Faltin Travel Ladekabel (Gift)',
  'Gepäckanhänger (Gift)',
] as const;

/* ─── Positionen ─────────────────────────────────────────────────────────── */

export interface CalcItem {
  id: string;
  category: string;
  description: string;
  /** Zimmerkategorie (nur bei Unterkunft, Freitext). */
  room_category?: string;
  currency: CalcCurrency;
  /** EK je Einheit in `currency` — immer pro Person. */
  amount: number;
  /** Menge pro Person (z. B. 3 Hotelnächte), Default 1. */
  qty: number;
  /** Leistungsdatum von (ISO "YYYY-MM-DD" oder ''), z. B. Check-in bzw. Flugtag. */
  service_from?: string;
  /** Leistungsdatum bis (ISO "YYYY-MM-DD" oder ''), z. B. Check-out bzw. Rückflug. */
  service_to?: string;
  /** Herkunft der Position, z. B. "traffics:DER" (nur Info, erscheint nicht auf dem Angebot). */
  source?: string;

  /* ── Programm/Ablauf (alle optional) ── */
  /** Uhrzeit von "HH:MM" (z. B. Abholung, Beginn). */
  time_from?: string;
  /** Uhrzeit bis "HH:MM". */
  time_to?: string;

  /* ── Anbieter (intern, nie im Kunden-PDF) ── */
  supplier_name?: string;
  /** E-Mail und/oder Telefon */
  supplier_contact?: string;
  /** Angebots-/Buchungscode beim Anbieter */
  supplier_ref?: string;
  /** Verbindlichkeit des EK: vorgabe | listenpreis | richtwert | annahme | angebot | bestaetigt */
  price_status?: PriceStatus | '';
  /** Quelle/Beleg (Website, Angebot) */
  source_url?: string;

  /* ── Transfer/Strecke ── */
  route_from?: string;
  route_to?: string;
  distance_km?: number;
  duration_min?: number;
  /** z. B. "VIP-Reisebus 50 Plätze" */
  vehicle?: string;
  /** Treffpunkt/Abholort */
  pickup_point?: string;
}

/* ─── Preisstatus (Verbindlichkeit des EK) ───────────────────────────────── */

export const PRICE_STATUSES = [
  { id: 'vorgabe', label: 'Vorgabe' },
  { id: 'listenpreis', label: 'Listenpreis' },
  { id: 'richtwert', label: 'Richtwert' },
  { id: 'annahme', label: 'Annahme' },
  { id: 'angebot', label: 'Angebot' },
  { id: 'bestaetigt', label: 'Bestätigt' },
] as const;

export type PriceStatus = (typeof PRICE_STATUSES)[number]['id'];

export function priceStatusLabel(s?: string): string {
  return PRICE_STATUSES.find((p) => p.id === s)?.label || '';
}

/** "HH:MM" (auch "9:5", "0935", "9.35") → "09:35"; sonst ''. */
export function normTime(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  const m = s.match(/^(\d{1,2})[:.h]?(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` : '';
}

function optStr(v: unknown, max: number): string | undefined {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return s || undefined;
}

function optNum(v: unknown, max: number): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n * 10) / 10, max) : undefined;
}

/** Nur gesetzte Detailfelder übernehmen (hält das Items-JSON schlank). */
function sanitizeDetails(it: Record<string, unknown>): Partial<CalcItem> {
  const ps = PRICE_STATUSES.some((p) => p.id === it.price_status) ? (it.price_status as PriceStatus) : undefined;
  const out: Partial<CalcItem> = {
    time_from: normTime(it.time_from) || undefined,
    time_to: normTime(it.time_to) || undefined,
    supplier_name: optStr(it.supplier_name, 160),
    supplier_contact: optStr(it.supplier_contact, 200),
    supplier_ref: optStr(it.supplier_ref, 200),
    price_status: ps,
    source_url: optStr(it.source_url, 500),
    route_from: optStr(it.route_from, 160),
    route_to: optStr(it.route_to, 160),
    distance_km: optNum(it.distance_km, 100_000),
    duration_min: optNum(it.duration_min, 100_000),
    vehicle: optStr(it.vehicle, 160),
    pickup_point: optStr(it.pickup_point, 200),
  };
  for (const k of Object.keys(out) as Array<keyof CalcItem>) if (out[k] === undefined) delete out[k];
  return out;
}

/** Dauer in Minuten → "2 h 15 min" bzw. "45 min". */
export function fmtDuration(min?: number): string {
  if (!min || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** Strecke als Text: "Flughafen AGP → Gran Hotel Miramar · 12 km · 25 min · VIP-Reisebus". */
export function fmtRoute(i: Partial<CalcItem>, arrow = '→'): string {
  const route = i.route_from || i.route_to ? `${i.route_from || '?'} ${arrow} ${i.route_to || '?'}` : '';
  return [route, i.distance_km ? `${String(i.distance_km).replace('.', ',')} km` : '', fmtDuration(i.duration_min), i.vehicle || '']
    .filter(Boolean).join(' · ');
}

/** Zeitspanne "09:35–12:25" / "09:35" / "". */
export function fmtTimeRange(i: Partial<CalcItem>): string {
  if (i.time_from && i.time_to) return `${i.time_from}–${i.time_to}`;
  return i.time_from || (i.time_to ? `bis ${i.time_to}` : '');
}

/** ISO-Datum "YYYY-MM-DD" oder leerer String. */
export function normIsoDate(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/* ─── Teilnehmer (Pax) ───────────────────────────────────────────────────── */

export const MAX_PAX = 10_000;

/** Teilnehmerzahl absichern: ganze Zahl 1…10 000, Default 1. */
export function normPax(v: unknown): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_PAX);
}

/**
 * percent   — Marge in % vom EK
 * fixed     — Marge als Fixbetrag in der Zielwährung
 * target_vk — fixer Verkaufspreis; Marge (absolut + %) wird rückgerechnet
 */
export type MarginMode = 'percent' | 'fixed' | 'target_vk';

/** EK einer Position (Menge × Einzel-EK) in ihrer Währung. */
export function itemEk(item: Pick<CalcItem, 'amount' | 'qty'>): number {
  const amount = Number(item.amount) || 0;
  const qty = Number(item.qty) || 0;
  return amount * qty;
}

/** Rohdaten (z. B. aus Request-Body) in saubere Positionen überführen. */
export function sanitizeItems(raw: unknown, fallbackCurrency: CalcCurrency = 'CHF'): CalcItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
    .map((it) => ({
      id: typeof it.id === 'string' && it.id ? it.id : crypto.randomUUID(),
      category: normalizeCategory(it.category),
      description: typeof it.description === 'string' ? it.description : '',
      room_category: typeof it.room_category === 'string' ? it.room_category : '',
      currency: isCalcCurrency(it.currency) ? it.currency : fallbackCurrency,
      amount: Math.max(0, Number(it.amount) || 0),
      qty: Math.max(0, Number(it.qty) || 0) || 1,
      service_from: normIsoDate(it.service_from),
      service_to: normIsoDate(it.service_to),
      ...(typeof it.source === 'string' && it.source.trim() ? { source: it.source.trim().slice(0, 80) } : {}),
      ...sanitizeDetails(it),
    }));
}

/* ─── Optionale Zusatzleistungen (Angebot) ───────────────────────────────── */

/**
 * Freitext-Option auf dem Angebot ("Zusatznacht +…", "Frühbucher-Rabatt −…").
 * Der Betrag versteht sich pro Person in der Zielwährung; negativ = Abzug.
 * Optionen fliessen NICHT in den Angebots-Gesamtpreis ein — sie erscheinen als
 * +/−-Zeilen und können bei der Rechnungserstellung einzeln übernommen werden.
 */
export interface OfferExtra {
  id: string;
  label: string;
  amount: number;
}

/** Rohdaten (Request-Body/DB-JSON) in saubere Zusatzoptionen überführen. */
export function sanitizeExtras(raw: unknown): OfferExtra[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      id: typeof e.id === 'string' && e.id ? e.id : crypto.randomUUID(),
      label: typeof e.label === 'string' ? e.label.trim() : '',
      amount: Math.max(-1_000_000, Math.min(1_000_000, Number(e.amount) || 0)),
    }))
    .filter((e) => e.label);
}

/** "+ EUR 450.00" / "- EUR 250.00" (U+2212 fehlt im PDF-Standardfont → ASCII). */
export function fmtSignedMoney(n: number, currency: string): string {
  const abs = Math.abs(n || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : '+'} ${currency} ${abs}`;
}

/* ─── Summen & Marge ─────────────────────────────────────────────────────── */

export interface CalcTotals {
  /** EK gesamt in der Zielwährung. */
  ekTarget: number;
  /** Marge absolut in der Zielwährung. */
  marginAmount: number;
  /** Marge in % vom EK (bei Fixbetrag: effektiver Prozentsatz). */
  marginPercent: number;
  /** Verkaufspreis gesamt (EK + Marge) in der Zielwährung. */
  vkTarget: number;
  /** EK-Anteile je Eingabewährung (Summe in Währung + umgerechnet). */
  byCurrency: Array<{ currency: CalcCurrency; sum: number; inTarget: number }>;
}

/** Summen + Marge auf Basis eines Kurs-Stands. Ohne Kurse → null (UI zeigt Hinweis). */
export function computeTotals(
  items: CalcItem[],
  target: CalcCurrency,
  rates: RatesSnapshot | null,
  marginMode: MarginMode,
  marginValue: number
): CalcTotals | null {
  if (!rates) return null;
  const byCurrencyMap = new Map<CalcCurrency, number>();
  let ekTarget = 0;
  for (const item of items) {
    const ek = itemEk(item);
    if (ek <= 0) continue;
    byCurrencyMap.set(item.currency, (byCurrencyMap.get(item.currency) || 0) + ek);
    ekTarget += convertAmount(ek, item.currency, target, rates);
  }
  const value = Math.max(0, Number(marginValue) || 0);
  let marginAmount: number;
  if (marginMode === 'fixed') marginAmount = value;
  else if (marginMode === 'target_vk') marginAmount = value - ekTarget; // kann negativ sein → UI warnt
  else marginAmount = (ekTarget * value) / 100;
  const marginPercent = marginMode === 'percent' ? value : ekTarget > 0 ? (marginAmount / ekTarget) * 100 : 0;
  return {
    ekTarget,
    marginAmount,
    marginPercent,
    vkTarget: marginMode === 'target_vk' ? value : ekTarget + marginAmount,
    byCurrency: Array.from(byCurrencyMap.entries()).map(([currency, sum]) => ({
      currency,
      sum,
      inTarget: convertAmount(sum, currency, target, rates),
    })),
  };
}

/** Gruppensummen: Pro-Person-Werte × Teilnehmerzahl. */
export interface GroupTotals {
  pax: number;
  ekTotal: number;
  marginTotal: number;
  vkTotal: number;
}

export function computeGroupTotals(totals: CalcTotals | null, pax: unknown): GroupTotals | null {
  if (!totals) return null;
  const n = normPax(pax);
  return {
    pax: n,
    ekTotal: totals.ekTarget * n,
    marginTotal: totals.marginAmount * n,
    vkTotal: totals.vkTarget * n,
  };
}

/* ─── FX-Vergleich (Snapshot vs. aktuell) ────────────────────────────────── */

export interface FxComparison {
  snapshotDate: string;
  currentDate: string;
  /** EK gesamt in Zielwährung zu Snapshot-Kursen. */
  ekAtSnapshot: number;
  /** EK gesamt in Zielwährung zu aktuellen Kursen. */
  ekAtCurrent: number;
  /** Differenz absolut (aktuell − Snapshot); > 0 = EK teurer geworden. */
  diffAbs: number;
  /** Differenz in %; > 0 = EK teurer (rot), < 0 = EK günstiger (grün). */
  diffPct: number;
  /** Kursveränderung je verwendeter Fremdwährung (ggü. Zielwährung). */
  perCurrency: Array<{ currency: CalcCurrency; ratePct: number }>;
}

/**
 * Vergleicht den EK der Kalkulation zu Snapshot- vs. aktuellen Kursen.
 * null, wenn Kurse fehlen oder es (noch) keinen umrechenbaren EK gibt.
 */
export function compareEk(
  items: CalcItem[],
  target: CalcCurrency,
  snapshot: RatesSnapshot | null,
  current: RatesSnapshot | null
): FxComparison | null {
  if (!snapshot || !current) return null;
  let ekAtSnapshot = 0;
  let ekAtCurrent = 0;
  const used = new Set<CalcCurrency>();
  for (const item of items) {
    const ek = itemEk(item);
    if (ek <= 0) continue;
    used.add(item.currency);
    ekAtSnapshot += convertAmount(ek, item.currency, target, snapshot);
    ekAtCurrent += convertAmount(ek, item.currency, target, current);
  }
  if (ekAtSnapshot <= 0) return null;
  const diffAbs = ekAtCurrent - ekAtSnapshot;
  const perCurrency: FxComparison['perCurrency'] = [];
  for (const currency of used) {
    if (currency === target) continue;
    const crossSnap = convertAmount(1, currency, target, snapshot);
    const crossCur = convertAmount(1, currency, target, current);
    if (crossSnap > 0 && crossCur > 0) {
      perCurrency.push({ currency, ratePct: ((crossCur - crossSnap) / crossSnap) * 100 });
    }
  }
  return {
    snapshotDate: snapshot.date,
    currentDate: current.date,
    ekAtSnapshot,
    ekAtCurrent,
    diffAbs,
    diffPct: (diffAbs / ekAtSnapshot) * 100,
    perCurrency,
  };
}

/**
 * Vorschlag „Inkludierte Leistungen" (eine Zeile je Position, ohne Preise) —
 * für Rechnungs-PDF (ticket_details) und den Rechnungs-Dialog.
 */
export function buildIncludedServices(items: CalcItem[]): string {
  const knownIds = CALC_CATEGORIES.map((c) => c.id as string);
  const extraIds = Array.from(new Set(items.map((i) => i.category))).filter((c) => !knownIds.includes(c));
  const lines: string[] = [];
  for (const catId of [...knownIds, ...extraIds]) {
    for (const item of items.filter((i) => i.category === catId && (i.description.trim() || i.amount > 0))) {
      const qty = item.qty > 1 ? `${item.qty}× ` : '';
      const room = (item.room_category || '').trim() ? ` — ${item.room_category}` : '';
      const date = fmtServiceDate(item.service_from, item.service_to);
      lines.push(`Inkl. ${qty}${item.description.trim() || categoryLabel(catId)}${room}${date ? ` (${date})` : ''}`);
    }
  }
  return lines.join('\n');
}

/* ─── Formatierung ───────────────────────────────────────────────────────── */

/** Geldbetrag formatiert (de-CH: 12'345.60). */
export function fmtMoney(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat('de-CH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`;
  }
}

/** Prozentwert mit Vorzeichen, z. B. "+2,1 %" / "−1,4 %". */
export function fmtPct(p: number, digits = 1): string {
  const v = Number.isFinite(p) ? p : 0;
  const s = v.toFixed(digits).replace('.', ',');
  return `${v > 0 ? '+' : ''}${s} %`;
}

/* ─── Reisezeitraum ──────────────────────────────────────────────────────── */

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null;
  const d = new Date(`${iso}T12:00:00`); // Mittag → keine TZ-Kippfehler
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2027-02-05" → "Fr, 05.02.2027" (de-CH, mit Wochentag). */
export function fmtDateWeekday(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return '';
  const wd = new Intl.DateTimeFormat('de-CH', { weekday: 'short' }).format(d).replace('.', '');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${wd}, ${dd}.${mm}.${d.getFullYear()}`;
}

/** Anzahl Nächte zwischen zwei ISO-Daten (null, wenn unvollständig/ungültig). */
export function nightsBetween(startIso: string, endIso: string): number | null {
  const a = parseIsoDate(startIso);
  const b = parseIsoDate(endIso);
  if (!a || !b) return null;
  const nights = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return nights >= 0 ? nights : null;
}

/** "Fr, 05.02.2027 – Mo, 08.02.2027 · 3 Nächte" (null ohne gültigen Zeitraum). */
export function fmtPeriod(startIso: string, endIso: string): string | null {
  const from = fmtDateWeekday(startIso);
  const to = fmtDateWeekday(endIso);
  if (!from && !to) return null;
  if (from && to) {
    const n = nightsBetween(startIso, endIso);
    const nights = n === null ? '' : ` · ${n} ${n === 1 ? 'Nacht' : 'Nächte'}`;
    return `${from} – ${to}${nights}`;
  }
  return from || to;
}

/** Kompakter Zeitraum für Titel: "05.02.–08.02.2027 (3 Nächte)". */
export function fmtPeriodShort(startIso: string, endIso: string): string | null {
  const a = parseIsoDate(startIso);
  const b = parseIsoDate(endIso);
  if (!a || !b) return null;
  const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
  const n = nightsBetween(startIso, endIso);
  const nights = n === null ? '' : ` (${n} ${n === 1 ? 'Nacht' : 'Nächte'})`;
  return `${dm(a)}–${dm(b)}${b.getFullYear()}${nights}`;
}

/**
 * Leistungsdatum einer Position kompakt: "10.05.2027", "10.05.–13.05.2027"
 * bzw. "28.12.2026–02.01.2027" über den Jahreswechsel. '' ohne Datum.
 */
export function fmtServiceDate(fromIso?: string, toIso?: string): string {
  const a = parseIsoDate(fromIso || '');
  const b = parseIsoDate(toIso || '');
  const dmy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  const dm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.`;
  if (a && b) {
    if (fromIso === toIso) return dmy(a);
    return a.getFullYear() === b.getFullYear() ? `${dm(a)}–${dmy(b)}` : `${dmy(a)}–${dmy(b)}`;
  }
  if (a) return dmy(a);
  if (b) return `bis ${dmy(b)}`;
  return '';
}

/* ─── Programm / Tagesablauf ─────────────────────────────────────────────── */

export interface ProgramEntry {
  item: CalcItem;
  /** Mehrtägige Leistung (z. B. Hotel): an diesem Tag Beginn, laufend oder Ende */
  phase: 'single' | 'start' | 'end';
}

export interface ProgramDay {
  date: string;
  entries: ProgramEntry[];
}

/**
 * Tagesablauf aus den Positionen: je Tag (Leistungsdatum) die Leistungen nach
 * Uhrzeit sortiert. Mehrtägige Leistungen erscheinen am ersten und letzten Tag
 * (z. B. Hotel Check-in/Check-out); ohne Datum landen sie unter date ''.
 * Leere Platzhalter-Positionen (ohne Text und EK) fallen weg.
 */
export function buildProgram(items: CalcItem[]): ProgramDay[] {
  const days = new Map<string, ProgramEntry[]>();
  const push = (date: string, e: ProgramEntry) => {
    if (!days.has(date)) days.set(date, []);
    days.get(date)!.push(e);
  };
  for (const item of items) {
    if (!item.description.trim() && !(item.amount > 0)) continue;
    const from = item.service_from || '';
    const to = item.service_to || '';
    if (from && to && to !== from) {
      push(from, { item, phase: 'start' });
      push(to, { item, phase: 'end' });
    } else {
      push(from || to, { item, phase: 'single' });
    }
  }
  const timeKey = (e: ProgramEntry) =>
    (e.phase === 'end' ? e.item.time_to || e.item.time_from : e.item.time_from) || (e.phase === 'end' ? '23:58' : '23:59');
  return Array.from(days.entries())
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
    .map(([date, entries]) => ({ date, entries: entries.sort((x, y) => timeKey(x).localeCompare(timeKey(y))) }));
}

/** Zeit für eine Programmzeile (berücksichtigt Beginn/Ende mehrtägiger Leistungen). */
export function programTime(e: ProgramEntry): string {
  if (e.phase === 'start') return e.item.time_from || '';
  if (e.phase === 'end') return e.item.time_to || '';
  return fmtTimeRange(e.item);
}

/** Hat irgendeine Position Programmdaten (Datum/Zeit/Strecke)? */
export function hasProgramData(items: CalcItem[]): boolean {
  return items.some((i) => i.service_from || i.time_from || i.route_from || i.route_to);
}

/** "Tag N" ab dem ersten Programmtag (Kalendertage, nicht Reihenfolge). */
export function programDayLabel(days: ProgramDay[], date: string): string {
  const first = days.find((d) => d.date)?.date || '';
  if (!date) return 'Ohne Datum';
  const n = first ? nightsBetween(first, date) : null;
  return `Tag ${(n ?? 0) + 1} · ${fmtDateWeekday(date)}`;
}

/** Präfix für Beginn/Ende mehrtägiger Leistungen ("Check-in: ", "Hinflug: " …). */
export function programPrefix(e: ProgramEntry): string {
  if (e.phase === 'single') return '';
  const c = e.item.category;
  if (c === 'hotel') return e.phase === 'start' ? 'Check-in: ' : 'Check-out: ';
  if (c === 'flug') return e.phase === 'start' ? 'Hinflug: ' : 'Rückflug: ';
  return e.phase === 'start' ? 'Beginn: ' : 'Ende: ';
}
