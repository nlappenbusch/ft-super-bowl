'use client';

/**
 * InboxPanel.tsx — Posteingang (request@), von der KI sortiert.
 * Liste nach Kategorie/Priorität, Detail mit Volltext, Antwortvorschlag der KI
 * (bearbeitbar, als Outlook-Entwurf ablegbar) und Status erledigt/ignoriert.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, ArrowLeft, Sparkles, CheckCircle2, EyeOff, RotateCcw, ExternalLink, Paperclip, Info, AlertCircle, MessageSquare } from 'lucide-react';
import { COLORS, Spinner } from '@/components/admin/ui';
import DraftCard from './DraftCard';
import { api, jsonInit, relTime, type TriagedMail } from './types';

interface Category { id: string; label: string }
interface MailDetail {
  triage: TriagedMail | null;
  mail: { subject: string; from: string; received: string; to: string[]; cc: string[]; text: string; web_link: string; has_attachments: boolean } | null;
  suggestion: { reply: string; internal_notes: string; missing_info: string[] } | null;
}

const PRIO_COLOR: Record<string, string> = { hoch: COLORS.danger, normal: COLORS.info, niedrig: '#9ca3af' };

export default function InboxPanel({ personName, onAsk }: { personName: string; onAsk: (text: string, context?: string) => void }) {
  const [mails, setMails] = useState<TriagedMail[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mailbox, setMailbox] = useState<string | null>(null);
  const [status, setStatus] = useState<'offen' | 'erledigt' | 'ignoriert' | 'alle'>('offen');
  const [category, setCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<{ mailbox: string | null; categories: Category[]; mails: TriagedMail[] }>(`/api/admin/workspace/mail?status=${status}`);
      setMails(d.mails); setCategories(d.categories); setMailbox(d.mailbox); setError(null);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [status]);

  const sync = useCallback(async () => {
    setSyncing(true); setSyncInfo(null);
    try {
      const r = await api<{ added: number; triaged: number; errors: string[] }>('/api/admin/workspace/mail', jsonInit('POST', { action: 'sync' }));
      setSyncInfo(r.errors.length ? `Teilweise fehlgeschlagen: ${r.errors[0]}` : r.added || r.triaged ? `${r.added} neu, ${r.triaged} einsortiert` : 'Keine neuen Mails');
      await load();
    } catch (e) { setSyncInfo((e as Error).message); }
    finally { setSyncing(false); }
  }, [load]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { sync(); /* beim Öffnen einmal abholen */ }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openMail = async (id: string) => {
    setOpenId(id); setDetail(null); setDetailLoading(true);
    try { setDetail(await api<MailDetail>(`/api/admin/workspace/mail/${encodeURIComponent(id)}`)); }
    catch (e) { setError((e as Error).message); }
    finally { setDetailLoading(false); }
  };

  const suggest = async () => {
    if (!openId) return;
    setSuggesting(true);
    try {
      const s = await api<MailDetail['suggestion']>(`/api/admin/workspace/mail/${encodeURIComponent(openId)}/suggest`, { method: 'POST' });
      setDetail((d) => (d ? { ...d, suggestion: s } : d));
    } catch (e) { setError((e as Error).message); }
    finally { setSuggesting(false); }
  };

  const setMailStatus = async (id: string, s: 'offen' | 'erledigt' | 'ignoriert') => {
    try {
      await api(`/api/admin/workspace/mail/${encodeURIComponent(id)}`, jsonInit('PATCH', { status: s }));
      setMails((list) => list.map((m) => (m.graph_id === id ? { ...m, status: s } : m)).filter((m) => status === 'alle' || m.status === status));
      if (s !== 'offen') { setOpenId(null); setDetail(null); }
    } catch (e) { setError((e as Error).message); }
  };

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const m of mails) c.set(m.category || '', (c.get(m.category || '') || 0) + 1);
    return c;
  }, [mails]);
  const visible = mails.filter((m) => !category || m.category === category);
  const catLabel = (id: string) => categories.find((c) => c.id === id)?.label || (id ? id : 'Noch nicht eingeordnet');

  /* ── Detailansicht ── */
  if (openId) {
    const t = detail?.triage;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: COLORS.stroke }}>
          <button onClick={() => { setOpenId(null); setDetail(null); }} className="rounded-lg p-1.5 hover:bg-gray-100" aria-label="Zurück zur Liste">
            <ArrowLeft className="h-4 w-4" style={{ color: COLORS.navy }} />
          </button>
          <span className="truncate text-sm font-semibold" style={{ color: COLORS.navy }}>{detail?.mail?.subject || t?.subject || 'Mail'}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {detailLoading && <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>}
          {detail && (
            <>
              <div className="text-xs" style={{ color: COLORS.textMuted }}>
                <div><span className="font-semibold" style={{ color: COLORS.navy }}>{detail.mail?.from || `${t?.from_name} <${t?.from_address}>`}</span></div>
                <div>{detail.mail ? new Date(detail.mail.received).toLocaleString('de-CH') : ''}{detail.mail?.has_attachments && <span className="ml-2 inline-flex items-center gap-0.5"><Paperclip className="h-3 w-3" /> Anhang</span>}</div>
              </div>
              {t && (
                <div className="mt-3 rounded-xl border p-3 text-xs" style={{ borderColor: COLORS.stroke, background: COLORS.surfaceMuted }}>
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md px-1.5 py-0.5 font-semibold" style={{ background: 'white', color: COLORS.navy }}>{catLabel(t.category)}</span>
                    <span className="font-semibold" style={{ color: PRIO_COLOR[t.priority] }}>Priorität {t.priority}</span>
                    {t.request_number && <span className="rounded-md px-1.5 py-0.5 font-semibold" style={{ background: 'white', color: COLORS.accent }}>{t.request_number}</span>}
                  </div>
                  {t.summary && <p style={{ color: COLORS.text }}>{t.summary}</p>}
                  {t.next_step && <p className="mt-1" style={{ color: COLORS.navy }}><span className="font-semibold">Nächster Schritt:</span> {t.next_step}</p>}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={suggest} disabled={suggesting} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" style={{ background: COLORS.accent }}>
                  {suggesting ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} {detail.suggestion ? 'Neu vorschlagen' : 'Antwort vorschlagen'}
                </button>
                <button onClick={() => onAsk(`Hilf mir mit dieser Mail (mail_id ${openId}): „${detail.mail?.subject || t?.subject}“. Lies sie und schlag vor, wie wir vorgehen.`, `Posteingang: Mail „${detail.mail?.subject || t?.subject}“`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>
                  <MessageSquare className="h-3.5 w-3.5" /> Im Chat besprechen
                </button>
                {t?.status === 'offen' ? (
                  <>
                    <button onClick={() => setMailStatus(openId, 'erledigt')} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: COLORS.stroke, color: COLORS.ok }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Erledigt
                    </button>
                    <button onClick={() => setMailStatus(openId, 'ignoriert')} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: COLORS.stroke, color: COLORS.textMuted }}>
                      <EyeOff className="h-3.5 w-3.5" /> Ignorieren
                    </button>
                  </>
                ) : t && (
                  <button onClick={() => setMailStatus(openId, 'offen')} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>
                    <RotateCcw className="h-3.5 w-3.5" /> Wieder öffnen
                  </button>
                )}
                {detail.mail?.web_link && (
                  <a href={detail.mail.web_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-1 py-1.5 text-xs font-medium hover:underline" style={{ color: COLORS.accent }}>
                    Outlook <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              {detail.suggestion && (
                <div className="mt-3">
                  {(detail.suggestion.internal_notes || detail.suggestion.missing_info.length > 0) && (
                    <div className="mb-2 flex gap-1.5 rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(217,119,6,0.08)', color: COLORS.warn }}>
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div>
                        {detail.suggestion.internal_notes}
                        {detail.suggestion.missing_info.length > 0 && <ul className="mt-1 list-disc pl-4">{detail.suggestion.missing_info.map((m, i) => <li key={i}>{m}</li>)}</ul>}
                      </div>
                    </div>
                  )}
                  <DraftCard key={detail.suggestion.reply.slice(0, 40)} mailId={openId} request={null} body={detail.suggestion.reply} note="" personName={personName} />
                </div>
              )}
              {detail.mail && (
                <div className="mt-4 whitespace-pre-wrap border-t pt-3 text-[13px] leading-relaxed" style={{ borderColor: COLORS.stroke, color: COLORS.text }}>
                  {detail.mail.text}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  /* ── Liste ── */
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-3 py-2" style={{ borderColor: COLORS.stroke }}>
        <div className="flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Status filtern"
            className="rounded-lg border bg-white px-2 py-1 text-xs" style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>
            <option value="offen">Offen</option><option value="erledigt">Erledigt</option><option value="ignoriert">Ignoriert</option><option value="alle">Alle</option>
          </select>
          <span className="truncate text-[11px]" style={{ color: COLORS.textMuted }}>{mailbox || 'Postfach nicht verbunden'}</span>
          <button onClick={sync} disabled={syncing} className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-gray-100" style={{ color: COLORS.accent }} title="Neue Mails abholen und einsortieren">
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} /> Sortieren
          </button>
        </div>
        {syncInfo && <p className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>{syncInfo}</p>}
        {counts.size > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <button onClick={() => setCategory('')} className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: !category ? COLORS.navy : COLORS.surfaceMuted, color: !category ? '#fff' : COLORS.navy }}>
              Alle {mails.length}
            </button>
            {Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([id, n]) => (
              <button key={id || 'none'} onClick={() => setCategory(id)} className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: category === id ? COLORS.navy : COLORS.surfaceMuted, color: category === id ? '#fff' : COLORS.navy }}>
                {catLabel(id)} {n}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="m-3 flex items-center gap-1.5 text-xs" style={{ color: COLORS.danger }}><AlertCircle className="h-3.5 w-3.5" /> {error}</p>}
        {loading && !mails.length && <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>}
        {!loading && !visible.length && <p className="px-4 py-8 text-center text-xs" style={{ color: COLORS.textMuted }}>Keine Mails in dieser Ansicht.</p>}
        {visible.map((m) => (
          <button key={m.graph_id} onClick={() => openMail(m.graph_id)} className="block w-full border-b px-3 py-2.5 text-left transition hover:bg-gray-50" style={{ borderColor: COLORS.stroke }}>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: m.triaged_at ? PRIO_COLOR[m.priority] : COLORS.stroke }} title={`Priorität ${m.priority}`} />
              <span className="truncate text-xs font-semibold" style={{ color: COLORS.navy }}>{m.from_name || m.from_address}</span>
              <span className="ml-auto shrink-0 text-[10px]" style={{ color: COLORS.textMuted }}>{relTime(m.received_at)}</span>
            </div>
            <div className="mt-0.5 truncate text-[13px]" style={{ color: COLORS.text }}>{m.subject || '(ohne Betreff)'}</div>
            <div className="mt-0.5 line-clamp-2 text-[11px]" style={{ color: COLORS.textMuted }}>{m.summary || m.preview}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: COLORS.surfaceMuted, color: COLORS.navy }}>{catLabel(m.category)}</span>
              {m.request_number && <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(217,83,30,0.08)', color: COLORS.accent }}>{m.request_number}</span>}
              {!!m.needs_reply && m.status === 'offen' && <span className="text-[10px] font-semibold" style={{ color: COLORS.warn }}>Antwort nötig</span>}
              {m.has_suggestion && <span className="text-[10px]" style={{ color: COLORS.ok }}>Vorschlag bereit</span>}
              {m.draft_created_at && <span className="text-[10px]" style={{ color: COLORS.ok }}>Entwurf im Postfach</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
