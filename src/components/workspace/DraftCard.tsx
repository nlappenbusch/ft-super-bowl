'use client';

/**
 * DraftCard.tsx — Antwortentwurf der KI zur Prüfung.
 * Die KI versendet nie selbst: Hier bearbeitet der Mensch den Text und entscheidet —
 * über das CRM an den Kunden senden (Anfrage) oder als Entwurf in Outlook ablegen
 * (Mail im Postfach). Beides mit ausdrücklichem Klick, Senden zusätzlich mit Rückfrage.
 */
import { useEffect, useState } from 'react';
import { Send, FileEdit, Copy, Check, ExternalLink, Info } from 'lucide-react';
import { COLORS, Spinner } from '@/components/admin/ui';
import { api, jsonInit } from './types';

interface RequestInfo { id: string; request_number: string | null; email: string; package: string; customer: string | null }

export default function DraftCard({ mailId, request, body, note, personName, draftId, conversationId, initialDone }: {
  mailId: string | null; request: string | null; body: string; note: string; personName: string;
  /** Entwurf aus dem Chat: ID + Chat, damit „gesendet“ gespeichert wird (kein doppeltes Senden nach Neuladen). */
  draftId?: string; conversationId?: string | null;
  initialDone?: { action: 'sent' | 'outlook'; web_link: string } | null;
}) {
  const [text, setText] = useState(body);
  const [busy, setBusy] = useState<'send' | 'draft' | null>(null);
  const [done, setDone] = useState<{ kind: 'sent' | 'draft'; link?: string } | null>(
    initialDone ? { kind: initialDone.action === 'sent' ? 'sent' : 'draft', link: initialDone.web_link || undefined } : null,
  );

  const remember = (action: 'sent' | 'outlook', webLink?: string) => {
    if (!draftId || !conversationId) return;
    api(`/api/admin/workspace/drafts/${encodeURIComponent(draftId)}`, jsonInit('POST', { conversation_id: conversationId, action, web_link: webLink })).catch(() => {});
  };
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [info, setInfo] = useState<RequestInfo | null>(null);

  useEffect(() => {
    if (!request) return;
    api<RequestInfo>(`/api/admin/workspace/request?ref=${encodeURIComponent(request)}`).then(setInfo).catch(() => setInfo(null));
  }, [request]);

  const sendViaCrm = async () => {
    if (!info) return;
    if (!window.confirm(`Diese Antwort jetzt an ${info.email} senden?\n\nSie wird im CRM bei ${info.request_number || 'der Anfrage'} protokolliert.`)) return;
    setBusy('send'); setError(null);
    try {
      await api(`/api/bookings/${info.id}/reply`, jsonInit('POST', { body: text, agentName: personName }));
      setDone({ kind: 'sent' });
      remember('sent');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const draftInOutlook = async () => {
    if (!mailId) return;
    setBusy('draft'); setError(null);
    try {
      const r = await api<{ web_link: string }>(`/api/admin/workspace/mail/${encodeURIComponent(mailId)}/draft`, jsonInit('POST', { text }));
      setDone({ kind: 'draft', link: r.web_link });
      remember('outlook', r.web_link);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="my-2 overflow-hidden rounded-xl border bg-white" style={{ borderColor: COLORS.stroke }}>
      <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-semibold" style={{ borderColor: COLORS.stroke, background: 'rgba(217,83,30,0.06)', color: COLORS.navy }}>
        <FileEdit className="h-3.5 w-3.5" style={{ color: COLORS.accent }} />
        Antwortentwurf {request ? `· ${info?.request_number || request}` : mailId ? '· Postfach-Mail' : ''}
        {info && <span className="ml-auto truncate font-normal" style={{ color: COLORS.textMuted }}>an {info.email}</span>}
      </div>
      {note && (
        <div className="flex gap-1.5 border-b px-3 py-2 text-xs" style={{ borderColor: COLORS.stroke, color: COLORS.warn }}>
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{note}</span>
        </div>
      )}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={!!done}
        rows={Math.min(16, Math.max(5, text.split('\n').length + 1))}
        className="block w-full resize-y border-0 px-3 py-2.5 text-sm leading-relaxed outline-none focus:ring-0"
        style={{ color: COLORS.text }}
        aria-label="Antworttext bearbeiten"
      />
      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2" style={{ borderColor: COLORS.stroke }}>
        {done ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: COLORS.ok }}>
            <Check className="h-3.5 w-3.5" />
            {done.kind === 'sent' ? 'Gesendet und im CRM protokolliert.' : 'Entwurf liegt im Postfach.'}
            {done.link && (
              <a href={done.link} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 underline" style={{ color: COLORS.accent }}>
                In Outlook öffnen <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
        ) : (
          <>
            {request && (
              <button onClick={sendViaCrm} disabled={!info || !!busy || !text.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: COLORS.accent }}>
                {busy === 'send' ? <Spinner className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />} Prüfen & senden
              </button>
            )}
            {mailId && (
              <button onClick={draftInOutlook} disabled={!!busy || !text.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ background: request ? COLORS.navy : COLORS.accent }}>
                {busy === 'draft' ? <Spinner className="h-3.5 w-3.5" /> : <FileEdit className="h-3.5 w-3.5" />} Als Outlook-Entwurf ablegen
              </button>
            )}
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Kopiert' : 'Kopieren'}
            </button>
          </>
        )}
        {error && <span className="w-full text-xs" style={{ color: COLORS.danger }}>{error}</span>}
      </div>
    </div>
  );
}
