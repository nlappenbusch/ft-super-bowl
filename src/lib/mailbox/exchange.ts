/**
 * mailbox/exchange.ts — Exchange Online REST (InvokeCommand), app-only.
 *
 * Gleiche App wie Graph (settings.mail bzw. GRAPH_*), Token für
 * https://outlook.office365.com/.default. Die App braucht dafür
 * Exchange.ManageAsApp und die Rolle „Exchange-Administrator“.
 * Wird nur LESEND genutzt (Postfächer und Postfachberechtigungen).
 */
import { getGraphCredentials, graphRequest } from '../graphMailer';

let token: { value: string; expiresAt: number; clientId: string } | null = null;
let initialDomain: string | null = null;

async function exchangeToken(): Promise<string> {
  const { tenantId, clientId, clientSecret } = getGraphCredentials();
  if (!tenantId || !clientId || !clientSecret) throw new Error('Microsoft 365 ist nicht konfiguriert.');
  if (token && token.clientId === clientId && token.expiresAt > Date.now() + 60_000) return token.value;
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://outlook.office365.com/.default',
      grant_type: 'client_credentials',
    }).toString(),
  });
  if (!res.ok) throw new Error(`Exchange-Token: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000, clientId };
  return j.access_token;
}

async function tenantInitialDomain(): Promise<string> {
  if (initialDomain) return initialDomain;
  const res = await graphRequest('/organization?$select=verifiedDomains');
  if (!res.ok) throw new Error(`Graph /organization: ${res.status}`);
  const j = (await res.json()) as { value?: Array<{ verifiedDomains?: Array<{ name: string; isInitial?: boolean }> }> };
  const d = j.value?.[0]?.verifiedDomains?.find((x) => x.isInitial)?.name;
  if (!d) throw new Error('Initiale Domain des Tenants nicht gefunden.');
  initialDomain = d;
  return d;
}

/** Einen Exchange-Cmdlet ausführen (nur Get-*). Liefert das value-Array. */
export async function exchangeGet<T = Record<string, unknown>>(cmdlet: string, params: Record<string, unknown> = {}): Promise<T[]> {
  if (!/^Get-[A-Za-z]+$/.test(cmdlet)) throw new Error('Nur Get-Cmdlets sind erlaubt.');
  const { tenantId } = getGraphCredentials();
  const [tok, dom] = await Promise.all([exchangeToken(), tenantInitialDomain()]);
  const res = await fetch(`https://outlook.office365.com/adminapi/beta/${encodeURIComponent(tenantId)}/InvokeCommand`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tok}`,
      'content-type': 'application/json',
      'x-responseformat': 'json',
      'x-anchormailbox': `UPN:SystemMailbox{bb558c35-97f1-4cb9-8ff7-d53741dc928c}@${dom}`,
      'x-clientapplication': 'FaltinNext-Mail',
    },
    body: JSON.stringify({ CmdletInput: { CmdletName: cmdlet, Parameters: params } }),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : {}; } catch { /* Rohtext */ }
  if (!res.ok) {
    const e = (data as { error?: { message?: string; details?: Array<{ message?: string }> } } | null)?.error;
    throw new Error(`Exchange ${cmdlet}: ${res.status} ${e?.details?.[0]?.message || e?.message || text.slice(0, 200)}`);
  }
  const v = (data as { value?: T[] } | null)?.value;
  return Array.isArray(v) ? v : [];
}
