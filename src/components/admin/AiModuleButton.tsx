'use client';

import { useState } from 'react';
import { Sparkles, Link2, Eye, Image as ImageIcon, X, Check, ChevronUp } from 'lucide-react';

const NAVY = '#143047';
const PURPLE = '#7c3aed';

export interface AiModuleButtonProps {
  /** Modul-Key passend zu MODULE_SPECS (z.B. 'leistungen', 'wissenswertes', 'ticket_categories') */
  moduleKey: string;
  /** Event-Name als Kontext */
  eventName?: string;
  /** Aktueller Inhalt (für „verbessern statt neu") */
  currentContent?: string;
  /** Wird mit dem geparsten Modul-JSON aufgerufen, wenn der Redakteur „Übernehmen" klickt */
  onApply: (data: Record<string, unknown>) => void;
}

export default function AiModuleButton({ moduleKey, eventName, currentContent, onApply }: AiModuleButtonProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [instruction, setInstruction] = useState('');
  const [image, setImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [src, setSrc] = useState<{ title: string; chars: number; text: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      setImage({ data: res.split(',')[1] || '', mediaType: f.type || 'image/png', preview: res });
    };
    reader.readAsDataURL(f);
  };

  const doFetch = async () => {
    if (!url.trim()) return;
    setFetching(true); setSrc(null); setErr(null);
    try {
      const r = await fetch('/api/admin/ai/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const d = await r.json();
      if (d.success) setSrc({ title: d.title, chars: d.chars, text: d.preview });
      else setErr(d.error || 'Abruf fehlgeschlagen.');
    } catch { setErr('Verbindungsfehler.'); } finally { setFetching(false); }
  };

  const run = async () => {
    setRunning(true); setResult(null); setErr(null);
    try {
      const r = await fetch('/api/admin/ai/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleKey, eventName, currentContent: currentContent || undefined,
          sourceUrl: url || undefined, instruction: instruction || undefined,
          image: image ? { data: image.data, mediaType: image.mediaType } : undefined,
        }),
      });
      const d = await r.json();
      if (d.success) setResult(d.data);
      else setErr(d.error || 'Generierung fehlgeschlagen.');
    } catch { setErr('Verbindungsfehler.'); } finally { setRunning(false); }
  };

  const apply = () => {
    if (result) onApply(result);
    setOpen(false); setResult(null); setSrc(null); setUrl(''); setInstruction(''); setImage(null); setErr(null);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all"
        style={{ background: open ? PURPLE : '#f3e8ff', color: open ? '#fff' : PURPLE }}
      >
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
        KI-Inhalt
      </button>

      {open && (
        <div className="mt-2 rounded-xl border p-3" style={{ borderColor: '#e9d5ff', background: '#faf5ff' }}>
          <div className="grid gap-2.5">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-gray-400" />
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Get from URL: https://faltintravel.com/…"
                className="flex-1 rounded-lg border px-2.5 py-1.5 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }} />
              <button type="button" onClick={doFetch} disabled={fetching || !url.trim()}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50"
                style={{ borderColor: '#d8dde4', color: NAVY }}>
                <Eye className="h-3.5 w-3.5" /> {fetching ? '…' : 'Abrufen'}
              </button>
            </div>

            {src && (
              <div className="rounded-lg border p-2 text-xs" style={{ borderColor: '#e9d5ff', background: '#fff' }}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-bold" style={{ color: NAVY }}>{src.title || '(ohne Titel)'}</span>
                  <span className="text-gray-400">{src.chars.toLocaleString('de-DE')} Zeichen</span>
                </div>
                <div className="max-h-24 overflow-auto whitespace-pre-wrap text-gray-600">{src.text.slice(0, 600)}…</div>
              </div>
            )}

            <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2}
              placeholder="Anweisung (optional), z.B. knackiger – oder: aus dem Screenshot übernehmen"
              className="w-full rounded-lg border px-2.5 py-1.5 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }} />

            <div className="flex items-center gap-2">
              {image ? (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.preview} alt="" className="h-8 w-12 rounded object-cover border" style={{ borderColor: '#d8dde4' }} />
                  Screenshot <button type="button" onClick={() => setImage(null)}><X className="h-3.5 w-3.5 text-gray-400" /></button>
                </span>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-gray-600" style={{ borderColor: '#d8dde4' }}>
                  <ImageIcon className="h-3.5 w-3.5" /> Screenshot
                  <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                </label>
              )}
              <button type="button" onClick={run} disabled={running || (!url && !instruction && !image)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50" style={{ background: PURPLE }}>
                <Sparkles className="h-3.5 w-3.5" /> {running ? 'Generiert…' : 'Generieren'}
              </button>
            </div>

            {err && <p className="text-xs" style={{ color: '#b91c1c' }}>{err}</p>}

            {result && (
              <div className="rounded-lg border p-2" style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: '#15803d' }}>Vorschau</div>
                <div className="max-h-44 overflow-auto text-xs" style={{ color: '#374151' }}>
                  {Object.entries(result).map(([k, v]) => (
                    <div key={k} className="mb-1.5">
                      {Array.isArray(v) ? (
                        <ul className="list-disc pl-4">
                          {v.map((it, i) => (
                            <li key={i}>{typeof it === 'object' && it !== null ? Object.values(it as Record<string, unknown>).map((x) => (Array.isArray(x) ? x.join(', ') : String(x))).join(' · ') : String(it)}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="whitespace-pre-wrap">{String(v)}</span>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={apply}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white" style={{ background: '#16a34a' }}>
                  <Check className="h-3.5 w-3.5" /> Übernehmen
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
