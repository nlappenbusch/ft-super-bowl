'use client';

/**
 * WorkshopPanel.tsx — Werkstatt: Ideen für neue Werkzeuge im Portal.
 * Jede Idee wird eine Aufgabe „KI-Umsetzung angefragt“ im Projekt KI-Werkstatt;
 * Kolleg:innen können mit „Brauche ich auch“ gewichten. Ausdrücklich zum
 * Mitmachen gedacht: Wer etwas oft von Hand macht, soll es hier melden.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Lightbulb, Plus, ThumbsUp, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { COLORS, Spinner } from '@/components/admin/ui';
import { api, jsonInit, relTime, type ToolIdea } from './types';

const STATUS_LABEL: Record<string, string> = { offen: 'Eingereicht', in_arbeit: 'In Umsetzung', warten_requester: 'Rückfrage', warten_dritte: 'Wartet', erledigt: 'Live' };

export default function WorkshopPanel({ onAsk }: { onAsk: (text: string, context?: string) => void }) {
  const [ideas, setIdeas] = useState<ToolIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<{ title: string; problem: string; idea: string; benefit: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setIdeas(await api<ToolIdea[]>('/api/admin/workspace/ideas')); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const r = await api<{ ticket_no: string }>('/api/admin/workspace/ideas', jsonInit('POST', form));
      setSent(r.ticket_no); setForm(null); load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const vote = async (id: string) => {
    setIdeas((l) => l.map((x) => (x.id === id ? { ...x, voted: true, votes: x.votes + 1 } : x)));
    try { await api(`/api/admin/workspace/ideas/${id}`, { method: 'POST' }); } catch { load(); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-3" style={{ borderColor: COLORS.stroke, background: 'linear-gradient(135deg, rgba(217,83,30,0.07), rgba(20,48,71,0.04))' }}>
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" style={{ color: COLORS.accent }} />
          <div className="text-xs" style={{ color: COLORS.text }}>
            <p className="font-bold" style={{ color: COLORS.navy }}>Was nervt dich im Alltag?</p>
            <p className="mt-0.5">Alles, was du öfter von Hand machst, kann ein Werkzeug im Portal werden. Beschreib es kurz — die Umsetzung übernimmt die KI mit der Entwicklung.</p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button onClick={() => { setForm({ title: '', problem: '', idea: '', benefit: '' }); setSent(null); }} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: COLORS.accent }}>
            <Plus className="h-3.5 w-3.5" /> Idee einreichen
          </button>
          <button onClick={() => onAsk('Ich möchte eine Werkzeug-Idee fürs Portal ausarbeiten. Frag mich, was ich heute von Hand mache, und hilf mir, daraus eine klare Idee zu machen. Reich sie danach ein.', 'Werkstatt')}
            className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium" style={{ borderColor: COLORS.stroke, color: COLORS.navy }}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: COLORS.accent }} /> Mit der KI ausarbeiten
          </button>
        </div>
        {sent && <p className="mt-2 flex items-center gap-1 text-xs font-semibold" style={{ color: COLORS.ok }}><CheckCircle2 className="h-3.5 w-3.5" /> Danke! Als {sent} eingereicht.</p>}
      </div>

      {form ? (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
          <div className="flex items-center">
            <span className="text-sm font-semibold" style={{ color: COLORS.navy }}>Neue Werkzeug-Idee</span>
            <button onClick={() => setForm(null)} className="ml-auto rounded-lg p-1 hover:bg-gray-100" aria-label="Schliessen"><X className="h-4 w-4" /></button>
          </div>
          {([
            ['title', 'Name', 'z.B. Hotelliste automatisch abgleichen', 1],
            ['problem', 'Was ist heute mühsam?', 'Wer macht was, wie oft, wie lange dauert es?', 3],
            ['idea', 'Was soll das Werkzeug tun?', 'z.B. Ich lade die Hotelliste hoch und das Portal …', 4],
            ['benefit', 'Was bringt es?', 'z.B. spart pro Anfrage 20 Minuten', 2],
          ] as const).map(([key, label, ph, rows]) => (
            <label key={key} className="block text-xs font-semibold" style={{ color: COLORS.navy }}>{label}
              {rows === 1 ? (
                <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={ph} className="mt-1 block w-full rounded-lg border px-2.5 py-1.5 text-sm font-normal" style={{ borderColor: COLORS.stroke }} />
              ) : (
                <textarea value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={ph} rows={rows} className="mt-1 block w-full rounded-lg border px-2.5 py-1.5 text-sm font-normal" style={{ borderColor: COLORS.stroke }} />
              )}
            </label>
          ))}
          {error && <p className="text-xs" style={{ color: COLORS.danger }}>{error}</p>}
          <button onClick={submit} disabled={saving || !form.title.trim() || !form.idea.trim()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" style={{ background: COLORS.accent }}>
            {saving && <Spinner className="h-3.5 w-3.5" />} Einreichen
          </button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && !ideas.length && <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div>}
          {!loading && !ideas.length && <p className="px-5 py-8 text-center text-xs" style={{ color: COLORS.textMuted }}>Noch keine Ideen — sei die oder der Erste!</p>}
          {error && !form && <p className="m-3 text-xs" style={{ color: COLORS.danger }}>{error}</p>}
          {ideas.map((i) => (
            <div key={i.id} className="border-b px-3 py-2.5" style={{ borderColor: COLORS.stroke }}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/aufgaben/${i.id}`} className="text-[13px] font-semibold hover:underline" style={{ color: COLORS.navy }}>{i.title}</Link>
                  <div className="mt-0.5 text-[10px]" style={{ color: COLORS.textMuted }}>
                    {i.ticket_no} · {relTime(i.created_at)} ·{' '}
                    <span style={{ color: i.status === 'erledigt' ? COLORS.ok : i.status === 'in_arbeit' ? COLORS.accent : COLORS.textMuted, fontWeight: 600 }}>{STATUS_LABEL[i.status] || i.status}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: COLORS.textMuted }}>{i.description.replace(/\*\*/g, '')}</p>
                </div>
                <button onClick={() => vote(i.id)} disabled={i.voted} title={i.voted ? 'Du hast schon gestimmt' : 'Brauche ich auch'}
                  className="flex shrink-0 flex-col items-center rounded-lg border px-2 py-1 text-[11px] font-semibold disabled:cursor-default"
                  style={{ borderColor: i.voted ? COLORS.accent : COLORS.stroke, color: i.voted ? COLORS.accent : COLORS.navy }}>
                  <ThumbsUp className="h-3.5 w-3.5" /> {i.votes}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
