/**
 * workspace/tools.ts — Werkzeuge der persönlichen Faltin-KI.
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Portal-Werkzeuge aus portalTools.ts (dieselben wie beim MCP-Server):
 *    Events, Anfragen, Kunden, Angebotskalkulationen, Aufgaben.
 *    Bewusst NICHT: create_invoice_from_offer (Rechnungen erzeugt ein Mensch).
 * 2. Arbeitsplatz-Werkzeuge: Mein Tag, Anfrage-Verlauf, Posteingang, Antwort-
 *    Entwürfe, SharePoint, Teamwissen, Werkstatt (Werkzeug-Ideen).
 * Die Liste ist statisch sortiert (Prompt-Cache bleibt stabil).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import type Anthropic from '@anthropic-ai/sdk';
import { TOOLS as PORTAL_TOOLS, callTool as callPortalTool, type ToolContext } from '../portalTools';
import { getBooking, updateBooking } from '../bookingStore';
import { findBookingByRequestNumber, getMessagesByBooking } from '../database';
import { getCustomer } from '../customerStore';
import { createStaffTask, listProjects, createProject, formatTicketNo, type Employee } from '../staffStore';
import { collectSignals, signalsToText } from './signals';
import { listTriagedMails, readMail, syncInbox, MAIL_CATEGORIES } from './mailTriage';
import { searchSharePoint, readSharePointFile } from './sharepoint';
import { ingestFile, fileContentBlock } from './files';
import { findFileBySourceRef } from './store';
import { searchKnowledge, createKnowledge } from './store';
import { htmlToText, clip } from './text';

type BetaTool = Anthropic.Beta.Messages.BetaTool;
type ToolResultContent = Anthropic.Beta.Messages.BetaToolResultBlockParam['content'];

export interface WorkspaceToolContext {
  employee: Employee | null;
  /** Anzeigename der Person (auch für localadmin). */
  personName: string;
  /** Schlüssel für Besitz (Chats, Dateien). */
  ownerKey: string;
  conversationId: string;
  base: string;
}

const STR = (description: string) => ({ type: 'string', description });

/** Werkzeuge, die die Faltin-KI nicht bekommt (bleiben dem Menschen vorbehalten). */
const EXCLUDED_PORTAL_TOOLS = new Set(['create_invoice_from_offer']);

const WORKSPACE_TOOLS: BetaTool[] = [
  {
    name: 'get_my_day',
    description: 'Überblick für die angemeldete Person: eigene offene Aufgaben (inkl. überfällig), wartende Kunden, neue nicht zugewiesene Anfragen, ruhende eigene Anfragen, Angebotsentwürfe, Stand Posteingang. Startpunkt für „Was steht an?“.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_request_thread',
    description: 'Eine Kundenanfrage vollständig: Anfragedaten (Paket, Personen, Zeitraum, Preis, Nachricht, Notizen, Status, Zuständigkeit), Kunde und der komplette Mailverlauf mit dem Kunden. Nutzen, bevor du eine Antwort an einen Kunden formulierst.',
    input_schema: {
      type: 'object',
      properties: { request: STR('RQ-Nummer (z.B. RQ-10042) oder Anfrage-ID') },
      required: ['request'], additionalProperties: false,
    },
  },
  {
    name: 'update_request',
    description: 'Anfrage im CRM ändern: Status setzen, mir zuweisen und/oder eine interne Notiz anhängen. Vorher bestätigen lassen, außer die Person hat es verlangt.',
    input_schema: {
      type: 'object',
      properties: {
        request: STR('RQ-Nummer oder Anfrage-ID'),
        status: { type: 'string', enum: ['new', 'in_progress', 'booked', 'rejected'], description: 'Neuer Status' },
        assign_to_me: { type: 'boolean', description: 'true = der angemeldeten Person zuweisen' },
        add_note: STR('Interne Notiz, wird mit Datum und Name angehängt'),
      },
      required: ['request'], additionalProperties: false,
    },
  },
  {
    name: 'list_inbox',
    description: `Posteingang des Portal-Postfachs (request@), von der KI vorsortiert: Kategorie, Priorität, Kurzfassung, nächster Schritt. Kategorien: ${MAIL_CATEGORIES.map((c) => c.id).join(', ')}.`,
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['offen', 'erledigt', 'ignoriert', 'alle'], description: 'Standard offen' },
        refresh: { type: 'boolean', description: 'true = vorher neue Mails abholen und einsortieren' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'read_mail',
    description: 'Eine Mail aus dem Portal-Postfach vollständig lesen (mail_id aus list_inbox). Ändert nichts am Postfach.',
    input_schema: {
      type: 'object',
      properties: { mail_id: STR('mail_id aus list_inbox') },
      required: ['mail_id'], additionalProperties: false,
    },
  },
  {
    name: 'prepare_reply_draft',
    description: 'Antwort-Entwurf zur Prüfung vorlegen. Es wird NICHTS versendet: Die Person sieht den Entwurf als Karte, kann ihn bearbeiten und dann selbst senden (Anfrage/CRM) oder als Entwurf in Outlook ablegen (Postfach-Mail). Genau eines von mail_id oder request angeben.',
    input_schema: {
      type: 'object',
      properties: {
        mail_id: STR('Mail aus list_inbox, auf die geantwortet wird'),
        request: STR('RQ-Nummer oder Anfrage-ID, wenn die Antwort über das CRM an den Kunden geht'),
        body: STR('Fertiger Antworttext (Sie-Form, mit Grussformel und Name der Person)'),
        note: STR('Kurzer interner Hinweis, was vor dem Senden zu prüfen ist'),
      },
      required: ['body'], additionalProperties: false,
    },
  },
  {
    name: 'search_sharepoint',
    description: 'Dateien in SharePoint/OneDrive von Faltin Travel suchen (Dateiname und Inhalt). Liefert drive_id/item_id zum Öffnen.',
    input_schema: {
      type: 'object',
      properties: { query: STR('Suchbegriffe, z.B. "Hotelliste Monaco 2027" oder "AGB"') },
      required: ['query'], additionalProperties: false,
    },
  },
  {
    name: 'open_sharepoint_file',
    description: 'Eine SharePoint-Datei öffnen und lesen (PDF, Word, Excel, PowerPoint, Text, Bild). Word/Excel/PowerPoint kommen als PDF-Ansicht.',
    input_schema: {
      type: 'object',
      properties: { drive_id: STR('drive_id aus search_sharepoint'), item_id: STR('item_id aus search_sharepoint') },
      required: ['drive_id', 'item_id'], additionalProperties: false,
    },
  },
  {
    name: 'search_knowledge',
    description: 'Gemeinsames Teamwissen durchsuchen (Abläufe, Regeln, Kontakte, Antwortbausteine, Lösungen). Bei Fach- und Ablauffragen zuerst hier nachsehen.',
    input_schema: {
      type: 'object',
      properties: { query: STR('Stichworte') },
      required: ['query'], additionalProperties: false,
    },
  },
  {
    name: 'save_knowledge',
    description: 'Wissen fürs ganze Team festhalten (Regel, Ablauf, Kontakt, Antwortbaustein, Lösung). Nur speichern, wenn die Person zugestimmt oder darum gebeten hat. Kurz, allgemeingültig, ohne persönliche Kundendaten.',
    input_schema: {
      type: 'object',
      properties: {
        title: STR('Kurzer, suchbarer Titel'),
        content: STR('Der Wissensinhalt (Markdown erlaubt)'),
        tags: STR('Komma-getrennte Stichworte, z.B. "zahlung, anzahlung"'),
      },
      required: ['title', 'content'], additionalProperties: false,
    },
  },
  {
    name: 'propose_tool_idea',
    description: 'Idee für ein neues Werkzeug im Portal an die Entwicklung geben (landet als Aufgabe „KI-Umsetzung angefragt“ in der Werkstatt). Nutzen, wenn jemand etwas wiederholt von Hand macht oder sich ein Werkzeug wünscht — nach Zustimmung der Person.',
    input_schema: {
      type: 'object',
      properties: {
        title: STR('Kurzer Name des Werkzeugs'),
        problem: STR('Was heute mühsam ist (wer, wie oft, wie lange)'),
        idea: STR('Was das Werkzeug tun soll, als User-Story'),
        benefit: STR('Erwarteter Nutzen'),
      },
      required: ['title', 'problem', 'idea'], additionalProperties: false,
    },
  },
];

/** Alle Werkzeuge für die Anthropic-API (Portal + Arbeitsplatz), stabile Reihenfolge. */
export function workspaceToolDefs(): BetaTool[] {
  const portal: BetaTool[] = PORTAL_TOOLS.filter((t) => !EXCLUDED_PORTAL_TOOLS.has(t.name)).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as BetaTool['input_schema'],
  }));
  return [...portal, ...WORKSPACE_TOOLS];
}

const PORTAL_TOOL_NAMES = new Set(PORTAL_TOOLS.map((t) => t.name));

/** Deutsche Kurzbeschriftung je Werkzeug (Chips im Chat). */
export const TOOL_LABELS: Record<string, string> = {
  list_events: 'Events nachgeschlagen',
  get_event_info: 'Event-Details gelesen',
  get_series_info: 'Serien-Infos gelesen',
  search_booking_status: 'Anfrage-Status gesucht',
  list_bookings: 'Anfragen aufgelistet',
  find_customers: 'Kunden gesucht',
  get_customer: 'Kundenakte gelesen',
  create_customer: 'Kunde angelegt',
  update_customer: 'Kunde aktualisiert',
  list_offers: 'Angebote aufgelistet',
  get_offer: 'Angebot gelesen',
  create_offer: 'Angebotsentwurf angelegt',
  update_offer: 'Angebot geändert',
  list_tasks: 'Aufgaben aufgelistet',
  create_task: 'Aufgabe angelegt',
  update_task: 'Aufgabe geändert',
  book_task_time: 'Zeit gebucht',
  get_my_day: 'Tagesüberblick geholt',
  get_request_thread: 'Anfrage-Verlauf gelesen',
  update_request: 'Anfrage aktualisiert',
  list_inbox: 'Posteingang angesehen',
  read_mail: 'Mail gelesen',
  prepare_reply_draft: 'Antwortentwurf vorbereitet',
  search_sharepoint: 'SharePoint durchsucht',
  open_sharepoint_file: 'SharePoint-Datei gelesen',
  search_knowledge: 'Teamwissen durchsucht',
  save_knowledge: 'Wissen festgehalten',
  propose_tool_idea: 'Werkzeug-Idee eingereicht',
};

/** Werkzeuge, die Daten verändern (im Chat hervorgehoben). */
export const WRITE_TOOLS = new Set([
  'create_customer', 'update_customer', 'create_offer', 'update_offer', 'create_task', 'update_task',
  'book_task_time', 'update_request', 'save_knowledge', 'propose_tool_idea',
]);

/** Pflichtfelder prüfen — Eingaben aus dem Stream werden nicht serverseitig validiert. */
export function validateToolInput(name: string, input: unknown): string | null {
  const def = workspaceToolDefs().find((t) => t.name === name);
  if (!def) return `Unbekanntes Werkzeug: ${name}`;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'Eingabe muss ein JSON-Objekt sein.';
  const required = ((def.input_schema as { required?: string[] }).required) || [];
  const missing = required.filter((k) => (input as Record<string, unknown>)[k] === undefined || (input as Record<string, unknown>)[k] === '');
  return missing.length ? `Pflichtfelder fehlen: ${missing.join(', ')}` : null;
}

async function resolveBooking(ref: string) {
  const r = String(ref || '').trim();
  if (!r) return null;
  if (/^rq-?\d+/i.test(r)) {
    const rq = r.toUpperCase().startsWith('RQ-') ? r.toUpperCase() : `RQ-${r.replace(/\D/g, '')}`;
    return (await findBookingByRequestNumber(rq)) || null;
  }
  return ((await getBooking(r)) as Awaited<ReturnType<typeof findBookingByRequestNumber>>) || null;
}

const WERKSTATT_PROJECT = 'KI-Werkstatt (Werkzeug-Ideen)';

/** Markierung einer „Brauche ich auch“-Stimme (Notiz an der Idee). */
export const VOTE_MARK = '+1 · Brauche ich auch';

export async function werkstattProjectId(): Promise<string | null> {
  const existing = (await listProjects()).find((p) => p.name === WERKSTATT_PROJECT);
  if (existing) return existing.id;
  const created = await createProject({
    name: WERKSTATT_PROJECT,
    description: 'Ideen der Mitarbeitenden für neue Werkzeuge im Portal — eingereicht über den KI-Arbeitsplatz. Umsetzung durch die KI angefragt.',
  });
  return 'error' in created ? null : created.id;
}

export async function submitToolIdea(input: { title: string; problem: string; idea: string; benefit?: string }, by: { name: string; employeeId: string | null }) {
  const projectId = await werkstattProjectId();
  const description = [
    `**Problem heute:** ${input.problem}`,
    `**Idee:** ${input.idea}`,
    input.benefit ? `**Nutzen:** ${input.benefit}` : '',
    `\nEingereicht von ${by.name} über den KI-Arbeitsplatz.`,
  ].filter(Boolean).join('\n\n');
  return createStaffTask({
    title: `Werkzeug-Idee: ${input.title}`.slice(0, 200),
    description,
    priority: 'normal',
    ai_requested: 1,
    project_id: projectId,
    created_by: by.employeeId || by.name,
  });
}

/** Ergebnis eines Werkzeugaufrufs: Inhalt für die KI + Metadaten für die Anzeige. */
export interface ToolRun {
  content: ToolResultContent;
  isError: boolean;
  summary: string;
  links: Array<{ label: string; url: string }>;
}

function jsonResult(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Links aus einem Ergebnis ziehen (admin_url, pdf_url, web_url) — für Chips im Chat. */
export function linksFromResult(value: unknown): Array<{ label: string; url: string }> {
  const out: Array<{ label: string; url: string }> = [];
  const visit = (v: unknown) => {
    if (!v || typeof v !== 'object' || out.length >= 4) return;
    if (Array.isArray(v)) { if (v.length <= 3) v.forEach(visit); return; }
    const o = v as Record<string, unknown>;
    if (typeof o.admin_url === 'string') out.push({ label: String(o.offer_number || o.ticket_no || o.request_number || 'Öffnen'), url: o.admin_url });
    if (typeof o.pdf_url === 'string') out.push({ label: 'PDF', url: o.pdf_url });
    if (typeof o.web_url === 'string' && o.web_url) out.push({ label: String(o.name || 'SharePoint'), url: o.web_url });
  };
  visit(value);
  return out;
}

export async function runWorkspaceTool(name: string, input: Record<string, unknown>, ctx: WorkspaceToolContext): Promise<ToolRun> {
  const done = (value: unknown, summary = ''): ToolRun => {
    const isError = !!value && typeof value === 'object' && !Array.isArray(value) && 'error' in (value as object);
    return { content: jsonResult(value), isError, summary, links: isError ? [] : linksFromResult(value) };
  };

  if (PORTAL_TOOL_NAMES.has(name) && !EXCLUDED_PORTAL_TOOLS.has(name)) {
    const portalCtx: ToolContext = {
      actor: `Faltin-KI (${ctx.personName})`,
      base: ctx.base,
      offerPdfUrl: (id) => `${ctx.base}/api/admin/calculations/${id}/pdf`,
      invoicePdfUrl: (id) => `${ctx.base}/api/invoices/${id}/pdf`,
    };
    const value = await callPortalTool(name, input, portalCtx);
    return done(value);
  }

  switch (name) {
    case 'get_my_day': {
      const s = await collectSignals(ctx.employee);
      return { content: signalsToText(s), isError: false, summary: '', links: [] };
    }

    case 'get_request_thread': {
      const b = await resolveBooking(String(input.request || ''));
      if (!b) return done({ error: 'Anfrage nicht gefunden — RQ-Nummer prüfen oder search_booking_status nutzen.' });
      const thread = await getMessagesByBooking(b.id).catch(() => []);
      const customer = b.customer_id ? await getCustomer(b.customer_id).catch(() => null) : null;
      const row = b as typeof b & { notes?: string; assigned_to?: string | null };
      return done({
        id: b.id,
        request_number: b.request_number,
        status: b.status,
        package: b.package_title,
        event_slug: b.event_slug || null,
        persons: b.number_of_persons,
        rooms: { double: b.double_rooms, single: b.single_rooms },
        travel_period: b.travel_period || b.start_date || null,
        total_price: b.total_price || null,
        customer: customer
          ? { id: customer.id, name: customer.name, company: customer.company || null, email: customer.emails?.[0]?.email || b.email, phone: customer.phone || b.phone || null }
          : { email: b.email, phone: b.phone || null },
        travelers: (b.travelers || []).map((t) => `${t.firstName || ''} ${t.lastName || ''}`.trim()).filter(Boolean),
        customer_message: b.message ? clip(b.message, 2000) : null,
        internal_notes: row.notes ? clip(row.notes, 2000) : null,
        assigned_to_me: !!ctx.employee && row.assigned_to === ctx.employee.id,
        messages: thread.slice(-20).map((m) => ({
          direction: m.direction === 'in' ? 'Kunde → Faltin' : 'Faltin → Kunde',
          date: m.created_at,
          subject: m.subject,
          text: clip(htmlToText(m.body), 3000),
        })),
        admin_url: `${ctx.base}/admin/crm`,
      });
    }

    case 'update_request': {
      const b = await resolveBooking(String(input.request || ''));
      if (!b) return done({ error: 'Anfrage nicht gefunden.' });
      const updates: { status?: string; assigned_to?: string | null; notes?: string } = {};
      if (typeof input.status === 'string') updates.status = input.status;
      if (input.assign_to_me === true) {
        if (!ctx.employee) return done({ error: 'Zuweisen geht nur mit Microsoft-Login (Mitarbeiterprofil).' });
        updates.assigned_to = ctx.employee.id;
      }
      if (typeof input.add_note === 'string' && input.add_note.trim()) {
        const cur = ((b as { notes?: string }).notes || '').trim();
        const stamp = new Date().toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich' });
        updates.notes = `${cur ? `${cur}\n` : ''}[${stamp} · ${ctx.personName} via Faltin-KI] ${input.add_note.trim()}`;
      }
      if (!Object.keys(updates).length) return done({ error: 'Nichts zu ändern (status, assign_to_me oder add_note angeben).' });
      await updateBooking(b.id, updates);
      return done({ updated: Object.keys(updates), request_number: b.request_number, admin_url: `${ctx.base}/admin/crm` });
    }

    case 'list_inbox': {
      let sync: Awaited<ReturnType<typeof syncInbox>> | null = null;
      if (input.refresh === true) sync = await syncInbox();
      const status = typeof input.status === 'string' ? input.status : 'offen';
      const rows = await listTriagedMails({ status, limit: 40 });
      return done({
        synced: sync ? { neu: sync.added, eingeordnet: sync.triaged, fehler: sync.errors } : undefined,
        mails: rows.map((m) => ({
          mail_id: m.graph_id,
          received: m.received_at,
          from: `${m.from_name} <${m.from_address}>`,
          subject: m.subject,
          category: m.category || 'noch nicht eingeordnet',
          priority: m.priority,
          summary: m.summary || m.preview,
          next_step: m.next_step,
          needs_reply: !!m.needs_reply,
          request_number: m.request_number || null,
          status: m.status,
          has_suggestion: !!m.suggestion,
        })),
      });
    }

    case 'read_mail': {
      const m = await readMail(String(input.mail_id || ''));
      if (!m) return done({ error: 'Mail nicht gefunden (verschoben oder gelöscht?).' });
      return done({ ...m, text: clip(m.text, 12000) });
    }

    case 'prepare_reply_draft': {
      const body = String(input.body || '').trim();
      if (!body) return done({ error: 'body fehlt.' });
      if (!input.mail_id && !input.request) return done({ error: 'mail_id oder request angeben.' });
      if (input.request) {
        const b = await resolveBooking(String(input.request));
        if (!b) return done({ error: 'Anfrage nicht gefunden.' });
      }
      return done({ draft_ready: true, hint: 'Der Entwurf wird der Person als Karte angezeigt; sie prüft und sendet selbst.' });
    }

    case 'search_sharepoint': {
      const hits = await searchSharePoint(String(input.query || ''), 10);
      if (!hits.length) return done({ results: [], hint: 'Keine Treffer — andere Stichworte versuchen.' });
      return done({ results: hits });
    }

    case 'open_sharepoint_file': {
      const driveId = String(input.drive_id || '');
      const itemId = String(input.item_id || '');
      const file = await readSharePointFile(driveId, itemId);
      const ref = `${driveId}:${itemId}:${file.modified}`;
      const ws = (await findFileBySourceRef('sharepoint', ref)) || (await ingestFile({
        employeeId: ctx.ownerKey,
        conversationId: ctx.conversationId,
        filename: file.name,
        mime: file.mime,
        bytes: file.bytes,
        source: 'sharepoint',
        sourceRef: ref,
      }));
      return {
        content: [
          { type: 'text', text: `Datei „${file.name}“${file.converted ? ' (für dich als PDF gerendert)' : ''}, zuletzt geändert ${file.modified}. Link: ${file.web_url}` },
          fileContentBlock(ws) as Anthropic.Beta.Messages.BetaRequestDocumentBlock | Anthropic.Beta.Messages.BetaImageBlockParam,
        ],
        isError: false,
        summary: file.name,
        links: file.web_url ? [{ label: file.name, url: file.web_url }] : [],
      };
    }

    case 'search_knowledge': {
      const rows = await searchKnowledge(String(input.query || ''), 6);
      if (!rows.length) return done({ results: [], hint: 'Noch nichts dazu im Teamwissen. Wenn ihr es klärt: anbieten, es mit save_knowledge festzuhalten.' });
      return done({ results: rows.map((k) => ({ title: k.title, content: clip(k.content, 3000), tags: k.tags, von: k.created_by_name, stand: k.updated_at.slice(0, 10) })) });
    }

    case 'save_knowledge': {
      const k = await createKnowledge({
        title: String(input.title || ''),
        content: String(input.content || ''),
        tags: typeof input.tags === 'string' ? input.tags : '',
        source: `Chat mit ${ctx.personName}`,
        created_by: ctx.employee?.id || ctx.ownerKey,
        created_by_name: ctx.personName,
      });
      return done({ saved: true, id: k.id, title: k.title }, k.title);
    }

    case 'propose_tool_idea': {
      const task = await submitToolIdea(
        { title: String(input.title || ''), problem: String(input.problem || ''), idea: String(input.idea || ''), benefit: typeof input.benefit === 'string' ? input.benefit : undefined },
        { name: ctx.personName, employeeId: ctx.employee?.id || null },
      );
      return done({
        submitted: true,
        ticket_no: formatTicketNo(task.ticket_number),
        admin_url: `${ctx.base}/admin/aufgaben/${task.id}`,
      }, formatTicketNo(task.ticket_number));
    }

    default:
      return done({ error: `Unbekanntes Werkzeug: ${name}` });
  }
}
