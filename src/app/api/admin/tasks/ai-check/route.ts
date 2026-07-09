import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { anthropicMessage, parseJsonLoose, isAiConfigured } from '@/lib/aiAssist';

export interface AiTaskCheck {
  /** Kann die Aufgabe grundsätzlich von einer KI (Dev-Agent) übernommen werden? */
  ai_doable: boolean;
  /** 0–100: Zuversicht der Einschätzung. */
  confidence: number;
  /** Ist die Beschreibung eindeutig genug, um loszulegen? */
  clear: boolean;
  /** Rückfragen bei Unklarheiten (leer, wenn alles klar). */
  questions: string[];
  improved_title: string;
  /** Optimierte Beschreibung — bei Portal-Themen als klare User-Story. */
  improved_description: string;
  category: 'portal_entwicklung' | 'kommunikation' | 'administration' | 'sonstiges';
}

const SYSTEM_PROMPT = [
  'Du bist der KI-Assistent des Faltin-Travel-Adminportals (Sportreisen-Buchungsplattform: CRM, Aufgaben, Rechnungen, Events, Mail).',
  'Du prüfst neue Aufgaben VOR dem Anlegen. Deine Einschätzung entscheidet, ob die Aufgabe einem KI-Dev-Agenten angeboten wird.',
  'KI-geeignet (ai_doable=true) sind vor allem: Weiterentwicklungen und Bugfixes des Portals, Textentwürfe, Auswertungen, Recherchen.',
  'NICHT KI-geeignet: physische Tätigkeiten (Hardware, Post, Termine vor Ort), Entscheidungen der Geschäftsleitung, Aufgaben die persönliche Gespräche erfordern.',
  'Bewerte die Beschreibung: Ist sie eindeutig genug, um ohne Rückfragen loszulegen (clear)? Wenn nicht: formuliere konkrete, kurze Rückfragen (questions).',
  'Formuliere improved_title (prägnant, max. 80 Zeichen) und improved_description: bei Portal-Entwicklung/Bugfix als klare User-Story',
  '("Als <Rolle> möchte ich <Ziel>, damit <Nutzen>." plus Akzeptanzkriterien als Liste), sonst als präzise strukturierte Beschreibung.',
  'Erfinde keine Anforderungen — offene Punkte gehören in questions, nicht in die Beschreibung.',
  'Antworte AUSSCHLIESSLICH mit einem JSON-Objekt:',
  '{ "ai_doable": boolean, "confidence": 0-100, "clear": boolean, "questions": string[], "improved_title": string, "improved_description": string, "category": "portal_entwicklung"|"kommunikation"|"administration"|"sonstiges" }',
].join(' ');

/** POST { title, description? } → KI-Einschätzung + optimierte Beschreibung (TASK-00098). */
export async function POST(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  if (!isAiConfigured()) {
    return NextResponse.json({ success: false, error: 'KI nicht konfiguriert (Admin → KI-Redaktion).' }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  if (!title) return NextResponse.json({ success: false, error: 'title erforderlich' }, { status: 400 });

  const res = await anthropicMessage({
    system: SYSTEM_PROMPT,
    userText: `Titel: ${title}\n\nBeschreibung:\n${description || '(keine Beschreibung angegeben)'}`,
    maxTokens: 1500,
  });
  if (!res.ok || !res.text) {
    return NextResponse.json({ success: false, error: res.error || 'KI-Antwort leer.' }, { status: 502 });
  }

  const parsed = parseJsonLoose(res.text) as Partial<AiTaskCheck> | null;
  if (!parsed || typeof parsed.ai_doable !== 'boolean') {
    return NextResponse.json({ success: false, error: 'KI-Antwort nicht auswertbar.' }, { status: 502 });
  }

  const data: AiTaskCheck = {
    ai_doable: !!parsed.ai_doable,
    confidence: Math.min(100, Math.max(0, Math.round(Number(parsed.confidence ?? 0)) || 0)),
    clear: !!parsed.clear,
    questions: Array.isArray(parsed.questions) ? parsed.questions.map(String).slice(0, 6) : [],
    improved_title: String(parsed.improved_title || title).slice(0, 200),
    improved_description: String(parsed.improved_description || description),
    category: (['portal_entwicklung', 'kommunikation', 'administration', 'sonstiges'] as const)
      .find((c) => c === parsed.category) || 'sonstiges',
  };
  return NextResponse.json({ success: true, data });
}
