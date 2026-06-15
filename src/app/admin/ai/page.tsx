'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  COLORS, SectionCard, InputField, Button, Field, SelectInput, TextArea, Spinner, Badge,
} from '@/components/admin/ui';
import { Sparkles, Save, Wand2, Link2, Image as ImageIcon, X, Eye } from 'lucide-react';

interface ModuleOpt { key: string; label: string }

export default function AiAdminPage() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [hasKey, setHasKey] = useState(false);
  const [modules, setModules] = useState<ModuleOpt[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // Test-Form
  const [eventName, setEventName] = useState('');
  const [moduleKey, setModuleKey] = useState('intro');
  const [sourceUrl, setSourceUrl] = useState('');
  const [instruction, setInstruction] = useState('');
  const [image, setImage] = useState<{ data: string; mediaType: string; preview: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [resultErr, setResultErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [preview, setPreview] = useState<{ title: string; chars: number; text: string } | null>(null);
  const [status, setStatus] = useState('');

  const flash = (ok: boolean, msg: string) => { setToast({ ok, msg }); setTimeout(() => setToast(null), 5000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        fetch('/api/admin/ai/status').then((r) => r.json()),
        fetch('/api/admin/ai/config').then((r) => r.json()),
      ]);
      if (s.success) { setConfigured(!!s.data.configured); setModules(s.data.modules || []); }
      if (c.success) { setModel(c.data.model || 'claude-sonnet-4-6'); setHasKey(!!c.data.has_api_key); }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, anthropic_api_key: apiKey }),
      });
      const d = await res.json();
      if (d.success) { flash(true, 'KI-Einstellungen gespeichert.'); setApiKey(''); await load(); }
      else flash(false, d.error || 'Speichern fehlgeschlagen.');
    } catch { flash(false, 'Verbindungsfehler.'); } finally { setSaving(false); }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const b64 = res.split(',')[1] || '';
      setImage({ data: b64, mediaType: f.type || 'image/png', preview: res });
    };
    reader.readAsDataURL(f);
  };

  const doFetch = async () => {
    if (!sourceUrl.trim()) return;
    setFetching(true); setPreview(null);
    try {
      const res = await fetch('/api/admin/ai/fetch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: sourceUrl }) });
      const d = await res.json();
      if (d.success) setPreview({ title: d.title, chars: d.chars, text: d.preview });
      else flash(false, d.error || 'Abruf fehlgeschlagen.');
    } catch { flash(false, 'Verbindungsfehler.'); } finally { setFetching(false); }
  };

  const run = async () => {
    setRunning(true); setResult(null); setResultErr(null);
    setStatus(sourceUrl ? 'Seite wird abgerufen & von der KI analysiert…' : 'KI schreibt…');
    try {
      const res = await fetch('/api/admin/ai/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleKey, eventName: eventName || undefined,
          sourceUrl: sourceUrl || undefined, instruction: instruction || undefined,
          image: image ? { data: image.data, mediaType: image.mediaType } : undefined,
        }),
      });
      const d = await res.json();
      if (d.success) setResult(d.data);
      else setResultErr(d.error || 'Fehlgeschlagen.');
    } catch { setResultErr('Verbindungsfehler.'); } finally { setRunning(false); setStatus(''); }
  };

  return (
    <AdminShell title="KI-Redaktion">
      {toast && (
        <div className="mb-5 rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ background: toast.ok ? '#ecfdf5' : '#fef2f2', color: toast.ok ? '#047857' : '#b91c1c', border: `1px solid ${toast.ok ? '#a7f3d0' : '#fecaca'}` }}>
          {toast.msg}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#f3e8ff' }}>
          <Sparkles className="h-5 w-5" style={{ color: '#7c3aed' }} />
        </span>
        <div>
          <div className="text-sm text-gray-500">KI-gestützter Redaktions-Assistent</div>
          {loading ? <Spinner className="h-4 w-4" /> : (
            <Badge tone={configured ? 'ok' : 'muted'}>
              {configured ? `Aktiv · ${model}` : 'Noch kein API-Key hinterlegt'}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Anthropic-Konfiguration" description="Messages-API-Key (sk-ant-…) – wird serverseitig in settings.json gespeichert." icon={<Save className="h-5 w-5" />}
          actions={<Button variant="accent" size="sm" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4 border-white" /> : <Save className="h-4 w-4" />} Speichern</Button>}>
          <div className="grid gap-4">
            <Field label="Modell" hint="Sonnet = empfohlen (ausgewogen). Opus = höchste Qualität. Haiku = schnell & günstig.">
              <SelectInput value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6 — empfohlen (ausgewogen)</option>
                <option value="claude-opus-4-6">Claude Opus 4.6 — höchste Qualität</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 — schnell & günstig</option>
              </SelectInput>
            </Field>
            <InputField label="Anthropic API-Key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? '•••••••• (gesetzt – leer lassen = unverändert)' : 'sk-ant-api03-…'} />
            <p className="text-xs" style={{ color: '#9ca3af' }}>
              Key erstellen unter console.anthropic.com → API Keys. Modelle z.B. <span className="font-mono">claude-sonnet-4-6</span> (Standard) oder <span className="font-mono">claude-opus-4-6</span>.
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Live-Test: Modul-Import" description="URL fetchen, Anweisung geben und/oder Screenshot anhängen – KI erzeugt den Modul-Inhalt." icon={<Wand2 className="h-5 w-5" />}>
          <div className="grid gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InputField label="Event-Name (Kontext)" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="z.B. French Open 2027" />
              <Field label="Modul">
                <SelectInput value={moduleKey} onChange={(e) => setModuleKey(e.target.value)}>
                  {(modules.length ? modules : [{ key: 'intro', label: 'Intro-Text' }]).map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <Field label="Get from URL" hint="Öffentliche Seite, z.B. https://faltintravel.com/french-open-tickets/">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-gray-400" />
                <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://faltintravel.com/…"
                  className="flex-1 rounded-lg border px-3 py-2 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }} />
                <Button variant="secondary" size="sm" onClick={doFetch} disabled={fetching || !sourceUrl.trim()}>
                  {fetching ? <Spinner className="h-4 w-4" /> : <Eye className="h-4 w-4" />} Abrufen
                </Button>
              </div>
            </Field>
            {preview && (
              <div className="rounded-lg border p-3" style={{ borderColor: '#cbd5e1', background: '#f8fafc' }}>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold" style={{ color: COLORS.navy }}>
                    <Eye className="mr-1 -mt-0.5 inline h-3.5 w-3.5" /> Gefetchter Inhalt: {preview.title || '(ohne Titel)'}
                  </span>
                  <span className="text-[11px] text-gray-400">{preview.chars.toLocaleString('de-DE')} Zeichen</span>
                </div>
                <div className="max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-600">{preview.text}{preview.chars > preview.text.length ? ' …' : ''}</div>
                <div className="mt-1.5 text-[11px] text-gray-400">Diesen Text bekommt die KI als Quelle.</div>
              </div>
            )}
            <Field label="Anweisung (optional)" hint="z.B. kürzer und knackiger – oder: ergänze 5 FAQ zu Anreise und Hotel">
              <TextArea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2} placeholder="Freie Anweisung an die KI…" />
            </Field>
            <Field label="Screenshot (optional)" hint="Bild der Quellseite als Zusatzkontext.">
              {image ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.preview} alt="Screenshot" className="h-16 w-24 rounded-lg object-cover border" style={{ borderColor: '#d8dde4' }} />
                  <Button variant="secondary" size="sm" onClick={() => setImage(null)}><X className="h-4 w-4" /> Entfernen</Button>
                </div>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold text-gray-700" style={{ borderColor: '#d8dde4' }}>
                  <ImageIcon className="h-4 w-4" /> Bild wählen
                  <input type="file" accept="image/*" onChange={onFile} className="hidden" />
                </label>
              )}
            </Field>
            <Button variant="accent" onClick={run} disabled={running || !configured}>
              {running ? <Spinner className="h-4 w-4 border-white" /> : <Sparkles className="h-4 w-4" />} Inhalt generieren
            </Button>
            {running && status && <p className="text-xs" style={{ color: '#7c3aed' }}>{status}</p>}
            {!configured && <p className="text-xs" style={{ color: '#b45309' }}>Bitte zuerst einen API-Key speichern.</p>}
          </div>
        </SectionCard>
      </div>

      {(result || resultErr) && (
        <div className="mt-6">
          <SectionCard title="Ergebnis" description="Vorschau der KI-Ausgabe für das Modul." icon={<Sparkles className="h-5 w-5" />}>
            {resultErr ? (
              <p className="text-sm" style={{ color: '#b91c1c' }}>{resultErr}</p>
            ) : (
              <ResultView data={result || {}} />
            )}
          </SectionCard>
        </div>
      )}
    </AdminShell>
  );
}

function ResultView({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  return (
    <div className="grid gap-4">
      {entries.map(([key, val]) => (
        <div key={key}>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: COLORS.navy }}>{key}</div>
          {Array.isArray(val) ? (
            <ul className="space-y-1.5">
              {val.map((item, i) => (
                <li key={i} className="rounded-lg px-3 py-2 text-sm" style={{ background: '#f5f7fa', color: '#33404d' }}>
                  {typeof item === 'object' && item !== null
                    ? Object.entries(item as Record<string, unknown>).map(([k, v]) => (
                        <div key={k}><span className="font-semibold">{k}:</span> {String(v)}</div>
                      ))
                    : String(item)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="whitespace-pre-wrap rounded-lg px-3 py-2 text-sm" style={{ background: '#f5f7fa', color: '#33404d' }}>{String(val)}</p>
          )}
        </div>
      ))}
    </div>
  );
}
