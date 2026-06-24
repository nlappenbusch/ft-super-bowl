/**
 * emailTemplates.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Markenkonforme HTML-E-Mail-Templates (Faltin Travel).
 * Inline-CSS, tabellenbasiert → maximale Kompatibilität in Mail-Clients.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { getSettings } from './settingsStore';
import { siteConfig } from './siteConfig';

const NAVY = '#143047';
const ACCENT = '#d9531e';

/** Absolute Basis-URL (E-Mails brauchen absolute Bild-URLs). */
function baseUrl(): string {
  const m = getSettings().mail as { login_base_url?: string };
  return (m.login_base_url || process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url).replace(/\/+$/, '');
}

/** Öffentliche Basis-URL (für Portal-Links etc.). */
export function publicBaseUrl(): string {
  return baseUrl();
}

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

export interface RecipientInfo {
  salutation?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Tageszeit-abhängige Grußformel nach Schweizer/deutscher Serverzeit (Europe/Zurich = CET/CEST).
 *   <05 Guten Tag · <11 Guten Morgen · <14 Guten Mittag · <18 Guten Tag · sonst Guten Abend
 */
export function grussformel(date: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', hour: '2-digit', hour12: false }).format(date));
  if (h < 5) return 'Guten Tag';
  if (h < 11) return 'Guten Morgen';
  if (h < 14) return 'Guten Mittag';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

/**
 * Begrüßung (HTML-escaped, inkl. Komma).
 * - Mit Anrede (Herr/Frau): tageszeit-abhängig + Nachname, z.B. "Guten Morgen Herr Müller,".
 * - OHNE Anrede (Felder nicht gesetzt, z.B. aus CF7): neutral "Sehr geehrte Damen und Herren," (ohne Namen, ohne Grußformel).
 */
export function formalGreeting(r: RecipientInfo): string {
  const s = (r.salutation || '').trim().toLowerCase();
  const last = (r.lastName || '').trim();
  const g = grussformel();
  if (s === 'herr') return last ? `${g} Herr ${escapeHtml(last)},` : `${g} Herr,`;
  if (s === 'frau') return last ? `${g} Frau ${escapeHtml(last)},` : `${g} Frau,`;
  return 'Sehr geehrte Damen und Herren,';
}

/**
 * Ersetzt Platzhalter in bereits HTML-escaptem Text:
 *   {{anrede}}   → "Sehr geehrter Herr" / "Sehr geehrte Frau" / "Sehr geehrte Damen und Herren"
 *   {{vorname}}  → Vorname
 *   {{nachname}} → Nachname
 * Räumt überflüssige Leerzeichen vor Satzzeichen auf (Fallback ohne Nachname).
 */
/** Wie formalGreeting, aber OHNE tageszeit-abhaengige Grussformel (immer "Guten Tag"). */
export function neutralGreeting(r: RecipientInfo): string {
  const s = (r.salutation || '').trim().toLowerCase();
  const last = (r.lastName || '').trim();
  if (s === 'herr') return last ? `Guten Tag Herr ${escapeHtml(last)},` : `Guten Tag Herr,`;
  if (s === 'frau') return last ? `Guten Tag Frau ${escapeHtml(last)},` : `Guten Tag Frau,`;
  return 'Sehr geehrte Damen und Herren,';
}

export function renderRecipientTokens(escapedText: string, r: RecipientInfo): string {
  const s = (r.salutation || '').trim().toLowerCase();
  const hasSalutation = s === 'herr' || s === 'frau';
  // {{anrede}} = nur "Herr"/"Frau" (für "Guten Tag {{anrede}} {{nachname}}" → "Guten Tag Herr Mudda").
  const anrede = s === 'herr' ? 'Herr' : s === 'frau' ? 'Frau' : '';
  // Ohne Anrede: Name NICHT einsetzen → Fallback wird sauber "Guten Tag" (ohne Anrede/Vor-/Nachname).
  const vorname = hasSalutation ? escapeHtml((r.firstName || '').trim()) : '';
  const nachname = hasSalutation ? escapeHtml((r.lastName || '').trim()) : '';
  return escapedText
    .replace(/\{\{\s*grussformel\s*\}\}/gi, grussformel())
    .replace(/\{\{\s*anrede\s*\}\}/gi, anrede)
    .replace(/\{\{\s*vorname\s*\}\}/gi, vorname)
    .replace(/\{\{\s*nachname\s*\}\}/gi, nachname)
    .replace(/ +([,.;:!?])/g, '$1')   // Leerzeichen vor Satzzeichen
    .replace(/[ \t]{2,}/g, ' ')        // doppelte Leerzeichen (entstehen bei leeren Tokens)
    .replace(/[ \t]+$/gm, '');         // Leerzeichen am Zeilenende → "Guten Tag " wird "Guten Tag"
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
        <tr><td style="background:#ffffff;padding:26px 36px 18px;">
          <table role="presentation" width="100%"><tr>
            <td><img src="${baseUrl()}/faltin-logo-email.png" alt="Faltin Travel" height="40" style="display:block;height:40px;width:auto;border:0;outline:none;text-decoration:none;" /></td>
            <td align="right" style="vertical-align:middle;">
              <div style="font-size:13px;font-weight:800;color:${NAVY};letter-spacing:0.3px;">Faltin&nbsp;Travel&nbsp;AG</div>
              <div style="font-size:10px;color:${ACCENT};text-transform:uppercase;letter-spacing:2px;margin-top:3px;">Wir&nbsp;liefern&nbsp;Emotionen</div>
            </td>
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

/**
 * Markenkonformer CTA-Block zum Kundenportal. Wird in Kundenmails eingebettet.
 * withNote=true ergänzt den sympathischen Hinweis für die erste Auto-Antwort.
 */
export function portalCtaHtml(opts: { withNote?: boolean } = {}): string {
  // Kundenportal noch in Entwicklung – Portal-CTA vorerst aus allen Kundenmails entfernt.
  // TODO: Reaktivieren, sobald das Reiseportal live ist (vorheriger Inhalt: siehe Git-Historie).
  void opts;
  return '';
}

export interface MagicLinkInput {
  link: string;
  recipientName?: string;
  ttlMinutes?: number;
}

export function magicLinkSubject(): string {
  return 'Ihr Login-Link zum Faltin Reiseportal';
}

/** E-Mail mit dem Einmal-Login-Link fürs Kundenportal. */
export function magicLinkEmailHtml(input: MagicLinkInput): string {
  const ttl = input.ttlMinutes || 30;
  const hi = input.recipientName ? `Hallo ${escapeHtml(input.recipientName)},` : 'Guten Tag,';
  const inner = `
    <h1 style="margin:0 0 6px;font-size:23px;font-weight:800;color:${NAVY};">Ihr Login zum Reiseportal</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#374151;">
      ${hi}<br>
      mit einem Klick gelangen Sie sicher und ohne Passwort in Ihr persönliches Reiseportal –
      dort sehen Sie den Stand Ihrer Anfragen, können uns schreiben und Ihre Unterlagen abrufen.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="border-radius:12px;background:${ACCENT};">
      <a href="${input.link}" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:12px;">
        Jetzt einloggen →
      </a>
    </td></tr></table>
    <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:#6b7280;">
      Der Link ist aus Sicherheitsgründen <strong>${ttl} Minuten</strong> gültig und nur einmal verwendbar.
    </p>
    <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
      Falls Sie keinen Login angefordert haben, können Sie diese E-Mail ignorieren.
    </p>`;
  return layout(inner, 'Ihr Login-Link zum Faltin Reiseportal');
}

export interface ConfirmationInput {
  firstName?: string;
  lastName?: string;
  salutation?: string | null;
  requestNumber: string;
  eventName?: string;
  message?: string;
}

/** Fancy Bestätigungsmail an den Kunden ("Vielen Dank für Ihre Anfrage") */
export function confirmationEmailHtml(input: ConfirmationInput): string {
  const greeting = formalGreeting({ salutation: input.salutation, firstName: input.firstName, lastName: input.lastName });
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
    </p>
    ${portalCtaHtml({ withNote: true })}`;

  return layout(inner, `Ihre Anfrage ${input.requestNumber} ist bei uns eingegangen.`);
}

/** Default-Betreff der Auto-Antwort, wenn im Event keiner gepflegt ist. */
export function autoReplySubjectDefault(eventName?: string, requestNumber?: string): string {
  const ev = eventName ? ` zu ${eventName}` : '';
  const tag = requestNumber ? ` ${subjectTag(requestNumber)}` : '';
  return `Ihre unverbindliche Anfrage${ev}${tag}`;
}

export interface AutoReplyInput extends RecipientInfo {
  /** Frei definierbarer Nachrichtentext (Plaintext mit Zeilenumbrüchen, Platzhalter erlaubt). */
  message: string;
  eventName?: string;
  requestNumber?: string;
}

/**
 * Markenkonforme Hülle für die per-Event definierbare Auto-Antwort.
 * - Platzhalter {{anrede}}/{{vorname}}/{{nachname}} werden ersetzt.
 * - Beginnt der Text bereits mit einer Begrüßung (z.B. via {{anrede}}), wird KEINE
 *   automatische Anrede vorangestellt; sonst setzen wir eine geschlechtskorrekte davor.
 */
export function autoReplyHtml(input: AutoReplyInput): string {
  const r: RecipientInfo = { salutation: input.salutation, firstName: input.firstName, lastName: input.lastName };
  const rendered = renderRecipientTokens(escapeHtml(input.message || ''), r);

  // Eigene Begrüßung erkennen (erste nicht-leere Zeile)
  const firstLine = rendered.replace(/^\s+/, '').slice(0, 40).toLowerCase();
  const hasOwnGreeting = /^(sehr geehrt|hallo|guten (tag|morgen|mittag|abend)|liebe|moin|servus|hi[\s,]|hey[\s,])/.test(firstLine);
  const greetingHtml = hasOwnGreeting
    ? ''
    : `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">${neutralGreeting(r)}</p>`;

  const bodyHtml = rendered.replace(/\n/g, '<br>');

  // Bewusst minimal: nur (optionale) Anrede + der Admin-Text im Marken-Rahmen.
  // KEINE automatische Anfragenummer-Zeile und KEINE Grußformel – die Nachricht ist
  // vollständig vom Admin gepflegt (vermeidet doppelten/überflüssigen Text).
  // Die Anfragenummer steht weiterhin im Betreff (Threading).
  const inner = `
    ${greetingHtml}
    <div style="font-size:15px;line-height:1.7;color:#374151;">${bodyHtml}</div>
    ${portalCtaHtml({ withNote: true })}`;

  // Preheader (Inbox-Vorschau) aus dem BEREITS gerenderten Text bilden – sonst
  // erscheinen die {{…}}-Platzhalter unersetzt in der Gmail-/Client-Vorschau.
  // rendered ist HTML-escaped → für den Preheader zurück-entschärfen (layout() escaped erneut).
  const preheader = rendered
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  return layout(inner, preheader);
}

export interface InternalNotificationInput {
  requestNumber: string;
  eventName?: string;
  packageTitle?: string;
  customerName?: string;
  email: string;
  phone: string;
  startDate?: string;
  numberOfPersons?: number;
  doubleRooms?: number;
  singleRooms?: number;
  totalPrice?: number;
  message?: string;
  adminUrl?: string;
}

export function internalNotificationSubject(requestNumber: string, eventName?: string): string {
  const ev = eventName ? ` – ${eventName}` : '';
  return `🆕 Neue Anfrage${ev} ${subjectTag(requestNumber)}`;
}

/** Interne Benachrichtigung ans Team (request@) bei neuer Anfrage. */
export function internalNotificationHtml(input: InternalNotificationInput): string {
  const row = (label: string, value?: string | number) =>
    value === undefined || value === '' || value === null
      ? ''
      : `<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;width:42%;">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:14px;font-weight:600;color:${NAVY};">${escapeHtml(String(value))}</td></tr>`;
  const rooms = [
    input.doubleRooms ? `${input.doubleRooms}× DZ` : '',
    input.singleRooms ? `${input.singleRooms}× EZ` : '',
  ].filter(Boolean).join(' · ');
  const price = input.totalPrice ? `CHF ${Number(input.totalPrice).toLocaleString('de-CH')}` : '';
  const adminUrl = input.adminUrl || `${baseUrl()}/admin/crm`;
  const messageBlock = input.message
    ? `<tr><td colspan="2" style="padding-top:14px;"><p style="margin:0 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Nachricht des Kunden</p><div style="background:#f5f7fa;border:1px solid #e5e8ed;border-radius:12px;padding:14px 16px;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap;">${escapeHtml(input.message)}</div></td></tr>`
    : '';
  const inner = `
    <p style="margin:0 0 4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9ca3af;">Neue Buchungsanfrage</p>
    <h1 style="margin:0 0 18px;font-size:22px;font-weight:800;color:${NAVY};">${escapeHtml(input.eventName || input.packageTitle || 'Anfrage')} <span style="color:${ACCENT};">${escapeHtml(input.requestNumber)}</span></h1>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${row('Kunde', input.customerName)}
      ${row('E-Mail', input.email)}
      ${row('Telefon', input.phone)}
      ${row('Paket', input.packageTitle)}
      ${row('Reisedatum', input.startDate)}
      ${row('Personen', input.numberOfPersons)}
      ${row('Zimmer', rooms)}
      ${row('Richtpreis', price)}
      ${messageBlock}
    </table>
    <p style="margin:22px 0 0;"><a href="${adminUrl}" style="display:inline-block;background:${ACCENT};color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:11px 22px;border-radius:10px;">Im CRM öffnen →</a></p>`;
  return layout(inner, `Neue Anfrage ${input.requestNumber} – ${input.customerName || input.email}`);
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
    </p>
    ${portalCtaHtml()}`;

  return layout(inner, input.bodyText.slice(0, 120));
}
