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
  { id: 'ticket', label: 'Ticket' },
  { id: 'hotel', label: 'Unterkunft (Hotel)' },
  { id: 'flug', label: 'Anreise (Flug)' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'reisefuehrer', label: 'Reiseführer' },
  { id: 'extras', label: 'Extras' },
  { id: 'gifts', label: 'Gifts' },
] as const;

export type CalcCategoryId = (typeof CALC_CATEGORIES)[number]['id'];

export function categoryLabel(id: string): string {
  return CALC_CATEGORIES.find((c) => c.id === id)?.label || id;
}

/* ─── Positionen ─────────────────────────────────────────────────────────── */

export interface CalcItem {
  id: string;
  category: string;
  description: string;
  currency: CalcCurrency;
  /** EK je Einheit in `currency`. */
  amount: number;
  /** Menge (z. B. 4 Tickets à 500 USD), Default 1. */
  qty: number;
}

export type MarginMode = 'percent' | 'fixed';

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
      category: typeof it.category === 'string' && it.category ? it.category : 'extras',
      description: typeof it.description === 'string' ? it.description : '',
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
  const marginAmount = marginMode === 'fixed' ? value : (ekTarget * value) / 100;
  const marginPercent = marginMode === 'percent' ? value : ekTarget > 0 ? (marginAmount / ekTarget) * 100 : 0;
  return {
    ekTarget,
    marginAmount,
    marginPercent,
    vkTarget: ekTarget + marginAmount,
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
