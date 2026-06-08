import { NextResponse } from 'next/server';
import { isGraphConfigured, getMailbox, getFromName } from '@/lib/graphMailer';

export async function GET() {
  const graphConfigured = isGraphConfigured();
  return NextResponse.json({
    success: true,
    data: {
      graphConfigured,
      mailbox: getMailbox(),
      fromName: getFromName(),
      tenantSet: !!process.env.GRAPH_TENANT_ID,
      clientSet: !!process.env.GRAPH_CLIENT_ID,
      secretSet: !!process.env.GRAPH_CLIENT_SECRET,
      brevoConfigured: !!process.env.BREVO_API_KEY,
      pollSecretSet: !!process.env.INBOUND_POLL_SECRET,
    },
  });
}
