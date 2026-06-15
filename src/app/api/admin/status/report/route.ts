import { NextResponse } from 'next/server';
import { getHealth, readReport, runScan } from '@/lib/statusCheck';
import { buildStatusReportPdf } from '@/lib/statusReportPdf';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/status/report
 * Erzeugt den gebrandeten System-Status- & Security-Audit-Report als PDF.
 * Nutzt den gecachten Scan; fehlt er, wird einmalig live gescannt.
 */
export async function GET() {
  try {
    const health = await getHealth();
    let report = await readReport();
    if (!report) report = await runScan(true);

    const pdf = buildStatusReportPdf(health, report);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Faltin-Travel_System-Status_${date}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
