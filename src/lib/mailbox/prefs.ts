/**
 * mailbox/prefs.ts — persönliche Mail-Einstellungen und die globale Mail-Konfiguration.
 * Gespeichert als JSON in mail_prefs (owner = E-Mail der Person bzw. "__global__").
 */
import { dbGet, dbRun } from '../dbq';
import { ensureMailSchema } from './schema';

export type AssistMode = 'korrektur' | 'optimieren' | 'kuerzer' | 'freundlicher' | 'englisch';

export interface PersonalMailPrefs {
  /** Signatur je Absender-Postfach (HTML); "*" = Standard für alle. */
  signatures: Record<string, string>;
  /** Standardaktion des KI-Knopfs im Editor. */
  assist_mode: AssistMode;
  /** Zuletzt gewähltes Absender-Postfach für neue Mails. */
  default_from: string;
  /** Telefon/Funktion für die automatische Signatur. */
  title: string;
  /** Funktion für englische Mails, z. B. «Owner / CEO». */
  title_en: string;
  /** Mobilnummer (optional, erscheint in der Signatur). */
  phone: string;
  /** Lesebereich: Bilder externer Absender automatisch laden. */
  load_images: boolean;
}

export interface GlobalMailConfig {
  /** Freigegebene Postfächer mit Vollzugriff dürfen auch zum Senden genutzt werden. */
  send_with_full_access: boolean;
  /** Zusätzliche Freigaben: Person (E-Mail) → Postfächer. */
  extra_access: Record<string, Array<{ mailbox: string; send: boolean }>>;
  /** Postfächer, die im Client nie angezeigt werden (z. B. Systempostfächer). */
  hidden: string[];
  /** Signatur-Vorlage mit Platzhaltern ({{name}}, {{titel}}, {{telefon}}, {{email}}). */
  signature_template: string;
  /** Signatur je freigegebenem Postfach (überschreibt die persönliche), z. B. request@. */
  mailbox_signatures: Record<string, string>;
}

/**
 * Faltin-Signatur (aus den Outlook-Signaturen von Natalie/Stefan abgeleitet). Die Grussformel
 * steht bewusst NICHT hier, sondern als eigene Zeile im Editor (Vorlagen setzen sie passend).
 * Platzhalter: {{name}} {{titel}} {{mobile}} {{mobile_label}} {{email}} {{ort_zeile}} {{fusszeile}} {{firma.*}}.
 */
export const DEFAULT_SIGNATURE_TEMPLATE = [
  '<table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45;color:#1a1a1a">',
  '<tr><td><strong>{{name}}</strong>{{#titel}}<br>{{titel}}{{/titel}}<br>Faltin Travel AG<br>{{firma.strasse}}<br>{{ort_zeile}}<br>',
  'Tel.: {{firma.telefon}}<br>{{#mobile}}{{mobile_label}} {{mobile}}<br>{{/mobile}}',
  '<a href="mailto:{{email}}" style="color:#1a1a1a">{{email}}</a><br><a href="https://www.faltintravel.com/" style="color:#1a1a1a">www.faltintravel.com</a></td></tr>',
  '<tr><td style="padding-top:10px"><a href="https://www.faltintravel.com/"><img src="https://faltintravel.com/wp-content/uploads/2020/10/Faltin-Travel-Logo.png" alt="Faltin Travel" height="40" style="display:block;border:0;height:40px"></a></td></tr>',
  '<tr><td style="padding-top:10px;font-size:11px;color:#555">{{fusszeile}}</td></tr>',
  '</table>',
].join('\n');

const DEFAULT_PERSONAL: PersonalMailPrefs = {
  signatures: {},
  assist_mode: 'korrektur',
  default_from: '',
  title: '',
  title_en: '',
  phone: '',
  load_images: true,
};

const DEFAULT_GLOBAL: GlobalMailConfig = {
  send_with_full_access: true,
  extra_access: {},
  hidden: [],
  signature_template: DEFAULT_SIGNATURE_TEMPLATE,
  mailbox_signatures: {},
};

async function read<T>(owner: string, defaults: T): Promise<T> {
  await ensureMailSchema();
  const row = await dbGet<{ data: string }>('SELECT data FROM mail_prefs WHERE owner = ?', [owner]);
  if (!row) return { ...defaults };
  try {
    return { ...defaults, ...(JSON.parse(row.data) as Partial<T>) };
  } catch {
    return { ...defaults };
  }
}

async function write<T>(owner: string, data: T): Promise<void> {
  await ensureMailSchema();
  const json = JSON.stringify(data);
  const now = new Date().toISOString();
  const exists = await dbGet('SELECT 1 AS x FROM mail_prefs WHERE owner = ?', [owner]);
  if (exists) await dbRun('UPDATE mail_prefs SET data = ?, updated_at = ? WHERE owner = ?', [json, now, owner]);
  else await dbRun('INSERT INTO mail_prefs (owner, data, updated_at) VALUES (?, ?, ?)', [owner, json, now]);
}

let globalCache: { at: number; value: GlobalMailConfig } | null = null;

export async function getGlobalMailConfig(): Promise<GlobalMailConfig> {
  if (globalCache && Date.now() - globalCache.at < 30_000) return globalCache.value;
  const value = await read<GlobalMailConfig>('__global__', DEFAULT_GLOBAL);
  globalCache = { at: Date.now(), value };
  return value;
}

export async function saveGlobalMailConfig(patch: Partial<GlobalMailConfig>): Promise<GlobalMailConfig> {
  const cur = await read<GlobalMailConfig>('__global__', DEFAULT_GLOBAL);
  const next = { ...cur, ...patch };
  await write('__global__', next);
  globalCache = null;
  return next;
}

export async function getPersonalPrefs(owner: string): Promise<PersonalMailPrefs> {
  return read<PersonalMailPrefs>(owner.toLowerCase(), DEFAULT_PERSONAL);
}

export async function savePersonalPrefs(owner: string, patch: Partial<PersonalMailPrefs>): Promise<PersonalMailPrefs> {
  const cur = await getPersonalPrefs(owner);
  const next = { ...cur, ...patch };
  if (patch.signatures) next.signatures = { ...cur.signatures, ...patch.signatures };
  await write(owner.toLowerCase(), next);
  return next;
}
