/**
 * mcpServer.ts — MCP-Server des Portals (Streamable HTTP, JSON-only).
 * ─────────────────────────────────────────────────────────────────────────────
 * Vollausbau (TASK-00125): FT-Mitarbeiter verbinden ihre KI (Claude, ChatGPT,
 * ElevenLabs, …) per API-Key — entweder klassisch mit Authorization-Header auf
 * /api/mcp oder über die persönliche Token-URL /api/mcp/<ftk_…> (für Clients
 * ohne Header-Support). Keys werden unter /admin/mcp verwaltet; pro Key lässt
 * sich der Werkzeugumfang über Scopes einschränken.
 *
 * Tool-Gruppen (= Scopes):
 *   content   — Events, Serien, Pakete, FAQs (read-only)
 *   bookings  — Anfrage-/Buchungsstatus nachschlagen und auflisten
 *   customers — Kunden suchen, anlegen, aktualisieren
 *   offers    — Angebotskalkulationen anlegen/pflegen, Angebots-PDF, Rechnung
 *   tasks     — Aufgaben-Ticketsystem inkl. Zeitbuchung
 *
 * Bewusst ohne SDK: minimale JSON-RPC-2.0-Behandlung der MCP-Methoden
 * initialize / tools/list / tools/call / ping. Notifications (ohne id)
 * werden mit 202 quittiert.
 */
import { NextResponse } from 'next/server';
import type { ApiKey } from './apiKeyStore';
import { getEvents, getSeries, getFaqs, findSeriesBySlug, findPackagesByEvent } from './contentStore';
import { getAllBookings, findBookingByRequestNumber } from './database';
import { listStaffTasks, createStaffTask, getStaffTask, updateStaffTask, addTaskTime, formatTicketNo, listProjects } from './staffStore';
import { listCustomers, getCustomer, upsertCustomerByEmail, updateCustomer } from './customerStore';
import {
  listCalculations, listCalculationsByCustomer, getCalculation, createCalculation, updateCalculation,
  type CalculationInput,
} from './calculationStore';
import { computeTotals } from './calcModel';
import { getCurrentRates } from './fxRates';
import { createInvoiceFromCalculation } from './offerInvoice';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'faltin-travel-portal', version: '2.0.0' };
const INSTRUCTIONS =
  'Portal-Zugriff für Faltin Travel (Sportreisen): Website-Inhalte (Events, Pakete, FAQs), Anfrage-/Buchungsstatus, ' +
  'Kundenstamm (suchen/anlegen), Angebotskalkulationen (anlegen, PDF-Link, Rechnung erzeugen) und das Aufgaben-Ticketsystem. ' +
  'Alle Beträge in Angeboten verstehen sich pro Person. Preise sind echte Werte aus dem Buchungssystem; keine Werte erfinden. ' +
  'Vor dem Anlegen eines Angebots den Kunden per find_customers suchen oder per create_customer anlegen.';

export const MCP_TOOL_GROUPS = [
  { id: 'content', label: 'Website-Inhalte', description: 'Events, Serien, Pakete, FAQs (nur lesen)' },
  { id: 'bookings', label: 'Anfragen & Buchungen', description: 'Status nachschlagen und auflisten' },
  { id: 'customers', label: 'Kunden', description: 'Suchen, anlegen, aktualisieren' },
  { id: 'offers', label: 'Angebote & Rechnungen', description: 'Kalkulationen, Angebots-PDF, Rechnung aus Angebot' },
  { id: 'tasks', label: 'Aufgaben', description: 'Ticketsystem inkl. Zeitbuchung' },
] as const;

export type McpScopeId = (typeof MCP_TOOL_GROUPS)[number]['id'];

function keyScopes(key: ApiKey): McpScopeId[] {
  const all = MCP_TOOL_GROUPS.map((g) => g.id);
  const raw = (key.scopes || 'all').trim();
  if (!raw || raw === 'all') return all;
  const parts = raw.split(',').map((x) => x.trim());
  const valid = all.filter((g) => parts.includes(g));
  return valid.length ? valid : all;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: number | string | null, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result });
}

function rpcError(id: number | string | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } });
}

/** Öffentliche Basis-URL des Portals aus dem Request (Reverse-Proxy-fest). */
function baseUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  try { return new URL(req.url).origin; } catch { return 'https://next.faltintravel.com'; }
}

/* ── Tool-Definitionen ─────────────────────────────────────────────────────── */

interface ToolDef {
  name: string;
  group: McpScopeId;
  description: string;
  inputSchema: Record<string, unknown>;
}

const STR = (description: string) => ({ type: 'string', description });
const NUM = (description: string) => ({ type: 'number', description });

const TOOLS: ToolDef[] = [
  /* ── content ── */
  {
    name: 'list_events', group: 'content',
    description: 'Listet alle Events der Website (Name, Slug, Datum, Ort, Serie). Startpunkt für Event-Fragen.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_event_info', group: 'content',
    description: 'Details zu einem Event inkl. buchbarer Pakete (Titel, Preis, Hotel, Leistungen) und FAQs.',
    inputSchema: {
      type: 'object',
      properties: { event_slug: STR('Slug aus list_events, z.B. "super-bowl-2027"') },
      required: ['event_slug'], additionalProperties: false,
    },
  },
  {
    name: 'get_series_info', group: 'content',
    description: 'Evergreen-Infos einer Event-Serie (Intro, Highlights, FAQs, Guide) — die Website-Inhalte.',
    inputSchema: {
      type: 'object',
      properties: { series_slug: STR('Serien-Slug, z.B. "monaco-grand-prix"') },
      required: ['series_slug'], additionalProperties: false,
    },
  },
  /* ── bookings ── */
  {
    name: 'search_booking_status', group: 'bookings',
    description: 'Status einer Kundenanfrage/Buchung nachschlagen — per RQ-Nummer (z.B. RQ-10042) oder Kunden-E-Mail.',
    inputSchema: {
      type: 'object',
      properties: { query: STR('RQ-Nummer oder E-Mail-Adresse') },
      required: ['query'], additionalProperties: false,
    },
  },
  {
    name: 'list_bookings', group: 'bookings',
    description: 'Neueste Anfragen/Buchungen auflisten (optional nach Status gefiltert).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['new', 'in_progress', 'booked', 'rejected'], description: 'Optionaler Statusfilter' },
        limit: NUM('Maximale Anzahl (Standard 20, max 50)'),
      },
      additionalProperties: false,
    },
  },
  /* ── customers ── */
  {
    name: 'find_customers', group: 'customers',
    description: 'Kunden suchen (Name, Firma oder E-Mail). Leerer query listet die neuesten Kunden.',
    inputSchema: {
      type: 'object',
      properties: { query: STR('Suchbegriff — Name, Firma oder E-Mail (auch Teilstring)') },
      additionalProperties: false,
    },
  },
  {
    name: 'get_customer', group: 'customers',
    description: 'Kundendetail inkl. E-Mails, Anfragen, Rechnungen und Angebots-Historie.',
    inputSchema: {
      type: 'object',
      properties: { customer_id: STR('Kunden-ID aus find_customers') },
      required: ['customer_id'], additionalProperties: false,
    },
  },
  {
    name: 'create_customer', group: 'customers',
    description: 'Kunden anlegen (Upsert per E-Mail: existiert die Adresse, werden fehlende Felder ergänzt).',
    inputSchema: {
      type: 'object',
      properties: {
        email: STR('E-Mail-Adresse (Pflicht, dient als Schlüssel)'),
        first_name: STR('Vorname'), last_name: STR('Nachname'),
        salutation: STR('Anrede: Herr/Frau'), company: STR('Firma'),
        phone: STR('Telefon'), street: STR('Strasse + Nr.'),
        zip: STR('PLZ'), city: STR('Ort'), country: STR('Land'),
      },
      required: ['email'], additionalProperties: false,
    },
  },
  {
    name: 'update_customer', group: 'customers',
    description: 'Stammdaten eines bestehenden Kunden aktualisieren (nur übergebene Felder werden geändert).',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: STR('Kunden-ID'),
        first_name: STR('Vorname'), last_name: STR('Nachname'),
        salutation: STR('Anrede: Herr/Frau'), company: STR('Firma'),
        phone: STR('Telefon'), street: STR('Strasse + Nr.'),
        zip: STR('PLZ'), city: STR('Ort'), country: STR('Land'), notes: STR('Interne Notiz'),
      },
      required: ['customer_id'], additionalProperties: false,
    },
  },
  /* ── offers ── */
  {
    name: 'list_offers', group: 'offers',
    description: 'Angebotskalkulationen auflisten (optional auf einen Kunden gefiltert).',
    inputSchema: {
      type: 'object',
      properties: { customer_id: STR('Optional: nur Angebote dieses Kunden') },
      additionalProperties: false,
    },
  },
  {
    name: 'get_offer', group: 'offers',
    description: 'Angebotskalkulation abrufen — per ID oder Angebotsnummer (KALK-1234). Enthält Positionen, Preis p.P. und PDF-Links.',
    inputSchema: {
      type: 'object',
      properties: { offer: STR('Kalkulations-ID oder Angebotsnummer, z.B. "KALK-1018"') },
      required: ['offer'], additionalProperties: false,
    },
  },
  {
    name: 'create_offer', group: 'offers',
    description:
      'Individuelles Angebot (Kalkulation) anlegen. Positionen sind Einkaufspreise PRO PERSON in EUR/USD/CHF/GBP; ' +
      'der Verkaufspreis entsteht über die Marge. Kunde per customer_id ODER customer_email (wird bei Bedarf angelegt). ' +
      'Wechselkurse werden automatisch festgeschrieben. Antwort enthält den Angebots-PDF-Link.',
    inputSchema: {
      type: 'object',
      properties: {
        title: STR('Titel, z.B. "Super Bowl LXI 2027 – Individualreise"'),
        customer_id: STR('Kunden-ID (alternativ customer_email)'),
        customer_email: STR('Kunden-E-Mail — existiert sie nicht, wird der Kunde angelegt'),
        customer_name: STR('Name für Neuanlage per customer_email, z.B. "Max Muster"'),
        travel_start: STR('Reisebeginn YYYY-MM-DD'), travel_end: STR('Reiseende YYYY-MM-DD'),
        target_currency: { type: 'string', enum: ['EUR', 'USD', 'CHF', 'GBP'], description: 'Zielwährung des Angebots (Standard EUR)' },
        margin_mode: { type: 'string', enum: ['percent', 'fixed', 'target_vk'], description: 'Margenmodell (Standard percent)' },
        margin_value: NUM('Marge in % bzw. Fixbetrag bzw. Ziel-VK, je nach margin_mode'),
        items: {
          type: 'array',
          description: 'Positionen (EK pro Person). category: ticket|hotel|flug|transfer|extras',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string', enum: ['ticket', 'hotel', 'flug', 'transfer', 'extras'] },
              description: STR('Beschreibung der Leistung'),
              room_category: STR('Nur hotel: Zimmerkategorie'),
              currency: { type: 'string', enum: ['EUR', 'USD', 'CHF', 'GBP'] },
              amount: NUM('EK je Einheit pro Person'),
              qty: NUM('Menge pro Person, z.B. 4 Hotelnächte (Standard 1)'),
            },
            required: ['category', 'description', 'amount'],
            additionalProperties: false,
          },
        },
        extras: {
          type: 'array',
          description: 'Optionale Zusatzleistungen: +/−-Freitextzeilen pro Person (nicht im Angebotspreis enthalten)',
          items: {
            type: 'object',
            properties: { label: STR('Freitext'), amount: NUM('Betrag pro Person, negativ = Abzug') },
            required: ['label', 'amount'], additionalProperties: false,
          },
        },
        notes: STR('Freitext-Notiz (erscheint auf dem Angebot)'),
      },
      required: ['title', 'items'], additionalProperties: false,
    },
  },
  {
    name: 'update_offer', group: 'offers',
    description: 'Bestehende Angebotskalkulation ändern (nur übergebene Felder; items/extras ersetzen die Liste komplett).',
    inputSchema: {
      type: 'object',
      properties: {
        offer: STR('Kalkulations-ID oder Angebotsnummer'),
        title: STR('Titel'), customer_id: STR('Kunden-ID'),
        travel_start: STR('YYYY-MM-DD'), travel_end: STR('YYYY-MM-DD'),
        target_currency: { type: 'string', enum: ['EUR', 'USD', 'CHF', 'GBP'] },
        margin_mode: { type: 'string', enum: ['percent', 'fixed', 'target_vk'] },
        margin_value: NUM('Marge/VK je nach margin_mode'),
        items: { type: 'array', description: 'Neue Positionsliste (ersetzt die bestehende)', items: { type: 'object' } },
        extras: { type: 'array', description: 'Neue Zusatzoptionen (ersetzen die bestehenden)', items: { type: 'object' } },
        status: { type: 'string', enum: ['entwurf', 'aktiv', 'archiviert'] },
        notes: STR('Notiz'),
      },
      required: ['offer'], additionalProperties: false,
    },
  },
  {
    name: 'create_invoice_from_offer', group: 'offers',
    description:
      'Rechnung aus einer Angebotskalkulation erzeugen (eine Pauschalposition × Personen, Leistungen ohne Einzelpreise). ' +
      'Optionale Zusatzleistungen per extra_ids übernehmen. Pro Kalkulation nur EINE Rechnung.',
    inputSchema: {
      type: 'object',
      properties: {
        offer: STR('Kalkulations-ID oder Angebotsnummer'),
        persons: NUM('Anzahl Personen (Rechnungsmenge × VK p.P.)'),
        due_in_days: NUM('Zahlungsziel in Tagen (Standard 14)'),
        extra_ids: { type: 'array', items: { type: 'string' }, description: 'IDs der zu übernehmenden Zusatzleistungen (aus get_offer)' },
      },
      required: ['offer', 'persons'], additionalProperties: false,
    },
  },
  /* ── tasks ── */
  {
    name: 'list_tasks', group: 'tasks',
    description: 'Aufgaben aus dem Admin-Ticketsystem auflisten (optional nach Status oder KI-Aufträgen gefiltert).',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['offen', 'in_arbeit', 'warten_requester', 'warten_dritte', 'erledigt'] },
        ai_only: { type: 'boolean', description: 'Nur Aufgaben, deren Umsetzung durch die KI angefragt ist' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'create_task', group: 'tasks',
    description: 'Neue Aufgabe im Admin-Ticketsystem anlegen. Bei Portal-Weiterentwicklung als klare User-Story formulieren.',
    inputSchema: {
      type: 'object',
      properties: {
        title: STR('Titel'),
        description: STR('Beschreibung/Kontext'),
        priority: { type: 'string', enum: ['niedrig', 'normal', 'hoch'] },
        ai_requested: { type: 'boolean', description: 'true = Umsetzung durch die KI anfragen' },
      },
      required: ['title'], additionalProperties: false,
    },
  },
  {
    name: 'update_task', group: 'tasks',
    description: 'Aufgabe aktualisieren (Status, Priorität, Titel, Beschreibung, Fälligkeit).',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: STR('Aufgaben-ID aus list_tasks'),
        status: { type: 'string', enum: ['offen', 'in_arbeit', 'warten_requester', 'warten_dritte', 'erledigt'] },
        priority: { type: 'string', enum: ['niedrig', 'normal', 'hoch'] },
        title: STR('Neuer Titel'), description: STR('Neue Beschreibung'),
        due_date: STR('Fälligkeit YYYY-MM-DD'),
      },
      required: ['task_id'], additionalProperties: false,
    },
  },
  {
    name: 'book_task_time', group: 'tasks',
    description: 'Arbeitszeit auf eine Aufgabe buchen (Minuten + aussagekräftige Notiz — landet 1:1 im Kunden-Rapport).',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: STR('Aufgaben-ID'),
        minutes: NUM('Minuten (> 0)'),
        note: STR('Was wurde getan'),
        work_date: STR('Datum YYYY-MM-DD (Standard heute)'),
      },
      required: ['task_id', 'minutes'], additionalProperties: false,
    },
  },
];

/* ── Tool-Implementierungen ────────────────────────────────────────────────── */

interface ToolContext {
  key: ApiKey;
  /** Klartext-Key des Aufrufers — für persönliche PDF-/Endpoint-Links. */
  rawKey: string;
  base: string;
}

/** Kalkulation per ID oder Angebotsnummer finden. */
async function resolveOffer(ref: string) {
  const r = ref.trim();
  if (!r) return null;
  const byId = await getCalculation(r).catch(() => null);
  if (byId) return byId;
  const all = await listCalculations();
  return all.find((c) => (c.calc_number || '').toLowerCase() === r.toLowerCase()) || null;
}

function offerSummary(c: Awaited<ReturnType<typeof listCalculations>>[number], ctx: ToolContext) {
  const totals = computeTotals(c.items, c.target_currency, c.rates_snapshot, c.margin_mode, c.margin_value);
  return {
    id: c.id,
    offer_number: c.calc_number,
    title: c.title,
    status: c.status,
    customer_id: c.customer_id,
    customer_name: c.customer_name,
    travel_start: c.travel_start || null,
    travel_end: c.travel_end || null,
    currency: c.target_currency,
    price_per_person: totals ? Math.round(totals.vkTarget * 100) / 100 : null,
    has_invoice: !!c.invoice_id,
    admin_url: `${ctx.base}/admin/kalkulation/${c.id}`,
    pdf_url: `${ctx.base}/api/ext/offers/${c.id}/pdf?key=${encodeURIComponent(ctx.rawKey)}`,
  };
}

async function callTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  switch (name) {
    /* ── content ── */
    case 'list_events': {
      return getEvents().map((e) => ({
        slug: e.slug,
        name: e.name || e.title,
        start_date: e.start_date || null,
        end_date: e.end_date || null,
        venue: e.venue || null,
        city: e.location_city || null,
        series_slug: getSeries().find((s) => s.id === e.series_id)?.slug || null,
      }));
    }
    case 'get_event_info': {
      const slug = String(args.event_slug || '');
      const event = getEvents().find((e) => e.slug === slug);
      if (!event) return { error: `Event "${slug}" nicht gefunden — list_events nutzen.` };
      const packages = findPackagesByEvent(event.id, true).map((p) => ({
        slug: p.slug, title: p.title, price: p.price ?? null, currency: p.currency || 'CHF',
        hotel: p.hotel || null, nights: p.nights ?? null,
        includes: Array.isArray(p.includes) ? p.includes.map((i) => (typeof i === 'string' ? i : i?.name)).filter(Boolean).slice(0, 20) : [],
      }));
      const faqs = getFaqs().filter((f) => f.event_id === event.id).map((f) => ({ question: f.question, answer: f.answer }));
      return {
        slug: event.slug, name: event.name || event.title,
        start_date: event.start_date || null, end_date: event.end_date || null,
        venue: event.venue || null, city: event.location_city || null,
        intro: (event.first_paragraph_text || '').slice(0, 1200) || null,
        packages, faqs,
      };
    }
    case 'get_series_info': {
      const s = findSeriesBySlug(String(args.series_slug || ''));
      if (!s) return { error: `Serie nicht gefunden — verfügbare Slugs: ${getSeries().map((x) => x.slug).join(', ')}` };
      return {
        slug: s.slug, title: s.title,
        intro_text: (s.intro_text || '').slice(0, 2000) || null,
        highlights: s.highlights || [],
        faqs: (s.faqs || []).map((f) => ({ question: f.question, answer: f.answer })),
        guide_sections: (s.guide_sections || []).map((g) => ({ title: g.title, text: (g.text || '').slice(0, 1500) })),
      };
    }

    /* ── bookings ── */
    case 'search_booking_status':
    case 'list_bookings': {
      const summarize = (b: {
        id?: string; request_number?: string | null; booking_number?: string | null; package_title: string; status: string;
        created_at: string; travel_period?: string; number_of_persons: number; email?: string;
      }) => ({
        id: b.id,
        request_number: b.request_number || null,
        booking_number: (b as { booking_number?: string | null }).booking_number || null,
        package: b.package_title,
        status: b.status,
        status_label: { new: 'Neu eingegangen', in_progress: 'In Bearbeitung', booked: 'Gebucht', rejected: 'Abgelehnt' }[b.status] || b.status,
        persons: b.number_of_persons,
        travel_period: b.travel_period || null,
        created_at: b.created_at,
      });
      if (name === 'list_bookings') {
        const status = typeof args.status === 'string' ? args.status : '';
        const limit = Math.min(50, Math.max(1, Math.round(Number(args.limit)) || 20));
        const all = await getAllBookings();
        return all.filter((b) => !status || b.status === status).slice(0, limit).map(summarize);
      }
      const query = String(args.query || '').trim();
      if (!query) return { error: 'query erforderlich (RQ-Nummer oder E-Mail).' };
      if (/^rq-?\d+/i.test(query)) {
        const rq = query.toUpperCase().startsWith('RQ-') ? query.toUpperCase() : `RQ-${query.replace(/\D/g, '')}`;
        const b = await findBookingByRequestNumber(rq);
        return b ? summarize(b) : { error: `Keine Anfrage mit Nummer ${rq} gefunden.` };
      }
      const matches = (await getAllBookings()).filter((b) => (b.email || '').toLowerCase() === query.toLowerCase());
      if (!matches.length) return { error: `Keine Anfragen zur E-Mail ${query} gefunden.` };
      return matches.slice(0, 10).map(summarize);
    }

    /* ── customers ── */
    case 'find_customers': {
      const rows = await listCustomers(typeof args.query === 'string' && args.query.trim() ? args.query.trim() : undefined);
      return rows.slice(0, 25).map((c) => ({
        id: c.id,
        name: c.name || [c.first_name, c.last_name].filter(Boolean).join(' '),
        company: c.company || null,
        email: c.primary_email || null,
        city: c.city || null,
        requests: c.requests_count,
      }));
    }
    case 'get_customer': {
      const c = await getCustomer(String(args.customer_id || ''));
      if (!c) return { error: 'Kunde nicht gefunden — find_customers nutzen.' };
      const offers = await listCalculationsByCustomer(c.id);
      return {
        id: c.id,
        salutation: c.salutation || null,
        name: c.name || [c.first_name, c.last_name].filter(Boolean).join(' '),
        company: c.company || null,
        phone: c.phone || null,
        address: [c.street, [c.zip, c.city].filter(Boolean).join(' '), c.country].filter(Boolean).join(', ') || null,
        emails: c.emails.map((e) => e.email),
        bookings: c.bookings.slice(0, 10).map((b) => ({ request_number: b.request_number, package: b.package_title, status: b.status })),
        invoices: c.invoices.slice(0, 10).map((i) => ({ invoice_number: i.invoice_number, total: i.total_amount, status: i.status })),
        offers: offers.slice(0, 10).map((o) => ({ offer_number: o.calc_number, title: o.title, status: o.status })),
        notes: c.notes || null,
      };
    }
    case 'create_customer': {
      const email = String(args.email || '').trim();
      if (!email || !email.includes('@')) return { error: 'Gültige E-Mail erforderlich.' };
      const id = await upsertCustomerByEmail(email, {
        firstName: typeof args.first_name === 'string' ? args.first_name : undefined,
        lastName: typeof args.last_name === 'string' ? args.last_name : undefined,
        salutation: typeof args.salutation === 'string' ? args.salutation : undefined,
        phone: typeof args.phone === 'string' ? args.phone : undefined,
        street: typeof args.street === 'string' ? args.street : undefined,
        zip: typeof args.zip === 'string' ? args.zip : undefined,
        city: typeof args.city === 'string' ? args.city : undefined,
        country: typeof args.country === 'string' ? args.country : undefined,
      });
      if (typeof args.company === 'string' && args.company.trim()) {
        await updateCustomer(id, { company: args.company.trim() });
      }
      const c = await getCustomer(id);
      return { id, name: c?.name || null, email, note: 'Upsert per E-Mail — bestehende Kundendaten wurden nicht überschrieben, nur ergänzt.' };
    }
    case 'update_customer': {
      const id = String(args.customer_id || '');
      const updates: Record<string, string> = {};
      for (const f of ['salutation', 'first_name', 'last_name', 'company', 'phone', 'street', 'zip', 'city', 'country', 'notes'] as const) {
        if (typeof args[f] === 'string') updates[f] = String(args[f]);
      }
      if (updates.first_name || updates.last_name) {
        const cur = await getCustomer(id);
        if (cur) updates.name = [updates.first_name ?? cur.first_name, updates.last_name ?? cur.last_name].filter(Boolean).join(' ');
      }
      const c = await updateCustomer(id, updates);
      if (!c) return { error: 'Kunde nicht gefunden.' };
      return { id: c.id, name: c.name, updated: Object.keys(updates) };
    }

    /* ── offers ── */
    case 'list_offers': {
      const customerId = typeof args.customer_id === 'string' && args.customer_id.trim() ? args.customer_id.trim() : '';
      const rows = customerId ? await listCalculationsByCustomer(customerId) : await listCalculations();
      return rows.slice(0, 25).map((c) => offerSummary(c, ctx));
    }
    case 'get_offer': {
      const c = await resolveOffer(String(args.offer || ''));
      if (!c) return { error: 'Angebot nicht gefunden — ID oder Angebotsnummer (KALK-…) angeben.' };
      const totals = computeTotals(c.items, c.target_currency, c.rates_snapshot, c.margin_mode, c.margin_value);
      return {
        ...offerSummary(c, ctx),
        items: c.items.map((i) => ({
          category: i.category, description: i.description, room_category: i.room_category || null,
          currency: i.currency, amount_per_person: i.amount, qty: i.qty,
        })),
        extras: (c.offer_extras || []).map((e) => ({ id: e.id, label: e.label, amount_per_person: e.amount })),
        purchase_total_per_person: totals ? Math.round(totals.ekTarget * 100) / 100 : null,
        margin: totals ? { amount: Math.round(totals.marginAmount * 100) / 100, percent: Math.round(totals.marginPercent * 10) / 10 } : null,
        notes: c.notes || null,
        rates_locked: !!c.rates_snapshot,
      };
    }
    case 'create_offer': {
      // Kunde auflösen/anlegen
      let customerId = typeof args.customer_id === 'string' && args.customer_id.trim() ? args.customer_id.trim() : '';
      const customerEmail = typeof args.customer_email === 'string' ? args.customer_email.trim() : '';
      if (!customerId && customerEmail) {
        customerId = await upsertCustomerByEmail(customerEmail, { name: typeof args.customer_name === 'string' ? args.customer_name : undefined });
      }
      const snapshot = await getCurrentRates();
      const input: CalculationInput = {
        title: args.title,
        customer_id: customerId || undefined,
        travel_start: args.travel_start,
        travel_end: args.travel_end,
        target_currency: args.target_currency,
        margin_mode: args.margin_mode ?? 'percent',
        margin_value: args.margin_value ?? 15,
        items: args.items,
        offer_extras: args.extras,
        notes: args.notes,
        status: 'entwurf',
      };
      const calc = await createCalculation(input, snapshot, `MCP: ${ctx.key.name}`);
      if (!calc) return { error: 'Kalkulation konnte nicht angelegt werden.' };
      return {
        ...offerSummary(calc, ctx),
        rates_locked: !!snapshot,
        warning: snapshot ? undefined : 'Wechselkurse waren nicht abrufbar — Preis erst nach „Kurse festschreiben" berechenbar.',
      };
    }
    case 'update_offer': {
      const existing = await resolveOffer(String(args.offer || ''));
      if (!existing) return { error: 'Angebot nicht gefunden.' };
      const updates: Record<string, unknown> = {};
      for (const [from, to] of [
        ['title', 'title'], ['customer_id', 'customer_id'], ['travel_start', 'travel_start'], ['travel_end', 'travel_end'],
        ['target_currency', 'target_currency'], ['margin_mode', 'margin_mode'], ['margin_value', 'margin_value'],
        ['items', 'items'], ['extras', 'offer_extras'], ['status', 'status'], ['notes', 'notes'],
      ] as const) {
        if (from in args) updates[to] = args[from];
      }
      const calc = await updateCalculation(existing.id, updates);
      if (!calc) return { error: 'Aktualisierung fehlgeschlagen.' };
      return offerSummary(calc, ctx);
    }
    case 'create_invoice_from_offer': {
      const existing = await resolveOffer(String(args.offer || ''));
      if (!existing) return { error: 'Angebot nicht gefunden.' };
      const result = await createInvoiceFromCalculation(existing.id, {
        persons: args.persons,
        due_in_days: args.due_in_days,
        extra_ids: args.extra_ids,
      });
      if (!result.ok) return { error: result.error };
      const inv = result.data.invoice as { id: string; invoice_number?: string; total_amount?: number };
      return {
        invoice_number: inv.invoice_number || null,
        total_amount: inv.total_amount ?? null,
        booking_id: result.data.booking_id,
        pdf_url: `${ctx.base}/api/ext/invoices/${inv.id}/pdf?key=${encodeURIComponent(ctx.rawKey)}`,
        admin_url: `${ctx.base}/admin/finanzen`,
        currency_warning: result.data.currency_warning,
      };
    }

    /* ── tasks ── */
    case 'list_tasks': {
      const tasks = await listStaffTasks({
        status: typeof args.status === 'string' ? args.status : undefined,
        ai_requested: args.ai_only === true || undefined,
      });
      return tasks.slice(0, 50).map((t) => ({
        id: t.id,
        ticket_no: formatTicketNo(t.ticket_number),
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        project: t.project_name || null,
        ai_requested: !!t.ai_requested,
        description: (t.description || '').slice(0, 500),
      }));
    }
    case 'create_task': {
      const title = String(args.title || '').trim();
      if (!title) return { error: 'title erforderlich.' };
      const task = await createStaffTask({
        title,
        description: String(args.description || ''),
        priority: (['niedrig', 'normal', 'hoch'] as const).find((p) => p === args.priority) || 'normal',
        ai_requested: args.ai_requested === true ? 1 : 0,
        created_by: `MCP: ${ctx.key.name}`,
      });
      return { ticket_no: formatTicketNo(task.ticket_number), id: task.id, status: task.status };
    }
    case 'update_task': {
      const id = String(args.task_id || '');
      const existing = await getStaffTask(id);
      if (!existing) return { error: 'Aufgabe nicht gefunden — list_tasks nutzen (id-Feld).' };
      const updates: Record<string, unknown> = {};
      for (const f of ['status', 'priority', 'title', 'description', 'due_date'] as const) {
        if (typeof args[f] === 'string') updates[f] = args[f];
      }
      const t = await updateStaffTask(id, updates);
      if (!t) return { error: 'Aktualisierung fehlgeschlagen.' };
      return { id: t.id, ticket_no: formatTicketNo(t.ticket_number), status: t.status, priority: t.priority };
    }
    case 'book_task_time': {
      const id = String(args.task_id || '');
      const minutes = Math.round(Number(args.minutes));
      if (!minutes || minutes <= 0) return { error: 'minutes > 0 erforderlich.' };
      const existing = await getStaffTask(id);
      if (!existing) return { error: 'Aufgabe nicht gefunden.' };
      const workDate = /^\d{4}-\d{2}-\d{2}$/.test(String(args.work_date || '')) ? String(args.work_date) : undefined;
      const entry = await addTaskTime(id, minutes, String(args.note || '').trim() || undefined, null, workDate);
      return { booked: true, minutes, entry_id: (entry as { id?: string })?.id ?? null, ticket_no: formatTicketNo(existing.ticket_number) };
    }

    default:
      throw new Error(`Unbekanntes Tool: ${name}`);
  }
}

/* ── JSON-RPC-Handling ─────────────────────────────────────────────────────── */

/**
 * Zentraler MCP-Handler. `key` ist der verifizierte API-Key-Datensatz,
 * `rawKey` der Klartext aus dem Request (für persönliche Links).
 */
export async function handleMcpRequest(req: Request, key: ApiKey, rawKey: string): Promise<NextResponse> {
  const scopes = keyScopes(key);
  const visibleTools = TOOLS.filter((t) => scopes.includes(t.group));
  const ctx: ToolContext = { key, rawKey, base: baseUrl(req) };

  const msg = (await req.json().catch(() => null)) as JsonRpcRequest | null;
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    return rpcError(null, -32700, 'Parse error: einzelnes JSON-RPC-Objekt erwartet.');
  }

  const id = msg.id ?? null;
  const method = msg.method || '';

  // Notifications (ohne id) nur quittieren.
  if (msg.id === undefined && method.startsWith('notifications/')) {
    return new NextResponse(null, { status: 202 });
  }

  try {
    switch (method) {
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      case 'ping':
        return rpcResult(id, {});
      case 'tools/list':
        return rpcResult(id, {
          tools: visibleTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
        });
      case 'tools/call': {
        const name = String(msg.params?.name || '');
        const args = (msg.params?.arguments || {}) as Record<string, unknown>;
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) return rpcError(id, -32602, `Unbekanntes Tool: ${name}`);
        if (!scopes.includes(tool.group)) {
          return rpcError(id, -32602, `Tool "${name}" ist für diesen API-Key nicht freigeschaltet (Scope "${tool.group}" fehlt).`);
        }
        const result = await callTool(name, args, ctx);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: typeof result === 'object' && result !== null && 'error' in result,
        });
      }
      default:
        return rpcError(id, -32601, `Methode nicht unterstützt: ${method}`);
    }
  } catch (e) {
    return rpcError(id, -32603, `Interner Fehler: ${(e as Error).message}`);
  }
}
