/**
 * graphMailer.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Microsoft 365 / Graph API helper (App-only / Client-Credentials).
 *
 * Sendet & liest E-Mails über das echte Postfach (Shared Mailbox) `GRAPH_MAILBOX`.
 * Wird genutzt für: Bestätigungsmails, CRM-Antworten und Inbound-Polling.
 *
 * Benötigte Env-Variablen (alle erforderlich, sonst wird der Versand still übersprungen):
 *   GRAPH_TENANT_ID       Entra-ID Verzeichnis-(Tenant-)ID
 *   GRAPH_CLIENT_ID       App-Registrierung Client-ID
 *   GRAPH_CLIENT_SECRET   App-Registrierung Client-Secret
 *   GRAPH_MAILBOX         Absender-/Eingangspostfach, z.B. request@faltintravel.com
 *   GRAPH_FROM_NAME       (optional) Anzeigename, default "Faltin Travel"
 *
 * Erforderliche Application-Permissions (mit Admin-Consent):
 *   Mail.Send, Mail.ReadWrite
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getSettings } from './settingsStore';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

/** Effektive Mail-Konfiguration: Admin-Settings haben Vorrang, dann .env. */
function mailConfig() {
  const m = getSettings().mail;
  return {
    tenantId: m.tenant_id || process.env.GRAPH_TENANT_ID || '',
    clientId: m.client_id || process.env.GRAPH_CLIENT_ID || '',
    clientSecret: m.client_secret || process.env.GRAPH_CLIENT_SECRET || '',
    mailbox: m.mailbox || process.env.GRAPH_MAILBOX || '',
    fromName: m.from_name || process.env.GRAPH_FROM_NAME || 'Faltin Travel',
  };
}

export function isGraphConfigured(): boolean {
  const c = mailConfig();
  return !!(c.tenantId && c.clientId && c.clientSecret && c.mailbox);
}

export function getMailbox(): string {
  return mailConfig().mailbox;
}

export function getFromName(): string {
  return mailConfig().fromName;
}

// Token-Cache (Prozesslaufzeit), spart Token-Requests
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getGraphToken(): Promise<string | null> {
  if (!isGraphConfigured()) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const c = mailConfig();
  const tenant = c.tenantId;
  const params = new URLSearchParams({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[Graph] Token-Fehler:', res.status, txt);
    return null;
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

export interface SendMailInput {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  /** Optional Plaintext-Variante (sonst aus HTML grob abgeleitet) */
  text?: string;
}

export async function sendGraphMail(
  input: SendMailInput
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  if (!isGraphConfigured()) {
    console.warn('[Graph] Nicht konfiguriert — E-Mail-Versand übersprungen.');
    return { success: false, skipped: true, error: 'Graph nicht konfiguriert' };
  }

  const token = await getGraphToken();
  if (!token) return { success: false, error: 'Kein Graph-Token' };

  const mailbox = getMailbox();

  const message = {
    subject: input.subject,
    body: { contentType: 'HTML', content: input.html },
    toRecipients: [
      {
        emailAddress: {
          address: input.to,
          ...(input.toName ? { name: input.toName } : {}),
        },
      },
    ],
  };

  const res = await fetch(`${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });

  if (res.ok || res.status === 202) {
    return { success: true };
  }

  const txt = await res.text().catch(() => '');
  console.error('[Graph] sendMail Fehler:', res.status, txt);
  return { success: false, error: `${res.status}: ${txt}` };
}

export interface GraphInboxMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  bodyHtml: string;
  fromAddress: string;
  fromName: string;
  receivedAt: string;
}

/**
 * Liest die letzten Nachrichten aus dem Posteingang des Postfachs.
 * @param onlyUnread nur ungelesene (default true)
 * @param top max. Anzahl (default 25)
 */
export async function listInboxMessages(
  onlyUnread = true,
  top = 25
): Promise<GraphInboxMessage[]> {
  if (!isGraphConfigured()) return [];
  const token = await getGraphToken();
  if (!token) return [];

  const mailbox = getMailbox();
  const filter = onlyUnread ? '&$filter=isRead eq false' : '';
  const url =
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages` +
    `?$top=${top}&$select=id,subject,bodyPreview,body,from,receivedDateTime&$orderby=receivedDateTime desc${filter}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[Graph] listInbox Fehler:', res.status, txt);
    return [];
  }

  const json = (await res.json()) as {
    value: Array<{
      id: string;
      subject: string;
      bodyPreview: string;
      body?: { contentType: string; content: string };
      from?: { emailAddress?: { address?: string; name?: string } };
      receivedDateTime: string;
    }>;
  };

  return (json.value || []).map((m) => ({
    id: m.id,
    subject: m.subject || '',
    bodyPreview: m.bodyPreview || '',
    bodyHtml: m.body?.content || m.bodyPreview || '',
    fromAddress: m.from?.emailAddress?.address || '',
    fromName: m.from?.emailAddress?.name || '',
    receivedAt: m.receivedDateTime,
  }));
}

export async function markMessageRead(messageId: string): Promise<void> {
  if (!isGraphConfigured()) return;
  const token = await getGraphToken();
  if (!token) return;
  const mailbox = getMailbox();
  await fetch(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}/messages/${messageId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isRead: true }),
    }
  ).catch((e) => console.error('[Graph] markRead Fehler:', e));
}
