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

export function getGraphCredentials() {
  const c = mailConfig();
  return { tenantId: c.tenantId, clientId: c.clientId, clientSecret: c.clientSecret };
}

/** Basis-URL für den SSO-Redirect: Admin-Setting > NEXT_PUBLIC_SITE_URL. */
export function getLoginBaseUrl(): string {
  const m = getSettings().mail as { login_base_url?: string };
  return (m.login_base_url || '').replace(/\/+$/, '');
}

export function isGraphConfigured(): boolean {
  const c = mailConfig();
  return !!(c.tenantId && c.clientId && c.clientSecret && c.mailbox);
}

export function getMailbox(): string {
  return mailConfig().mailbox;
}

/** Empfänger interner Team-Benachrichtigungen (default = Postfach). */
export function getNotifyTo(): string {
  const m = getSettings().mail as { notify_to?: string };
  return (m.notify_to || '').trim() || mailConfig().mailbox;
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
    console.error(`[Graph] Token-Fehler (App ${c.clientId}, Tenant ${tenant}):`, res.status, txt);
    return null;
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

export interface MailAttachment {
  /** Anzeigename inkl. Endung, z.B. "Angebot French Open 2027.pdf" */
  name: string;
  /** MIME-Typ, z.B. "application/pdf" */
  contentType: string;
  /** Datei-Inhalt als Base64 (ohne data:-Präfix) */
  contentBytes: string;
}

export interface SendMailInput {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  /** Optional Plaintext-Variante (sonst aus HTML grob abgeleitet) */
  text?: string;
  /**
   * Optionale Datei-Anhänge. Kleine Mails gehen inline (base64) über /sendMail;
   * überschreiten die Anhänge in Summe ~2,5 MB, wird automatisch der Pfad
   * Draft → Anhänge (ggf. Upload-Session) → Senden genutzt (Graph-Limit:
   * /sendMail-Request max. 4 MB).
   */
  attachments?: MailAttachment[];
}

// Ab dieser Summe an Roh-Bytes (dekodiert) wechseln wir von /sendMail (inline)
// auf Draft + Upload-Session. Gleichzeitig die Grenze, ab der ein EINZELNER
// Anhang am Draft per Upload-Session statt inline hochgeladen wird.
const INLINE_ATTACHMENT_LIMIT_BYTES = Math.floor(2.5 * 1024 * 1024);

// Chunk-Größe für Upload-Sessions: muss ein Vielfaches von 320 KiB sein
// (Graph-Vorgabe); 10 × 320 KiB = 3.276.800 Bytes.
const UPLOAD_CHUNK_BYTES = 10 * 320 * 1024;

/** Ungefähre Roh-Größe (dekodierte Bytes) eines Base64-Strings. */
function base64RawSize(b64: string): number {
  return Math.floor((b64 || '').length * 0.75);
}

export async function sendGraphMail(
  input: SendMailInput
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  if (!isGraphConfigured()) {
    console.warn('[Graph] Nicht konfiguriert — E-Mail-Versand übersprungen.');
    return { success: false, skipped: true, error: 'Graph nicht konfiguriert' };
  }

  const clientId = mailConfig().clientId;
  const token = await getGraphToken();
  if (!token) return { success: false, error: `Kein Graph-Token (App ${clientId})` };

  const mailbox = getMailbox();

  const message: Record<string, unknown> = {
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

  const attachments = input.attachments || [];
  const totalRawBytes = attachments.reduce((sum, a) => sum + base64RawSize(a.contentBytes), 0);

  // Große Mails: /sendMail (JSON) ist auf ~4 MB Request-Größe begrenzt —
  // ab ~2,5 MB Anhang-Summe daher Draft + Upload-Session statt inline.
  if (attachments.length > 0 && totalRawBytes > INLINE_ATTACHMENT_LIMIT_BYTES) {
    return sendGraphMailViaDraft(token, mailbox, clientId, message, attachments);
  }

  if (attachments.length > 0) {
    message.attachments = attachments.map((a) => ({
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: a.name,
      contentType: a.contentType,
      contentBytes: a.contentBytes,
    }));
  }

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
  console.error(`[Graph] sendMail Fehler (App ${clientId}, Postfach ${mailbox}):`, res.status, txt);
  return { success: false, error: `${res.status} (App ${clientId}, Postfach ${mailbox}): ${txt}` };
}

/**
 * Versand großer Mails (Anhänge in Summe > ~2,5 MB):
 *   1. Draft anlegen (POST /users/{mailbox}/messages)
 *   2. Anhänge einzeln anhängen — kleine inline, große per Upload-Session
 *      (Chunks als Vielfache von 320 KiB, PUT ohne Authorization-Header)
 *   3. Draft senden (POST /users/{mailbox}/messages/{id}/send)
 * Ergebnis-Shape identisch zu sendGraphMail, damit Call-Sites unverändert bleiben.
 */
async function sendGraphMailViaDraft(
  token: string,
  mailbox: string,
  clientId: string,
  message: Record<string, unknown>,
  attachments: MailAttachment[]
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const userBase = `${GRAPH_BASE}/users/${encodeURIComponent(mailbox)}`;
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 1) Draft anlegen (Betreff/Body/Empfänger wie beim Inline-Versand)
  const draftRes = await fetch(`${userBase}/messages`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(message),
  });
  if (!draftRes.ok) {
    const txt = await draftRes.text().catch(() => '');
    console.error(`[Graph] Draft-Erstellung Fehler (App ${clientId}, Postfach ${mailbox}):`, draftRes.status, txt);
    return { success: false, error: `Draft-Erstellung ${draftRes.status} (App ${clientId}, Postfach ${mailbox}): ${txt}` };
  }
  const draft = (await draftRes.json()) as { id?: string };
  if (!draft.id) {
    return { success: false, error: 'Draft-Erstellung: keine Message-ID erhalten' };
  }

  // 2) Anhänge einzeln an den Draft hängen
  for (const att of attachments) {
    const raw = Buffer.from(att.contentBytes, 'base64');

    if (raw.length <= INLINE_ATTACHMENT_LIMIT_BYTES) {
      // Kleiner Anhang: direkt als fileAttachment ans Draft (Limit hier ~3 MB)
      const attRes = await fetch(`${userBase}/messages/${draft.id}/attachments`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.name,
          contentType: att.contentType,
          contentBytes: att.contentBytes,
        }),
      });
      if (!attRes.ok) {
        const txt = await attRes.text().catch(() => '');
        console.error(`[Graph] Anhang "${att.name}" Fehler (Postfach ${mailbox}):`, attRes.status, txt);
        return { success: false, error: `Anhang "${att.name}" ${attRes.status}: ${txt}` };
      }
      continue;
    }

    // Großer Anhang: Upload-Session anlegen …
    const sessionRes = await fetch(`${userBase}/messages/${draft.id}/attachments/createUploadSession`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        AttachmentItem: { attachmentType: 'file', name: att.name, size: raw.length },
      }),
    });
    if (!sessionRes.ok) {
      const txt = await sessionRes.text().catch(() => '');
      console.error(`[Graph] UploadSession "${att.name}" Fehler (Postfach ${mailbox}):`, sessionRes.status, txt);
      return { success: false, error: `UploadSession "${att.name}" ${sessionRes.status}: ${txt}` };
    }
    const session = (await sessionRes.json()) as { uploadUrl?: string };
    if (!session.uploadUrl) {
      return { success: false, error: `UploadSession "${att.name}": keine uploadUrl erhalten` };
    }

    // … und Bytes in Chunks hochladen (Vielfache von 320 KiB, letzter Chunk beliebig)
    for (let start = 0; start < raw.length; start += UPLOAD_CHUNK_BYTES) {
      const end = Math.min(start + UPLOAD_CHUNK_BYTES, raw.length);
      const chunk = new Uint8Array(raw.subarray(start, end));
      const putRes = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          // WICHTIG: KEIN Authorization-Header — die uploadUrl ist vor-autorisiert.
          'Content-Type': 'application/octet-stream',
          'Content-Range': `bytes ${start}-${end - 1}/${raw.length}`,
        },
        body: chunk,
      });
      if (!putRes.ok) {
        const txt = await putRes.text().catch(() => '');
        console.error(`[Graph] Chunk-Upload "${att.name}" (${start}-${end - 1}) Fehler:`, putRes.status, txt);
        return { success: false, error: `Chunk-Upload "${att.name}" ${putRes.status}: ${txt}` };
      }
    }
  }

  // 3) Draft versenden (landet automatisch in "Gesendete Elemente")
  const sendRes = await fetch(`${userBase}/messages/${draft.id}/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    // Leerer Body → Content-Length: 0 (Graph verlangt eine Länge beim POST)
    body: '',
  });
  if (sendRes.ok || sendRes.status === 202) {
    return { success: true };
  }
  const txt = await sendRes.text().catch(() => '');
  console.error(`[Graph] Draft-Versand Fehler (App ${clientId}, Postfach ${mailbox}):`, sendRes.status, txt);
  return { success: false, error: `Draft-Versand ${sendRes.status} (App ${clientId}, Postfach ${mailbox}): ${txt}` };
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
    console.error(`[Graph] listInbox Fehler (App ${mailConfig().clientId}, Postfach ${mailbox}):`, res.status, txt);
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

/** Health-Check fürs M365/Graph: Ist es konfiguriert und lässt sich ein Token holen? */
export async function graphHealth(): Promise<{ configured: boolean; tokenOk: boolean; error?: string }> {
  if (!isGraphConfigured()) return { configured: false, tokenOk: false };
  try {
    const token = await getGraphToken();
    return { configured: true, tokenOk: !!token, error: token ? undefined : 'Kein Token erhalten' };
  } catch (e) {
    return { configured: true, tokenOk: false, error: (e as Error).message };
  }
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
