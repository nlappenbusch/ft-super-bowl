import { NextResponse } from 'next/server';
import { runScan } from '@/lib/statusCheck';
import { getSettings } from '@/lib/settingsStore';
import { requireAdminSession } from '@/lib/apiGuard';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron-Endpoint für den täglichen System-Scan (außerhalb von /api/admin).
 * Aufruf: GET/POST /api/status/scan?secret=<INBOUND_POLL_SECRET>
 * Schutz: identisch zum Inbound-Poll – gültiges Secret ODER Admin-Session,
 * ohne konfiguriertes Secret fail-closed.
 */
async function handle(request: Request) {
  const secret = getSettings().mail.inbound_poll_secret || process.env.INBOUND_POLL_SECRET;
  const url = new URL(request.url);
  const provided = url.searchParams.get('secret') || request.headers.get('x-poll-secret') || '';
  if (!secret || provided !== secret) {
    const denied = await requireAdminSession();
    if (denied) return denied;
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
