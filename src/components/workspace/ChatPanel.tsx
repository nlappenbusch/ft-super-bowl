'use client';

/**
 * ChatPanel.tsx — Chat mit der persönlichen Faltin-KI.
 * Streamt Antworten (NDJSON) inkl. Werkzeug-Chips und Entwurfskarten, nimmt Dateien
 * per Klick oder Drag & Drop an und zeigt bei leerem Chat den proaktiven Check-in.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sparkles, Send, Paperclip, X, Plus, History, Square, Loader2, Check, AlertTriangle, PencilLine,
  FileText, Trash2, RefreshCw, ChevronRight, Wrench, ExternalLink,
} from 'lucide-react';
import { COLORS, Spinner } from '@/components/admin/ui';
import Markdown from './Markdown';
import DraftCard from './DraftCard';
import {
  api, jsonInit, relTime,
  type AssistantPart, type DisplayItem, type ConversationSummary, type Checkin, type ChatRequest,
} from './types';

interface PendingFile { key: string; name: string; id?: string; error?: string; uploading: boolean }

const QUICK_PROMPTS = [
  { label: 'Was steht heute an?', text: 'Was steht heute bei mir an? Was sollte ich zuerst angehen?' },
  { label: 'Posteingang durchgehen', text: 'Geh mit mir den Posteingang durch: Was ist dringend und wo sollten wir antworten?' },
  { label: 'Angebot bauen', text: 'Ich möchte für einen Kunden eine Kalkulation und daraus einen Angebotsentwurf bauen.' },
  { label: 'In SharePoint suchen', text: 'Such in SharePoint nach ' },
  { label: 'Werkzeug-Idee', text: 'Ich habe eine Idee für ein Werkzeug, das mir Arbeit abnimmt: ' },
];

function newId(): string {
  return Math.random().toString(36).slice(2);
}

export default function ChatPanel({ personName, request, prefill, onActivity, aiReady }: {
  personName: string;
  request: ChatRequest | null;
  /** Text nur ins Eingabefeld übernehmen (z.B. aus der Schnellsuche), nicht senden. */
  prefill?: { n: number; text: string } | null;
  onActivity?: () => void;
  aiReady: boolean;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [checkin, setCheckin] = useState<Checkin | null>(null);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastRequestN = useRef(0);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const loadConversations = useCallback(async () => {
    try { setConversations(await api<ConversationSummary[]>('/api/admin/workspace/conversations')); } catch { /* ignore */ }
  }, []);

  const loadCheckin = useCallback(async (refresh = false) => {
    setCheckinLoading(true);
    try { setCheckin(await api<Checkin>(`/api/admin/workspace/checkin${refresh ? '?refresh=1' : ''}`)); } catch { /* ignore */ }
    finally { setCheckinLoading(false); }
  }, []);

  useEffect(() => { loadConversations(); loadCheckin(); }, [loadConversations, loadCheckin]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, streaming]);

  const openConversation = async (id: string) => {
    if (streaming) return;
    setShowHistory(false);
    setLoadingConv(true);
    try {
      const d = await api<{ id: string; title: string; items: DisplayItem[] }>(`/api/admin/workspace/conversations/${id}`);
      setActiveId(d.id);
      setItems(d.items);
    } catch { /* ignore */ }
    finally { setLoadingConv(false); }
  };

  const newChat = () => {
    if (streaming) return;
    setActiveId(null);
    setItems([]);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const deleteConversation = async (id: string) => {
    if (!window.confirm('Diesen Chat inkl. Dateien löschen?')) return;
    try { await api(`/api/admin/workspace/conversations/${id}`, { method: 'DELETE' }); } catch { /* ignore */ }
    if (activeIdRef.current === id) newChat();
    loadConversations();
  };

  /* ── Dateien ── */
  const uploadFiles = async (list: FileList | File[]) => {
    for (const file of Array.from(list).slice(0, 8)) {
      const key = newId();
      setFiles((f) => [...f, { key, name: file.name, uploading: true }]);
      const fd = new FormData();
      fd.append('file', file);
      try {
        const d = await api<{ id: string; filename: string }>('/api/admin/workspace/files', { method: 'POST', body: fd });
        setFiles((f) => f.map((x) => (x.key === key ? { ...x, id: d.id, uploading: false } : x)));
      } catch (e) {
        setFiles((f) => f.map((x) => (x.key === key ? { ...x, uploading: false, error: (e as Error).message } : x)));
      }
    }
  };

  /* ── Senden + Stream verarbeiten ── */
  const patchLastAssistant = (fn: (parts: AssistantPart[]) => AssistantPart[]) => {
    setItems((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.kind === 'assistant') next[next.length - 1] = { ...last, parts: fn(last.parts) };
      return next;
    });
  };

  const send = useCallback(async (textArg?: string, opts: { context?: string; forceNew?: boolean } = {}) => {
    const text = (textArg ?? input).trim();
    const readyFiles = files.filter((f) => f.id && !f.error);
    if (streaming || (!text && !readyFiles.length) || files.some((f) => f.uploading)) return;
    const convId = opts.forceNew ? null : activeIdRef.current;
    if (opts.forceNew) { setActiveId(null); setItems([]); }

    const now = new Date().toISOString();
    setItems((prev) => [
      ...(opts.forceNew ? [] : prev),
      { kind: 'user', id: newId(), text, files: readyFiles.map((f) => ({ id: f.id!, name: f.name })), at: now },
      { kind: 'assistant', id: newId(), parts: [], at: now },
    ]);
    if (textArg === undefined) setInput('');
    setFiles([]);
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/admin/workspace/chat', {
        ...jsonInit('POST', { text, conversation_id: convId, file_ids: readyFiles.map((f) => f.id), page_context: opts.context }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error || `Fehler ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: Record<string, unknown>;
          try { ev = JSON.parse(line); } catch { continue; }
          switch (ev.t) {
            case 'meta':
              setActiveId(String(ev.conversation_id));
              if (ev.created) loadConversations();
              break;
            case 'text':
              patchLastAssistant((parts) => {
                const last = parts[parts.length - 1];
                if (last?.type === 'text') return [...parts.slice(0, -1), { ...last, text: last.text + String(ev.d) }];
                return [...parts, { type: 'text', text: String(ev.d) }];
              });
              break;
            case 'tool':
              if (ev.phase === 'start') {
                patchLastAssistant((parts) => [...parts, {
                  type: 'tool', id: String(ev.id), name: String(ev.name), label: String(ev.label),
                  write: !!ev.write, ok: null, links: [], input_preview: String(ev.input_preview || ''),
                }]);
              } else {
                patchLastAssistant((parts) => parts.map((p) => (p.type === 'tool' && p.id === ev.id
                  ? { ...p, ok: !!ev.ok, error: ev.error ? String(ev.error) : undefined, links: (ev.links as Array<{ label: string; url: string }>) || [] }
                  : p)));
              }
              break;
            case 'draft':
              patchLastAssistant((parts) => {
                const idx = parts.findIndex((p) => p.type === 'tool' && p.id === ev.id);
                const draft: AssistantPart = { type: 'draft', id: String(ev.id), mail_id: (ev.mail_id as string) || null, request: (ev.request as string) || null, body: String(ev.body || ''), note: String(ev.note || '') };
                if (idx < 0) return [...parts, draft];
                return [...parts.slice(0, idx + 1), draft, ...parts.slice(idx + 1)];
              });
              break;
            case 'notice':
              patchLastAssistant((parts) => [...parts, { type: 'notice', text: String(ev.message), tone: 'warn' }]);
              break;
            case 'error':
              patchLastAssistant((parts) => [...parts, { type: 'notice', text: String(ev.message), tone: 'error' }]);
              break;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        patchLastAssistant((parts) => [...parts, { type: 'notice', text: (e as Error).message, tone: 'error' }]);
      } else {
        patchLastAssistant((parts) => [...parts, { type: 'notice', text: 'Abgebrochen.', tone: 'warn' }]);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      loadConversations();
      onActivity?.();
    }
  }, [input, files, streaming, loadConversations, onActivity]);

  // Anfragen aus anderen Bereichen (Heute, Posteingang, Werkstatt, ?q=)
  useEffect(() => {
    if (!request || request.n === lastRequestN.current) return;
    lastRequestN.current = request.n;
    send(request.text, { context: request.context, forceNew: request.newChat });
  }, [request, send]);

  useEffect(() => {
    if (!prefill) return;
    setActiveId(null);
    setItems([]);
    setInput(prefill.text);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [prefill]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  const activeTitle = conversations.find((c) => c.id === activeId)?.title;
  const empty = items.length === 0;

  return (
    <section
      className="relative flex h-full min-h-0 flex-col bg-white"
      aria-label="Chat mit der Faltin-KI"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files); }}
    >
      {/* Kopf */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: COLORS.stroke }}>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: COLORS.accent }}>
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold" style={{ color: COLORS.navy }}>{activeTitle || 'Faltin-KI'}</div>
          <div className="text-[11px]" style={{ color: COLORS.textMuted }}>{activeId ? 'Chat' : 'Neuer Chat'} · deine persönliche Assistentin</div>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setShowHistory((s) => !s)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-gray-100" style={{ color: COLORS.navy }} aria-expanded={showHistory}>
            <History className="h-4 w-4" /> <span className="hidden sm:inline">Verlauf</span>
          </button>
          <button onClick={newChat} disabled={streaming} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-gray-100 disabled:opacity-50" style={{ color: COLORS.accent }}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Neuer Chat</span>
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="absolute inset-x-3 top-14 z-20 max-h-[60%] overflow-y-auto rounded-xl border bg-white shadow-xl" style={{ borderColor: COLORS.stroke }}>
          {conversations.length === 0 && <p className="px-4 py-6 text-center text-xs" style={{ color: COLORS.textMuted }}>Noch keine Chats.</p>}
          {conversations.map((c) => (
            <div key={c.id} className="group flex items-center gap-2 border-b px-3 py-2 hover:bg-gray-50" style={{ borderColor: COLORS.stroke, background: c.id === activeId ? 'rgba(217,83,30,0.06)' : undefined }}>
              <button onClick={() => openConversation(c.id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium" style={{ color: COLORS.navy }}>{c.title}</div>
                <div className="text-[11px]" style={{ color: COLORS.textMuted }}>{relTime(c.updated_at)}</div>
              </button>
              <button onClick={() => deleteConversation(c.id)} className="rounded p-1 opacity-0 transition group-hover:opacity-100 hover:bg-gray-100 focus:opacity-100" aria-label="Chat löschen">
                <Trash2 className="h-3.5 w-3.5" style={{ color: COLORS.textMuted }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Verlauf */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {loadingConv && <div className="flex justify-center py-10"><Spinner className="h-5 w-5" /></div>}

        {empty && !loadingConv && (
          <div className="mx-auto max-w-2xl">
            <div className="rounded-2xl border p-4" style={{ borderColor: COLORS.stroke, background: COLORS.surfaceMuted }}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white" style={{ background: COLORS.accent }}>
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  {checkinLoading && !checkin && <p className="text-sm" style={{ color: COLORS.textMuted }}>Ich schaue kurz über deinen Tag …</p>}
                  {checkin && (
                    <>
                      <p className="text-[15px] font-bold" style={{ color: COLORS.navy }}>{checkin.greeting}</p>
                      <p className="mt-1 text-sm" style={{ color: COLORS.text }}>{checkin.message}</p>
                      <div className="mt-3 space-y-2">
                        {checkin.items.map((it, i) => (
                          <button key={i} onClick={() => send(it.prompt, { context: `Check-in: ${it.title}` })} disabled={streaming || !aiReady}
                            className="group flex w-full items-start gap-2 rounded-xl border bg-white px-3 py-2.5 text-left transition hover:shadow-sm disabled:opacity-60"
                            style={{ borderColor: COLORS.stroke }}>
                            <span className="mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: 'rgba(20,48,71,0.07)', color: COLORS.navy }}>{it.title}</span>
                            <span className="flex-1 text-sm" style={{ color: COLORS.text }}>{it.question}</span>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" style={{ color: COLORS.accent }} />
                          </button>
                        ))}
                      </div>
                      <button onClick={() => loadCheckin(true)} disabled={checkinLoading} className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: COLORS.textMuted }}>
                        <RefreshCw className={`h-3 w-3 ${checkinLoading ? 'animate-spin' : ''}`} /> Neu einschätzen
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
            {!aiReady && (
              <p className="mt-3 rounded-xl border px-3 py-2 text-xs" style={{ borderColor: COLORS.stroke, color: COLORS.warn }}>
                Die KI ist noch nicht verbunden: Im Admin unter „KI-Redaktion“ einen Anthropic API-Key hinterlegen.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((q) => (
                <button key={q.label} onClick={() => { setInput(q.text); inputRef.current?.focus(); }}
                  className="rounded-full border bg-white px-3 py-1.5 text-xs font-medium transition hover:border-current"
                  style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-4">
          {items.map((it, idx) => (it.kind === 'user' ? (
            <div key={it.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm text-white" style={{ background: COLORS.navy }}>
                {it.files.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {it.files.map((f, i) => (
                      <a key={i} href={f.id ? `/api/admin/workspace/files/${f.id}` : undefined} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2 py-0.5 text-xs hover:bg-white/25">
                        <FileText className="h-3 w-3" /> {f.name}
                      </a>
                    ))}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{it.text}</div>
              </div>
            </div>
          ) : (
            <div key={it.id} className="flex gap-2.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white" style={{ background: COLORS.accent }}>
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1" style={{ color: COLORS.text }}>
                {it.parts.length === 0 && streaming && idx === items.length - 1 && (
                  <span className="inline-flex items-center gap-2 text-sm" style={{ color: COLORS.textMuted }}>
                    <Loader2 className="h-4 w-4 animate-spin" /> denkt nach …
                  </span>
                )}
                {it.parts.map((p, pi) => {
                  if (p.type === 'text') return <Markdown key={pi} text={p.text} />;
                  if (p.type === 'draft') return <DraftCard key={`${p.id}-d`} mailId={p.mail_id} request={p.request} body={p.body} note={p.note} personName={personName} draftId={p.id} conversationId={activeId} initialDone={p.done} />;
                  if (p.type === 'notice') {
                    return (
                      <div key={pi} className="my-1.5 flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs"
                        style={{ background: p.tone === 'error' ? 'rgba(220,38,38,0.07)' : 'rgba(217,119,6,0.08)', color: p.tone === 'error' ? COLORS.danger : COLORS.warn }}>
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {p.text}
                      </div>
                    );
                  }
                  if (p.name === 'prepare_reply_draft') return null;
                  return (
                    <div key={pi} className="my-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                        style={{ borderColor: p.write ? 'rgba(217,83,30,0.35)' : COLORS.stroke, background: p.write ? 'rgba(217,83,30,0.05)' : COLORS.surfaceMuted, color: COLORS.navy }}>
                        {p.ok === null ? <Loader2 className="h-3 w-3 animate-spin" /> : p.ok ? (p.write ? <PencilLine className="h-3 w-3" style={{ color: COLORS.accent }} /> : <Check className="h-3 w-3" style={{ color: COLORS.ok }} />) : <AlertTriangle className="h-3 w-3" style={{ color: COLORS.danger }} />}
                        {p.label}{p.input_preview ? `: ${p.input_preview}` : ''}
                      </span>
                      {p.links.map((l, li) => (
                        <a key={li} href={l.url} target={l.url.startsWith('/') || l.url.includes(window.location.host) ? undefined : '_blank'} rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium hover:underline" style={{ color: COLORS.accent }}>
                          {l.label} <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                      {p.error && <span style={{ color: COLORS.danger }}>{p.error}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )))}
        </div>
      </div>

      {/* Eingabe */}
      <div className="border-t px-3 pb-3 pt-2" style={{ borderColor: COLORS.stroke }}>
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {files.map((f) => (
              <span key={f.key} className="inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-xs"
                style={{ borderColor: f.error ? COLORS.danger : COLORS.stroke, color: f.error ? COLORS.danger : COLORS.navy }} title={f.error}>
                {f.uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : f.error ? <AlertTriangle className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                <span className="truncate">{f.name}</span>
                {f.error && <span className="hidden truncate sm:inline">– {f.error}</span>}
                <button onClick={() => setFiles((l) => l.filter((x) => x.key !== f.key))} aria-label="Datei entfernen"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border bg-white px-2 py-1.5 focus-within:ring-2" style={{ borderColor: COLORS.stroke, ['--tw-ring-color' as string]: 'rgba(217,83,30,0.25)' }}>
          <button onClick={() => fileInputRef.current?.click()} className="rounded-lg p-2 hover:bg-gray-100" aria-label="Datei anhängen" title="Datei anhängen (PDF, Word, Excel, Bild, Text)">
            <Paperclip className="h-4 w-4" style={{ color: COLORS.textMuted }} />
          </button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) uploadFiles(e.target.files); e.target.value = ''; }}
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.pptx,.txt,.csv,.md,.json,.html,.eml" />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.min(8, Math.max(1, input.split('\n').length))}
            placeholder={aiReady ? 'Frag deine Faltin-KI … (Enter senden, Shift+Enter neue Zeile)' : 'KI noch nicht verbunden'}
            disabled={!aiReady}
            className="min-h-[36px] flex-1 resize-none border-0 bg-transparent py-2 text-sm outline-none focus:ring-0"
            style={{ color: COLORS.text }}
            aria-label="Nachricht an die Faltin-KI"
          />
          {streaming ? (
            <button onClick={() => abortRef.current?.abort()} className="rounded-xl p-2 text-white" style={{ background: COLORS.navy }} aria-label="Antwort stoppen">
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={() => send()} disabled={!aiReady || (!input.trim() && !files.some((f) => f.id)) || files.some((f) => f.uploading)}
              className="rounded-xl p-2 text-white disabled:opacity-40" style={{ background: COLORS.accent }} aria-label="Senden">
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px]" style={{ color: COLORS.textMuted }}>
          <Wrench className="h-3 w-3" /> Die KI nutzt Portal, Postfach, SharePoint und Teamwissen. Sie versendet nichts selbst.
        </p>
      </div>

      {dragOver && (
        <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed text-sm font-semibold"
          style={{ borderColor: COLORS.accent, background: 'rgba(217,83,30,0.06)', color: COLORS.accent }}>
          Datei hier ablegen
        </div>
      )}
    </section>
  );
}
