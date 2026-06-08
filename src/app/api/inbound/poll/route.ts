import { NextResponse } from 'next/server';
import { runInboundPoll } from '@/lib/inboundPoll';
import { getSettings } from '@/lib/settingsStore';

/**
 * Inbound-Polling (Cron-Endpoint).
 * Aufruf: GET/POST /api/inbound/poll?secret=<INBOUND_POLL_SECRET>
 * Schutz: wenn INBOUND_POLL_SECRET gesetzt ist, muss es übergeben werden.
 */
async function handle(request: Request) {
  const secret = getSettings().mail.inbound_poll_secret || process.env.INBOUND_POLL_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const provided =
      url.searchParams.get('secret') || request.headers.get('x-poll-secret') || '';
    if (provided !== secret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
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
