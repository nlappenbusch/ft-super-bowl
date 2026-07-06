import { NextResponse } from 'next/server';

/**
 * GET /api/health → leichtgewichtiger Erreichbarkeits-Check.
 * Wird u.a. vom WP-Plugin (Wartungsbox-Selbstheilung, ab 1.8.3) aus dem
 * Browser abgefragt: Liefert der Endpoint 200, ist die Plattform wieder da
 * und eine vom Page-Cache eingefrorene Wartungsbox lädt sich selbst neu.
 * CORS für faltintravel.com kommt zentral aus next.config.ts (/api/*).
 */
export async function GET() {
  return NextResponse.json(
    { success: true, status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
