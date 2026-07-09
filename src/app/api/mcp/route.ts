import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getEvents, getSeries, getFaqs, findSeriesBySlug, findPackagesByEvent } from '@/lib/contentStore';
import { getAllBookings, findBookingByRequestNumber } from '@/lib/database';
import { listStaffTasks, createStaffTask, formatTicketNo } from '@/lib/staffStore';

/**
 * /api/mcp — MCP-Server (Streamable HTTP, JSON-only) für die „Nerd-KI" (TASK-00101).
 * ─────────────────────────────────────────────────────────────────────────────
 * Externe KI-Agents (ElevenLabs Voice-Agent, Claude, …) verbinden sich per
 * MCP über HTTP POST mit API-Key (Authorization: Bearer ftk_… — Keys unter
 * /admin/api-keys). Angebotene Tools: Website-/Event-Infos, Pakete, FAQs,
 * Anfrage-/Buchungsstatus, Aufgabenliste und Aufgabe anlegen (inkl.
 * ai_requested-Flag aus TASK-00098).
 *
 * Bewusst ohne SDK: minimale JSON-RPC-2.0-Behandlung der MCP-Methoden
 * initialize / tools/list / tools/call / ping. Notifications (ohne id)
 * werden mit 202 quittiert. GET liefert 405 (kein SSE-Stream nötig).
 */

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'faltin-travel-portal', version: '1.0.0' };
const INSTRUCTIONS =
  'Portal-Zugriff für Faltin Travel (Sportreisen): Events, Pakete, FAQs und Serien-Infos der Website abrufen, ' +
  'Anfrage-/Buchungsstatus nachschlagen (RQ-Nummer oder Kunden-E-Mail) und Aufgaben im Admin-Ticketsystem anlegen/auflisten. ' +
  'Preise sind CHF/EUR-Beträge aus dem Buchungssystem; keine Werte erfinden.';

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

/* ── Tool-Definitionen ─────────────────────────────────────────────────────── */

const TOOLS = [
  {
    name: 'list_events',
    description: 'Listet alle Events der Website (Name, Slug, Datum, Ort, Serie). Startpunkt für Event-Fragen.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_event_info',
    description: 'Details zu einem Event inkl. buchbarer Pakete (Titel, Preis, Hotel, Leistungen) und FAQs.',
    inputSchema: {
      type: 'object',
      properties: { event_slug: { type: 'string', description: 'Slug aus list_events, z.B. "super-bowl-2027"' } },
      required: ['event_slug'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_series_info',
    description: 'Evergreen-Infos einer Event-Serie (Intro, Highlights, FAQs, Guide) — die Website-Inhalte.',
    inputSchema: {
      type: 'object',
      properties: { series_slug: { type: 'string', description: 'Serien-Slug, z.B. "monaco-grand-prix"' } },
      required: ['series_slug'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_booking_status',
    description: 'Status einer Kundenanfrage/Buchung nachschlagen — per RQ-Nummer (z.B. RQ-10042) oder Kunden-E-Mail.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'RQ-Nummer oder E-Mail-Adresse' } },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_tasks',
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
    name: 'create_task',
    description: 'Neue Aufgabe im Admin-Ticketsystem anlegen. Bei Portal-Weiterentwicklung als klare User-Story formulieren.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['niedrig', 'normal', 'hoch'] },
        ai_requested: { type: 'boolean', description: 'true = Umsetzung durch die KI anfragen' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
] as const;

/* ── Tool-Implementierungen ────────────────────────────────────────────────── */

async function callTool(name: string, args: Record<string, unknown>, keyName: string): Promise<unknown> {
  switch (name) {
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
    case 'search_booking_status': {
      const query = String(args.query || '').trim();
      if (!query) return { error: 'query erforderlich (RQ-Nummer oder E-Mail).' };
      const summarize = (b: {
        request_number?: string | null; booking_number?: string | null; package_title: string; status: string;
        created_at: string; travel_period?: string; number_of_persons: number;
      }) => ({
        request_number: b.request_number || null,
        booking_number: (b as { booking_number?: string | null }).booking_number || null,
        package: b.package_title,
        status: b.status,
        status_label: { new: 'Neu eingegangen', in_progress: 'In Bearbeitung', booked: 'Gebucht', rejected: 'Abgelehnt' }[b.status] || b.status,
        persons: b.number_of_persons,
        travel_period: b.travel_period || null,
        created_at: b.created_at,
      });
      if (/^rq-?\d+/i.test(query)) {
        const rq = query.toUpperCase().startsWith('RQ-') ? query.toUpperCase() : `RQ-${query.replace(/\D/g, '')}`;
        const b = await findBookingByRequestNumber(rq);
        return b ? summarize(b) : { error: `Keine Anfrage mit Nummer ${rq} gefunden.` };
      }
      const matches = (await getAllBookings()).filter((b) => (b.email || '').toLowerCase() === query.toLowerCase());
      if (!matches.length) return { error: `Keine Anfragen zur E-Mail ${query} gefunden.` };
      return matches.slice(0, 10).map(summarize);
    }
    case 'list_tasks': {
      const tasks = await listStaffTasks({
        status: typeof args.status === 'string' ? args.status : undefined,
        ai_requested: args.ai_only === true || undefined,
      });
      return tasks.slice(0, 50).map((t) => ({
        ticket_no: formatTicketNo(t.ticket_number),
        title: t.title,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
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
        created_by: `MCP: ${keyName}`,
      });
      return { ticket_no: formatTicketNo(task.ticket_number), id: task.id, status: task.status };
    }
    default:
      throw new Error(`Unbekanntes Tool: ${name}`);
  }
}

/* ── JSON-RPC-Handling ─────────────────────────────────────────────────────── */

export async function POST(req: Request) {
  const a = await apiKeyOr401(req);
  if ('res' in a) return a.res;

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
        return rpcResult(id, { tools: TOOLS });
      case 'tools/call': {
        const name = String(msg.params?.name || '');
        const args = (msg.params?.arguments || {}) as Record<string, unknown>;
        if (!TOOLS.some((t) => t.name === name)) return rpcError(id, -32602, `Unbekanntes Tool: ${name}`);
        const result = await callTool(name, args, a.key.name);
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

/** Kein SSE-Stream — Clients nutzen reine POST-Requests (Streamable HTTP, JSON-Antworten). */
export async function GET() {
  return NextResponse.json(
    { error: 'MCP-Endpoint: POST mit JSON-RPC verwenden (Authorization: Bearer <API-Key>).' },
    { status: 405 }
  );
}
