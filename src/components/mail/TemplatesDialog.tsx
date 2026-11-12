'use client';

/**
 * TemplatesDialog — Vorlagen & Textbausteine ansehen, suchen, anlegen, bearbeiten.
 * «Verwenden» setzt die Vorlage in die offene Mail (oder öffnet eine neue).
 */
import { useEffect, useMemo, useState } from 'react';
import { X, Search, Plus, Trash2, Save, Loader2, BookText, Puzzle, Users, Lock, Send } from 'lucide-react';
import type { MailTemplate } from './types';
import { api } from './util';

interface Props {
  templates: MailTemplate[];
  placeholders: Array<{ key: string; label: string }>;
  isAdmin: boolean;
  userName: string;
  onClose: () => void;
  onChanged: () => void;
  onUse: (t: MailTemplate) => void;
}

type Draft = Partial<MailTemplate> & { shared?: boolean };

const EMPTY: Draft = { kind: 'baustein', title: '', category: 'Allgemein', lang: 'de', subject: '', body: '', description: '', shortcut: '', greeting: '', shared: true };

export default function TemplatesDialog(p: Props) {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'vorlage' | 'baustein'>('vorlage');
  const [cat, setCat] = useState('');
  const [sel, setSel] = useState<string | null>(p.templates.find((t) => t.kind === 'vorlage')?.id || null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') p.onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [p.onClose]);

  const ofKind = p.templates.filter((t) => t.kind === kind);
  const cats = useMemo(() => [...new Set(ofKind.map((t) => t.category))].sort(), [ofKind]);
  const list = useMemo(() => {
    const s = q.toLowerCase().trim();
    return ofKind.filter((t) => (!cat || t.category === cat) && (!s || `${t.title} ${t.category} ${t.body} ${t.shortcut}`.toLowerCase().includes(s)));
  }, [ofKind, q, cat]);
  const cur = p.templates.find((t) => t.id === sel) || null;
  const canEdit = (t: MailTemplate) => !!t.owner || p.isAdmin || t.created_by === p.userName;

  const save = async () => {
    if (!draft) return;
    setBusy(true); setErr(null);
    try {
      const r = await api<{ template: MailTemplate }>('templates', { json: { ...draft, shared: draft.shared !== false } });
      p.onChanged();
      setSel(r.template.id); setKind(r.template.kind); setDraft(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const del = async (t: MailTemplate) => {
    if (!window.confirm(`«${t.title}» löschen?`)) return;
    try {
      await api(`templates?id=${encodeURIComponent(t.id)}`, { method: 'DELETE' });
      p.onChanged(); setSel(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const insertPh = (key: string) => {
    if (!draft) return;
    const el = document.getElementById('tpl-body') as HTMLTextAreaElement | null;
    const body = draft.body || '';
    const pos = el ? el.selectionStart : body.length;
    setDraft({ ...draft, body: `${body.slice(0, pos)}{{${key}}}${body.slice(pos)}` });
  };

  const input = 'w-full rounded-lg border px-2.5 py-1.5 text-[13px] outline-none focus:border-slate-400';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-0 sm:p-6" onMouseDown={p.onClose}>
      <div className="flex h-full w-full max-w-[1100px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(820px,100%)] sm:rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b px-5 py-3" style={{ borderColor: '#eef1f5' }}>
          <BookText className="h-5 w-5" style={{ color: '#d9531e' }} />
          <h2 className="flex-1 text-[15px] font-bold" style={{ color: '#143047' }}>Vorlagen &amp; Textbausteine</h2>
          <button onClick={() => { setDraft({ ...EMPTY, kind }); setSel(null); }} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white" style={{ background: '#143047' }}>
            <Plus className="h-4 w-4" /> Neu
          </button>
          <button onClick={p.onClose} className="rounded p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_1fr]">
          {/* Liste */}
          <div className="flex min-h-0 flex-col border-r" style={{ borderColor: '#eef1f5' }}>
            <div className="space-y-2 border-b p-3" style={{ borderColor: '#eef1f5' }}>
              <div className="flex rounded-lg bg-slate-100 p-0.5 text-[12.5px]">
                {(['vorlage', 'baustein'] as const).map((k) => (
                  <button key={k} onClick={() => { setKind(k); setCat(''); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 ${kind === k ? 'bg-white font-semibold shadow-sm' : 'text-slate-500'}`}>
                    {k === 'vorlage' ? <BookText className="h-3.5 w-3.5" /> : <Puzzle className="h-3.5 w-3.5" />}
                    {k === 'vorlage' ? 'Vorlagen' : 'Bausteine'} <span className="text-slate-400">{p.templates.filter((t) => t.kind === k).length}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-lg border px-2.5" style={{ borderColor: '#e3e8ef' }}>
                <Search className="h-3.5 w-3.5 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen …" className="flex-1 bg-transparent py-1.5 text-[13px] outline-none" />
              </div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setCat('')} className={`rounded-full px-2 py-0.5 text-[11.5px] ${!cat ? 'bg-[#143047] text-white' : 'bg-slate-100 text-slate-600'}`}>Alle</button>
                {cats.map((c) => (
                  <button key={c} onClick={() => setCat(c === cat ? '' : c)} className={`rounded-full px-2 py-0.5 text-[11.5px] ${cat === c ? 'bg-[#143047] text-white' : 'bg-slate-100 text-slate-600'}`}>{c}</button>
                ))}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {list.map((t) => (
                <button key={t.id} onClick={() => { setSel(t.id); setDraft(null); }} className={`flex w-full items-start gap-2 px-3 py-2 text-left ${sel === t.id && !draft ? 'bg-orange-50' : 'hover:bg-slate-50'}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-800">{t.title}</span>
                    <span className="block truncate text-[11.5px] text-slate-500">{t.category}{t.lang === 'en' ? ' · EN' : ''}{t.uses ? ` · ${t.uses}× benutzt` : ''}</span>
                  </span>
                  {t.owner ? <Lock className="mt-1 h-3 w-3 text-slate-300" /> : null}
                  {t.shortcut && <code className="mt-0.5 rounded bg-slate-100 px-1 text-[10.5px] text-slate-500">/{t.shortcut}</code>}
                </button>
              ))}
              {!list.length && <div className="px-3 py-8 text-center text-[12.5px] text-slate-400">Nichts gefunden.</div>}
            </div>
          </div>

          {/* Detail / Editor */}
          <div className="min-h-0 overflow-y-auto p-5">
            {draft ? (
              <div className="mx-auto max-w-[680px] space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <label className="col-span-2 text-[11.5px] text-slate-500">Titel
                    <input className={input} style={{ borderColor: '#e3e8ef' }} value={draft.title || ''} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                  </label>
                  <label className="text-[11.5px] text-slate-500">Art
                    <select className={input} style={{ borderColor: '#e3e8ef' }} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as 'vorlage' | 'baustein' })}>
                      <option value="vorlage">Vorlage (ganze Mail)</option>
                      <option value="baustein">Baustein (Absatz)</option>
                    </select>
                  </label>
                  <label className="text-[11.5px] text-slate-500">Sprache
                    <select className={input} style={{ borderColor: '#e3e8ef' }} value={draft.lang} onChange={(e) => setDraft({ ...draft, lang: e.target.value })}>
                      <option value="de">Deutsch</option><option value="en">Englisch</option>
                    </select>
                  </label>
                  <label className="col-span-2 text-[11.5px] text-slate-500">Kategorie
                    <input list="tpl-cats" className={input} style={{ borderColor: '#e3e8ef' }} value={draft.category || ''} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                    <datalist id="tpl-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
                  </label>
                  <label className="text-[11.5px] text-slate-500">Kürzel (/…)
                    <input className={input} style={{ borderColor: '#e3e8ef' }} value={draft.shortcut || ''} onChange={(e) => setDraft({ ...draft, shortcut: e.target.value })} placeholder="z. B. iban" />
                  </label>
                  <label className="text-[11.5px] text-slate-500">Sichtbar für
                    <select className={input} style={{ borderColor: '#e3e8ef' }} value={draft.shared === false ? 'me' : 'team'} onChange={(e) => setDraft({ ...draft, shared: e.target.value === 'team' })}>
                      <option value="team">ganzes Team</option><option value="me">nur mich</option>
                    </select>
                  </label>
                </div>
                {draft.kind === 'vorlage' && (
                  <label className="block text-[11.5px] text-slate-500">Betreff
                    <input className={input} style={{ borderColor: '#e3e8ef' }} value={draft.subject || ''} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
                  </label>
                )}
                <label className="block text-[11.5px] text-slate-500">Text
                  <textarea id="tpl-body" rows={14} className={`${input} font-[inherit] leading-relaxed`} style={{ borderColor: '#e3e8ef' }} value={draft.body || ''} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                </label>
                <div className="flex flex-wrap gap-1">
                  <span className="mr-1 text-[11px] text-slate-400">Platzhalter:</span>
                  {p.placeholders.slice(0, 40).map((ph) => (
                    <button key={ph.key} onClick={() => insertPh(ph.key)} title={ph.label} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10.5px] text-slate-600 hover:bg-orange-100 hover:text-[#8a3a12]">{ph.key}</button>
                  ))}
                </div>
                <label className="block text-[11.5px] text-slate-500">Grussformel (wird über der Signatur gesetzt)
                  <input className={input} style={{ borderColor: '#e3e8ef' }} value={draft.greeting || ''} onChange={(e) => setDraft({ ...draft, greeting: e.target.value })} placeholder="z. B. Freundliche Grüsse" />
                </label>
                <label className="block text-[11.5px] text-slate-500">Wann verwenden? (Hinweis)
                  <input className={input} style={{ borderColor: '#e3e8ef' }} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                </label>
                {err && <div className="text-[12.5px] text-red-600">{err}</div>}
                <div className="flex gap-2">
                  <button onClick={save} disabled={busy} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: '#d9531e' }}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Speichern
                  </button>
                  <button onClick={() => setDraft(null)} className="rounded-lg px-3 py-2 text-[13px] text-slate-600 hover:bg-slate-100">Abbrechen</button>
                </div>
              </div>
            ) : cur ? (
              <div className="mx-auto max-w-[680px]">
                <div className="mb-1 flex items-center gap-2 text-[11.5px] text-slate-500">
                  <span>{cur.category}</span>·<span>{cur.lang === 'en' ? 'Englisch' : 'Deutsch'}</span>·
                  <span className="flex items-center gap-1">{cur.owner ? <><Lock className="h-3 w-3" /> persönlich</> : <><Users className="h-3 w-3" /> Team</>}</span>
                  {cur.shortcut && <>· <code className="rounded bg-slate-100 px-1">/{cur.shortcut}</code></>}
                </div>
                <h3 className="text-[18px] font-bold" style={{ color: '#143047' }}>{cur.title}</h3>
                {cur.description && <p className="mt-1 text-[13px] text-slate-500">{cur.description}</p>}
                {cur.subject && <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[13px]"><span className="text-slate-400">Betreff: </span>{cur.subject}</div>}
                <div className="mt-3 whitespace-pre-wrap rounded-xl border px-4 py-3 text-[13.5px] leading-relaxed text-slate-700" style={{ borderColor: '#eef1f5' }}>
                  {cur.body.split(/(\{\{[^}]+\}\})/g).map((part, i) => part.startsWith('{{')
                    ? <span key={i} className="rounded bg-amber-100 px-0.5 text-amber-800">{part.replace(/[{}]/g, '').replace(/^[#/]/, '')}</span>
                    : <span key={i}>{part}</span>)}
                  {cur.greeting && <div className="mt-3 text-slate-400">{cur.greeting}</div>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => p.onUse(cur)} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white" style={{ background: '#d9531e' }}>
                    <Send className="h-4 w-4" /> Verwenden
                  </button>
                  {canEdit(cur) && <button onClick={() => setDraft({ ...cur, shared: !cur.owner })} className="rounded-lg border px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50" style={{ borderColor: '#e3e8ef' }}>Bearbeiten</button>}
                  <button onClick={() => { setDraft({ ...cur, id: undefined, title: `${cur.title} (Kopie)`, shared: false }); }} className="rounded-lg border px-3 py-2 text-[13px] text-slate-700 hover:bg-slate-50" style={{ borderColor: '#e3e8ef' }}>Als eigene Kopie</button>
                  {canEdit(cur) && <button onClick={() => void del(cur)} className="ml-auto flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Löschen</button>}
                </div>
                {err && <div className="mt-2 text-[12.5px] text-red-600">{err}</div>}
              </div>
            ) : (
              <div className="grid h-full place-items-center text-[13px] text-slate-400">Links eine Vorlage wählen.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
