/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * aiAssist.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * KI-Redaktions-Engine (Anthropic Messages API).
 * Konfiguration kommt aus den Admin-Settings (getSettings().ai) mit ENV-Fallback.
 * Unterstützt optionalen Screenshot (Bild) als Zusatzkontext.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { getSettings } from './settingsStore';

export function getAiConfig() {
  const a = getSettings().ai;
  return {
    apiKey: a.anthropic_api_key || process.env.ANTHROPIC_API_KEY || '',
    model: a.model || 'claude-sonnet-4-6',
  };
}

export function isAiConfigured(): boolean {
  return !!getAiConfig().apiKey;
}

export interface AiImage {
  /** base64 ohne data:-Präfix */
  data: string;
  /** z.B. image/png, image/jpeg */
  mediaType: string;
}

export interface AiCallResult {
  ok: boolean;
  text?: string;
  error?: string;
}

/** Roher Aufruf der Anthropic Messages API (optional multimodal). */
export async function anthropicMessage(opts: {
  system: string;
  userText: string;
  image?: AiImage | null;
  maxTokens?: number;
}): Promise<AiCallResult> {
  const { apiKey, model } = getAiConfig();
  if (!apiKey) return { ok: false, error: 'Kein Anthropic API-Key konfiguriert (Admin → KI).' };

  const content: any[] = [];
  if (opts.image?.data) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: opts.image.mediaType || 'image/png', data: opts.image.data },
    });
  }
  content.push({ type: 'text', text: opts.userText });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 2500,
        system: opts.system,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, error: `Anthropic ${res.status}: ${t.slice(0, 400)}` };
    }
    const j = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (j.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text || '')
      .join('\n')
      .trim();
    return { ok: true, text };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Extrahiert das erste JSON-Objekt aus einer Modell-Antwort (toleriert ```json Fences). */
export function parseJsonLoose(text: string): any | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1));
  } catch {
    return null;
  }
}

/* ─── Modul-Registry: welche Felder ein Modul hat + wie es befüllt wird ─────── */

export interface ModuleSpec {
  key: string;
  label: string;
  /** Beschreibung des Ziel-JSON-Schemas für das Modell */
  schema: string;
}

export const MODULE_SPECS: ModuleSpec[] = [
  { key: 'intro', label: 'Intro-Text', schema: '{ "intro_text": string (2-4 Sätze, einladend, sachlich-werblich) }' },
  { key: 'highlights', label: 'Highlights', schema: '{ "highlights": string[] (4-6 prägnante Stichpunkte, je < 12 Wörter) }' },
  { key: 'seo', label: 'SEO-Text', schema: '{ "seo_text": string (1 Absatz, keyword-reich, faktisch) }' },
  { key: 'leistungen', label: 'Unsere Leistungen', schema: '{ "leistungen_items": string[] (Leistungen/Inklusivleistungen als Stichpunkte) }' },
  { key: 'wissenswertes', label: 'Wissenswertes (Accordion)', schema: '{ "wissenswertes_accordion_text": string (mehrere Absätze mit \\n\\n getrennt; praktische Infos: Anreise, Hotel, Tipps) }' },
  { key: 'faq', label: 'FAQ', schema: '{ "faqs": [{ "question": string, "answer": string }] (4-6 sinnvolle FAQ) }' },
];

export function getModuleSpec(key: string): ModuleSpec | undefined {
  return MODULE_SPECS.find((m) => m.key === key);
}

/**
 * Importiert/erzeugt Inhalt für ein Modul aus Quelltext (+ optional Screenshot + Anweisung).
 * Gibt das geparste Ziel-JSON zurück.
 */
export async function generateModuleContent(opts: {
  moduleKey: string;
  eventName?: string;
  sourceText?: string;
  instruction?: string;
  currentContent?: string;
  image?: AiImage | null;
}): Promise<{ ok: boolean; data?: any; raw?: string; error?: string }> {
  const spec = getModuleSpec(opts.moduleKey);
  if (!spec) return { ok: false, error: `Unbekanntes Modul: ${opts.moduleKey}` };

  const system =
    'Du bist Redaktions-Assistent für Faltin Travel, einen Schweizer Sportreisen-Veranstalter. ' +
    'Du schreibst auf Deutsch (Sie-Form), markenkonform, sachlich-werblich, ohne Übertreibung und ohne erfundene Fakten/Preise. ' +
    'Wenn Quelldaten vorliegen, nutze ausschließlich diese; erfinde keine konkreten Zahlen, Daten oder Garantien. ' +
    'Antworte AUSSCHLIESSLICH mit gültigem JSON nach dem vorgegebenen Schema – kein Fließtext drumherum.';

  const parts: string[] = [];
  parts.push(`Aufgabe: Befülle das Modul "${spec.label}" für das Event "${opts.eventName || 'Sport-Event'}".`);
  parts.push(`Ziel-JSON-Schema:\n${spec.schema}`);
  if (opts.instruction) parts.push(`Zusätzliche Anweisung des Redakteurs:\n${opts.instruction}`);
  if (opts.currentContent) parts.push(`Aktueller Inhalt (zur Verbesserung/Berücksichtigung):\n${opts.currentContent}`);
  if (opts.sourceText) parts.push(`Quelltext der Webseite (Basis für den Inhalt):\n"""\n${opts.sourceText}\n"""`);
  if (opts.image) parts.push('Zusätzlich ist ein Screenshot der Quellseite als Bild beigefügt – nutze ihn für Kontext, Struktur und Tonalität.');
  parts.push('Gib jetzt das JSON aus.');

  const res = await anthropicMessage({
    system,
    userText: parts.join('\n\n'),
    image: opts.image,
    maxTokens: 3000,
  });
  if (!res.ok) return { ok: false, error: res.error };

  const data = parseJsonLoose(res.text || '');
  if (!data) return { ok: false, error: 'Antwort war kein gültiges JSON.', raw: res.text };
  return { ok: true, data, raw: res.text };
}
