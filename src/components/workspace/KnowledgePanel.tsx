'use client';

/**
 * KnowledgePanel.tsx — Gemeinsames Teamwissen: suchen, festhalten, pflegen.
 * Einträge entstehen hier von Hand oder im Chat (die KI schlägt es vor).
 * Angeheftete Einträge kennt die KI in jedem neuen Chat automatisch.
 */
import { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Pin, Pencil, Trash2, BookOpen, X } from 'lucide-react';
import { COLORS, Spinner } from '@/components/admin/ui';
import Markdown from './Markdown';
import { api, jsonInit, relTime, type KnowledgeEntry } from './types';

interface Draft { id?: string; title: string; content: string; tags: string; pinned: boolean }
const EMPTY: Draft = { title: '', content: '', tags: '', pinned: false };

export default function KnowledgePanel({ isAdmin, myKey, onAsk }: { isAdmin: boolean; myKey: string | null; onAsk: (text: string, context?: string) => void }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    try { setRows(await api<KnowledgeEntry[]>(`/api/admin/workspace/knowledge${query ? `?q=${encodeURIComponent(query)}` : ''}`)); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      if (edit.id) await api(`/api/admin/workspace/knowledge/${edit.id}`, jsonInit('PATCH', edit));
      else await api('/api/admin/workspace/knowledge', jsonInit('POST', edit));
      setEdit(null);
      load(q.trim());
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Diesen Wissenseintrag löschen?')) return;
    try { await api(`/api/admin/workspace/knowledge/${id}`, { method: 'DELETE' }); load(q.trim()); }
    catch (e) { setError((e as Error).message); }
  };

  if (edit) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: COLORS.stroke }}>
          <span className="text-sm font-semibold" style={{ color: COLORS.navy }}>{edit.id ? 'Wissen bearbeiten' : 'Wissen festhalten'}</span>
          <button onClick={() => setEdit(null)} className="ml-auto rounded-lg p-1.5 hover:bg-gray-100" aria-label="Schliessen"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <label className="block text-xs font-semibold" style={{ color: COLORS.navy }}>Titel
            <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className="mt-1 block w-full rounded-lg border px-2.5 py-1.5 text-sm font-normal" style={{ borderColor: COLORS.stroke }} placeholder="z.B. Anzahlung bei Super-Bowl-Paketen" />
          </label>
          <label className="block text-xs font-semibold" style={{ color: COLORS.navy }}>Inhalt
            <textarea value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} rows={10} className="mt-1 block w-full rounded-lg border px-2.5 py-1.5 text-sm font-normal" style={{ borderColor: COLORS.stroke }} placeholder="Was gilt, wie geht man vor, wen fragt man …" />
          </label>
          <label className="block text-xs font-semibold" style={{ color: COLORS.navy }}>Stichworte
            <input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} className="mt-1 block w-full rounded-lg border px-2.5 py-1.5 text-sm font-normal" style={{ borderColor: COLORS.stroke }} placeholder="zahlung, anzahlung, super bowl" />
          </label>
          {isAdmin && (
            <label className="flex items-center gap-2 text-xs" style={{ color: COLORS.navy }}>
              <input type="checkbox" checked={edit.pinned} onChange={(e) => setEdit({ ...edit, pinned: e.target.checked })} />
              Anheften — die KI kennt diesen Eintrag in jedem neuen Chat
            </label>
          )}
          {error && <p className="text-xs" style={{ color: COLORS.danger }}>{error}</p>}
        </div>
        <div className="border-t px-4 py-2.5" style={{ borderColor: COLORS.stroke }}>
          <button onClick={save} disabled={saving || !edit.title.trim() || !edit.content.trim()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: COLORS.accent }}>
            {saving && <Spinner className="h-3.5 w-3.5" />} Speichern
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2" style={{ borderColor: COLORS.stroke }}>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: COLORS.textMuted }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Teamwissen durchsuchen …" aria-label="Teamwissen durchsuchen"
            className="w-full rounded-lg border py-1.5 pl-7 pr-2 text-xs" style={{ borderColor: COLORS.stroke }} />
        </div>
        <button onClick={() => setEdit({ ...EMPTY })} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-gray-100" style={{ color: COLORS.accent }}>
          <Plus className="h-3.5 w-3.5" /> Neu
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && !rows.length && <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>}
        {!loading && !rows.length && (
          <div className="px-5 py-8 text-center text-xs" style={{ color: COLORS.textMuted }}>
            <BookOpen className="mx-auto mb-2 h-6 w-6 opacity-50" />
            {q ? 'Nichts gefunden.' : 'Noch kein Teamwissen. Haltet fest, was ihr immer wieder erklärt: Abläufe, Regeln, Kontakte, Antwortbausteine.'}
            <div className="mt-3">
              <button onClick={() => onAsk('Lass uns Teamwissen aufbauen: Frag mich nach Abläufen und Regeln, die wir immer wieder erklären, und halte sie danach fest.', 'Teamwissen')}
                className="rounded-full border px-3 py-1.5 font-medium" style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>Mit der KI sammeln</button>
            </div>
          </div>
        )}
        {rows.map((k) => {
          const expanded = open === k.id;
          const mine = !!myKey && k.created_by === myKey;
          return (
            <div key={k.id} className="border-b px-3 py-2.5" style={{ borderColor: COLORS.stroke }}>
              <button onClick={() => setOpen(expanded ? null : k.id)} className="flex w-full items-start gap-1.5 text-left" aria-expanded={expanded}>
                {!!k.pinned && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: COLORS.accent }} />}
                <span className="text-[13px] font-semibold" style={{ color: COLORS.navy }}>{k.title}</span>
              </button>
              <div className="mt-0.5 text-[10px]" style={{ color: COLORS.textMuted }}>
                {k.created_by_name || '—'} · {relTime(k.updated_at)}{k.tags ? ` · ${k.tags}` : ''}{k.uses ? ` · ${k.uses}× genutzt` : ''}
              </div>
              {expanded ? (
                <div className="mt-2">
                  <Markdown text={k.content} />
                  {(mine || isAdmin) && (
                    <div className="mt-2 flex gap-3 text-[11px]">
                      <button onClick={() => setEdit({ id: k.id, title: k.title, content: k.content, tags: k.tags, pinned: !!k.pinned })} className="inline-flex items-center gap-1 font-medium hover:underline" style={{ color: COLORS.navy }}><Pencil className="h-3 w-3" /> Bearbeiten</button>
                      <button onClick={() => remove(k.id)} className="inline-flex items-center gap-1 font-medium hover:underline" style={{ color: COLORS.danger }}><Trash2 className="h-3 w-3" /> Löschen</button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: COLORS.textMuted }}>{k.content.replace(/[#*`>]/g, '')}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
