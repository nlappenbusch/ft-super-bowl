/**
 * emailTemplates.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Markenkonforme HTML-E-Mail-Templates (Faltin Travel).
 * Inline-CSS, tabellenbasiert → maximale Kompatibilität in Mail-Clients.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { getSettings } from './settingsStore';

const NAVY = '#143047';
const ACCENT = '#d9531e';

/** Eindeutiger Betreff-Tag für Threading, z.B. "[RQ-12345]" */
export function subjectTag(requestNumber: string): string {
  return `[${requestNumber}]`;
}

/** Extrahiert eine RQ-Nummer aus beliebigem Betreff/Text (z.B. "Re: ... [RQ-12345]") */
export function parseRequestNumber(text: string): string | null {
  const m = text.match(/RQ-\d{3,}/i);
  return m ? m[0].toUpperCase() : null;
}

export function confirmationSubject(requestNumber: string, eventName?: string): string {
  const ev = eventName ? ` – ${eventName}` : '';
  return `Ihre Anfrage${ev} ${subjectTag(requestNumber)}`;
}

export function replySubject(requestNumber: string, eventName?: string): string {
  const ev = eventName ? ` – ${eventName}` : '';
  return `Re: Ihre Anfrage${ev} ${subjectTag(requestNumber)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Gemeinsames Grundgerüst (Header + Footer) */
function layout(innerHtml: string, preheader = ''): string {
  const c = getSettings().company;
  const year = '2026';
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:${NAVY};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(20,48,71,0.10);">
        <!-- Header -->
        <tr><td style="background:${NAVY};padding:30px 36px;">
          <table role="presentation" width="100%"><tr>
            <td style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.4px;">Faltin&nbsp;Travel</td>
            <td align="right" style="font-size:12px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1.5px;">Sports&nbsp;Travel</td>
          </tr></table>
        </td></tr>
        <!-- Accent bar -->
        <tr><td style="height:4px;background:${ACCENT};line-height:4px;font-size:4px;">&nbsp;</td></tr>
        <!-- Body -->
        <tr><td style="padding:36px;">${innerHtml}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#f5f7fa;padding:24px 36px;border-top:1px solid #e5e8ed;">
          <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${NAVY};">${escapeHtml(c.name)}</p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
            ${escapeHtml(c.street)}, ${escapeHtml(c.zip)} ${escapeHtml(c.city)}, ${escapeHtml(c.country)}<br>
            ${escapeHtml(c.phone)} · <a href="mailto:${escapeHtml(c.email)}" style="color:${ACCENT};text-decoration:none;">${escapeHtml(c.email)}</a> · ${escapeHtml(c.website)}
          </p>
          <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">© ${year} ${escapeHtml(c.name)} · Schweizer Reisegarantie</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;">Diese E-Mail wurde automatisch versendet. Bitte antworten Sie direkt auf diese Nachricht.</p>
    </td></tr>
  </table>
</body></html>`;
}

export interface ConfirmationInput {
  firstName?: string;
  requestNumber: string;
  eventName?: string;
  message?: string;
}

/** Fancy Bestätigungsmail an den Kunden ("Vielen Dank für Ihre Anfrage") */
export function confirmationEmailHtml(input: ConfirmationInput): string {
  const greeting = input.firstName ? `Hallo ${escapeHtml(input.firstName)},` : 'Guten Tag,';
  const ev = input.eventName ? escapeHtml(input.eventName) : 'Ihrem Wunsch-Event';

  const messageBlock = input.message
    ? `<tr><td style="padding-top:18px;">
         <p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Ihre Nachricht an uns</p>
         <div style="background:#f5f7fa;border:1px solid #e5e8ed;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap;">${escapeHtml(input.message)}</div>
       </td></tr>`
    : '';

  const inner = `
    <h1 style="margin:0 0 6px;font-size:24px;font-weight:800;color:${NAVY};">Vielen Dank für Ihre Anfrage! 🎉</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#374151;">
      ${greeting}<br>
      wir haben Ihre Anfrage zu <strong style="color:${NAVY};">${ev}</strong> erhalten und kümmern uns persönlich darum.
      In der Regel melden wir uns innerhalb von <strong>24 Stunden</strong> mit einem passenden Angebot bei Ihnen.
    </p>

    <!-- RQ Badge -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="background:${NAVY};border-radius:14px;">
        <table role="presentation" width="100%" style="background:${NAVY};border-radius:14px;"><tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.65);">Ihre Anfragenummer</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:1px;">${escapeHtml(input.requestNumber)}</p>
          </td>
          <td align="right" style="padding:20px 24px;">
            <span style="display:inline-block;background:${ACCENT};color:#ffffff;font-size:12px;font-weight:700;padding:7px 14px;border-radius:999px;">in Bearbeitung</span>
          </td>
        </tr></table>
      </td></tr>
    </table>

    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6b7280;">
      Bitte geben Sie diese Nummer bei Rückfragen an. Sie finden sie auch im Betreff dieser E-Mail —
      so ordnen wir Ihre Antworten automatisch dem richtigen Vorgang zu.
    </p>
    ${messageBlock ? `<table role="presentation" width="100%">${messageBlock}</table>` : ''}

    <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#374151;">
      Herzliche Grüße<br><strong style="color:${NAVY};">Ihr Faltin Travel Team</strong>
    </p>`;

  return layout(inner, `Ihre Anfrage ${input.requestNumber} ist bei uns eingegangen.`);
}

export interface ReplyInput {
  bodyText: string;
  requestNumber: string;
  eventName?: string;
  agentName?: string;
}

/** Markenkonforme Hülle für eine manuelle CRM-Antwort */
export function replyEmailHtml(input: ReplyInput): string {
  const bodyHtml = escapeHtml(input.bodyText).replace(/\n/g, '<br>');
  const signature = input.agentName ? escapeHtml(input.agentName) : 'Ihr Faltin Travel Team';

  const inner = `
    <p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">
      Vorgang ${escapeHtml(input.requestNumber)}${input.eventName ? ' · ' + escapeHtml(input.eventName) : ''}
    </p>
    <div style="margin:14px 0 0;font-size:15px;line-height:1.7;color:#374151;">${bodyHtml}</div>
    <p style="margin:24px 0 0;font-size:15px;line-height:1.7;color:#374151;">
      Herzliche Grüße<br><strong style="color:${NAVY};">${signature}</strong>
    </p>`;

  return layout(inner, input.bodyText.slice(0, 120));
}
