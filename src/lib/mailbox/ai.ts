/**
 * mailbox/ai.ts — KI im Mail-Client:
 *   - aiSearch:   Frage in Alltagssprache → KI durchsucht die eigenen Postfächer (Tool-Loop) → Antwort mit Quellen
 *   - extractMail: strukturierte Infos aus einer Mail (Anfrage, Personen, Daten, Aufgaben) für die Übernahme in Prozesse
 *   - composeAssist: Text korrigieren / im Faltin-Ton ausformulieren / kürzen / übersetzen
 * Die KI versendet NIE selbst etwas. Modell + Key wie der KI-Arbeitsplatz (settings.ai).
 */
import type Anthropic from '@anthropic-ai/sdk';
import { anthropicClient, structuredCall, FALLBACK_BETA } from '../workspace/claude';
import { TOOLS as PORTAL_TOOLS, callTool as callPortalTool, type ToolContext } from '../portalTools';
import { getSettings } from '../settingsStore';
import { getMessage, searchMessages, type MailSummary } from './graph';
import { mailText } from './context';
import type { AssistMode } from './prefs';
import { FALTIN_TONE } from './tone';

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + ' …[gekürzt]' : s);
const today = () => new Date().toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

// ───────────────────────── KI-Suche ─────────────────────────

export interface AiSearchResult {
  answer: string;
  sources: MailSummary[];
  steps: string[];
}

/** Fortschritt für die Live-Anzeige im Client. */
export type AiSearchProgress = (step: string) => void;

/** Portal-Werkzeuge, die die Mail-Suche lesend mitbenutzt (Events mit Datum, Anfragen/Buchungen, Kunden). */
const PORTAL_READ_TOOLS = ['list_events', 'get_event_info', 'list_bookings', 'search_booking_status', 'find_customers'];

const MAX_ROUNDS = 6;

function searchTools(): Anthropic.Beta.Messages.BetaTool[] {
  const portal = PORTAL_TOOLS.filter((t) => PORTAL_READ_TOOLS.includes(t.name)).map((t) => ({
    name: t.name,
    description: `[Portal next.faltintravel.com] ${t.description}`,
    input_schema: t.inputSchema as Anthropic.Beta.Messages.BetaTool['input_schema'],
  }));
  return [
    {
      name: 'search_mail',
      description:
        'Durchsucht die Postfächer per Microsoft-Suche (KQL), alle Postfächer gleichzeitig. Beispiele: `Oktoberfest Hotel`, `from:max@firma.ch`, `subject:Rechnung`, `"RQ-12345"`, `hasattachments:true Ticket`, `received>=2026-10-01 Darts`. `received` ist das Eingangsdatum der Mail, NICHT das Datum eines Spiels oder Events. Liefert Betreff, Absender, Datum, Vorschau und id.',
      input_schema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'KQL-Suchausdruck' },
          mailbox: { type: 'string', description: 'Adresse eines Postfachs oder "alle" (Standard)' },
          top: { type: 'integer', description: 'max. Treffer je Postfach (Standard 10, max 25)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'read_mail',
      description: 'Liest eine Mail vollständig (Text, Empfänger, Anhänge-Namen). Mehrere Mails in EINER Antwort parallel anfordern.',
      input_schema: {
        type: 'object',
        properties: { mailbox: { type: 'string' }, id: { type: 'string' } },
        required: ['mailbox', 'id'],
      },
    },
    ...portal,
    {
      name: 'answer',
      description: 'Endgültige Antwort an die Person geben. Immer zum Schluss aufrufen.',
      input_schema: {
        type: 'object',
        properties: {
          antwort: { type: 'string', description: 'Antwort auf Deutsch (Markdown erlaubt, knapp, konkrete Fakten mit Datum/Absender).' },
          quellen: {
            type: 'array',
            description: 'Mails, auf die sich die Antwort stützt (aus den Suchergebnissen)',
            items: { type: 'object', properties: { mailbox: { type: 'string' }, id: { type: 'string' } }, required: ['mailbox', 'id'] },
          },
        },
        required: ['antwort', 'quellen'],
      },
    },
  ];
}

/** Modell der Mail-Suche: eigener Schalter (Tempo), sonst Sonnet 5.5. */
function mailSearchModel(): string {
  return (getSettings().ai.mail_search_model || '').trim() || 'claude-sonnet-5-5';
}

export async function aiSearch(
  question: string,
  mailboxes: string[],
  person: { name: string; employeeId: string | null; base: string },
  onStep: AiSearchProgress = () => undefined,
  signal?: AbortSignal,
): Promise<AiSearchResult> {
  const client = anthropicClient();
  const model = mailSearchModel();
  const tools = searchTools();
  const known = new Map<string, MailSummary>();
  const steps: string[] = [];
  const step = (s: string) => { steps.push(s); onStep(s); };
  const portalCtx: ToolContext = {
    actor: `Faltin Mail (${person.name})`,
    base: person.base,
    offerPdfUrl: (id) => `${person.base}/api/admin/calculations/${id}/pdf`,
    invoicePdfUrl: (id) => `${person.base}/api/invoices/${id}/pdf`,
    employeeId: person.employeeId,
  };
  const system = [
    `Du bist die Mail-Suche von Faltin Travel AG (Sportreisen, Schweiz). Heute ist ${today()}.`,
    `Du suchst im Auftrag von ${person.name} in diesen Postfächern: ${mailboxes.join(', ')}.`,
    'Zusätzlich kannst du im Portal lesen: Events mit Datum (list_events, get_event_info), Anfragen/Buchungen (list_bookings, search_booking_status) und Kunden (find_customers).',
    'Tempo zählt: Stelle in der ersten Runde 2–4 Suchen GLEICHZEITIG (Synonyme, Namen, Nummern wie RQ-…, Veranstalter wie Ticketmaster/On Location, dazu bei Fragen nach Zeiträumen list_events). Lies danach nur die 2–5 relevantesten Mails, ebenfalls gleichzeitig. Höchstens drei Runden, dann antworten.',
    'Fragen nach «kommenden Tagen» beziehen sich meist auf das Event- bzw. Spieldatum: Das steht im Mailtext oder in list_events, nicht im Eingangsdatum.',
    'Nenne konkrete Fakten (Daten, Beträge, Anzahl, Namen, Absender). Wenn nichts gefunden wird, sag das ehrlich und schlage eine bessere Suche vor.',
    'Rufe zum Schluss IMMER das Werkzeug answer auf. Erfinde nichts.',
  ].join('\n');
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: 'user', content: question }];

  step('KI plant die Suche …');
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (signal?.aborted) throw new Error('Suche abgebrochen.');
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      system,
      tools,
      tool_choice: { type: 'auto' },
      output_config: { effort: 'low' },
      messages,
    } as Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, { signal });
    messages.push({ role: 'assistant', content: res.content as Anthropic.Beta.Messages.BetaContentBlockParam[] });
    if (res.stop_reason === 'refusal') return { answer: 'Die KI hat diese Suche abgelehnt. Bitte anders formulieren.', sources: [], steps };
    const uses = res.content.filter((b): b is Anthropic.Beta.Messages.BetaToolUseBlock => b.type === 'tool_use');
    if (!uses.length) {
      const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('\n');
      return { answer: text || 'Keine Antwort erhalten.', sources: [], steps };
    }
    const fin = uses.find((u) => u.name === 'answer');
    if (fin) {
      const input = fin.input as Record<string, unknown>;
      const q = (input.quellen as Array<{ mailbox: string; id: string }> | undefined) || [];
      const sources = q.map((s) => known.get(`${String(s.mailbox).toLowerCase()}|${s.id}`)).filter((x): x is MailSummary => !!x);
      return { answer: String(input.antwort || ''), sources, steps };
    }

    // Alle Werkzeugaufrufe dieser Runde gleichzeitig ausführen, Ergebnisse in Aufruf-Reihenfolge zurückgeben.
    const results = await Promise.all(uses.map(async (u): Promise<Anthropic.Beta.Messages.BetaToolResultBlockParam> => {
      const input = u.input as Record<string, unknown>;
      try {
        if (u.name === 'search_mail') {
          const query = String(input.query || '').slice(0, 300);
          const mbArg = String(input.mailbox || 'alle').toLowerCase();
          const top = Math.min(Number(input.top) || 10, 25);
          const targets = mbArg && mbArg !== 'alle' && mailboxes.includes(mbArg) ? [mbArg] : mailboxes;
          step(`Suche «${query}»${targets.length === 1 ? ` in ${targets[0]}` : ` in ${targets.length} Postfächern`}`);
          const lists = await Promise.all(targets.map((mb) => searchMessages(mb, query, top).catch(() => [] as MailSummary[])));
          const hits = lists.flat().sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).slice(0, 30);
          hits.forEach((h) => known.set(`${h.mailbox}|${h.id}`, h));
          step(`→ ${hits.length} Treffer für «${query}»`);
          const lines = hits.map((h) =>
            `- mailbox=${h.mailbox} id=${h.id}\n  ${h.receivedAt.slice(0, 16).replace('T', ' ')} · von ${h.from.name || h.from.address} <${h.from.address}> · an ${h.to.map((t) => t.address).join(', ')}\n  Betreff: ${h.subject}\n  ${clip(h.preview, 220)}`);
          return { type: 'tool_result', tool_use_id: u.id, content: lines.length ? lines.join('\n') : 'Keine Treffer.' };
        }
        if (u.name === 'read_mail') {
          const mb = String(input.mailbox || '').toLowerCase();
          if (!mailboxes.includes(mb)) throw new Error('Kein Zugriff auf dieses Postfach.');
          const m = await getMessage(mb, String(input.id));
          known.set(`${mb}|${m.id}`, m);
          step(`Gelesen: ${m.subject || '(ohne Betreff)'}`);
          return {
            type: 'tool_result', tool_use_id: u.id,
            content: `Von: ${m.from.name} <${m.from.address}>\nAn: ${m.to.map((t) => t.address).join(', ')}${m.cc.length ? `\nCc: ${m.cc.map((t) => t.address).join(', ')}` : ''}\nDatum: ${m.receivedAt}\nBetreff: ${m.subject}\nAnhänge: ${m.attachments.map((a) => a.name).join(', ') || '–'}\n\n${clip(mailText(m), 12000)}`,
          };
        }
        if (PORTAL_READ_TOOLS.includes(u.name)) {
          step(PORTAL_STEP[u.name] || `Portal: ${u.name}`);
          const value = await callPortalTool(u.name, input, portalCtx);
          return { type: 'tool_result', tool_use_id: u.id, content: clip(JSON.stringify(value), 20000) };
        }
        throw new Error(`Unbekanntes Werkzeug ${u.name}`);
      } catch (e) {
        return { type: 'tool_result', tool_use_id: u.id, content: `Fehler: ${(e as Error).message}`, is_error: true };
      }
    }));
    // Vorletzte Runde: Hinweis, dass jetzt geantwortet werden muss (erzwungene Werkzeugwahl lehnen neuere Modelle ab).
    const content: Array<Anthropic.Beta.Messages.BetaToolResultBlockParam | Anthropic.Beta.Messages.BetaTextBlockParam> = [...results];
    if (round >= MAX_ROUNDS - 2) content.push({ type: 'text', text: 'Genug gesucht: Rufe jetzt answer mit dem bisherigen Stand auf.' });
    messages.push({ role: 'user', content });
    step('KI wertet aus …');
  }
  return { answer: 'Die Suche hat zu lange gedauert. Bitte die Frage genauer stellen.', sources: [...known.values()].slice(0, 5), steps };
}

const PORTAL_STEP: Record<string, string> = {
  list_events: 'Portal: Events mit Datum nachschlagen',
  get_event_info: 'Portal: Event-Details lesen',
  list_bookings: 'Portal: Anfragen/Buchungen durchsehen',
  search_booking_status: 'Portal: Anfrage nachschlagen',
  find_customers: 'Portal: Kunden suchen',
};

// ───────────────────────── Extraktion ─────────────────────────

export interface MailExtraction {
  typ: 'neue_anfrage' | 'anfrage_folge' | 'buchung_aenderung' | 'storno' | 'zahlung' | 'lieferant' | 'reklamation' | 'intern' | 'werbung' | 'sonstiges';
  zusammenfassung: string;
  dringlichkeit: 'hoch' | 'normal' | 'niedrig';
  stimmung: 'positiv' | 'neutral' | 'kritisch';
  kunde: { anrede: string; vorname: string; nachname: string; firma: string; email: string; telefon: string; adresse: string };
  reise: { event: string; ort: string; von: string; bis: string; personen: number; zimmer: string; budget: string; wuensche: string[] };
  aufgaben: Array<{ titel: string; beschreibung: string; faellig: string; prioritaet: 'hoch' | 'normal' | 'niedrig' }>;
  fakten: Array<{ label: string; wert: string }>;
  vorgeschlagene_antwort: string;
}

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    typ: { type: 'string', enum: ['neue_anfrage', 'anfrage_folge', 'buchung_aenderung', 'storno', 'zahlung', 'lieferant', 'reklamation', 'intern', 'werbung', 'sonstiges'] },
    zusammenfassung: { type: 'string' },
    dringlichkeit: { type: 'string', enum: ['hoch', 'normal', 'niedrig'] },
    stimmung: { type: 'string', enum: ['positiv', 'neutral', 'kritisch'] },
    kunde: {
      type: 'object', additionalProperties: false,
      properties: { anrede: { type: 'string' }, vorname: { type: 'string' }, nachname: { type: 'string' }, firma: { type: 'string' }, email: { type: 'string' }, telefon: { type: 'string' }, adresse: { type: 'string' } },
      required: ['anrede', 'vorname', 'nachname', 'firma', 'email', 'telefon', 'adresse'],
    },
    reise: {
      type: 'object', additionalProperties: false,
      properties: {
        event: { type: 'string' }, ort: { type: 'string' }, von: { type: 'string', description: 'YYYY-MM-DD oder leer' }, bis: { type: 'string', description: 'YYYY-MM-DD oder leer' },
        personen: { type: 'integer' }, zimmer: { type: 'string' }, budget: { type: 'string' }, wuensche: { type: 'array', items: { type: 'string' } },
      },
      required: ['event', 'ort', 'von', 'bis', 'personen', 'zimmer', 'budget', 'wuensche'],
    },
    aufgaben: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: { titel: { type: 'string' }, beschreibung: { type: 'string' }, faellig: { type: 'string', description: 'YYYY-MM-DD oder leer' }, prioritaet: { type: 'string', enum: ['hoch', 'normal', 'niedrig'] } },
        required: ['titel', 'beschreibung', 'faellig', 'prioritaet'],
      },
    },
    fakten: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { label: { type: 'string' }, wert: { type: 'string' } }, required: ['label', 'wert'] } },
    vorgeschlagene_antwort: { type: 'string', description: 'Kurzer Antwortentwurf im Faltin-Ton: mit Anrede, OHNE Grussformel und ohne Signatur (die setzt der Client). Leer, wenn keine Antwort nötig.' },
  },
  required: ['typ', 'zusammenfassung', 'dringlichkeit', 'stimmung', 'kunde', 'reise', 'aufgaben', 'fakten', 'vorgeschlagene_antwort'],
};

export async function extractMail(mailbox: string, id: string, thread: string, personName: string): Promise<MailExtraction> {
  const m = await getMessage(mailbox, id);
  return structuredCall<MailExtraction>({
    system: [
      `Du arbeitest für Faltin Travel AG (Sportreisen: Tickets, Hotel, Hospitality für Events wie Super Bowl, Oktoberfest, Ryder Cup, Darts-WM). Heute ist ${today()}.`,
      'Lies die Mail und ziehe strukturierte Informationen heraus, damit sie ohne Abtippen in CRM, Kundenstamm und Aufgaben übernommen werden können.',
      'Nur was wirklich in der Mail steht, nichts erfinden; unbekannte Felder leer lassen (Zahlen 0). Datumsangaben als YYYY-MM-DD.',
      'Aufgaben: nur echte nächste Schritte für Faltin (max. 4), knapp formuliert.',
      `Der Antwortentwurf ist für ${personName}, ohne Grussformel und ohne Signatur.`,
      FALTIN_TONE,
    ].join('\n'),
    user: `Postfach: ${mailbox}\nVon: ${m.from.name} <${m.from.address}>\nAn: ${m.to.map((t) => t.address).join(', ')}\nDatum: ${m.receivedAt}\nBetreff: ${m.subject}\n\n${clip(mailText(m), 14000)}${thread ? `\n\n--- Früherer Verlauf (Auszug) ---\n${clip(thread, 4000)}` : ''}`,
    schema: EXTRACT_SCHEMA,
    effort: 'low',
    maxTokens: 6000,
  });
}

// ───────────────────────── Schreib-Assistent ─────────────────────────

export interface ComposeInput {
  mode: AssistMode;
  /** Text der Person (Klartext, Absätze mit Leerzeile) */
  text: string;
  subject: string;
  /** Mail, auf die geantwortet wird (Klartext-Auszug) */
  replyTo?: string;
  recipientName?: string;
  senderName: string;
  mailbox: string;
}

export interface ComposeResult {
  text: string;
  subject: string;
  hinweise: string[];
}

const MODE_TASK: Record<AssistMode, string> = {
  korrektur:
    'Korrigiere NUR Rechtschreibung, Grammatik, Zeichensetzung und offensichtliche Tippfehler. Wortwahl, Satzbau, Tonalität, Inhalt und Länge bleiben unverändert. Schweizer Rechtschreibung (ss statt ß). Keine Grussformel ergänzen.',
  optimieren:
    'Formuliere aus den Stichworten oder dem Rohtext eine vollständige, professionelle Mail im Faltin-Ton. Alle Fakten, Zahlen, Daten und Zusagen exakt übernehmen, nichts hinzuerfinden (fehlende Angaben als [[…]] markieren). Mit passender Anrede, ohne Grussformel und ohne Signatur (die werden automatisch angehängt).',
  kuerzer:
    'Kürze die Mail deutlich (etwa auf die Hälfte), ohne Fakten, Zahlen oder Zusagen zu verlieren. Ton beibehalten. Keine Grussformel und keine Signatur.',
  freundlicher:
    'Formuliere die Mail wärmer, verbindlicher und kundenorientierter im Faltin-Ton, ohne Inhalt zu ändern. Keine Grussformel und keine Signatur.',
  englisch:
    'Übersetze die Mail in natürliches, professionelles Englisch (Business-Ton, wie Faltin mit internationalen Kund:innen schreibt). Fakten exakt übernehmen. Auch den Betreff übersetzen. Keine Grussformel und keine Signatur.',
};

export async function composeAssist(i: ComposeInput): Promise<ComposeResult> {
  return structuredCall<ComposeResult>({
    system: [
      'Du bist der Schreib-Assistent im Mail-Client von Faltin Travel AG.',
      MODE_TASK[i.mode],
      i.mode === 'korrektur' ? '' : FALTIN_TONE,
      'Gib den Text als Klartext zurück: Absätze durch eine Leerzeile getrennt, Aufzählungen mit "- ". Kein Markdown-Fett, keine Überschriften.',
      'hinweise: 0–3 kurze Hinweise an die schreibende Person (z. B. fehlende Angabe, widersprüchliches Datum). Leer, wenn alles passt.',
      'subject: den Betreff unverändert zurückgeben, ausser er fehlt (dann knapp vorschlagen) oder es wird übersetzt. Nummern wie [RQ-12345] immer behalten.',
    ].filter(Boolean).join('\n'),
    user: [
      `Absender: ${i.senderName} (Postfach ${i.mailbox})`,
      i.recipientName ? `Empfänger: ${i.recipientName}` : '',
      `Betreff: ${i.subject || '(leer)'}`,
      i.replyTo ? `\nUrsprüngliche Mail, auf die geantwortet wird (Auszug):\n${clip(i.replyTo, 5000)}\n` : '',
      `\nText:\n${i.text}`,
    ].filter(Boolean).join('\n'),
    schema: {
      type: 'object', additionalProperties: false,
      properties: { text: { type: 'string' }, subject: { type: 'string' }, hinweise: { type: 'array', items: { type: 'string' } } },
      required: ['text', 'subject', 'hinweise'],
    },
    effort: 'low',
    maxTokens: 8000,
  });
}
