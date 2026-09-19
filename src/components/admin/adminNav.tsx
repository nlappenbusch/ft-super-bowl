/**
 * Admin-Navigation: eine Quelle für Sidebar, Mobile-Drawer und Schnellsuche (Cmd+K).
 *
 * Gruppiert nach Arbeitsbereichen statt nach Technik: oben die tägliche Arbeit,
 * unten die selten gebrauchte Konfiguration. Die Routen selbst bleiben unverändert
 * (Lesezeichen/Links) — hier wird nur sortiert, benannt und verschlagwortet.
 *
 * `keywords` sind Synonyme für die Schnellsuche (Kürzel, Fachbegriffe, alte Namen).
 */
import type { LucideIcon } from 'lucide-react';
import {
  Sparkles, LayoutDashboard, ListTodo,
  KanbanSquare, Inbox, Contact, Calculator, Wallet,
  Wand2, Presentation,
  CalendarDays, Layers, Package, HelpCircle, Tag, Globe, Code2, MapPin, Trophy,
  Timer, Plane, FileClock, Users,
  Mail, Activity, Bot, KeyRound, Settings,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Nur exakt diese Route gilt als aktiv (sonst auch Unterseiten). */
  exact?: boolean;
  /** Synonyme für die Schnellsuche. */
  keywords: string[];
}

export interface AdminNavGroup {
  /** Stabiler Schlüssel (localStorage für den Auf-/Zu-Zustand). */
  id: string;
  /** Überschrift in der Sidebar. Ohne Label: Gruppe ohne Kopf, immer offen. */
  label?: string;
  /** Anzeigename in der Schnellsuche (Fallback, wenn kein `label`). */
  searchLabel?: string;
  /** Standardzustand, solange der Nutzer die Gruppe nie auf-/zugeklappt hat. */
  defaultOpen?: boolean;
  items: AdminNavItem[];
}

/** Ziel der Faltin-KI (KI-Arbeitsplatz). Liegt bewusst ausserhalb von /admin. */
export const AI_WORKSPACE_HREF = '/working-dashboard';

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    id: 'start',
    searchLabel: 'Start',
    items: [
      {
        href: AI_WORKSPACE_HREF, label: 'KI-Arbeitsplatz', icon: Sparkles,
        keywords: ['Chat', 'Assistent', 'KI', 'AI', 'Faltin-KI', 'Copilot', 'fragen', 'Working Dashboard'],
      },
      {
        href: '/admin', label: 'Übersicht', icon: LayoutDashboard, exact: true,
        keywords: ['Dashboard', 'Start', 'Home', 'Cockpit', 'Kennzahlen', 'KPI', 'Umsatz'],
      },
      {
        href: '/admin/aufgaben', label: 'Aufgaben', icon: ListTodo,
        keywords: ['Ticket', 'Tickets', 'TASK', 'To-do', 'Todo', 'Pendenzen', 'Projekte', 'Board'],
      },
    ],
  },
  {
    id: 'verkauf',
    label: 'Verkauf',
    defaultOpen: true,
    items: [
      {
        href: '/admin/crm', label: 'Anfragen (CRM)', icon: KanbanSquare,
        keywords: ['CRM', 'Leads', 'RQ', 'Pipeline', 'Anfrage', 'Kanban', 'Posteingang', 'Verkaufschance'],
      },
      {
        href: '/admin/buchungen', label: 'Buchungen', icon: Inbox,
        keywords: ['Buchung', 'Bestellung', 'Reservation', 'Auftrag', 'Teilnehmer', 'Vorgang'],
      },
      {
        href: '/admin/kunden', label: 'Kunden', icon: Contact,
        keywords: ['Kunde', 'Kontakte', 'Kundenakte', 'Adressen', 'Firmen', 'Kundenportal'],
      },
      {
        href: '/admin/kalkulation', label: 'Kalkulation & Angebote', icon: Calculator,
        keywords: ['Angebot', 'Offerte', 'Preis', 'Marge', 'Kalkulation', 'Kosten', 'Gruppenreise'],
      },
      {
        href: '/admin/finanzen', label: 'Finanzen', icon: Wallet,
        keywords: ['Rechnung', 'Rechnungen', 'Zahlung', 'Spesen', 'Mahnung', 'Umsatz', 'Buchhaltung', 'Saferpay', 'Belege'],
      },
    ],
  },
  {
    id: 'studio',
    label: 'Studio',
    items: [
      {
        href: '/admin/incentive', label: 'Incentive Builder', icon: Wand2,
        keywords: ['Incentive', 'Firmenreise', 'Planer', 'Programm', 'Reiseprogramm', 'Event planen'],
      },
      {
        href: '/admin/praesentationen', label: 'Präsentationen', icon: Presentation,
        keywords: ['Präsentation', 'Deck', 'Folien', 'Slides', 'PowerPoint', 'PPTX', 'PDF', 'Kundendeck'],
      },
      {
        href: '/admin/ai', label: 'KI-Redaktion', icon: Sparkles,
        keywords: ['KI', 'AI', 'Texte', 'Redaktion', 'Import', 'Content generieren', 'Claude'],
      },
    ],
  },
  {
    id: 'website',
    label: 'Website',
    items: [
      {
        href: '/admin/events', label: 'Events', icon: CalendarDays,
        keywords: ['Event', 'Veranstaltung', 'Termine', 'Eventseite', 'Spiele'],
      },
      {
        href: '/admin/series', label: 'Serien', icon: Layers,
        keywords: ['Serie', 'Series', 'Hub', 'Evergreen', 'Turnier'],
      },
      {
        href: '/admin/packages', label: 'Packages', icon: Package,
        keywords: ['Paket', 'Pakete', 'Arrangement', 'Tickets', 'Hotel', 'Hospitality', 'Preise'],
      },
      {
        href: '/admin/faqs', label: 'FAQs', icon: HelpCircle,
        keywords: ['FAQ', 'Fragen', 'Häufige Fragen', 'Hilfe'],
      },
      {
        href: '/admin/categories', label: 'Kategorien', icon: Tag,
        keywords: ['Kategorie', 'Kategorieseiten', 'Sportarten', 'Kategorien SEO', 'Tags'],
      },
      {
        href: '/admin/seo', label: 'SEO & GEO', icon: Globe,
        keywords: ['SEO', 'GEO', 'Google', 'Suchmaschine', 'Meta', 'Sitemap', 'llms.txt', 'Ranking'],
      },
      {
        href: '/admin/shortcodes', label: 'WP-Shortcodes', icon: Code2,
        keywords: ['WordPress', 'WP', 'Shortcode', 'Einbetten', 'Embed', 'Widget'],
      },
      {
        href: '/admin/pins', label: 'Lageplan-Icons', icon: MapPin,
        keywords: ['Lageplan', 'Karte', 'Pins', 'Icons', 'Stadion', 'Map'],
      },
      {
        href: '/admin/tippspiel', label: 'WM-Tippspiel', icon: Trophy,
        keywords: ['Tippspiel', 'WM', 'Tipps', 'Rangliste', 'Gewinnspiel', 'Fussball'],
      },
    ],
  },
  {
    id: 'team',
    label: 'Team',
    items: [
      {
        href: '/admin/zeit', label: 'Zeiterfassung', icon: Timer,
        keywords: ['Zeit', 'Stunden', 'Stempeln', 'Arbeitszeit', 'Timesheet', 'Einstempeln'],
      },
      {
        href: '/admin/urlaub', label: 'Urlaub & Abwesenheiten', icon: Plane,
        keywords: ['Ferien', 'Urlaub', 'Abwesenheit', 'Krank', 'Krankheit', 'Absenz', 'Freitage'],
      },
      {
        href: '/admin/rapporte', label: 'Zeit-Rapporte', icon: FileClock,
        keywords: ['Rapport', 'RAP', 'Abrechnung', 'Stundenrapport', 'Zeitrapport'],
      },
      {
        href: '/admin/team', label: 'Team & User', icon: Users,
        keywords: ['Team', 'User', 'Benutzer', 'Mitarbeiter', 'Rechte', 'Rollen', 'Personal'],
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        href: '/admin/mail', label: 'E-Mail / M365', icon: Mail,
        keywords: ['Mail', 'E-Mail', 'Outlook', 'Microsoft', 'M365', 'Graph', 'Postfach', 'SSO'],
      },
      {
        href: '/admin/status', label: 'Status', icon: Activity,
        keywords: ['Status', 'Monitoring', 'Health', 'Systemstatus', 'Fehler', 'Logs'],
      },
      {
        href: '/admin/mcp', label: 'KI-Zugang (MCP)', icon: Bot,
        keywords: ['MCP', 'KI-Zugang', 'Claude', 'Connector', 'Schnittstelle'],
      },
      {
        href: '/admin/api-keys', label: 'API-Keys', icon: KeyRound,
        keywords: ['API', 'Key', 'Schlüssel', 'Token', 'Zugang', 'ftk'],
      },
      {
        href: '/admin/settings', label: 'Einstellungen', icon: Settings,
        keywords: ['Settings', 'Konfiguration', 'Firma', 'Bank', 'Rechnungsvorlage', 'Optionen'],
      },
    ],
  },
];

export function isNavItemActive(pathname: string, item: Pick<AdminNavItem, 'href' | 'exact'>): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

/** Id der Gruppe, die die aktuelle Route enthält (null, wenn keine passt). */
export function activeNavGroupId(pathname: string): string | null {
  for (const group of ADMIN_NAV) {
    if (group.items.some((item) => isNavItemActive(pathname, item))) return group.id;
  }
  return null;
}

// ==================== Schnellsuche ====================

/**
 * Such-Normalisierung: klein, ohne Akzente, Umlaute gleichgesetzt mit ihrer
 * Umschreibung („Präsentation" = „Prasentation" = „Praesentation"), ß = ss.
 */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface NavSearchResult {
  item: AdminNavItem;
  group: AdminNavGroup;
  /** Anzeigename der Gruppe. */
  groupName: string;
}

interface IndexedItem extends NavSearchResult {
  order: number;
  label: string;
  groupText: string;
  keywordText: string;
}

const INDEX: IndexedItem[] = ADMIN_NAV.flatMap((group) =>
  group.items.map((item) => ({ item, group, groupName: group.label ?? group.searchLabel ?? '' })),
).map((r, order) => ({
  ...r,
  order,
  label: normalizeSearch(r.item.label),
  groupText: normalizeSearch(r.groupName),
  keywordText: normalizeSearch(r.item.keywords.join(' ')),
}));

/** Alle Buchstaben von `needle` in Reihenfolge in `hay` (einfaches Fuzzy). */
function isSubsequence(needle: string, hay: string): boolean {
  let i = 0;
  for (let j = 0; j < hay.length && i < needle.length; j++) {
    if (hay[j] === needle[i]) i++;
  }
  return i === needle.length;
}

function tokenScore(token: string, e: IndexedItem): number {
  // Kurze Begriffe (z.B. „ki", „rq") nur am Wortanfang, sonst trifft „ki" auch „Ranking".
  const infix = token.length >= 3;
  const startsWord = (text: string) => text.split(' ').some((w) => w.startsWith(token));
  if (e.label.startsWith(token)) return 100;
  if (startsWord(e.label)) return 80;
  if (infix && e.label.includes(token)) return 60;
  if (startsWord(e.keywordText)) return 50;
  if (infix && e.keywordText.includes(token)) return 40;
  if (startsWord(e.groupText) || (infix && e.groupText.includes(token))) return 25;
  if (infix && isSubsequence(token, e.label.replace(/ /g, ''))) return 10;
  return 0;
}

/**
 * Filtert die Navigation nach Label, Gruppe und Stichworten. Jeder Suchbegriff muss
 * irgendwo treffen; sortiert nach Trefferqualität, sonst in Navigationsreihenfolge.
 * Leere Suche → alle Einträge.
 */
export function searchAdminNav(query: string): NavSearchResult[] {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean);
  if (tokens.length === 0) return INDEX.map(({ item, group, groupName }) => ({ item, group, groupName }));

  const scored: Array<{ e: IndexedItem; score: number }> = [];
  for (const e of INDEX) {
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      const s = tokenScore(t, e);
      if (s === 0) { ok = false; break; }
      score += s;
    }
    if (ok) scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.order - b.e.order);
  return scored.map(({ e }) => ({ item: e.item, group: e.group, groupName: e.groupName }));
}
