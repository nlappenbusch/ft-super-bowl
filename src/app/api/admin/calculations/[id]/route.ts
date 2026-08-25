import { NextResponse } from 'next/server';
import { getCalculation, updateCalculation, deleteCalculation, type CalculationUpdate } from '@/lib/calculationStore';
import { getCurrentRates } from '@/lib/fxRates';
import { compareEk } from '@/lib/calcModel';

/** GET → Kalkulation inkl. `fx`-Vergleich und aktuellem Kursstand. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const calc = await getCalculation(id);
  if (!calc) return NextResponse.json({ success: false, error: 'Kalkulation nicht gefunden' }, { status: 404 });
  const current = await getCurrentRates();
  return NextResponse.json({
    success: true,
    data: { ...calc, fx: compareEk(calc.items, calc.target_currency, calc.rates_snapshot, current) },
    current_rates: current,
  });
}

/**
 * PATCH { …Felder } → aktualisiert die Kalkulation.
 * Sonderfall { refresh_rates: true }: schreibt den Kurs-Snapshot neu auf den
 * aktuellen Stand fest (neue Kalkulationsbasis).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as CalculationUpdate & { refresh_rates?: boolean };

  const updates: CalculationUpdate = {};
  for (const key of ['title', 'customer_id', 'booking_id', 'travel_start', 'travel_end', 'target_currency', 'margin_mode', 'margin_value', 'items', 'offer_extras', 'status', 'notes', 'hotel_info'] as const) {
    if (key in body) updates[key] = body[key];
  }
  if (body.refresh_rates === true) {
    const current = await getCurrentRates(true);
    if (!current) {
      return NextResponse.json({ success: false, error: 'Wechselkurse sind aktuell nicht abrufbar' }, { status: 502 });
    }
    updates.rates_snapshot = current;
  }

  const calc = await updateCalculation(id, updates);
  if (!calc) return NextResponse.json({ success: false, error: 'Kalkulation nicht gefunden' }, { status: 404 });
  const current = await getCurrentRates();
  return NextResponse.json({
    success: true,
    data: { ...calc, fx: compareEk(calc.items, calc.target_currency, calc.rates_snapshot, current) },
    current_rates: current,
  });
}

/** DELETE → Kalkulation löschen. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteCalculation(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Kalkulation nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true });
}
