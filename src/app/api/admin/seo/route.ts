import { NextResponse } from 'next/server';
import { readSeoReport, seoReportAgeHours, runSeoScan } from '@/lib/seoCheck';

export const dynamic = 'force-dynamic';

/** GET /api/admin/seo – gecachter SEO/GEO-Report; >24h alt → Hintergrund-Refresh. */
export async function GET() {
  const report = await readSeoReport();
  const ageHours = seoReportAgeHours(report);
  let refreshing = false;
  if (ageHours === null || ageHours > 24) {
    refreshing = true;
    runSeoScan(true).catch(() => {});
  }
  return NextResponse.json({ success: true, report, ageHours, refreshing });
}
