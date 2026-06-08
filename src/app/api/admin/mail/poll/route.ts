import { NextResponse } from 'next/server';
import { runInboundPoll } from '@/lib/inboundPoll';

/** Admin-Trigger für das Inbound-Polling (aus dem Mail-Panel). */
export async function POST() {
  const result = await runInboundPoll();
  if (!result.configured) {
    return NextResponse.json(
      { success: false, error: 'Microsoft 365 Graph ist nicht konfiguriert.' },
      { status: 503 }
    );
  }
  return NextResponse.json(result);
}
