#!/usr/bin/env node
/**
 * ft-super-bowl-mcp — MCP-Server für die Faltin-Travel-Plattform.
 * ─────────────────────────────────────────────────────────────────────────────
 * Greift über die externe API (/api/ext/*) auf die Website zu und authentifiziert
 * sich per API-Key. Tools für Tickets/Aufgaben, Anfragen/CRM, Kunden und Content.
 *
 * Konfiguration über Umgebungsvariablen:
 *   FT_BASE_URL  Basis-URL der Plattform (Default: https://next.faltintravel.com)
 *   FT_API_KEY   API-Key (im Admin unter /admin/api-keys erzeugen)  [erforderlich]
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = (process.env.FT_BASE_URL || 'https://next.faltintravel.com').replace(/\/+$/, '');
const API_KEY = process.env.FT_API_KEY || '';

if (!API_KEY) {
  console.error('[ft-mcp] FEHLER: FT_API_KEY ist nicht gesetzt. Key im Admin unter /admin/api-keys erzeugen und als FT_API_KEY hinterlegen.');
  process.exit(1);
}

type Json = Record<string, unknown> | unknown[] | null;

/** Ruft die externe API auf und liefert die `data`-Nutzlast (oder wirft mit klarer Meldung). */
async function api(method: string, path: string, body?: Json): Promise<unknown> {
  const url = `${BASE_URL}/api/ext${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    throw new Error(`Netzwerkfehler beim Aufruf von ${method} ${url}: ${(e as Error).message}. Ist FT_BASE_URL korrekt und die Seite erreichbar?`);
  }
  const text = await res.text();
  let parsed: { success?: boolean; data?: unknown; error?: string } = {};
  try { parsed = text ? JSON.parse(text) : {}; } catch { /* non-json */ }
  if (res.status === 401) throw new Error('Nicht autorisiert (401): API-Key ungültig oder widerrufen. Prüfe FT_API_KEY bzw. erzeuge unter /admin/api-keys einen neuen.');
  if (!res.ok || parsed.success === false) {
    throw new Error(parsed.error || `API-Fehler ${res.status} bei ${method} ${path}: ${text.slice(0, 300)}`);
  }
  return parsed.data ?? parsed;
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({ name: 'ft-super-bowl', version: '1.0.0' });

const RO = { readOnlyHint: true, openWorldHint: true } as const;
const RW = { readOnlyHint: false, openWorldHint: true } as const;

// ─────────────────────────── Health ───────────────────────────
server.registerTool('ft_whoami', {
  title: 'API-Key prüfen',
  description: 'Prüft den hinterlegten API-Key und gibt dessen Bezeichnung zurück (Verbindungstest).',
  inputSchema: {},
  annotations: RO,
}, async () => ok(await api('GET', '/me')));

// ─────────────────────────── Tickets / Aufgaben ───────────────────────────
server.registerTool('ft_list_tasks', {
  title: 'Tickets auflisten',
  description: 'Listet interne Tickets/Aufgaben. Optional nach Status (offen|in_arbeit|erledigt), Mitarbeiter-ID oder verknüpfter Anfrage filtern.',
  inputSchema: {
    status: z.enum(['offen', 'in_arbeit', 'erledigt']).optional().describe('Statusfilter'),
    assignee: z.string().optional().describe('Mitarbeiter-ID (zugewiesen an)'),
    booking: z.string().optional().describe('Anfrage-/Booking-ID'),
  },
  annotations: RO,
}, async ({ status, assignee, booking }) => {
  const q = new URLSearchParams();
  if (status) q.set('status', status);
  if (assignee) q.set('assignee', assignee);
  if (booking) q.set('booking', booking);
  const qs = q.toString();
  return ok(await api('GET', `/tasks${qs ? `?${qs}` : ''}`));
});

server.registerTool('ft_get_task', {
  title: 'Ticket abrufen',
  description: 'Liefert ein einzelnes Ticket inkl. Ticketnummer (TASK-xxxxx).',
  inputSchema: { id: z.string().describe('Ticket-ID') },
  annotations: RO,
}, async ({ id }) => ok(await api('GET', `/tasks/${encodeURIComponent(id)}`)));

server.registerTool('ft_create_task', {
  title: 'Ticket anlegen',
  description: 'Legt ein neues internes Ticket/Aufgabe an. Gibt das Ticket inkl. neuer Nummer zurück.',
  inputSchema: {
    title: z.string().describe('Titel der Aufgabe'),
    description: z.string().optional().describe('Beschreibung/Kontext'),
    priority: z.enum(['niedrig', 'normal', 'hoch']).optional().describe('Priorität (Default normal)'),
    due_date: z.string().optional().describe('Fälligkeitsdatum YYYY-MM-DD'),
    assignee_id: z.string().optional().describe('Mitarbeiter-ID (zuweisen)'),
    booking_id: z.string().optional().describe('verknüpfte Anfrage/Booking-ID'),
  },
  annotations: RW,
}, async (args) => ok(await api('POST', '/tasks', args)));

server.registerTool('ft_update_task', {
  title: 'Ticket aktualisieren',
  description: 'Aktualisiert Felder eines Tickets (z.B. Status auf Kanban-Board verschieben).',
  inputSchema: {
    id: z.string().describe('Ticket-ID'),
    status: z.enum(['offen', 'in_arbeit', 'erledigt']).optional(),
    priority: z.enum(['niedrig', 'normal', 'hoch']).optional(),
    assignee_id: z.string().nullable().optional(),
    due_date: z.string().nullable().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
  },
  annotations: { ...RW, idempotentHint: true },
}, async ({ id, ...patch }) => ok(await api('PATCH', `/tasks/${encodeURIComponent(id)}`, patch)));

server.registerTool('ft_book_task_time', {
  title: 'Zeit auf Ticket buchen',
  description: 'Bucht Arbeitszeit (in Minuten) auf ein Ticket, mit optionalem Datum (Standard heute) und Notiz.',
  inputSchema: {
    id: z.string().describe('Ticket-ID'),
    minutes: z.number().int().positive().describe('Dauer in Minuten'),
    note: z.string().optional().describe('Notiz zur Buchung'),
    work_date: z.string().optional().describe('Datum der Leistung YYYY-MM-DD (Default heute)'),
  },
  annotations: RW,
}, async ({ id, ...body }) => ok(await api('POST', `/tasks/${encodeURIComponent(id)}/time`, body)));

server.registerTool('ft_list_task_time', {
  title: 'Zeitbuchungen eines Tickets',
  description: 'Listet Zeitbuchungen eines Tickets inkl. Gesamtsumme (Minuten).',
  inputSchema: { id: z.string().describe('Ticket-ID') },
  annotations: RO,
}, async ({ id }) => ok(await api('GET', `/tasks/${encodeURIComponent(id)}/time`)));

server.registerTool('ft_list_task_messages', {
  title: 'Ticket-Verlauf',
  description: 'Listet den Mail-/Notiz-Verlauf eines Tickets (ein- und ausgehend).',
  inputSchema: { id: z.string().describe('Ticket-ID') },
  annotations: RO,
}, async ({ id }) => ok(await api('GET', `/tasks/${encodeURIComponent(id)}/messages`)));

server.registerTool('ft_send_task_message', {
  title: 'Ticket-Mail/Notiz',
  description: 'Sendet eine E-Mail vom Ticket aus (kind="email", Empfänger "to" nötig) ODER speichert eine interne Notiz (kind="note"). Der Betreff bekommt automatisch die Ticketnummer.',
  inputSchema: {
    id: z.string().describe('Ticket-ID'),
    kind: z.enum(['email', 'note']).describe('email = echte Mail senden, note = interne Notiz'),
    to: z.string().optional().describe('Empfänger-E-Mail (nur bei kind=email)'),
    toName: z.string().optional().describe('Anzeigename des Empfängers'),
    subject: z.string().optional().describe('Betreff (optional, Ticketnummer wird ergänzt)'),
    body: z.string().describe('Nachrichtentext'),
  },
  annotations: RW,
}, async ({ id, ...body }) => ok(await api('POST', `/tasks/${encodeURIComponent(id)}/messages`, body)));

// ─────────────────────────── Anfragen / CRM ───────────────────────────
server.registerTool('ft_list_bookings', {
  title: 'Anfragen auflisten',
  description: 'Listet Buchungsanfragen (CRM). Optional nach Status filtern (z.B. new, in_progress, offer, booked, rejected).',
  inputSchema: { status: z.string().optional().describe('Statusfilter') },
  annotations: RO,
}, async ({ status }) => ok(await api('GET', `/bookings${status ? `?status=${encodeURIComponent(status)}` : ''}`)));

server.registerTool('ft_get_booking', {
  title: 'Anfrage abrufen',
  description: 'Liefert eine einzelne Anfrage/Buchung inkl. RQ-Nummer.',
  inputSchema: { id: z.string().describe('Anfrage-/Booking-ID') },
  annotations: RO,
}, async ({ id }) => ok(await api('GET', `/bookings/${encodeURIComponent(id)}`)));

server.registerTool('ft_update_booking', {
  title: 'Anfrage aktualisieren',
  description: 'Setzt Status/Zuweisung/Notizen/Meilensteine einer Anfrage.',
  inputSchema: {
    id: z.string().describe('Anfrage-/Booking-ID'),
    status: z.string().optional(),
    notes: z.string().optional(),
    assigned_to: z.string().nullable().optional(),
    offer_sent: z.boolean().optional(),
    docs_ready: z.boolean().optional(),
  },
  annotations: { ...RW, idempotentHint: true },
}, async ({ id, ...patch }) => ok(await api('PATCH', `/bookings/${encodeURIComponent(id)}`, patch)));

server.registerTool('ft_list_booking_messages', {
  title: 'Anfrage-Mailverlauf',
  description: 'Listet den E-Mail-Verlauf (CRM) einer Anfrage.',
  inputSchema: { id: z.string().describe('Anfrage-/Booking-ID') },
  annotations: RO,
}, async ({ id }) => ok(await api('GET', `/bookings/${encodeURIComponent(id)}/messages`)));

server.registerTool('ft_reply_booking', {
  title: 'Kundenantwort senden',
  description: 'Sendet eine Antwort-E-Mail an den Kunden einer Anfrage (mit RQ-Threading) und protokolliert sie im CRM. Achtung: echte Kundenkommunikation.',
  inputSchema: {
    id: z.string().describe('Anfrage-/Booking-ID'),
    body: z.string().describe('Nachrichtentext an den Kunden'),
    agentName: z.string().optional().describe('Signaturname (optional)'),
  },
  annotations: RW,
}, async ({ id, ...body }) => ok(await api('POST', `/bookings/${encodeURIComponent(id)}/reply`, body)));

// ─────────────────────────── Kunden (read) ───────────────────────────
server.registerTool('ft_list_customers', {
  title: 'Kunden auflisten',
  description: 'Listet Kunden (read-only). Optional Suchbegriff (Name/E-Mail).',
  inputSchema: { q: z.string().optional().describe('Suchbegriff') },
  annotations: RO,
}, async ({ q }) => ok(await api('GET', `/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`)));

server.registerTool('ft_get_customer', {
  title: 'Kunde abrufen',
  description: 'Liefert einen Kunden inkl. verknüpfter Daten (read-only).',
  inputSchema: { id: z.string().describe('Kunden-ID') },
  annotations: RO,
}, async ({ id }) => ok(await api('GET', `/customers/${encodeURIComponent(id)}`)));

// ─────────────────────────── Content (read) ───────────────────────────
server.registerTool('ft_list_events', {
  title: 'Events auflisten',
  description: 'Listet alle Events (read-only).',
  inputSchema: {},
  annotations: RO,
}, async () => ok(await api('GET', '/events')));

server.registerTool('ft_list_series', {
  title: 'Serien auflisten',
  description: 'Listet alle Serien/Hubs (read-only).',
  inputSchema: {},
  annotations: RO,
}, async () => ok(await api('GET', '/series')));

server.registerTool('ft_list_packages', {
  title: 'Pakete auflisten',
  description: 'Listet Pakete – alle oder eines Events (Parameter event=Slug). Read-only.',
  inputSchema: { event: z.string().optional().describe('Event-Slug (optional)') },
  annotations: RO,
}, async ({ event }) => ok(await api('GET', `/packages${event ? `?event=${encodeURIComponent(event)}` : ''}`)));

server.registerTool('ft_list_faqs', {
  title: 'FAQs eines Events',
  description: 'Listet die FAQs eines Events (Parameter event=Slug). Read-only.',
  inputSchema: { event: z.string().describe('Event-Slug') },
  annotations: RO,
}, async ({ event }) => ok(await api('GET', `/faqs?event=${encodeURIComponent(event)}`)));

// ─────────────────────────── Start ───────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[ft-mcp] verbunden · Basis: ${BASE_URL}`);
}

main().catch((e) => {
  console.error('[ft-mcp] Startfehler:', e);
  process.exit(1);
});
