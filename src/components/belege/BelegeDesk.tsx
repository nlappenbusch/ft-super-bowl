'use client';
/**
 * BelegeDesk — Desktop-Ansicht (Admin-Panel und belege.faltintravel.com auf grossem Bildschirm):
 * Status-Reiter, Suche, Mehrfach-Upload per Drag & Drop, Liste + Detail (Original + Editor),
 * Export für die Buchhaltung und Kontierungsregeln.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileUp, Loader2, Search, Settings2, Upload, X } from 'lucide-react';
import ReceiptEditor from './ReceiptEditor';
import { api, uploadReceipt, money, dateCH, fileUrl, STATUS_TONE, type Meta, type Receipt } from './belegeClient';

const NAVY = '#143047';
const ORANGE = '#d9531e';

const TABS: Array<{ key: string; label: string; statuses: string[] }> = [
  { key: 'pruefen', label: 'Zu prüfen', statuses: ['erfasst'] },
  { key: 'offen', label: 'Beim Erfasser', statuses: ['eingang', 'rueckfrage'] },
  { key: 'freigegeben', label: 'Freigegeben', statuses: ['freigegeben'] },
  { key: 'verbucht', label: 'Verbucht', statuses: ['verbucht'] },
  { key: 'verworfen', label: 'Verworfen', statuses: ['verworfen'] },
  { key: 'alle', label: 'Alle', statuses: [] },
];

export default function BelegeDesk() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tab, setTab] = useState('pruefen');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Receipt[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState<string>('');
  const [panel, setPanel] = useState<'' | 'export' | 'regeln'>('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    api.meta().then((m) => {
      setMeta(m);
      if (!m.me.reviewer) setTab('offen');
    }).catch((e) => setErr((e as Error).message));
  }, []);

  const statuses = useMemo(() => TABS.find((t) => t.key === tab)?.statuses || [], [tab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.list({ status: statuses.join(','), q });
      setItems(res.items);
      setCounts(res.counts);
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statuses, q]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const upload = async (files: FileList | File[]) => {
    const list = Array.from(files);
    let last: Receipt | null = null;
    for (let i = 0; i < list.length; i++) {
      setUploading(`${i + 1}/${list.length}: ${list[i].name}`);
      try { last = await uploadReceipt(list[i], list[i].name, 'desktop'); } catch (e) { setErr(`${list[i].name}: ${(e as Error).message}`); }
    }
    setUploading('');
    if (last) { setTab('offen'); setSel(last.id); }
    void load();
  };

  const onChanged = useCallback((r: Receipt) => {
    setItems((it) => it.map((x) => (x.id === r.id ? r : x)));
  }, []);

  if (!meta) {
    return <div className="flex min-h-[40vh] items-center justify-center">{err ? <p className="text-red-600">{err}</p> : <Loader2 className="h-6 w-6 animate-spin text-slate-400" />}</div>;
  }

  const countFor = (t: (typeof TABS)[number]) => t.statuses.length ? t.statuses.reduce((n, s) => n + (counts[s] || 0), 0) : Object.values(counts).reduce((a, b) => a + b, 0);
  const selected = items.find((x) => x.id === sel) || null;
  const sumChf = items.reduce((n, r) => n + (r.amount_chf || 0), 0);

  return (
    <div
      className="relative"
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
    >
      {drag && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-3xl border-4 border-dashed bg-white/80 text-xl font-black" style={{ borderColor: ORANGE, color: ORANGE }}>
          Belege hier ablegen
        </div>
      )}

      {/* Kopfzeile */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm">
          {TABS.filter((t) => meta.me.reviewer || t.key !== 'pruefen').map((t) => {
            const n = countFor(t);
            const active = tab === t.key;
            return (
              <button key={t.key} type="button" onClick={() => { setTab(t.key); setSel(null); }}
                className="rounded-xl px-3 py-1.5 text-sm font-bold transition"
                style={active ? { background: NAVY, color: '#fff' } : { color: NAVY }}>
                {t.label}{n > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-[11px] ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{n}</span>}
              </button>
            );
          })}
        </div>
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lieferant, Nummer, Person, RQ …"
            className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm" />
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-white" style={{ background: ORANGE }}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Belege hochladen
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={(e) => { if (e.target.files) void upload(e.target.files); e.target.value = ''; }} />
        {meta.me.reviewer && (
          <>
            <button type="button" onClick={() => setPanel(panel === 'export' ? '' : 'export')} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold" style={{ color: NAVY }}>
              <Download className="h-4 w-4" /> Export
            </button>
            <button type="button" onClick={() => setPanel(panel === 'regeln' ? '' : 'regeln')} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold" style={{ color: NAVY }}>
              <Settings2 className="h-4 w-4" /> Kontierung
            </button>
          </>
        )}
      </div>
      {uploading && <p className="mb-2 text-xs text-slate-500">Lade hoch: {uploading}</p>}
      {err && <p className="mb-2 text-sm text-red-600">{err}</p>}

      {panel === 'export' && <ExportPanel onClose={() => setPanel('')} onDone={() => void load()} />}
      {panel === 'regeln' && <RulesPanel meta={meta} onClose={() => setPanel('')} onSaved={(r) => setMeta({ ...meta, regeln: r })} />}

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* Liste */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
            <span>{items.length} Belege{loading && ' · lädt …'}</span>
            <span>Summe {money(sumChf)}</span>
          </div>
          {items.length === 0 && !loading && (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              <FileUp className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              Nichts in dieser Ansicht. Belege per Drag & Drop hier ablegen oder mit dem Handy auf belege.faltintravel.com fotografieren.
            </div>
          )}
          <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
            {items.map((r) => {
              const tone = STATUS_TONE[r.status];
              const active = r.id === sel;
              const reading = r.analysis_status === 'laeuft' || r.analysis_status === 'offen';
              return (
                <button key={r.id} type="button" onClick={() => setSel(r.id)}
                  className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50"
                  style={active ? { background: '#fff3ec', boxShadow: `inset 3px 0 0 ${ORANGE}` } : undefined}>
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {r.has_thumb
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={fileUrl(r, true)} alt="" className="h-full w-full object-cover" loading="lazy" />
                      : <span className="flex h-full items-center justify-center">📄</span>}
                    {reading && <span className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="h-4 w-4 animate-spin text-white" /></span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-bold" style={{ color: NAVY }}>{r.supplier || '– Lieferant fehlt –'}</span>
                      {r.duplicate_of && <span className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-800">doppelt?</span>}
                    </div>
                    <div className="truncate text-[11px] text-slate-500">{r.number} · {dateCH(r.receipt_date) || '–'} · {r.created_by_name}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-black tabular-nums" style={{ color: NAVY }}>{r.amount_gross ? money(r.amount_gross, r.currency) : '–'}</div>
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail */}
        <div>
          {selected ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 xl:sticky xl:top-4 xl:h-[calc(100vh-180px)]">
                {selected.file_mime === 'application/pdf'
                  ? <iframe src={fileUrl(selected)} title="Beleg" className="h-[70vh] w-full bg-white xl:h-full" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <a href={fileUrl(selected)} target="_blank" rel="noreferrer"><img src={fileUrl(selected)} alt="Beleg" className="max-h-[70vh] w-full object-contain xl:h-full xl:max-h-none" /></a>}
              </div>
              <div className="min-w-0">
                <ReceiptEditor key={selected.id} id={selected.id} meta={meta} mode="desk" onChanged={onChanged} />
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-sm text-slate-400">
              Beleg links auswählen
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExportPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const [from, setFrom] = useState(iso(first));
  const [to, setTo] = useState(iso(last));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const book = async () => {
    if (!confirm('Freigegebene Belege im Zeitraum als CSV exportieren und als «verbucht» markieren?')) return;
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/belege/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Fehler ${res.status}`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Belege_Faltin_${from}_${to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg('Exportiert und als verbucht markiert.');
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black" style={{ color: NAVY }}>Export für die Buchhaltung</h3>
        <button type="button" onClick={onClose} className="text-slate-400" aria-label="Schliessen"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-500">Belegdatum von<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-0.5 block rounded-xl border border-slate-200 px-2 py-1.5 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-500">bis<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-0.5 block rounded-xl border border-slate-200 px-2 py-1.5 text-sm" /></label>
        <a href={`/api/admin/belege/export?from=${from}&to=${to}&status=freigegeben,verbucht`} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" style={{ color: NAVY }}>CSV ansehen (ohne Markieren)</a>
        <button type="button" disabled={busy} onClick={() => void book()} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: ORANGE }}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Exportieren & als verbucht markieren
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">CSV mit Soll/Haben, CHF-Betrag, Fremdwährung, MWST und eigener Vorsteuer-Zeile (Semikolon, für Excel/Banana/Abacus). {msg && <b className="ml-1" style={{ color: NAVY }}>{msg}</b>}</p>
    </div>
  );
}

function RulesPanel({ meta, onClose, onSaved }: { meta: Meta; onClose: () => void; onSaved: (r: Meta['regeln']) => void }) {
  const [r, setR] = useState(meta.regeln);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const konto = (field: 'firmenkarte' | 'bar' | 'privat' | 'privat_gesellschafter', label: string, hint: string) => (
    <label className="block">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <select value={r[field]} onChange={(e) => setR({ ...r, [field]: e.target.value })} className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm">
        {meta.konten.filter((k) => /^[12]/.test(k.nr)).map((k) => <option key={k.nr} value={k.nr}>{k.nr} {k.name}</option>)}
      </select>
      <span className="text-[11px] text-slate-400">{hint}</span>
    </label>
  );
  const save = async () => {
    setBusy(true);
    try { const res = await api.saveRules(r); onSaved(res.regeln); setMsg('Gespeichert.'); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black" style={{ color: NAVY }}>Kontierung</h3>
        <button type="button" onClick={onClose} className="text-slate-400" aria-label="Schliessen"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {konto('firmenkarte', 'Firmenkarte → Gegenkonto', 'Kreditkarten-Abrechnungskonto')}
        {konto('bar', 'Bar (Kasse)', 'Kasse')}
        {konto('privat', 'Privat ausgelegt (Mitarbeitende)', 'Rückerstattung an Mitarbeitende')}
        {konto('privat_gesellschafter', 'Privat ausgelegt (Gesellschafter)', 'Kontokorrent Gesellschafter')}
      </div>
      <label className="mt-3 block">
        <span className="text-xs font-semibold text-slate-500">Gesellschafter (E-Mail, kommagetrennt)</span>
        <input value={r.gesellschafter_emails.join(', ')} onChange={(e) => setR({ ...r, gesellschafter_emails: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
          className="mt-0.5 w-full rounded-xl border border-slate-200 px-2 py-1.5 text-sm" />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl px-3 py-2 text-sm font-bold text-white disabled:opacity-50" style={{ background: ORANGE }}>Speichern</button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-bold" style={{ color: NAVY }}>Kategorien → Konten</summary>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-xs text-slate-500"><th className="py-1">Kategorie</th><th>Konto Inland</th><th>Konto Ausland</th></tr></thead>
          <tbody>
            {meta.kategorien.map((k) => (
              <tr key={k.key} className="border-t border-slate-100">
                <td className="py-1.5">{k.emoji} {k.label}</td>
                <td>{k.konto} {meta.konten.find((x) => x.nr === k.konto)?.name}</td>
                <td>{k.kontoAusland ? `${k.kontoAusland} ${meta.konten.find((x) => x.nr === k.kontoAusland)?.name || ''}` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">Kontenplan Faltin Travel AG (Stand Treuhand). Einzelne Belege lassen sich in der Detailansicht abweichend kontieren.</p>
      </details>
    </div>
  );
}
