import { NextResponse } from 'next/server';
import { getHealth, readReport, reportAgeHours, runScan } from '@/lib/statusCheck';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/status
 * Liefert Live-Health + den gecachten Versions-/CVE-Report.
 * "Täglich": ist der Report älter als 24h (oder fehlt), wird im Hintergrund neu gescannt.
 */
export async function GET() {
  const health = await getHealth();
  const report = await readReport();
  const ageHours = reportAgeHours(report);

  let refreshing = false;
  if (ageHours === null || ageHours > 24) {
    refreshing = true;
    runScan(true).catch(() => {});
  }

  return NextResponse.json({ success: true, health, report, ageHours, refreshing });
}
