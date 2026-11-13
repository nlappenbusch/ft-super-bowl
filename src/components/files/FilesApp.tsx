'use client';

/**
 * FilesApp — Faltin Files: Dateien hochladen, Link teilen, Ablauf verwalten.
 * Wird in /admin/files (AdminShell) und auf files.faltintravel.com (/files) genutzt.
 *
 * Ablauf für Nutzer:innen: Dateien reinziehen → Ablauf wählen (Standard 30 Tage)
 * → "Hochladen & Link erstellen" → Link ist kopiert. Unten alle Freigaben des Teams
 * mit Restlaufzeit, Verlängern, Löschen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CloudUpload, Link2, Copy, Check, Trash2, CalendarClock, Download, Lock, Mail, Search, X, Plus,
  FileText, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet, File as FileIcon, Presentation,
  ChevronDown, LoaderCircle, ExternalLink, ShieldCheck, HardDrive, Pencil, TriangleAlert,
} from 'lucide-react';
import { fmtAgo, fmtBytes, fmtDate, fmtDateTime, expiryInfo, fileKind, type ExpiryTone } from './filesFormat';

const NAVY = '#143047';
const ACCENT = '#d9531e';

// ───────────────────────── Typen ─────────────────────────

interface Item { id: string; share_id: string; name: string; mime: string; size: number; received: number; complete: boolean; downloads: number; created_at: string }
interface Share {
  id: string; token: string; title: string; message: string;
  created_by: string; created_by_name: string; created_by_email: string;
  has_password: boolean; expires_at: string; deleted_at: string | null; deleted_by: string;
  downloads: number; last_download_at: string | null; created_at: string; updated_at: string;
  url: string; items: Item[]; total_size: number;
}
interface Config { default_days: number; max_days: number; presets: number[]; max_file_bytes: number; chunk_bytes: number; free_bytes: number | null }
interface Me { id: string; name: string; email?: string }

type Expiry = { kind: 'days'; days: number } | { kind: 'date'; date: string };

// ───────────────────────── Upload-Helfer ─────────────────────────

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
  const d = await r.json().catch(() => ({ success: false, error: `HTTP ${r.status}` }));
  if (!r.ok || !d.success) throw new Error(d.error || `HTTP ${r.status}`);
  return d.data as T;
}

function putChunk(url: string, blob: Blob, onProgress: (loaded: number) => void, signal: { aborted: boolean; xhr?: XMLHttpRequest }): Promise<{ received: number; complete: boolean }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    signal.xhr = xhr;
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let d: { success?: boolean; data?: { received: number; complete: boolean }; error?: string; received?: number } = {};
      try { d = JSON.parse(xhr.responseText); } catch { /* */ }
      if (xhr.status === 409 && typeof d.received === 'number') return resolve({ received: d.received, complete: false });
      if (xhr.status >= 200 && xhr.status < 300 && d.success && d.data) return resolve(d.data);
      const err = new Error(d.error || `HTTP ${xhr.status}`) as Error & { fatal?: boolean };
      err.fatal = xhr.status === 401 || xhr.status === 404 || xhr.status === 410 || xhr.status === 413;
      reject(err);
    };
    xhr.onerror = () => reject(new Error('Verbindung unterbrochen'));
    xhr.onabort = () => reject(new Error('Abgebrochen'));
    xhr.send(blob);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Lädt Dateien in eine bestehende Freigabe; ruft onProgress(gesamtGeladen) auf. */
async function uploadInto(shareId: string, files: File[], chunk: number, onProgress: (loaded: number, fileIndex: number) => void, signal: { aborted: boolean; xhr?: XMLHttpRequest }) {
  let doneBytes = 0;
  for (let fi = 0; fi < files.length; fi++) {
    const f = files[fi];
    if (signal.aborted) throw new Error('Abgebrochen');
    const item = await api<Item>(`/api/admin/files/${shareId}/items`, {
      method: 'POST', body: JSON.stringify({ name: f.name, size: f.size, mime: f.type || 'application/octet-stream' }),
    });
    let offset = 0;
    let tries = 0;
    while (offset < f.size) {
      if (signal.aborted) throw new Error('Abgebrochen');
      const end = Math.min(f.size, offset + chunk);
      try {
        const r = await putChunk(`/api/files/chunk/${item.id}?offset=${offset}`, f.slice(offset, end), (l) => onProgress(doneBytes + offset + l, fi), signal);
        offset = r.received;
        tries = 0;
        onProgress(doneBytes + offset, fi);
      } catch (e) {
        if (signal.aborted || (e as { fatal?: boolean }).fatal || ++tries > 6) throw e;
        await sleep(Math.min(15000, 800 * 2 ** tries));
      }
    }
    doneBytes += f.size;
    onProgress(doneBytes, fi);
  }
}

async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
}

function mailtoFor(share: Share): string {
  const subject = share.title ? `Dateien: ${share.title}` : 'Dateien von Faltin Travel';
  const files = share.items.filter((i) => i.complete).map((i) => `• ${i.name} (${fmtBytes(i.size)})`).join('\n');
  const body = [
    'Guten Tag', '',
    'hier finden Sie die Dateien zum Herunterladen:', share.url, '',
    files, '',
    `Der Link ist gültig bis ${fmtDate(share.expires_at)}.`,
    share.has_password ? 'Das Passwort erhalten Sie separat.' : '',
    '', 'Freundliche Grüsse', '',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function expiryPayload(e: Expiry): { days?: number; expires_at?: string } {
  return e.kind === 'days' ? { days: e.days } : { expires_at: e.date };
}

// ───────────────────────── Kleine Bausteine ─────────────────────────

function KindIcon({ name, mime, className = 'h-5 w-5' }: { name: string; mime?: string; className?: string }) {
  const k = fileKind(name, mime);
  const map = { image: FileImage, pdf: FileText, video: FileVideo, audio: FileAudio, archive: FileArchive, sheet: FileSpreadsheet, slides: Presentation, doc: FileText, other: FileIcon };
  const color = { image: '#7c3aed', pdf: '#dc2626', video: '#0891b2', audio: '#db2777', archive: '#a16207', sheet: '#16a34a', slides: '#ea580c', doc: '#2563eb', other: '#64748b' }[k];
  const I = map[k];
  return <I className={className} style={{ color }} />;
}

const TONE: Record<ExpiryTone, { bg: string; fg: string; dot: string }> = {
  ok: { bg: '#ecfdf5', fg: '#047857', dot: '#10b981' },
  soon: { bg: '#fffbeb', fg: '#b45309', dot: '#f59e0b' },
  urgent: { bg: '#fef2f2', fg: '#b91c1c', dot: '#ef4444' },
  gone: { bg: '#f1f5f9', fg: '#64748b', dot: '#94a3b8' },
};

function ExpiryPill({ iso }: { iso: string }) {
  const e = expiryInfo(iso);
  const t = TONE[e.tone];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap" style={{ background: t.bg, color: t.fg }} title={`Wird am ${fmtDateTime(iso)} automatisch gelöscht`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
      {e.label}
    </span>
  );
}

/** Schnellwahl der Aufbewahrung: Chips + eigenes Datum. */
function ExpiryPicker({ value, onChange, presets, maxDays }: { value: Expiry; onChange: (e: Expiry) => void; presets: number[]; maxDays: number }) {
  const dateRef = useRef<HTMLInputElement>(null);
  const isDate = value.kind === 'date';
  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((d) => {
        const active = value.kind === 'days' && value.days === d;
        return (
          <button key={d} type="button" onClick={() => onChange({ kind: 'days', days: d })}
            className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition"
            style={active ? { background: NAVY, color: '#fff' } : { background: '#f1f5f9', color: NAVY }}>
            {d} Tage
          </button>
        );
      })}
      <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition"
        style={isDate ? { background: NAVY, color: '#fff' } : { background: '#f1f5f9', color: NAVY }}
        onClick={() => { try { dateRef.current?.showPicker(); } catch { dateRef.current?.focus(); } }}>
        <CalendarClock className="h-4 w-4" />
        {isDate ? `bis ${fmtDate(`${value.date}T12:00:00`)}` : 'Datum wählen'}
        <input ref={dateRef} type="date" className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          min={todayPlus(1)} max={todayPlus(maxDays)} value={isDate ? value.date : ''}
          onChange={(e) => e.target.value && onChange({ kind: 'date', date: e.target.value })} />
      </label>
    </div>
  );
}

function CopyButton({ text, label = 'Link kopieren', primary = false }: { text: string; label?: string; primary?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button"
      onClick={async () => { if (await copyText(text)) { setOk(true); setTimeout(() => setOk(false), 1800); } }}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition"
      style={primary ? { background: ACCENT, color: '#fff' } : { background: '#f1f5f9', color: NAVY }}>
      {ok ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {ok ? 'Kopiert' : label}
    </button>
  );
}

// ───────────────────────── Hauptkomponente ─────────────────────────

export default function FilesApp() {
  const [shares, setShares] = useState<Share[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Neue Freigabe
  const [picked, setPicked] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const [expiry, setExpiry] = useState<Expiry>({ kind: 'days', days: 30 });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0, file: 0 });
  const [created, setCreated] = useState<Share | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const signalRef = useRef<{ aborted: boolean; xhr?: XMLHttpRequest }>({ aborted: false });
  const inputRef = useRef<HTMLInputElement>(null);

  // Liste
  const [query, setQuery] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/files').then((x) => x.json());
      if (!r.success) throw new Error(r.error || 'Laden fehlgeschlagen');
      setShares(r.data); setConfig(r.config); setMe(r.me); setError(null);
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Restlaufzeiten aktuell halten
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);

  // Warnung beim Verlassen während des Uploads
  useEffect(() => {
    if (!uploading) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [uploading]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => f.size > 0 || f.name);
    if (!arr.length) return;
    setCreated(null);
    setPicked((cur) => {
      const seen = new Set(cur.map((f) => `${f.name}:${f.size}`));
      return [...cur, ...arr.filter((f) => !seen.has(`${f.name}:${f.size}`))];
    });
  };

  // Ganze Seite als Drop-Ziel
  useEffect(() => {
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes('Files')) { e.preventDefault(); setDragOver(true); } };
    const leave = (e: DragEvent) => { if (!e.relatedTarget) setDragOver(false); };
    const drop = (e: DragEvent) => { if (e.dataTransfer?.files?.length) { e.preventDefault(); setDragOver(false); if (!uploading) addFiles(e.dataTransfer.files); } };
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop);
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop); };
  }, [uploading]);

  const totalPicked = picked.reduce((s, f) => s + f.size, 0);
  const tooBig = config ? picked.filter((f) => f.size > config.max_file_bytes) : [];

  const resetForm = () => { setPicked([]); setTitle(''); setMessage(''); setPassword(''); setShowOptions(false); setExpiry({ kind: 'days', days: config?.default_days || 30 }); };

  const startUpload = async () => {
    if (!picked.length || !config || tooBig.length) return;
    setUploading(true); setError(null);
    signalRef.current = { aborted: false };
    setProgress({ loaded: 0, total: totalPicked, file: 0 });
    let share: Share | null = null;
    try {
      share = await api<Share>('/api/admin/files', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || (picked.length === 1 ? picked[0].name : `${picked[0].name} + ${picked.length - 1} weitere`),
          message, password: password || undefined, ...expiryPayload(expiry),
        }),
      });
      await uploadInto(share.id, picked, config.chunk_bytes, (loaded, file) => setProgress({ loaded, total: totalPicked, file }), signalRef.current);
      const fresh = await api<Share[]>('/api/admin/files').catch(() => null);
      const done = fresh?.find((s) => s.id === share!.id) || share;
      setCreated(done);
      copyText(done.url);
      resetForm();
      load();
    } catch (e) {
      if (share) fetch(`/api/admin/files/${share.id}`, { method: 'DELETE' }).catch(() => {});
      setError(signalRef.current.aborted ? 'Upload abgebrochen.' : `Upload fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setUploading(false);
    }
  };

  const cancelUpload = () => { signalRef.current.aborted = true; signalRef.current.xhr?.abort(); };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shares.filter((s) => {
      if (onlyMine && me && s.created_by !== me.id) return false;
      if (!q) return true;
      return [s.title, s.message, s.created_by_name, ...s.items.map((i) => i.name)].join(' ').toLowerCase().includes(q);
    });
  }, [shares, query, onlyMine, me]);

  // Erfolgsbanner zeigt immer den aktuellen Stand (z. B. nach Verlängern); weg, wenn gelöscht.
  const createdLive = created ? shares.find((s) => s.id === created.id) || (loading ? created : null) : null;
  const soonCount = shares.filter((s) => expiryInfo(s.expires_at).tone !== 'ok').length;
  const totalStored = shares.reduce((s, x) => s + x.total_size, 0);
  const pct = progress.total ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Drag-Overlay */}
      {dragOver && !uploading && (
        <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(20,48,71,0.55)' }}>
          <div className="rounded-3xl border-4 border-dashed border-white/80 px-16 py-12 text-center text-white">
            <CloudUpload className="mx-auto mb-3 h-14 w-14" />
            <div className="text-2xl font-bold">Loslassen zum Hinzufügen</div>
          </div>
        </div>
      )}

      {/* ── Neue Freigabe ── */}
      <section className="overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid #e5e8ed', boxShadow: '0 1px 3px rgba(20,48,71,0.06)' }}>
        {createdLive && (
          <div className="border-b p-5 sm:p-6" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: '#16a34a' }}>
                <Check className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-bold" style={{ color: NAVY }}>Link ist bereit – und schon kopiert.</div>
                <div className="mt-0.5 text-sm text-slate-600">
                  {createdLive.items.length} {createdLive.items.length === 1 ? 'Datei' : 'Dateien'} · {fmtBytes(createdLive.total_size)} · gültig bis {fmtDate(createdLive.expires_at)}
                  {createdLive.has_password && ' · mit Passwort'}
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input readOnly value={createdLive.url} onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 font-mono text-sm" style={{ borderColor: '#bbf7d0', color: NAVY }} />
                  <div className="flex flex-wrap gap-2">
                    <CopyButton text={createdLive.url} primary />
                    <a href={mailtoFor(createdLive)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#fff', color: NAVY, border: '1px solid #e5e8ed' }}>
                      <Mail className="h-4 w-4" /> Per E-Mail
                    </a>
                    <a href={createdLive.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#fff', color: NAVY, border: '1px solid #e5e8ed' }}>
                      <ExternalLink className="h-4 w-4" /> Ansehen
                    </a>
                  </div>
                </div>
              </div>
              <button onClick={() => setCreated(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white" aria-label="Schliessen"><X className="h-4 w-4" /></button>
            </div>
          </div>
        )}

        <div className="p-5 sm:p-6">
          {!picked.length && !uploading ? (
            <button type="button" onClick={() => inputRef.current?.click()}
              className="group flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition hover:bg-slate-50"
              style={{ borderColor: '#cbd5e1' }}>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition group-hover:scale-105" style={{ background: '#fdf0ea' }}>
                <CloudUpload className="h-8 w-8" style={{ color: ACCENT }} />
              </div>
              <div className="text-lg font-bold" style={{ color: NAVY }}>Dateien hierher ziehen</div>
              <div className="mt-1 text-sm text-slate-500">oder <span className="font-semibold underline" style={{ color: ACCENT }}>vom Computer auswählen</span> · bis {config ? fmtBytes(config.max_file_bytes) : '20 GB'} pro Datei</div>
            </button>
          ) : (
            <div className="space-y-5">
              {/* Dateiliste */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-semibold" style={{ color: NAVY }}>
                    {picked.length} {picked.length === 1 ? 'Datei' : 'Dateien'} · {fmtBytes(totalPicked)}
                  </div>
                  {!uploading && (
                    <button onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: ACCENT }}>
                      <Plus className="h-4 w-4" /> weitere
                    </button>
                  )}
                </div>
                <ul className="max-h-64 divide-y divide-slate-100 overflow-auto rounded-xl border" style={{ borderColor: '#e5e8ed' }}>
                  {picked.map((f, i) => (
                    <li key={`${f.name}:${f.size}:${i}`} className="flex items-center gap-3 px-3 py-2.5">
                      <KindIcon name={f.name} mime={f.type} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium" style={{ color: NAVY }}>{f.name}</div>
                        <div className={`text-xs ${config && f.size > config.max_file_bytes ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                          {fmtBytes(f.size)}{config && f.size > config.max_file_bytes ? ' – zu gross' : ''}
                        </div>
                      </div>
                      {uploading ? (
                        i < progress.file ? <Check className="h-4 w-4 text-green-600" /> : i === progress.file ? <LoaderCircle className="h-4 w-4 animate-spin" style={{ color: ACCENT }} /> : null
                      ) : (
                        <button onClick={() => setPicked((c) => c.filter((_, j) => j !== i))} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Entfernen"><X className="h-4 w-4" /></button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {!uploading && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold" style={{ color: NAVY }}>Bezeichnung <span className="font-normal text-slate-400">(optional)</span></label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
                      placeholder={picked.length === 1 ? picked[0].name : 'z. B. Reiseunterlagen Málaga 2027'}
                      className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2" style={{ borderColor: '#e5e8ed', color: NAVY }} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold" style={{ color: NAVY }}>Automatisch löschen nach</label>
                    <ExpiryPicker value={expiry} onChange={setExpiry} presets={config?.presets || [7, 14, 30, 90]} maxDays={config?.max_days || 365} />
                  </div>

                  <div>
                    <button type="button" onClick={() => setShowOptions((v) => !v)} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900">
                      <ChevronDown className={`h-4 w-4 transition ${showOptions ? 'rotate-180' : ''}`} />
                      Nachricht & Passwort
                      {(message || password) && <span className="ml-1 h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />}
                    </button>
                    {showOptions && (
                      <div className="mt-3 grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold" style={{ color: NAVY }}>Nachricht an Empfänger</label>
                          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={2000}
                            placeholder="Erscheint auf der Download-Seite"
                            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2" style={{ borderColor: '#e5e8ed', color: NAVY }} />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold" style={{ color: NAVY }}>Passwort</label>
                          <input value={password} onChange={(e) => setPassword(e.target.value)} type="text" autoComplete="off"
                            placeholder="leer = ohne Passwort"
                            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2" style={{ borderColor: '#e5e8ed', color: NAVY }} />
                          <p className="mt-1 text-xs text-slate-500">Passwort am besten separat (z. B. per SMS) mitteilen.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {uploading && (
                <div>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="font-semibold" style={{ color: NAVY }}>Wird hochgeladen … {pct}%</span>
                    <span className="text-slate-500">{fmtBytes(progress.loaded)} von {fmtBytes(progress.total)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ACCENT }} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Fenster bitte offen lassen. Kurze Verbindungsabbrüche werden automatisch überbrückt.</p>
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {uploading ? (
                  <button onClick={cancelUpload} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Abbrechen</button>
                ) : (
                  <button onClick={resetForm} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Verwerfen</button>
                )}
                <button onClick={startUpload} disabled={uploading || !!tooBig.length}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-sm transition disabled:opacity-60"
                  style={{ background: ACCENT }}>
                  {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {uploading ? 'Lädt hoch …' : 'Hochladen & Link erstellen'}
                </button>
              </div>
            </div>
          )}
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: '#fef2f2', color: '#b91c1c' }}>
              <TriangleAlert className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>
      </section>

      {/* ── Freigaben des Teams ── */}
      <section>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: NAVY }}>Geteilte Dateien</h2>
            <p className={`text-sm text-slate-500 ${loading ? 'invisible' : ''}`}>
              {shares.length} aktive {shares.length === 1 ? 'Freigabe' : 'Freigaben'} · {fmtBytes(totalStored)}
              {soonCount > 0 && <> · <span className="font-semibold text-amber-700">{soonCount} {soonCount === 1 ? 'läuft' : 'laufen'} bald ab</span></>}
              {config?.free_bytes != null && <span className="hidden sm:inline"> · <HardDrive className="inline h-3.5 w-3.5 -mt-0.5" /> {fmtBytes(config.free_bytes)} frei</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen …"
                className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:ring-2" style={{ borderColor: '#e5e8ed', color: NAVY }} />
            </div>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm font-semibold">
              {[{ v: false, l: 'Alle' }, { v: true, l: 'Meine' }].map((o) => (
                <button key={o.l} onClick={() => setOnlyMine(o.v)} className="rounded-md px-3 py-1.5 transition"
                  style={onlyMine === o.v ? { background: '#fff', color: NAVY, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' } : { color: '#64748b' }}>{o.l}</button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-slate-400" /></div>
        ) : !filtered.length ? (
          <div className="rounded-2xl border border-dashed bg-white px-6 py-14 text-center" style={{ borderColor: '#e5e8ed' }}>
            <Link2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
            <div className="font-semibold" style={{ color: NAVY }}>{shares.length ? 'Nichts gefunden' : 'Noch keine geteilten Dateien'}</div>
            <div className="text-sm text-slate-500">{shares.length ? 'Suche oder Filter anpassen.' : 'Oben Dateien reinziehen – der Link ist in Sekunden bereit.'}</div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((s) => (
              <ShareRow key={s.id} share={s} open={openId === s.id} onToggle={() => setOpenId(openId === s.id ? null : s.id)}
                config={config} onChanged={load} mine={!!me && s.created_by === me.id} />
            ))}
          </ul>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" /> Abgelaufene Freigaben werden automatisch endgültig gelöscht. Alle Mitarbeitenden sehen alle Freigaben.
        </p>
      </section>
    </div>
  );
}

// ───────────────────────── Eine Freigabe ─────────────────────────

function ShareRow({ share, open, onToggle, config, onChanged, mine }: {
  share: Share; open: boolean; onToggle: () => void; config: Config | null; onChanged: () => void; mine: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(share.title);
  const [message, setMessage] = useState(share.message);
  const [pw, setPw] = useState('');
  const [addProgress, setAddProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expiryOpen) return;
    const h = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setExpiryOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [expiryOpen]);

  const patch = async (body: Record<string, unknown>, tag: string) => {
    setBusy(tag); setErr(null);
    try { await api(`/api/admin/files/${share.id}`, { method: 'PATCH', body: JSON.stringify(body) }); onChanged(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const remove = async () => {
    setBusy('delete');
    try { await api(`/api/admin/files/${share.id}`, { method: 'DELETE' }); onChanged(); }
    catch (e) { setErr((e as Error).message); setBusy(null); }
  };

  const removeItem = async (itemId: string) => {
    setBusy(`item:${itemId}`);
    try { await api(`/api/admin/files/${share.id}/items/${itemId}`, { method: 'DELETE' }); onChanged(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  const addFiles = async (list: FileList | null) => {
    if (!list?.length || !config) return;
    const files = Array.from(list);
    const total = files.reduce((s, f) => s + f.size, 0);
    setAddProgress(0); setErr(null);
    try {
      await uploadInto(share.id, files, config.chunk_bytes, (l) => setAddProgress(total ? Math.round((l / total) * 100) : 100), { aborted: false });
    } catch (e) { setErr((e as Error).message); }
    setAddProgress(null); onChanged();
  };

  const label = share.title || share.items[0]?.name || 'Ohne Bezeichnung';
  const complete = share.items.filter((i) => i.complete);
  const presets = config?.presets || [7, 14, 30, 90];

  return (
    <li className="rounded-2xl bg-white transition" style={{ border: `1px solid ${open ? '#cbd5e1' : '#e5e8ed'}`, boxShadow: open ? '0 4px 14px rgba(20,48,71,0.08)' : '0 1px 2px rgba(20,48,71,0.04)' }}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <button onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: '#f1f5f9' }}>
            {complete.length === 1 ? <KindIcon name={complete[0].name} mime={complete[0].mime} className="h-5 w-5" /> : <span className="text-sm font-bold" style={{ color: NAVY }}>{complete.length}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold" style={{ color: NAVY }}>{label}</span>
              {share.has_password && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-label="mit Passwort" />}
            </div>
            <div className="truncate text-xs text-slate-500">
              {complete.length} {complete.length === 1 ? 'Datei' : 'Dateien'} · {fmtBytes(share.total_size)} · {mine ? 'von dir' : `von ${share.created_by_name}`} · {fmtAgo(share.created_at)}
              {share.downloads > 0 && <> · <Download className="inline h-3 w-3 -mt-0.5" /> {share.downloads}×</>}
            </div>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="relative" ref={popRef}>
            <button onClick={() => setExpiryOpen((v) => !v)} className="rounded-full" title="Ablauf ändern">
              <ExpiryPill iso={share.expires_at} />
            </button>
            {expiryOpen && (
              <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl bg-white p-4 shadow-xl" style={{ border: '1px solid #e5e8ed' }}>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Wird gelöscht am</div>
                <div className="mb-3 text-sm font-bold" style={{ color: NAVY }}>{fmtDateTime(share.expires_at)}</div>
                <div className="mb-1.5 text-xs font-semibold text-slate-500">Verlängern um</div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {presets.map((d) => (
                    <button key={d} disabled={!!busy} onClick={() => { patch({ extend_days: d }, 'exp'); setExpiryOpen(false); }}
                      className="rounded-full px-3 py-1 text-sm font-semibold hover:opacity-90" style={{ background: '#f1f5f9', color: NAVY }}>+{d} T.</button>
                  ))}
                </div>
                <div className="mb-1.5 text-xs font-semibold text-slate-500">Oder genaues Datum</div>
                <input type="date" min={todayPlus(1)} max={todayPlus(config?.max_days || 365)} defaultValue={share.expires_at.slice(0, 10)}
                  onChange={(e) => { if (e.target.value) { patch({ expires_at: e.target.value }, 'exp'); setExpiryOpen(false); } }}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#e5e8ed', color: NAVY }} />
                <p className="mt-2 text-xs text-slate-500">Auch kürzer möglich – z. B. morgen.</p>
              </div>
            )}
          </div>
          <CopyButton text={share.url} label="Link" />
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={remove} disabled={busy === 'delete'} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-white" style={{ background: '#dc2626' }}>
                {busy === 'delete' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Endgültig löschen
              </button>
              <button onClick={() => setConfirmDelete(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Abbrechen"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Jetzt löschen" aria-label="Jetzt löschen">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={onToggle} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Details">
            <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {err && <div className="mx-4 mb-3 rounded-lg px-3 py-2 text-sm" style={{ background: '#fef2f2', color: '#b91c1c' }}>{err}</div>}

      {open && (
        <div className="space-y-4 border-t px-4 pb-4 pt-4" style={{ borderColor: '#eef1f5' }}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input readOnly value={share.url} onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border bg-slate-50 px-3 py-2 font-mono text-xs" style={{ borderColor: '#e5e8ed', color: NAVY }} />
            <div className="flex gap-2">
              <a href={mailtoFor(share)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#f1f5f9', color: NAVY }}><Mail className="h-4 w-4" /> Per E-Mail</a>
              <a href={share.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: '#f1f5f9', color: NAVY }}><ExternalLink className="h-4 w-4" /> Ansehen</a>
            </div>
          </div>

          <ul className="divide-y divide-slate-100 rounded-xl border" style={{ borderColor: '#e5e8ed' }}>
            {share.items.map((it) => (
              <li key={it.id} className="flex items-center gap-3 px-3 py-2.5">
                <KindIcon name={it.name} mime={it.mime} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium" style={{ color: NAVY }}>{it.name}</div>
                  <div className="text-xs text-slate-500">
                    {fmtBytes(it.size)}{!it.complete && ` · unvollständig (${fmtBytes(it.received)})`}{it.downloads > 0 && ` · ${it.downloads}× geladen`}
                  </div>
                </div>
                {it.complete && (
                  <a href={`/api/admin/files/${share.id}/items/${it.id}`} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Herunterladen"><Download className="h-4 w-4" /></a>
                )}
                <button onClick={() => removeItem(it.id)} disabled={busy === `item:${it.id}`} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Datei entfernen">
                  {busy === `item:${it.id}` ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                </button>
              </li>
            ))}
            <li className="px-3 py-2.5">
              {addProgress !== null ? (
                <div className="flex items-center gap-3 text-sm" style={{ color: NAVY }}>
                  <LoaderCircle className="h-4 w-4 animate-spin" style={{ color: ACCENT }} /> Lädt hoch … {addProgress}%
                </div>
              ) : (
                <button onClick={() => addRef.current?.click()} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: ACCENT }}>
                  <Plus className="h-4 w-4" /> Dateien hinzufügen
                </button>
              )}
              <input ref={addRef} type="file" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            </li>
          </ul>

          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1 text-slate-600">
              <div><span className="text-slate-400">Erstellt:</span> {fmtDateTime(share.created_at)} von {share.created_by_name}</div>
              <div><span className="text-slate-400">Löschung:</span> {fmtDateTime(share.expires_at)}</div>
              <div><span className="text-slate-400">Abrufe:</span> {share.downloads}{share.last_download_at && ` · zuletzt ${fmtAgo(share.last_download_at)}`}</div>
            </div>
            <div className="space-y-2">
              {editing ? (
                <div className="space-y-2">
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bezeichnung" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#e5e8ed', color: NAVY }} />
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} placeholder="Nachricht an Empfänger" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#e5e8ed', color: NAVY }} />
                  <div className="flex gap-2">
                    <button onClick={async () => { await patch({ title, message }, 'edit'); setEditing(false); }} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white" style={{ background: NAVY }}>Speichern</button>
                    <button onClick={() => { setEditing(false); setTitle(share.title); setMessage(share.message); }} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Abbrechen</button>
                  </div>
                </div>
              ) : (
                <>
                  {share.message && <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700 whitespace-pre-line">{share.message}</div>}
                  <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900"><Pencil className="h-3.5 w-3.5" /> Bezeichnung & Nachricht bearbeiten</button>
                </>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {share.has_password ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-sm text-slate-600"><Lock className="h-3.5 w-3.5" /> Passwortgeschützt</span>
                    <button onClick={() => patch({ password: null }, 'pw')} className="text-sm font-semibold text-slate-500 underline hover:text-slate-800">entfernen</button>
                  </>
                ) : null}
                <input value={pw} onChange={(e) => setPw(e.target.value)} placeholder={share.has_password ? 'neues Passwort' : 'Passwort setzen'} autoComplete="off"
                  className="w-40 rounded-lg border px-2.5 py-1.5 text-sm" style={{ borderColor: '#e5e8ed', color: NAVY }} />
                <button disabled={!pw.trim() || busy === 'pw'} onClick={async () => { await patch({ password: pw }, 'pw'); setPw(''); }}
                  className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-40" style={{ background: '#f1f5f9', color: NAVY }}>Setzen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
