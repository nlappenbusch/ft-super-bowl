import { NextResponse } from 'next/server';
import { getCurrentRates } from '@/lib/fxRates';

/** GET /api/admin/calculations/rates → aktueller Kursstand (für den Editor). */
export async function GET() {
  const rates = await getCurrentRates();
  if (!rates) {
    return NextResponse.json({ success: false, error: 'Wechselkurse sind aktuell nicht abrufbar' }, { status: 502 });
  }
  return NextResponse.json({ success: true, data: rates });
}
