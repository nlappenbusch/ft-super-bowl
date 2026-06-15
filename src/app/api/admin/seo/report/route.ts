import { NextResponse } from 'next/server';
import { readSeoReport, runSeoScan } from '@/lib/seoCheck';
import { buildSeoReportPdf } from '@/lib/seoReportPdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** GET /api/admin/seo/report – gebrandeter SEO/GEO-Audit als PDF. */
export async function GET() {
  try {
    let report = await readSeoReport();
    if (!report) report = await runSeoScan(true);
    const pdf = buildSeoReportPdf(report);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Faltin-Travel_SEO-GEO-Audit_${date}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
