import { NextResponse } from 'next/server';
import { isGraphConfigured, getMailbox, getFromName, getGraphCredentials, getLoginBaseUrl } from '@/lib/graphMailer';
import { getSettings } from '@/lib/settingsStore';

export async function GET() {
  const m = getSettings().mail;
  return NextResponse.json({
    success: true,
    data: {
      graphConfigured: isGraphConfigured(),
      mailbox: getMailbox(),
      fromName: getFromName(),
      tenantSet: !!(m.tenant_id || process.env.GRAPH_TENANT_ID),
      clientSet: !!(m.client_id || process.env.GRAPH_CLIENT_ID),
      secretSet: !!(m.client_secret || process.env.GRAPH_CLIENT_SECRET),
      mailboxSet: !!(m.mailbox || process.env.GRAPH_MAILBOX),
      brevoConfigured: !!(m.brevo_api_key || process.env.BREVO_API_KEY),
      loginConfigured: (() => { const c = getGraphCredentials(); return !!(c.tenantId && c.clientId && c.clientSecret); })(),
      loginBaseUrl: getLoginBaseUrl(),
      redirectUri: `${getLoginBaseUrl()}/api/auth/microsoft/callback`,
      pollSecretSet: !!(m.inbound_poll_secret || process.env.INBOUND_POLL_SECRET),
    },
  });
}
