import { NextResponse } from 'next/server';
import { migrateSqliteToPg } from '@/lib/pgMigrate';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/admin/db/migrate
 * Kopiert alle SQLite-Tabellen (bookings.db) nach PostgreSQL (db:5432).
 * Non-destruktiv für SQLite (nur lesend). App bleibt auf DB_BACKEND=sqlite, bis bewusst umgeschaltet wird.
 */
export async function POST() {
  try {
    const res = await migrateSqliteToPg();
    return NextResponse.json({ success: res.errors.length === 0, ...res });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
