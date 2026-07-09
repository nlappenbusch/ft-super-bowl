import { NextResponse } from 'next/server';
import { runInboundPoll } from '@/lib/inboundPoll';
import { getSettings } from '@/lib/settingsStore';
import { requireAdminSession } from '@/lib/apiGuard';

/**
 * Inbound-Polling (Cron-Endpoint).
 * Aufruf: GET/POST /api/inbound/poll?secret=<INBOUND_POLL_SECRET>
 * Schutz: gültiges Secret ODER Admin-Session. Ohne konfiguriertes Secret ist
 * der Endpoint NICHT offen (fail-closed) – der interne Scheduler
 * (instrumentation.ts) ruft runInboundPoll() direkt auf und braucht ihn nicht.
 */
async function handle(request: Request) {
  const secret = getSettings().mail.inbound_poll_secret || process.env.INBOUND_POLL_SECRET;
  const url = new URL(request.url);
  const provided =
    url.searchParams.get('secret') || request.headers.get('x-poll-secret') || '';
  if (!secret || provided !== secret) {
    const denied = await requireAdminSession();
    if (denied) return denied;
  }

  const result = await runInboundPoll();
  if (!result.configured) {
    return NextResponse.json(
      { success: false, error: 'Microsoft 365 Graph ist nicht konfiguriert.' },
      { status: 503 }
    );
  }
  return NextResponse.json(result);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
