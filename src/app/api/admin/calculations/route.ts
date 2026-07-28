import { NextResponse } from 'next/server';
import { listCalculations, createCalculation, type CalculationInput } from '@/lib/calculationStore';
import { getCurrentRates } from '@/lib/fxRates';
import { compareEk } from '@/lib/calcModel';
import { getSessionEmployee } from '@/lib/serverSession';

/**
 * GET /api/admin/calculations → Liste aller Angebotskalkulationen,
 * je Zeile inkl. `fx` (EK-Veränderung Snapshot vs. aktuelle Kurse).
 */
export async function GET() {
  const [rows, current] = await Promise.all([listCalculations(), getCurrentRates()]);
  const data = rows.map((r) => ({
    ...r,
    fx: compareEk(r.items, r.target_currency, r.rates_snapshot, current),
  }));
  return NextResponse.json({ success: true, data, current_rates: current });
}

/**
 * POST /api/admin/calculations { title?, customer_id?, booking_id?, target_currency?,
 * margin_mode?, margin_value?, items?, notes?, status? }
 * → legt eine Kalkulation an; die zum Zeitpunkt gültigen Wechselkurse werden
 * als Snapshot festgeschrieben.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CalculationInput;
  const ctx = await getSessionEmployee().catch(() => null);
  const snapshot = await getCurrentRates();
  const calc = await createCalculation(body, snapshot, ctx?.employee?.name || ctx?.session?.name || '');
  if (!calc) return NextResponse.json({ success: false, error: 'Kalkulation konnte nicht angelegt werden' }, { status: 500 });
  return NextResponse.json({
    success: true,
    data: calc,
    rates_unavailable: !snapshot,
  });
}
