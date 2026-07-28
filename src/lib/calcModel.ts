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
    }));
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
