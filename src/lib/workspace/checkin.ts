/**
 * workspace/checkin.ts — Der proaktive Check-in der Faltin-KI.
 * Aus „Mein Tag“ formuliert die KI eine kurze Begrüssung mit 2–4 Nachfragen
 * („Hast du an … gedacht?“), jede mit einem Vorschlag, den man per Klick in den
 * Chat übernimmt. Pro Person 3 h zwischengespeichert; ohne KI gibt es eine
 * regelbasierte Fassung.
 */
import type { Employee } from '../staffStore';
import { collectSignals, signalsToText, type DaySignals } from './signals';
import { structuredCall, isWorkspaceAiConfigured } from './claude';

export interface CheckinItem {
  kind: 'kunde' | 'aufgabe' | 'mail' | 'angebot' | 'team' | 'idee';
  title: string;
  question: string;
  prompt: string;
}

export interface Checkin {
  greeting: string;
  message: string;
  items: CheckinItem[];
  generated_at: string;
  ai: boolean;
}

const TTL_MS = 3 * 3600 * 1000;
const cache = new Map<string, { at: number; data: Checkin }>();

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['greeting', 'message', 'items'],
  properties: {
    greeting: { type: 'string' },
    message: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'title', 'question', 'prompt'],
        properties: {
          kind: { type: 'string', enum: ['kunde', 'aufgabe', 'mail', 'angebot', 'team', 'idee'] },
          title: { type: 'string' },
          question: { type: 'string' },
          prompt: { type: 'string' },
        },
      },
    },
  },
};

function greetingFor(name: string): string {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).find((p) => p.type === 'hour')?.value ?? 12);
  const first = name.split(' ')[0] || name;
  if (hour < 11) return `Guten Morgen, ${first}!`;
  if (hour < 17) return `Hallo ${first}!`;
  return `Guten Abend, ${first}!`;
}

/** Regelbasierter Check-in (ohne KI oder wenn die KI nicht erreichbar ist). */
function ruleCheckin(name: string, s: DaySignals): Checkin {
  const items: CheckinItem[] = [];
  const w = s.waiting_customers[0];
  if (w) items.push({ kind: 'kunde', title: `${w.request_number || 'Anfrage'} wartet`, question: `${w.customer} wartet seit ${w.days_waiting} Tag(en) auf eine Antwort — hast du das gesehen?`, prompt: `Hilf mir, ${w.request_number || w.booking_id} zu beantworten: Lies den Verlauf und entwirf eine Antwort.` });
  const t = s.my_tasks.find((x) => x.overdue) || s.my_tasks[0];
  if (t) items.push({ kind: 'aufgabe', title: t.ticket_no, question: `${t.title}${t.overdue ? ' ist überfällig' : ' steht noch offen'} — sollen wir sie angehen?`, prompt: `Lass uns ${t.ticket_no} „${t.title}“ angehen. Was ist der nächste Schritt?` });
  const n = s.new_requests[0];
  if (n) items.push({ kind: 'kunde', title: 'Neue Anfrage', question: `${n.customer} fragt ${n.package} an (${n.persons} Pers.) — übernimmst du?`, prompt: `Schau dir ${n.request_number || n.booking_id} an. Soll ich eine Kalkulation und einen Angebotsentwurf vorbereiten?` });
  if (s.mail.needs_reply) items.push({ kind: 'mail', title: 'Posteingang', question: `${s.mail.needs_reply} Mail(s) im Postfach brauchen eine Antwort.`, prompt: 'Welche Mails im Posteingang brauchen heute eine Antwort? Fang mit der dringendsten an.' });
  if (items.length < 2) items.push({ kind: 'idee', title: 'Werkstatt', question: 'Gibt es etwas, das du immer wieder von Hand machst? Daraus bauen wir gern ein Werkzeug.', prompt: 'Ich habe eine Idee für ein Werkzeug, das mir Arbeit abnimmt:' });
  return {
    greeting: greetingFor(name),
    message: items.length ? 'Ich habe kurz über deinen Tag geschaut:' : 'Bei dir ist gerade alles ruhig.',
    items: items.slice(0, 4),
    generated_at: new Date().toISOString(),
    ai: false,
  };
}

export async function getCheckin(input: { ownerKey: string; employee: Employee | null; personName: string; refresh?: boolean }): Promise<Checkin> {
  const hit = cache.get(input.ownerKey);
  if (hit && !input.refresh && Date.now() - hit.at < TTL_MS) return hit.data;

  const signals = await collectSignals(input.employee);
  let data: Checkin;
  if (!isWorkspaceAiConfigured()) {
    data = ruleCheckin(input.personName, signals);
  } else {
    try {
      const out = await structuredCall<Omit<Checkin, 'generated_at' | 'ai'>>({
        system: [
          `Du bist die persönliche Faltin-KI von ${input.personName} (Faltin Travel AG, Sportreisen, Schweiz).`,
          'Schreibe einen kurzen, freundlichen Check-in für den Arbeitsplatz: greeting (Begrüssung mit Vornamen, passend zur Tageszeit),',
          'message (1–2 Sätze Lagebild, konkret mit Zahlen), items (2–4 Nachfragen, wichtigste zuerst).',
          'Jede Nachfrage: title (2–5 Wörter, z.B. RQ-Nummer oder Ticket), question (eine Frage im Stil „Hast du an … gedacht?“ / „Soll ich …?“, konkret mit Namen/Nummern),',
          'prompt (was die Person der KI im Chat sagen würde, um genau das anzugehen – in Ich-Form, z.B. „Lies den Verlauf von RQ-10042 und entwirf eine Antwort“).',
          'Priorität: Kunden, die warten > überfällige Aufgaben > neue Anfragen ohne Zuständigkeit > dringende Mails > Angebotsentwürfe.',
          'Wenn wenig los ist, darf ein Punkt (kind "idee") dazu ermutigen, eine Werkzeug-Idee fürs Portal einzubringen.',
          'Deutsch, Schweizer Schreibweise (ss), du-Form, keine Emojis. Nichts erfinden, nur was in den Daten steht.',
        ].join(' '),
        user: `Daten von heute:\n${signalsToText(signals)}`,
        schema: SCHEMA,
        effort: 'low',
        maxTokens: 4000,
      });
      data = { ...out, items: out.items.slice(0, 4), generated_at: new Date().toISOString(), ai: true };
    } catch (e) {
      console.warn('[workspace] Check-in per KI fehlgeschlagen, nutze Regel-Fassung:', (e as Error).message);
      data = ruleCheckin(input.personName, signals);
    }
  }
  cache.set(input.ownerKey, { at: Date.now(), data });
  return data;
}
