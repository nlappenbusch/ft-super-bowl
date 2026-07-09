/**
 * settingsStore.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Persistent JSON-based settings store (server-side only).
 * Settings are stored in data/settings.json next to the project root.
 * Falls back to sensible defaults on first run.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs';
import path from 'path';

const SETTINGS_PATH = path.join(process.cwd(), 'data', 'settings.json');

export interface CompanySettings {
  name: string;
  legal_form: string;        // e.g. "AG", "GmbH", ""
  street: string;
  zip: string;
  city: string;
  country: string;
  phone: string;
  fax: string;
  email: string;
  website: string;
  uid: string;               // VAT / UID number
  hr_id: string;             // Handelsregister-Nr
  ceo: string;               // Geschäftsführer / Inhaber
  logo_path: string;         // Relative path in /public, e.g. "/faltin_logo_black.png"
}

export interface BankSettings {
  bank_name: string;
  iban: string;              // raw: CH650029129111351860G
  bic_swift: string;
  currency: string;          // EUR | CHF
  account_holder: string;
}

export interface InvoiceSettings {
  prefix: string;            // RE | INV | ...
  vat_rate: number;          // 0 | 7.7 | ...
  vat_note: string;          // "Mehrwertsteuer 0% (Steuerbefreit)"
  due_days: number;          // Default payment term
  payment_note: string;      // Free text for invoice footer
  show_qr: boolean;
  // Reisegarantie logo
  reisegarantie_logo: string; // path in /public
}

export interface EventSettings {
  /** Name shown on invoice, e.g. "Super Bowl LXI 2027" or "French Open 2027" */
  event_name: string;
  /** Destination shown on invoice */
  destination: string;
  /** Hotel description shown on invoice */
  hotel_description: string;
  /** Base check-in date ISO string */
  base_checkin: string;
  /** Base check-out date ISO string */
  base_checkout: string;
  /** Number of base nights */
  base_nights: number;
  /** Thank-you text shown on invoice PDF */
  thank_you_text: string;
}

export interface SiteSettings {
  /** Portal/site title (browser tab) */
  site_title: string;
  /** Short event/site name */
  site_name: string;
  /** Meta description */
  site_description: string;
  /** OG image path in /public */
  og_image: string;
}

export interface AiSettings {
  /** Anthropic Messages API-Key (sk-ant-...) */
  anthropic_api_key: string;
  /** Modell-ID, z.B. claude-sonnet-4-6 */
  model: string;
}

export interface GithubSettings {
  /** Personal Access Token (repo-Schreibrechte) – für Auto-Fix-PRs. Leer = deaktiviert. */
  token: string;
  /** Repo-Owner, z.B. "nlappenbusch" */
  owner: string;
  /** Repo-Name, z.B. "ft-super-bowl" */
  repo: string;
  /** Ziel-Branch für PRs */
  base_branch: string;
}

export interface AllSettings {
  company: CompanySettings;
  bank: BankSettings;
  invoice: InvoiceSettings;
  event: EventSettings;
  site: SiteSettings;
  mail: MailSettings;
  ai: AiSettings;
  github: GithubSettings;
  updated_at?: string;
}

export interface MailSettings {
  /** Microsoft 365 / Graph (App-only) */
  tenant_id: string;
  client_id: string;
  client_secret: string;
  /** Shared Mailbox als Absender & Eingang, z.B. request@faltintravel.com */
  mailbox: string;
  from_name: string;
  /** Schutz-Token für den Inbound-Poll-Endpoint */
  inbound_poll_secret: string;
  /** Brevo API-Key (Marketing-Listen) */
  brevo_api_key: string;
  login_base_url: string;
  notify_to: string;
  /** Unzugeordnete Inbound-Mails automatisch als Ticket (StaffTask) anlegen */
  ticket_auto_create?: boolean;
  /** Komma-getrennte Absender-Domain-Allowlist für Auto-Create (leer = alle Absender) */
  ticket_auto_create_domains?: string;
}

const DEFAULT_SETTINGS: AllSettings = {
  company: {
    name: 'Faltin Travel AG',
    legal_form: 'AG',
    street: 'Riedthofstrasse 172',
    zip: '8105',
    city: 'Regensdorf',
    country: 'CH',
    phone: '+41 44 700 22 77',
    fax: '+41 44 740 33 27',
    email: 'info@faltintravel.com',
    website: 'faltintravel.com',
    uid: 'CHE-267.347.685 MWST',
    hr_id: 'CH-020.3.037.547-2',
    ceo: 'Stefan Faltin',
    logo_path: '/faltin_logo_black-1 (2).png',
  },
  bank: {
    bank_name: 'UBS Switzerland AG',
    iban: 'CH6500291291113518607',
    bic_swift: 'UBSWCHZH80A',
    currency: 'EUR',
    account_holder: 'Faltin Travel AG',
  },
  invoice: {
    prefix: 'RE',
    vat_rate: 0,
    vat_note: 'Mehrwertsteuer 0%',
    due_days: 14,
    payment_note:
      'Der Rechnungsbetrag ist zahlbar bis zum Fälligkeitsdatum auf unten genanntes Konto. Mit der Buchung akzeptieren Sie unsere AGB. Vielen Dank für Ihr Vertrauen.',
    show_qr: true,
    reisegarantie_logo: '/reisegarantielogo-de-768x258.webp',
  },
  event: {
    event_name: 'Super Bowl LXI 2027',
    destination: 'USA – Los Angeles',
    hotel_description: '5* Luxushotel in Los Angeles',
    base_checkin: '2027-02-09',
    base_checkout: '2027-02-11',
    base_nights: 2,
    thank_you_text:
      'Wir wünschen Ihnen eine unvergessliche Reise und freuen uns, Sie bei diesem einzigartigen Event zu begleiten.',
  },
  site: {
    site_title: 'Super Bowl LXI 2027 Tickets & Packages | Faltin Travel',
    site_name: 'Super Bowl LXI 2027',
    site_description:
      'Offizielle Super Bowl LXI 2027 Packages inkl. Tickets, Hotel & VIP-Hospitality.',
    og_image: '/Super-Bowl-LXI-Tickets-Packages.webp',
  },
  mail: {
    tenant_id: '',
    client_id: '',
    client_secret: '',
    mailbox: 'request@faltintravel.com',
    from_name: 'Faltin Travel',
    inbound_poll_secret: '',
    brevo_api_key: '',
    login_base_url: '',
    notify_to: '',
    ticket_auto_create: false,
    ticket_auto_create_domains: 'faltintravel.com',
  },
  ai: {
    anthropic_api_key: '',
    model: 'claude-sonnet-4-6',
  },
  github: {
    token: '',
    owner: 'nlappenbusch',
    repo: 'ft-super-bowl',
    base_branch: 'main',
  },
};

function ensureDataDir() {
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * site.admin_password ist deprecated (seit 2026-07): der Admin-Login läuft über
 * Microsoft SSO bzw. localadmin (src/lib/auth.ts), das Feld schützt nichts mehr.
 * Ältere settings.json-Dateien (und alte Clients im PATCH-Body) dürfen es noch
 * enthalten — hier wird es beim Lesen/Schreiben still entfernt.
 */
function stripLegacySiteFields(site: SiteSettings): SiteSettings {
  const cleaned = { ...site } as SiteSettings & { admin_password?: unknown };
  delete cleaned.admin_password;
  return cleaned;
}

export function getSettings(): AllSettings {
  try {
    ensureDataDir();
    if (!fs.existsSync(SETTINGS_PATH)) {
      return DEFAULT_SETTINGS;
    }
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AllSettings>;
    // Deep merge with defaults so new fields added later always have a value
    return {
      company: { ...DEFAULT_SETTINGS.company, ...parsed.company },
      bank: { ...DEFAULT_SETTINGS.bank, ...parsed.bank },
      invoice: { ...DEFAULT_SETTINGS.invoice, ...parsed.invoice },
      event: { ...DEFAULT_SETTINGS.event, ...parsed.event },
      site: stripLegacySiteFields({ ...DEFAULT_SETTINGS.site, ...parsed.site }),
      mail: { ...DEFAULT_SETTINGS.mail, ...parsed.mail },
      ai: { ...DEFAULT_SETTINGS.ai, ...parsed.ai },
      github: { ...DEFAULT_SETTINGS.github, ...parsed.github },
      updated_at: parsed.updated_at,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(updates: Partial<AllSettings>): AllSettings {
  ensureDataDir();
  const current = getSettings();
  const merged: AllSettings = {
    company: { ...current.company, ...(updates.company || {}) },
    bank: { ...current.bank, ...(updates.bank || {}) },
    invoice: { ...current.invoice, ...(updates.invoice || {}) },
    event: { ...current.event, ...(updates.event || {}) },
    site: stripLegacySiteFields({ ...current.site, ...(updates.site || {}) }),
    mail: { ...current.mail, ...(updates.mail || {}) },
    ai: { ...current.ai, ...(updates.ai || {}) },
    github: { ...current.github, ...(updates.github || {}) },
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
