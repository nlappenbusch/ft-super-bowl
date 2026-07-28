/**
 * calculationStore.ts — Angebotskalkulationen (TASK-00115).
 * ─────────────────────────────────────────────────────────────────────────────
 * EK-Kalkulation für Arrangements: Positionen je Kategorie mit EK in
 * EUR/USD/CHF/GBP, Kurs-Snapshot zum Erstellzeitpunkt, Marge (Prozent oder
 * Fixbetrag), optionale Zuordnung zu Kunde (CRM) und Anfrage (RQ-Nummer).
 * Läuft über die Backend-Abstraktion `dbq` (SQLite ODER Postgres).
 * Schema: database.initDatabase() (SQLite) bzw. dbq.applyPgSchemaEnhancements() (PG).
 */
import './database';
import { dbGet, dbAll, dbRun } from './dbq';
import { isCalcCurrency, type CalcCurrency, type RatesSnapshot } from './fxRates';
import { sanitizeItems, type CalcItem, type MarginMode } from './calcModel';

export type CalcStatus = 'entwurf' | 'aktiv' | 'archiviert';

export interface OfferCalculation {
  id: string;
  calc_number: string;
  created_at: string;
  updated_at: string;
  title: string;
  customer_id: string | null;
  booking_id: string | null;
  target_currency: CalcCurrency;
  margin_mode: MarginMode;
  margin_value: number;
  items: CalcItem[];
  rates_snapshot: RatesSnapshot | null;
  status: CalcStatus;
  notes: string;
  created_by: string;
}

/** Listen-/Detailzeile inkl. Kunde + Anfrage (JOIN). */
export interface OfferCalculationRow extends OfferCalculation {
  customer_name: string | null;
  request_number: string | null;
  package_title: string | null;
}

interface DbRow {
  id: string;
  calc_number: string | null;
  created_at: string;
  updated_at: string;
  title: string;
  customer_id: string | null;
  booking_id: string | null;
  target_currency: string;
  margin_mode: string;
  margin_value: number;
  items: string;
  rates_snapshot: string;
  status: string;
  notes: string;
  created_by: string;
  customer_name?: string | null;
  request_number?: string | null;
  package_title?: string | null;
}

function normStatus(s: unknown): CalcStatus {
  return s === 'aktiv' || s === 'archiviert' ? s : 'entwurf';
}

function normMarginMode(m: unknown): MarginMode {
  return m === 'fixed' ? 'fixed' : 'percent';
}

function normMarginValue(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1_000_000);
}

function parseRow(r: DbRow): OfferCalculationRow {
  let items: CalcItem[] = [];
  try {
    items = sanitizeItems(JSON.parse(r.items || '[]'));
  } catch {
    items = [];
  }
  let snapshot: RatesSnapshot | null = null;
  try {
    snapshot = r.rates_snapshot ? (JSON.parse(r.rates_snapshot) as RatesSnapshot) : null;
    if (snapshot && (!snapshot.rates || typeof snapshot.rates !== 'object')) snapshot = null;
  } catch {
    snapshot = null;
  }
  return {
    id: r.id,
    calc_number: r.calc_number || '',
    created_at: r.created_at,
    updated_at: r.updated_at,
    title: r.title || '',
    customer_id: r.customer_id || null,
    booking_id: r.booking_id || null,
    target_currency: isCalcCurrency(r.target_currency) ? r.target_currency : 'CHF',
    margin_mode: normMarginMode(r.margin_mode),
    margin_value: normMarginValue(r.margin_value),
    items,
    rates_snapshot: snapshot,
    status: normStatus(r.status),
    notes: r.notes || '',
    created_by: r.created_by || '',
    customer_name: r.customer_name ?? null,
    request_number: r.request_number ?? null,
    package_title: r.package_title ?? null,
  };
}

/** Nächste fortlaufende Kalkulationsnummer "KALK-1001" (atomar). */
export async function nextCalcNumber(): Promise<string> {
  const row = await dbGet<{ value: number }>(
    `UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value`,
    ['calculation_number']
  );
  return `KALK-${row?.value ?? Date.now()}`;
}

const SELECT_SQL = `
  SELECT oc.*, c.name AS customer_name, b.request_number AS request_number, b.package_title AS package_title
  FROM offer_calculations oc
  LEFT JOIN customers c ON c.id = oc.customer_id
  LEFT JOIN booking_requests b ON b.id = oc.booking_id`;

export async function listCalculations(): Promise<OfferCalculationRow[]> {
  const rows = await dbAll<DbRow>(`${SELECT_SQL} ORDER BY oc.created_at DESC`);
  return rows.map(parseRow);
}

export async function getCalculation(id: string): Promise<OfferCalculationRow | null> {
  const row = await dbGet<DbRow>(`${SELECT_SQL} WHERE oc.id = ?`, [id]);
  return row ? parseRow(row) : null;
}

export interface CalculationInput {
  title?: unknown;
  customer_id?: unknown;
  booking_id?: unknown;
  target_currency?: unknown;
  margin_mode?: unknown;
  margin_value?: unknown;
  items?: unknown;
  status?: unknown;
  notes?: unknown;
}

function normTarget(c: unknown): CalcCurrency {
  return isCalcCurrency(c) ? c : 'CHF';
}

function normIdRef(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
}

export async function createCalculation(
  input: CalculationInput,
  snapshot: RatesSnapshot | null,
  createdBy: string
): Promise<OfferCalculationRow | null> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const target = normTarget(input.target_currency);
  await dbRun(
    `INSERT INTO offer_calculations (
      id, calc_number, created_at, updated_at, title, customer_id, booking_id,
      target_currency, margin_mode, margin_value, items, rates_snapshot, status, notes, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      await nextCalcNumber(),
      now,
      now,
      typeof input.title === 'string' ? input.title.trim() : '',
      normIdRef(input.customer_id),
      normIdRef(input.booking_id),
      target,
      normMarginMode(input.margin_mode),
      normMarginValue(input.margin_value),
      JSON.stringify(sanitizeItems(input.items, target)),
      snapshot ? JSON.stringify(snapshot) : '',
      normStatus(input.status),
      typeof input.notes === 'string' ? input.notes : '',
      createdBy || '',
    ]
  );
  return getCalculation(id);
}

export type CalculationUpdate = CalculationInput & { rates_snapshot?: RatesSnapshot };

export async function updateCalculation(id: string, updates: CalculationUpdate): Promise<OfferCalculationRow | null> {
  const existing = await getCalculation(id);
  if (!existing) return null;

  const sets: string[] = [];
  const vals: unknown[] = [];
  const target = 'target_currency' in updates ? normTarget(updates.target_currency) : existing.target_currency;

  if ('title' in updates) { sets.push('title = ?'); vals.push(typeof updates.title === 'string' ? updates.title.trim() : ''); }
  if ('customer_id' in updates) { sets.push('customer_id = ?'); vals.push(normIdRef(updates.customer_id)); }
  if ('booking_id' in updates) { sets.push('booking_id = ?'); vals.push(normIdRef(updates.booking_id)); }
  if ('target_currency' in updates) { sets.push('target_currency = ?'); vals.push(target); }
  if ('margin_mode' in updates) { sets.push('margin_mode = ?'); vals.push(normMarginMode(updates.margin_mode)); }
  if ('margin_value' in updates) { sets.push('margin_value = ?'); vals.push(normMarginValue(updates.margin_value)); }
  if ('items' in updates) { sets.push('items = ?'); vals.push(JSON.stringify(sanitizeItems(updates.items, target))); }
  if ('status' in updates) { sets.push('status = ?'); vals.push(normStatus(updates.status)); }
  if ('notes' in updates) { sets.push('notes = ?'); vals.push(typeof updates.notes === 'string' ? updates.notes : ''); }
  if (updates.rates_snapshot) { sets.push('rates_snapshot = ?'); vals.push(JSON.stringify(updates.rates_snapshot)); }

  if (sets.length) {
    sets.push(`updated_at = ?`);
    vals.push(new Date().toISOString());
    await dbRun(`UPDATE offer_calculations SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  }
  return getCalculation(id);
}

export async function deleteCalculation(id: string): Promise<boolean> {
  const { changes } = await dbRun(`DELETE FROM offer_calculations WHERE id = ?`, [id]);
  return changes > 0;
}
