/**
 * workspace/display.ts — Gespeicherten Chatverlauf für die Oberfläche aufbereiten.
 * Aus Anthropic-Blöcken werden Anzeige-Elemente: Nutzertext mit Datei-Chips,
 * KI-Antworten mit Text, Werkzeug-Chips (inkl. Ergebnis-Links) und Entwurfskarten.
 * Kontextblöcke (<kontext>…) und Thinking bleiben unsichtbar.
 */
import type { StoredMessage, WsFile } from './store';
import { TOOL_LABELS, WRITE_TOOLS, linksFromResult } from './tools';
import { CONTEXT_PREFIX } from './agent';

export type AssistantPart =
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string; name: string; label: string; write: boolean; ok: boolean | null; error?: string; links: Array<{ label: string; url: string }> }
  | { type: 'draft'; id: string; mail_id: string | null; request: string | null; body: string; note: string };

export type DisplayItem =
  | { kind: 'user'; id: string; text: string; files: Array<{ id: string; name: string }>; at: string }
  | { kind: 'assistant'; id: string; parts: AssistantPart[]; at: string };

interface Block {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  is_error?: boolean;
  content?: unknown;
  source?: { type?: string; file_id?: string };
}

function resultValue(content: unknown): unknown {
  if (typeof content === 'string') {
    try { return JSON.parse(content); } catch { return null; }
  }
  return null;
}

export function toDisplay(messages: StoredMessage[], filesByAnthropicId: Map<string, WsFile>): DisplayItem[] {
  const out: DisplayItem[] = [];
  let current: Extract<DisplayItem, { kind: 'assistant' }> | null = null;
  const toolParts = new Map<string, Extract<AssistantPart, { type: 'tool' }>>();

  for (const m of messages) {
    let blocks: Block[] = [];
    try { blocks = JSON.parse(m.content) as Block[]; } catch { blocks = []; }
    if (!Array.isArray(blocks)) blocks = typeof blocks === 'string' ? [{ type: 'text', text: blocks }] : [];

    if (m.role === 'user') {
      const results = blocks.filter((b) => b.type === 'tool_result');
      if (results.length && results.length === blocks.length) {
        for (const r of results) {
          const part = toolParts.get(r.tool_use_id || '');
          if (!part) continue;
          part.ok = !r.is_error;
          if (r.is_error) part.error = typeof r.content === 'string' ? r.content.slice(0, 200) : 'Fehler';
          else part.links = linksFromResult(resultValue(r.content));
        }
        continue;
      }
      current = null;
      const text = blocks
        .filter((b) => b.type === 'text' && b.text && !b.text.startsWith(CONTEXT_PREFIX))
        .map((b) => b.text)
        .join('\n');
      const files = blocks
        .filter((b) => (b.type === 'document' || b.type === 'image') && b.source?.type === 'file')
        .map((b) => {
          const f = filesByAnthropicId.get(b.source?.file_id || '');
          return { id: f?.id || '', name: f?.filename || 'Datei' };
        });
      out.push({ kind: 'user', id: m.id, text, files, at: m.created_at });
      continue;
    }

    if (m.role !== 'assistant') continue;
    if (!current) {
      current = { kind: 'assistant', id: m.id, parts: [], at: m.created_at };
      out.push(current);
    }
    for (const b of blocks) {
      if (b.type === 'text' && b.text) {
        current.parts.push({ type: 'text', text: b.text });
      } else if (b.type === 'tool_use' && b.id && b.name) {
        if (b.name === 'prepare_reply_draft') {
          current.parts.push({
            type: 'draft', id: b.id,
            mail_id: typeof b.input?.mail_id === 'string' ? b.input.mail_id : null,
            request: typeof b.input?.request === 'string' ? b.input.request : null,
            body: String(b.input?.body || ''),
            note: typeof b.input?.note === 'string' ? b.input.note : '',
          });
        }
        const part: Extract<AssistantPart, { type: 'tool' }> = {
          type: 'tool', id: b.id, name: b.name, label: TOOL_LABELS[b.name] || b.name,
          write: WRITE_TOOLS.has(b.name), ok: null, links: [],
        };
        toolParts.set(b.id, part);
        current.parts.push(part);
      }
    }
  }
  return out;
}
