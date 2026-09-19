/**
 * workspace/claude.ts — Anthropic-Client für den KI-Arbeitsplatz.
 * API-Key kommt wie bei der KI-Redaktion aus settings.ai (ENV-Fallback);
 * das Modell separat aus settings.ai.workspace_model (Standard: claude-opus-5).
 */
import Anthropic from '@anthropic-ai/sdk';
import { getSettings } from '../settingsStore';

/** Server-seitiger Fallback bei Richtlinien-Ablehnungen (Claude API, "default"-Routing). */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export function workspaceAiConfig() {
  const a = getSettings().ai;
  return {
    apiKey: a.anthropic_api_key || process.env.ANTHROPIC_API_KEY || '',
    model: (a.workspace_model || '').trim() || 'claude-opus-5',
  };
}

export function isWorkspaceAiConfigured(): boolean {
  return !!workspaceAiConfig().apiKey;
}

let cached: { key: string; client: Anthropic } | null = null;

/** Client pro API-Key cachen (Key-Wechsel im Admin greift ohne Neustart). */
export function anthropicClient(): Anthropic {
  const { apiKey } = workspaceAiConfig();
  if (!apiKey) throw new Error('Kein Anthropic API-Key konfiguriert (Admin → KI-Redaktion).');
  if (!cached || cached.key !== apiKey) {
    cached = { key: apiKey, client: new Anthropic({ apiKey, maxRetries: 5, timeout: 10 * 60 * 1000 }) };
  }
  return cached.client;
}

/**
 * Überlastung — auch wenn sie mitten im Stream als error-Event kommt (dann ohne HTTP-Status,
 * nur mit type „overloaded_error“; solche Fehler wiederholt das SDK nicht selbst).
 */
export function isOverloadedAiError(e: unknown): boolean {
  if (e instanceof Anthropic.APIError && e.status === 529) return true;
  const inner = (e as { error?: { error?: { type?: string }; type?: string } })?.error;
  return inner?.error?.type === 'overloaded_error' || inner?.type === 'overloaded_error'
    || /overloaded_error/.test(String((e as Error)?.message || ''));
}

/** Vorübergehende Fehler (Überlastung, Rate-Limit, Serverfehler): lohnt „Nochmal versuchen“. */
export function isRetryableAiError(e: unknown): boolean {
  if (isOverloadedAiError(e)) return true;
  if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError) return true;
  if (e instanceof Anthropic.APIConnectionError) return true;
  return e instanceof Anthropic.APIError && (e.status === 503 || e.status === 502);
}

/** Verständliche deutsche Fehlermeldung aus einem SDK-Fehler. */
export function describeAiError(e: unknown): string {
  if (isOverloadedAiError(e)) {
    return 'Die KI ist gerade überlastet (Anthropic). Bitte gleich nochmal versuchen – deine Nachricht ist gespeichert.';
  }
  if (e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError) {
    return 'Die KI ist gerade nicht erreichbar. Bitte gleich nochmal versuchen – deine Nachricht ist gespeichert.';
  }
  if (e instanceof Anthropic.AuthenticationError) return 'Der Anthropic API-Key ist ungültig (Admin → KI-Redaktion).';
  if (e instanceof Anthropic.RateLimitError) return 'Die KI ist gerade ausgelastet (Rate-Limit). Bitte gleich nochmal versuchen.';
  if (e instanceof Anthropic.BadRequestError) return `Anfrage an die KI abgelehnt: ${e.message.slice(0, 300)}`;
  if (e instanceof Anthropic.APIError) return `KI-Fehler ${e.status ?? ''}: ${e.message.slice(0, 300)}`;
  return (e as Error)?.message || 'Unbekannter Fehler bei der KI.';
}

/**
 * Einmaliger strukturierter Aufruf (JSON nach Schema) — für Mail-Sortierung,
 * Check-in und Antwortvorschläge. Kein Tool-Loop.
 */
export async function structuredCall<T>(opts: {
  system: string;
  user: Anthropic.Beta.Messages.BetaContentBlockParam[] | string;
  schema: Record<string, unknown>;
  effort?: 'low' | 'medium' | 'high';
  maxTokens?: number;
}): Promise<T> {
  const client = anthropicClient();
  const { model } = workspaceAiConfig();
  const stream = client.beta.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 16000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    system: opts.system,
    output_config: {
      effort: opts.effort ?? 'low',
      format: { type: 'json_schema', schema: opts.schema },
    },
    messages: [{ role: 'user', content: opts.user }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('Die KI hat diese Anfrage abgelehnt.');
  if (msg.stop_reason === 'max_tokens') throw new Error('Antwort der KI war zu lang und wurde abgeschnitten.');
  const text = msg.content
    .filter((b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
  return JSON.parse(text) as T;
}
