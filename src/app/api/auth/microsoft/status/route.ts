import { NextResponse } from 'next/server';
import { getGraphCredentials } from '@/lib/graphMailer';

/** Öffentlicher Status: ist Microsoft-365-SSO serverseitig konfiguriert? */
export async function GET() {
  const c = getGraphCredentials();
  return NextResponse.json({
    configured: !!(c.tenantId && c.clientId && c.clientSecret),
  });
}
