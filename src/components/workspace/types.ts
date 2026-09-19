/** Gemeinsame Typen der Arbeitsplatz-Oberfläche (spiegeln die API-Antworten). */

export type AssistantPart =
  | { type: 'text'; text: string }
  | { type: 'tool'; id: string; name: string; label: string; write: boolean; ok: boolean | null; error?: string; links: Array<{ label: string; url: string }>; input_preview?: string }
  | { type: 'draft'; id: string; mail_id: string | null; request: string | null; body: string; note: string; done?: { action: 'sent' | 'outlook'; web_link: string } | null }
  | { type: 'notice'; text: string; tone: 'warn' | 'error'; retry?: boolean };

export type DisplayItem =
  | { kind: 'user'; id: string; text: string; files: Array<{ id: string; name: string }>; at: string }
  | { kind: 'assistant'; id: string; parts: AssistantPart[]; at: string };

export interface ConversationSummary { id: string; title: string; updated_at: string }

export interface CheckinItem { kind: 'kunde' | 'aufgabe' | 'mail' | 'angebot' | 'team' | 'idee'; title: string; question: string; prompt: string }
export interface Checkin { greeting: string; message: string; items: CheckinItem[]; generated_at: string; ai: boolean }

export interface DaySignals {
  today: string;
  me: { id: string; name: string; role: string } | null;
  my_tasks: Array<{ id: string; ticket_no: string; title: string; status: string; priority: string; due_date: string | null; overdue: boolean }>;
  unassigned_tasks: Array<{ id: string; ticket_no: string; title: string; created_at: string; priority: string }>;
  waiting_customers: Array<{ booking_id: string; request_number: string | null; package: string; customer: string; last_in_at: string; mine: boolean; assignee: string | null; days_waiting: number }>;
  unreachable: Array<{ booking_id: string; request_number: string | null; package: string; customer: string; kind: 'bounce' | 'abwesend'; days: number; mine: boolean }>;
  new_requests: Array<{ booking_id: string; request_number: string | null; package: string; customer: string; created_at: string; persons: number }>;
  stale_requests: Array<{ booking_id: string; request_number: string | null; package: string; customer: string; days_idle: number }>;
  offer_drafts: Array<{ id: string; offer_number: string | null; title: string; customer: string | null; updated_at: string }>;
  mail: { open: number; high: number; needs_reply: number };
  nudges: Array<{ id: string; kind: string; title: string; body: string; ref_id: string; action_url: string; prompt: string; priority: string }>;
}

export interface AgentSummary {
  enabled: boolean;
  last_run: { finished_at: string; errors: string[]; skipped?: string } | null;
  today: { runs: number; mails_triaged: number; drafts_prepared: number; nudges_created: number; notifications: number; reminder_mails: number };
}

export interface TriagedMail {
  graph_id: string; received_at: string; from_address: string; from_name: string; subject: string; preview: string;
  category: string; priority: 'hoch' | 'normal' | 'niedrig'; summary: string; next_step: string; needs_reply: number;
  request_number: string; booking_id: string | null; status: 'offen' | 'erledigt' | 'ignoriert'; handled_by: string;
  has_suggestion: boolean; draft_created_at: string | null; triaged_at: string | null; error: string;
}

export interface KnowledgeEntry {
  id: string; title: string; content: string; tags: string; source: string; pinned: number; uses: number;
  created_by: string; created_by_name: string; created_at: string; updated_at: string;
}

export interface ToolIdea { id: string; ticket_no: string; title: string; description: string; status: string; created_at: string; votes: number; voted: boolean }

export interface WorkspaceStatus {
  person: { name: string; role: string; is_admin: boolean; has_profile: boolean; key: string };
  ai: { configured: boolean; model: string };
  mail: { configured: boolean; mailbox: string | null };
  sharepoint: { configured: boolean; can_read: boolean; hint: string; roles?: string[] };
  agent: { enabled: boolean };
}

/** Anfrage an den Chat (aus anderen Bereichen ausgelöst). */
export interface ChatRequest { n: number; text: string; context?: string; newChat?: boolean }

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const j = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };
  if (!res.ok || j.success === false) throw new Error(j.error || `Fehler ${res.status}`);
  return j.data as T;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function relTime(iso: string): string {
  const t = Date.parse(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (!Number.isFinite(t)) return '';
  const min = Math.round((Date.now() - t) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d < 14) return `vor ${d} Tag${d === 1 ? '' : 'en'}`;
  return new Date(t).toLocaleDateString('de-CH');
}
