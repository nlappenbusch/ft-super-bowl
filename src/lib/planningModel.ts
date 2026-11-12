/**
 * planningModel.ts — Reiseplanung je Kalkulation (reine Logik, ohne Imports).
 * ─────────────────────────────────────────────────────────────────────────────
 * Ergänzt die Kalkulationspositionen um:
 *   • Programm / Tagesablauf: Tage mit Titel und Einträgen (Zeit, Programmpunkt,
 *     Ort, Anbieter, Transfer mit Strecke/km/Minuten/Fahrzeug, Notiz).
 *   • DMC- / Anbieter-Optionen (Kandidat → angefragt → Angebot → gewählt).
 *   • Belege / Quellen (Nr., URL oder interne Quelle, was belegt ist).
 * Gespeichert als JSON in `offer_calculations.planning`.
 */

export const PLAN_KINDS = [
  { id: 'programm', label: 'Programm', color: '#d9531e' },
  { id: 'transfer', label: 'Transfer', color: '#2563eb' },
  { id: 'essen', label: 'Essen', color: '#16a34a' },
  { id: 'freizeit', label: 'Freizeit', color: '#9ca3af' },
  { id: 'hotel', label: 'Hotel', color: '#7c3aed' },
  { id: 'flug', label: 'Flug', color: '#0f172a' },
] as const;
export type PlanKind = (typeof PLAN_KINDS)[number]['id'];

export const SUPPLIER_TYPES = [
  { id: 'dmc', label: 'DMC' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'airline', label: 'Airline' },
  { id: 'aktivitaet', label: 'Aktivität' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'transport', label: 'Transport' },
  { id: 'veranstalter', label: 'Veranstalter' },
  { id: 'sonstiges', label: 'Sonstiges' },
] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number]['id'];

export const SUPPLIER_STATUSES = [
  { id: 'kandidat', label: 'Kandidat' },
  { id: 'angefragt', label: 'Angefragt' },
  { id: 'angebot', label: 'Angebot liegt vor' },
  { id: 'gewaehlt', label: 'Gewählt' },
  { id: 'abgelehnt', label: 'Abgelehnt' },
] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number]['id'];

export const SOURCE_KINDS = [
  { id: 'website', label: 'Website' },
  { id: 'angebot', label: 'Angebot' },
  { id: 'mail', label: 'Mail' },
  { id: 'dokument', label: 'Dokument' },
  { id: 'system', label: 'System-Abfrage' },
  { id: 'annahme', label: 'Annahme' },
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number]['id'];

export interface PlanEntry {
  id: string;
  time_from: string;
  time_to: string;
  title: string;
  kind: PlanKind;
  location: string;
  /** Anbieter inkl. Kontakt — intern */
  supplier: string;
  /** Verknüpfte Kalkulationsposition */
  item_id: string;
  route_from: string;
  route_to: string;
  distance_km?: number;
  duration_min?: number;
  vehicle: string;
  /** Preisangabe als Text, z. B. "34,15 € (Tag)" — intern */
  price_note: string;
  /** z. B. "Listenpreis", "angefragt", "offen" — intern */
  status: string;
  note: string;
}

export interface PlanDay {
  id: string;
  date: string;
  title: string;
  entries: PlanEntry[];
}

export interface PlanSupplier {
  id: string;
  name: string;
  type: SupplierType;
  contact: string;
  coverage: string;
  source: string;
  status: SupplierStatus;
  inquiry_ids: string[];
  note: string;
}

export interface PlanSource {
  id: string;
  nr: string;
  ref: string;
  what: string;
  kind: SourceKind;
  item_ids: string[];
}

export interface Planning {
  days: PlanDay[];
  suppliers: PlanSupplier[];
  sources: PlanSource[];
  /** Freitext: was (noch) nicht kalkuliert ist */
  not_included: string;
}

export const EMPTY_PLANNING: Planning = { days: [], suppliers: [], sources: [], not_included: '' };

/* ─── Sanitizer ─────────────────────────────────────────────────────────── */

type O = Record<string, unknown>;
const obj = (v: unknown): O => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const s = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const id = (v: unknown) => s(v, 80) || (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
const oneOf = <T extends string>(v: unknown, list: readonly { id: T }[], dflt: T): T =>
  list.some((x) => x.id === v) ? (v as T) : dflt;
const num = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(typeof v === 'string' ? v.replace(',', '.') : v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : undefined;
};
const isoDate = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(s(v, 10)) ? s(v, 10) : '');
const ids = (v: unknown) => arr(v).map((x) => s(x, 80)).filter(Boolean).slice(0, 50);

/** "9:35", "0935", "09.35" → "09:35"; sonst ''. */
export function normPlanTime(v: unknown): string {
  const m = s(v, 10).match(/^(\d{1,2})[:.h]?(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]);
  const mi = Number(m[2]);
  return h <= 23 && mi <= 59 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : '';
}

function sanitizeEntry(raw: unknown): PlanEntry {
  const o = obj(raw);
  const e: PlanEntry = {
    id: id(o.id),
    time_from: normPlanTime(o.time_from),
    time_to: normPlanTime(o.time_to),
    title: s(o.title, 300),
    kind: oneOf(o.kind, PLAN_KINDS, 'programm'),
    location: s(o.location, 200),
    supplier: s(o.supplier, 400),
    item_id: s(o.item_id, 80),
    route_from: s(o.route_from, 200),
    route_to: s(o.route_to, 200),
    vehicle: s(o.vehicle, 160),
    price_note: s(o.price_note, 200),
    status: s(o.status, 80),
    note: s(o.note, 1000),
  };
  const km = num(o.distance_km);
  const min = num(o.duration_min);
  if (km !== undefined) e.distance_km = km;
  if (min !== undefined) e.duration_min = min;
  return e;
}

export function sanitizePlanning(raw: unknown): Planning {
  const o = obj(typeof raw === 'string' ? safeJson(raw) : raw);
  return {
    days: arr(o.days).slice(0, 60).map((d) => {
      const x = obj(d);
      return {
        id: id(x.id), date: isoDate(x.date), title: s(x.title, 200),
        entries: arr(x.entries).slice(0, 80).map(sanitizeEntry).filter((e) => e.title || e.time_from),
      };
    }),
    suppliers: arr(o.suppliers).slice(0, 100).map((r) => {
      const x = obj(r);
      return {
        id: id(x.id), name: s(x.name, 200), type: oneOf(x.type, SUPPLIER_TYPES, 'sonstiges'),
        contact: s(x.contact, 600), coverage: s(x.coverage, 1000), source: s(x.source, 500),
        status: oneOf(x.status, SUPPLIER_STATUSES, 'kandidat'), inquiry_ids: ids(x.inquiry_ids), note: s(x.note, 1000),
      };
    }).filter((r) => r.name),
    sources: arr(o.sources).slice(0, 200).map((r, i) => {
      const x = obj(r);
      return {
        id: id(x.id), nr: s(x.nr, 20) || `B${i + 1}`, ref: s(x.ref, 600), what: s(x.what, 600),
        kind: oneOf(x.kind, SOURCE_KINDS, 'website'), item_ids: ids(x.item_ids),
      };
    }).filter((r) => r.ref || r.what),
    not_included: s(o.not_included, 2000),
  };
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t || '{}'); } catch { return {}; }
}

export function isPlanningEmpty(p: Planning): boolean {
  return !p.days.length && !p.suppliers.length && !p.sources.length && !p.not_included;
}

/* ─── Schema / Timeline ─────────────────────────────────────────────────── */

/** "HH:MM" → Minuten seit 00:00 (oder null). */
export function timeToMin(t: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(t || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export interface TimelineBlock {
  entry: PlanEntry;
  /** Minuten ab 00:00 des Tages (kann > 1440 sein, über Mitternacht) */
  start: number;
  end: number;
  /** Punkt-Ereignis ohne Dauer (z. B. Abflug 09:35) */
  point: boolean;
}

/**
 * Blöcke für die schematische Ansicht eines Tages. Einträge ohne Endzeit werden
 * als Punkt gezeigt; Transfers ohne Endzeit, aber mit Fahrzeit, bekommen ihre
 * Dauer. Endzeit vor Beginn = über Mitternacht (+24 h).
 */
export function dayBlocks(day: PlanDay): TimelineBlock[] {
  const out: TimelineBlock[] = [];
  for (const e of day.entries) {
    const a = timeToMin(e.time_from);
    let b = timeToMin(e.time_to);
    if (a === null && b === null) continue;
    if (a === null) { out.push({ entry: e, start: b as number, end: b as number, point: true }); continue; }
    if (b === null && e.duration_min) b = a + e.duration_min;
    if (b === null) { out.push({ entry: e, start: a, end: a, point: true }); continue; }
    if (b < a) b += 24 * 60;
    out.push({ entry: e, start: a, end: b, point: b === a });
  }
  return out.sort((x, y) => x.start - y.start);
}

/** Sichtbarer Zeitbereich aller Tage, auf volle Stunden gerundet (min. 08–20 Uhr). */
export function timelineRange(days: PlanDay[]): { from: number; to: number } {
  let from = 8 * 60;
  let to = 20 * 60;
  for (const d of days) for (const b of dayBlocks(d)) { from = Math.min(from, b.start); to = Math.max(to, b.end); }
  return { from: Math.floor(from / 60) * 60, to: Math.min(30 * 60, Math.ceil(to / 60) * 60) };
}

export function kindColor(k: string): string {
  return PLAN_KINDS.find((x) => x.id === k)?.color || '#9ca3af';
}

export function kindLabel(k: string): string {
  return PLAN_KINDS.find((x) => x.id === k)?.label || k;
}

/** "Hotel → Granada · 130 km · 1 h 45 min · VIP-Reisebus" */
export function entryRoute(e: Pick<PlanEntry, 'route_from' | 'route_to' | 'distance_km' | 'duration_min' | 'vehicle'>, arrow = '→'): string {
  const r = e.route_from || e.route_to ? `${e.route_from || '?'} ${arrow} ${e.route_to || '?'}` : '';
  const dur = e.duration_min ? (e.duration_min >= 60 ? `${Math.floor(e.duration_min / 60)} h${e.duration_min % 60 ? ` ${Math.round(e.duration_min % 60)} min` : ''}` : `${e.duration_min} min`) : '';
  return [r, e.distance_km ? `${String(e.distance_km).replace('.', ',')} km` : '', dur, e.vehicle].filter(Boolean).join(' · ');
}

export function entryTime(e: Pick<PlanEntry, 'time_from' | 'time_to'>): string {
  if (e.time_from && e.time_to) return `${e.time_from}–${e.time_to}`;
  return e.time_from || (e.time_to ? `bis ${e.time_to}` : '');
}
