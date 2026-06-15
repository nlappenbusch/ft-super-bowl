import { NextResponse } from 'next/server';
import { runScan } from '@/lib/statusCheck';
import { getSettings } from '@/lib/settingsStore';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron-Endpoint für den täglichen System-Scan (außerhalb von /api/admin, also ohne Login).
 * Aufruf: GET/POST /api/status/scan?secret=<INBOUND_POLL_SECRET>
 * Schutz: identisch zum Inbound-Poll – wenn ein Secret gesetzt ist, muss es übergeben werden.
 */
async function handle(request: Request) {
  const secret = getSettings().mail.inbound_poll_secret || process.env.INBOUND_POLL_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided = url.searchParams.get('secret') || request.headers.get('x-poll-secret') || '';
    if (provided !== secret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const report = await runScan(true);
    return NextResponse.json({ success: true, generatedAt: report.generatedAt, vulns: report.vulnerabilities.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }
