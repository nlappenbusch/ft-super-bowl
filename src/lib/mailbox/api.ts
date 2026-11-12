/**
 * mailbox/api.ts — gemeinsame Helfer für die Routen unter /api/admin/mailbox.
 */
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { workspaceSession } from '../workspace/session';
import { describeAiError } from '../workspace/claude';
import { MailAccessError, mailboxesFor, type MailboxInfo } from './access';
import { GraphError } from './graph';
import { getGlobalMailConfig, getPersonalPrefs, DEFAULT_SIGNATURE_TEMPLATE } from './prefs';
import { getSettings } from '../settingsStore';

export interface MailUser {
  email: string;
  name: string;
  firstName: string;
  isAdmin: boolean;
  employeeId: string | null;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function mailUser(): Promise<MailUser> {
  const ws = await workspaceSession();
  if (!ws) throw new HttpError(401, 'Nicht angemeldet');
  const email = (ws.employee?.email || ws.session.email || '').toLowerCase();
  return {
    email,
    name: ws.personName,
    firstName: ws.personName.split(/\s+/)[0] || ws.personName,
    isAdmin: ws.isAdmin,
    employeeId: ws.employee?.id || null,
  };
}

/** Postfächer der Person; `mb` = Adresse oder 'all'. Wirft 403 bei fremdem Postfach. */
export async function resolveMailboxes(user: MailUser, mb: string | null, need: 'read' | 'send' = 'read'): Promise<MailboxInfo[]> {
  const { mailboxes } = await mailboxesFor(user.email);
  if (!mb || mb === 'all') return mailboxes;
  const m = mailboxes.find((x) => x.address === mb.toLowerCase());
  if (!m) throw new MailAccessError(`Kein Zugriff auf das Postfach ${mb}.`);
  if (need === 'send' && !m.canSend) throw new MailAccessError(`Aus ${mb} darfst du nicht senden.`);
  return [m];
}

export function fail(e: unknown) {
  const err = e as Error & { status?: number };
  const known = e instanceof HttpError || e instanceof MailAccessError || e instanceof GraphError;
  let status = known ? err.status || 500 : 500;
  if (status < 400 || status > 599) status = 502;
  const msg = known ? err.message : e instanceof Anthropic.APIError ? describeAiError(e) : err?.message || 'Unbekannter Fehler';
  if (status >= 500) console.error('[Mail]', e);
  return NextResponse.json({ success: false, error: msg }, { status });
}

/** Mini-Template: {{key}} und {{#key}}…{{/key}} (Abschnitt nur, wenn key gesetzt). */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl
    .replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, k: string, inner: string) => (vars[k] ? inner : ''))
    .replace(/\{\{([\w.]+)\}\}/g, (_, k: string) => vars[k] ?? '');
}

export interface Signatures { de: Record<string, string>; en: Record<string, string> }

/**
 * Signatur-HTML je Absender-Postfach, deutsch und englisch. Reihenfolge: persönliche Signatur
 * je Postfach > globale Signatur je Postfach > persönliche Standardsignatur > Faltin-Vorlage.
 * Wie in Outlook hängt die Signatur an der PERSON: auch aus kontakt@ steht die eigene Adresse.
 * Schlüssel in prefs.signatures: "<postfach>" bzw. "*" (deutsch), "en:<postfach>" bzw. "en:*".
 */
export async function signaturesFor(user: MailUser, mailboxes: MailboxInfo[]): Promise<Signatures> {
  const [prefs, global] = await Promise.all([getPersonalPrefs(user.email || 'local'), getGlobalMailConfig()]);
  const c = getSettings().company;
  const out: Signatures = { de: {}, en: {} };
  for (const lang of ['de', 'en'] as const) {
    const pre = lang === 'en' ? 'en:' : '';
    for (const m of mailboxes) {
      const personal = prefs.signatures[pre + m.address] || '';
      const shared = global.mailbox_signatures[pre + m.address] || '';
      const fallback = prefs.signatures[pre + '*'] || '';
      const email = m.kind === 'own' ? m.address : user.email || m.address;
      out[lang][m.address] = personal
        || (shared && renderTemplate(shared, sigVars(user, prefs, c, m.address, lang)))
        || fallback
        || renderTemplate(global.signature_template || DEFAULT_SIGNATURE_TEMPLATE, sigVars(user, prefs, c, email, lang));
    }
  }
  return out;
}

function sigVars(
  user: MailUser,
  prefs: { title: string; title_en?: string; phone: string },
  c: { street?: string; zip?: string; city?: string; phone?: string; uid?: string; ceo?: string },
  email: string,
  lang: 'de' | 'en',
): Record<string, string> {
  const en = lang === 'en';
  const ceo = c.ceo || 'Stefan Faltin';
  const city = c.city || 'Regensdorf';
  const uid = (c.uid || '').replace(/\s*MWST\s*$/i, '');
  return {
    name: user.name,
    vorname: user.firstName,
    titel: en ? prefs.title_en || prefs.title : prefs.title,
    mobile: prefs.phone,
    mobile_label: en ? 'Mobile:' : 'Mobil:',
    telefon: prefs.phone || c.phone || '',
    email,
    ort_zeile: `${c.zip || '8105'} ${city}, ${en ? 'Switzerland' : 'Schweiz/Switzerland'}`,
    fusszeile: en
      ? `Owner &amp; CEO: ${ceo} • Registered office and place of jurisdiction: ${city}${uid ? ` • UID: ${uid}` : ''}`
      : `Inhaber: ${ceo} • Geschäftsführer: ${ceo}<br>Sitz der Gesellschaft und Gerichtsstand: ${city}${uid ? ` • UID: ${uid}` : ''}`,
    'firma.strasse': c.street || 'Riedthofstrasse 172',
    'firma.plz': c.zip || '8105',
    'firma.ort': city,
    'firma.telefon': c.phone || '+41 44 700 22 77',
  };
}
