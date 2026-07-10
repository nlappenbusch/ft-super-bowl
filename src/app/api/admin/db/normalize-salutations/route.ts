import { NextResponse } from 'next/server';
import { dbAll, dbRun } from '@/lib/dbq';
import { normalizeSalutation } from '@/lib/customerStore';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/admin/db/normalize-salutations
 * Einmaliger Daten-Fix (TASK-00107): vereinheitlicht bestehende Anreden auf
 * "Herr"/"Frau" — in customers.salutation UND in bookings.travelers[].salutation.
 * Idempotent (mehrfach ausführbar, ändert nur, was abweicht). Admin-gated über
 * die Middleware (/api/admin/*).
 */
export async function POST() {
  try {
    // 1) Kundenstamm
    const customers = await dbAll<{ id: string; salutation: string | null }>(
      'SELECT id, salutation FROM customers'
    );
    let customersFixed = 0;
    for (const c of customers) {
      const norm = normalizeSalutation(c.salutation || '');
      if (norm !== (c.salutation || '')) {
        await dbRun("UPDATE customers SET salutation = ?, updated_at = datetime('now') WHERE id = ?", [norm, c.id]);
        customersFixed++;
      }
    }

    // 2) Reisende je Anfrage (travelers-JSON)
    const bookings = await dbAll<{ id: string; travelers: string | null }>(
      'SELECT id, travelers FROM booking_requests'
    );
    let bookingsFixed = 0;
    let travelersFixed = 0;
    for (const b of bookings) {
      if (!b.travelers) continue;
      let arr: unknown;
      try {
        arr = JSON.parse(b.travelers);
      } catch {
        continue;
      }
      if (!Array.isArray(arr)) continue;
      let changed = 0;
      const out = arr.map((t) => {
        if (t && typeof t === 'object' && 'salutation' in t) {
          const cur = String((t as { salutation?: unknown }).salutation ?? '');
          const norm = normalizeSalutation(cur);
          if (norm !== cur) {
            changed++;
            return { ...t, salutation: norm };
          }
        }
        return t;
      });
      if (changed > 0) {
        await dbRun("UPDATE booking_requests SET travelers = ?, updated_at = datetime('now') WHERE id = ?", [
          JSON.stringify(out),
          b.id,
        ]);
        bookingsFixed++;
        travelersFixed += changed;
      }
    }

    return NextResponse.json({
      success: true,
      customers_scanned: customers.length,
      customers_fixed: customersFixed,
      bookings_scanned: bookings.length,
      bookings_fixed: bookingsFixed,
      travelers_fixed: travelersFixed,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
