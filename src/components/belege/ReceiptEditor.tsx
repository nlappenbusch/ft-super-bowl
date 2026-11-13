'use client';
/**
 * ReceiptEditor — Erfassen/Bearbeiten eines Belegs. Eine Komponente für Handy und Desktop:
 *   mode="mobile": grosse Tasten, Vorschlags-Chips, Foto oben mit Scan-Animation
 *   mode="desk":   zusätzlich Buchhaltung (Konten, MWST-Zeilen, CHF-Betrag), Freigabe, Verlauf
 * Speichert automatisch (kurz nach jeder Änderung). Während die Analyse läuft, füllt sie leere
 * Felder nach – was die Person schon angefasst hat, bleibt unangetastet.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronRight, Loader2, Search, Sparkles, X, AlertTriangle, RotateCcw, Trash2, ExternalLink,
  MessageCircleQuestion, ShieldCheck, Undo2, Plus, Download,
} from 'lucide-react';
import { api, money, dateCH, todayIso, fileUrl, STATUS_TONE, type Detail, type Meta, type Receipt, type AssocCandidate, type PointsBreakdown } from './belegeClient';
import { vatFromGross, missingFields, missingForApproval, round2, totalVat, type VatLine } from '@/lib/belege/model';

type Form = Record<string, unknown>;

const FORM_KEYS = [
  'supplier', 'amount_gross', 'currency', 'receipt_date', 'category', 'payment', 'vat_lines', 'description', 'notes',
  'event_slug', 'booking_id', 'booking_ref', 'country', 'invoice_no', 'supplier_vat_id', 'account', 'contra_account',
  'vat_account', 'amount_chf',
] as const;

const NAVY = '#143047';
const ORANGE = '#d9531e';
const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP'];
const VAT_CHIPS = [8.1, 2.6, 3.8, 0];

function pickForm(r: Receipt): Form {
  const f: Form = {};
  for (const k of FORM_KEYS) f[k] = (r as unknown as Record<string, unknown>)[k];
  return f;
}

export interface SubmittedInfo { receipt: Receipt; points: PointsBreakdown; cheer: { text: string; emoji: string } }

export default function ReceiptEditor({
  id, meta, mode, onClose, onChanged, onSubmitted,
}: {
  id: string;
  meta: Meta;
  mode: 'mobile' | 'desk';
  onClose?: () => void;
  onChanged?: (r: Receipt) => void;
  onSubmitted?: (info: SubmittedInfo) => void;
}) {
  const desk = mode === 'desk';
  const [detail, setDetail] = useState<Detail | null>(null);
  const [form, setForm] = useState<Form>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [toast, setToast] = useState('');
  const [assocLabel, setAssocLabel] = useState('');
  const [note, setNote] = useState('');
  const [askNote, setAskNote] = useState(false);

  const touched = useRef<Set<string>>(new Set());
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version = useRef<Record<string, number>>({});
  const inflight = useRef<Promise<void> | null>(null);
  const formRef = useRef<Form>({});
  formRef.current = form;

  const r = detail?.receipt;
  const editable = !!detail?.editable;

  const applyServer = useCallback((rec: Receipt, keepVersions: Record<string, number>) => {
    setDetail((d) => (d ? { ...d, receipt: rec } : d));
    setForm((f) => {
      const next = { ...f };
      for (const k of FORM_KEYS) {
        if ((version.current[k] || 0) > (keepVersions[k] || 0)) continue; // seitdem erneut geändert
        next[k] = (rec as unknown as Record<string, unknown>)[k];
      }
      return next;
    });
    onChanged?.(rec);
  }, [onChanged]);

  const load = useCallback(async () => {
    try {
      const d = await api.get(id, desk);
      setDetail(d);
      setForm(pickForm(d.receipt));
      setAssocLabel(d.booking_label || (d.receipt.event_slug ? eventTitle(meta, d.receipt.event_slug, d) : ''));
      setErr('');
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id, desk, meta]);

  useEffect(() => {
    touched.current = new Set();
    pending.current = {};
    version.current = {};
    setDetail(null);
    setAskNote(false);
    setNote('');
    void load();
  }, [load]);

  // Analyse abwarten: nur unberührte Felder übernehmen
  const analysing = r?.analysis_status === 'laeuft' || r?.analysis_status === 'offen';
  useEffect(() => {
    if (!analysing) return;
    const t = setInterval(async () => {
      try {
        const d = await api.get(id, desk);
        if (d.receipt.analysis_status === 'laeuft' || d.receipt.analysis_status === 'offen') return;
        setDetail((old) => ({ ...d, log: d.log.length ? d.log : old?.log || [] }));
        setForm((f) => {
          const next = { ...f };
          for (const k of FORM_KEYS) if (!touched.current.has(k) && !(k in pending.current)) next[k] = (d.receipt as unknown as Record<string, unknown>)[k];
          return next;
        });
        if (d.booking_label) setAssocLabel(d.booking_label);
        else if (d.receipt.event_slug && !touched.current.has('event_slug')) setAssocLabel(eventTitle(meta, d.receipt.event_slug, d));
        const m = d.receipt.analysis_method || '';
        setToast(d.receipt.analysis_status === 'fehler'
          ? 'Konnte den Beleg nicht lesen – bitte kurz selbst ausfüllen.'
          : m.includes('ki') ? 'Die KI hat den Beleg gelesen ✨' : 'Beleg gelesen ✓');
        onChanged?.(d.receipt);
      } catch { /* nächster Versuch */ }
    }, 1300);
    return () => clearInterval(t);
  }, [analysing, id, desk, meta, onChanged]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const flush = useCallback(async (): Promise<void> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (inflight.current) await inflight.current;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    const sentVersions = { ...version.current };
    setSaveState('saving');
    const p = (async () => {
      try {
        const res = await api.patch(id, patch);
        applyServer(res.receipt, sentVersions);
        if ('booking_id' in patch || 'event_slug' in patch) {
          setAssocLabel(res.booking_label || (res.receipt.event_slug ? eventTitle(meta, res.receipt.event_slug) : ''));
        }
        setSaveState('saved');
        setErr('');
      } catch (e) {
        pending.current = { ...patch, ...pending.current };
        setErr((e as Error).message);
        setSaveState('idle');
      }
    })();
    inflight.current = p;
    await p;
    inflight.current = null;
  }, [id, applyServer, meta]);

  const set = useCallback((patch: Record<string, unknown>, opts: { fast?: boolean; local?: Form } = {}) => {
    setForm((f) => ({ ...f, ...(opts.local || patch) }));
    for (const k of Object.keys(opts.local || patch)) {
      touched.current.add(k);
      version.current[k] = (version.current[k] || 0) + 1;
    }
    Object.assign(pending.current, patch);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush(); }, opts.fast ? 120 : 700);
  }, [flush]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // ── Ableitungen für die Anzeige
  const amount = Number(form.amount_gross) || 0;
  const cur = String(form.currency || 'CHF');
  const vatLines = (Array.isArray(form.vat_lines) ? form.vat_lines : []) as VatLine[];
  const vatRate = vatLines.length === 1 ? vatLines[0].rate : vatLines.length > 1 ? -1 : null;
  const showVat = cur === 'CHF' || form.country === 'CH' || vatLines.length > 0;
  const extraction = r?.extraction;
  const suggestedCat = extraction?.suggestions?.find((s) => s.field === 'category')?.value;
  const candidates = extraction?.candidates || [];
  const missing = r ? missingFields({ ...r, ...(form as Partial<Receipt>) } as Receipt) : [];
  const missingApprove = r ? missingForApproval({ ...r, ...(form as Partial<Receipt>) } as Receipt) : [];

  const setVat = (rate: number | null) => {
    const lines = rate === null ? [] : [vatFromGross(amount, rate)];
    set({ vat_rate: rate }, { fast: true, local: { vat_lines: lines } });
  };

  const pickSupplier = (s: Meta['suppliers'][number]) => {
    const patch: Record<string, unknown> = { supplier: s.supplier };
    if (!form.category && s.category) patch.category = s.category;
    if (!form.payment && s.payment) patch.payment = s.payment;
    if (!form.country && s.country) patch.country = s.country;
    set(patch, { fast: true });
    if (!vatLines.length && s.vat_rate !== null && (s.country || 'CH') === 'CH') setVat(s.vat_rate);
  };

  const chooseAssoc = (c: AssocCandidate | null) => {
    if (!c) { set({ booking_id: '', booking_ref: '', event_slug: '' }, { fast: true }); setAssocLabel(''); return; }
    if (c.kind === 'anfrage') set({ booking_id: c.id, booking_ref: c.label.split(' · ')[0], event_slug: c.event_slug || '' }, { fast: true });
    else set({ event_slug: c.id, booking_id: '', booking_ref: '' }, { fast: true });
    setAssocLabel(c.label);
  };

  const doAction = async (action: string, n = '') => {
    setBusy(action);
    setErr('');
    try {
      await flush();
      const res = await api.action(id, action, n);
      setDetail((d) => (d ? { ...d, receipt: res.receipt, editable: action === 'reopen' || action === 'restore' || action === 'question' ? true : d.editable } : d));
      setForm(pickForm(res.receipt));
      onChanged?.(res.receipt);
      if (action === 'submit' && res.points && res.cheer) onSubmitted?.({ receipt: res.receipt, points: res.points, cheer: res.cheer });
      if (action === 'ai' || action === 'analyze') { touched.current = new Set(); setToast('Wird neu gelesen …'); }
      if (desk) void load();
      setAskNote(false);
      setNote('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  if (!detail || !r) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        {err ? <span className="text-red-600">{err}</span> : <Loader2 className="h-6 w-6 animate-spin" />}
      </div>
    );
  }

  const tone = STATUS_TONE[r.status];
  const lockedMsg = r.status === 'freigegeben' ? `Freigegeben von ${r.reviewed_by_name} am ${dateCH(r.reviewed_at)}` : r.status === 'verbucht' ? 'Verbucht – an die Buchhaltung exportiert' : '';
  const isImage = r.file_mime.startsWith('image/');

  return (
    <div className={desk ? 'space-y-4' : 'space-y-5 pb-36'}>
      {toast && (
        <div className="fixed left-1/2 top-4 z-[90] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg" style={{ background: NAVY }}>{toast}</div>
      )}

      {/* Foto (Handy) mit Scan-Animation */}
      {!desk && (
        <a href={fileUrl(r)} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-3xl bg-slate-900" style={{ height: isImage ? 220 : 120 }}>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(r, true)} alt="Beleg" className="h-full w-full object-cover opacity-90" />
          ) : (
            <div className="flex h-full items-center justify-center gap-2 text-white/80"><span className="text-4xl">📄</span><span className="font-semibold">{r.file_name}</span></div>
          )}
          {analysing && (
            <div className="absolute inset-0 bg-[#143047]/40">
              <div className="belege-scan absolute inset-x-0 h-16" style={{ background: 'linear-gradient(180deg, transparent, rgba(245,197,66,.55), transparent)' }} />
              <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-sm font-semibold text-white">
                <Loader2 className="h-4 w-4 animate-spin" /> Beleg wird gelesen …
              </div>
            </div>
          )}
          <span className="absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: tone.bg, color: tone.fg }}>{r.number} · {tone.label}</span>
        </a>
      )}

      {desk && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: tone.bg, color: tone.fg }}>{tone.label}</span>
          <span className="text-sm font-bold" style={{ color: NAVY }}>{r.number}</span>
          <span className="text-xs text-slate-500">erfasst von {r.created_by_name} · {dateCH(r.created_at)}</span>
          {analysing && <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700"><Loader2 className="h-3.5 w-3.5 animate-spin" /> wird gelesen</span>}
          {r.analysis_method && !analysing && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">gelesen: {r.analysis_method}</span>}
          <span className="ml-auto text-xs text-slate-400">{saveState === 'saving' ? 'speichert …' : saveState === 'saved' ? 'gespeichert ✓' : ''}</span>
        </div>
      )}

      {r.duplicate_of && (
        <Banner tone="warn" icon={<AlertTriangle className="h-4 w-4" />}>Gleiche Datei wie {r.duplicate_of} – vielleicht doppelt?</Banner>
      )}
      {r.status === 'rueckfrage' && r.review_note && (
        <Banner tone="danger" icon={<MessageCircleQuestion className="h-4 w-4" />}><b>Rückfrage der Buchhaltung:</b> {r.review_note}</Banner>
      )}
      {lockedMsg && <Banner tone="ok" icon={<ShieldCheck className="h-4 w-4" />}>{lockedMsg}</Banner>}
      {r.analysis_status === 'fehler' && r.analysis_error && (
        <Banner tone="warn" icon={<AlertTriangle className="h-4 w-4" />}>{r.analysis_error}</Banner>
      )}
      {extraction?.suggestions?.filter((s) => s.field === 'notes').map((s, i) => (
        <Banner key={i} tone="info" icon={<Sparkles className="h-4 w-4" />}>KI-Hinweis: {s.label}</Banner>
      ))}

      <fieldset disabled={!editable} className="space-y-5 disabled:opacity-80">
        {/* Betrag */}
        <Section label="Betrag">
          <div className="flex items-stretch gap-2">
            <AmountInput value={amount} onChange={(v) => {
              const local: Form = { amount_gross: v };
              if (vatLines.length === 1) local.vat_lines = [vatFromGross(v, vatLines[0].rate)];
              set({ amount_gross: v }, { local });
            }} big={!desk} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CURRENCIES.map((c) => <Chip key={c} active={cur === c} onClick={() => set({ currency: c }, { fast: true })}>{c}</Chip>)}
            {!CURRENCIES.includes(cur) && cur && <Chip active>{cur}</Chip>}
            <input aria-label="Andere Währung" placeholder="andere" maxLength={3} className="w-20 rounded-full border border-slate-200 px-3 py-1.5 text-sm uppercase"
              onBlur={(e) => { const v = e.target.value.trim().toUpperCase(); if (/^[A-Z]{3}$/.test(v)) set({ currency: v }, { fast: true }); e.target.value = ''; }} />
          </div>
          {cur !== 'CHF' && r.amount_chf > 0 && <p className="mt-1.5 text-xs text-slate-500">≈ {money(r.amount_chf)} (Kurs {r.fx_rate})</p>}
        </Section>

        {/* Lieferant */}
        <Section label="Wo / bei wem?">
          <SupplierInput value={String(form.supplier || '')} suppliers={meta.suppliers} onType={(v) => set({ supplier: v })} onPick={pickSupplier} big={!desk} />
        </Section>

        {/* Datum */}
        <Section label="Datum">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip active={form.receipt_date === todayIso()} onClick={() => set({ receipt_date: todayIso() }, { fast: true })}>Heute</Chip>
            <Chip active={form.receipt_date === todayIso(-1)} onClick={() => set({ receipt_date: todayIso(-1) }, { fast: true })}>Gestern</Chip>
            <input type="date" value={String(form.receipt_date || '')} max={todayIso(1)} onChange={(e) => set({ receipt_date: e.target.value }, { fast: true })}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm" style={{ color: NAVY }} />
          </div>
        </Section>

        {/* Kategorie */}
        <Section label="Was war es?">
          <div className={desk ? 'grid grid-cols-3 gap-1.5 xl:grid-cols-4' : 'grid grid-cols-3 gap-2'}>
            {meta.kategorien.map((k) => {
              const active = form.category === k.key;
              const sug = !form.category && suggestedCat === k.key;
              return (
                <button key={k.key} type="button" onClick={() => set({ category: k.key }, { fast: true })} title={`${k.hint} · Konto ${k.konto}`}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 text-center transition active:scale-95 ${desk ? 'py-2' : 'py-3'}`}
                  style={{ borderColor: active ? ORANGE : sug ? '#f5c542' : '#e5e8ed', background: active ? '#fff3ec' : '#fff', boxShadow: active ? `0 0 0 2px ${ORANGE}33` : undefined }}>
                  <span className={desk ? 'text-xl' : 'text-2xl'}>{k.emoji}</span>
                  <span className="text-[11px] font-semibold leading-tight" style={{ color: NAVY }}>{k.label}</span>
                  {sug && <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-bold text-white">Tipp</span>}
                </button>
              );
            })}
          </div>
        </Section>

        {/* Zahlung */}
        <Section label="Bezahlt mit">
          <div className="flex flex-wrap gap-1.5">
            {meta.zahlungsarten.map((z) => (
              <Chip key={z.key} active={form.payment === z.key} onClick={() => set({ payment: z.key }, { fast: true })} title={z.hint}>
                {z.emoji} {z.label}
              </Chip>
            ))}
          </div>
          {form.payment === 'privat' && <p className="mt-1.5 text-xs text-slate-500">Wird dir nach der Freigabe zurückerstattet.</p>}
        </Section>

        {/* MWST */}
        {showVat && (
          <Section label="MWST">
            <div className="flex flex-wrap gap-1.5">
              {VAT_CHIPS.map((v) => <Chip key={v} active={vatRate === v} onClick={() => setVat(v)}>{v}%</Chip>)}
              <Chip active={vatRate === null} onClick={() => setVat(null)}>weiss nicht</Chip>
              {vatRate === -1 && <Chip active>mehrere Sätze</Chip>}
            </div>
            {vatLines.length > 0 && totalVat(vatLines) > 0 && <p className="mt-1.5 text-xs text-slate-500">darin MWST {money(totalVat(vatLines), cur)}</p>}
          </Section>
        )}

        {/* Zuordnung */}
        <Section label="Gehört zu (optional)">
          <AssocPicker label={assocLabel} candidates={candidates} onPick={chooseAssoc} />
        </Section>

        <Section label="Notiz (optional)">
          <textarea value={String(form.description || '')} onChange={(e) => set({ description: e.target.value })} rows={2}
            placeholder="z. B. Abendessen mit Kunde Müller, 4 Personen"
            className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-[15px]" style={{ color: NAVY }} />
        </Section>

        {desk && meta.me.reviewer && (
          <DeskAccounting form={form} r={r} meta={meta} set={set} />
        )}
      </fieldset>

      {err && <Banner tone="danger" icon={<AlertTriangle className="h-4 w-4" />}>{err}</Banner>}

      {/* Aktionen */}
      {desk ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
          {meta.me.reviewer && ['erfasst', 'eingang', 'rueckfrage'].includes(r.status) && (
            <>
              {missingApprove.length > 0 && <p className="text-xs text-amber-700">Für die Freigabe fehlt: {missingApprove.join(', ')}</p>}
              <div className="flex flex-wrap gap-2">
                <Btn primary disabled={!!busy || missingApprove.length > 0 || analysing} onClick={() => doAction('approve')} icon={busy === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}>Geprüft & freigeben</Btn>
                <Btn disabled={!!busy} onClick={() => setAskNote((v) => !v)} icon={<MessageCircleQuestion className="h-4 w-4" />}>Rückfrage</Btn>
                <Btn disabled={!!busy || analysing || !meta.ai} onClick={() => doAction('ai')} icon={<Sparkles className="h-4 w-4" />}>KI liest nochmal</Btn>
                <Btn disabled={!!busy} onClick={() => doAction('discard')} icon={<Trash2 className="h-4 w-4" />}>Verwerfen</Btn>
              </div>
              {askNote && (
                <div className="flex gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Was fehlt? z. B. «Wer war beim Essen dabei?»" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  <Btn primary disabled={!note.trim() || !!busy} onClick={() => doAction('question', note)}>Senden</Btn>
                </div>
              )}
            </>
          )}
          {meta.me.reviewer && r.status === 'freigegeben' && (
            <Btn disabled={!!busy} onClick={() => doAction('reopen')} icon={<Undo2 className="h-4 w-4" />}>Freigabe aufheben</Btn>
          )}
          {r.status === 'verworfen' && <Btn disabled={!!busy} onClick={() => doAction('restore')} icon={<RotateCcw className="h-4 w-4" />}>Wiederherstellen</Btn>}
          {!meta.me.reviewer && ['eingang', 'rueckfrage'].includes(r.status) && (
            <Btn primary disabled={!!busy || missing.length > 0} onClick={() => doAction('submit')} icon={<Check className="h-4 w-4" />}>Fertig – an die Buchhaltung</Btn>
          )}
          <div className="flex flex-wrap gap-3 text-xs">
            <a href={fileUrl(r)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Original öffnen</a>
            <a href={`${fileUrl(r)}?download=1`} className="inline-flex items-center gap-1 font-semibold text-slate-600 hover:underline"><Download className="h-3.5 w-3.5" /> Herunterladen</a>
          </div>
        </div>
      ) : (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto max-w-lg">
            {['eingang', 'rueckfrage'].includes(r.status) ? (
              <>
                {missing.length > 0 && !analysing && <p className="mb-2 text-center text-xs text-slate-500">Noch offen: {missing.join(', ')}</p>}
                <button type="button" disabled={!!busy || missing.length > 0 || analysing} onClick={() => doAction('submit')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-lg font-extrabold text-white transition active:scale-[.98] disabled:opacity-40"
                  style={{ background: ORANGE }}>
                  {busy === 'submit' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                  {r.status === 'rueckfrage' ? 'Ergänzt – zurück an die Buchhaltung' : 'Fertig – an die Buchhaltung'}
                </button>
                <div className="mt-2 flex justify-between text-sm">
                  <button type="button" onClick={async () => { await flush(); onClose?.(); }} className="font-semibold text-slate-500">Später ergänzen</button>
                  <button type="button" onClick={() => { if (confirm('Beleg verwerfen?')) void doAction('discard').then(() => onClose?.()); }} className="font-semibold text-red-500">Verwerfen</button>
                </div>
              </>
            ) : (
              <button type="button" onClick={async () => { await flush(); onClose?.(); }} className="w-full rounded-2xl py-4 text-lg font-bold" style={{ background: '#eef2f6', color: NAVY }}>
                Schliessen
              </button>
            )}
          </div>
        </div>
      )}

      {desk && detail.log.length > 0 && (
        <details className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer font-semibold" style={{ color: NAVY }}>Verlauf ({detail.log.length})</summary>
          <ul className="mt-2 space-y-1">
            {detail.log.map((l, i) => (
              <li key={i} className="flex gap-2 text-xs"><span className="w-28 shrink-0 text-slate-400">{new Date(l.at).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}</span><span><b>{l.actor_name}</b> · {l.action}{l.detail ? ` – ${l.detail}` : ''}</span></li>
            ))}
          </ul>
        </details>
      )}
      {desk && detail.ocr_text && (
        <details className="rounded-2xl border border-slate-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer font-semibold" style={{ color: NAVY }}>Erkannter Text</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-600">{detail.ocr_text}</pre>
        </details>
      )}
    </div>
  );
}

function eventTitle(_meta: Meta, slug: string, d?: Detail): string {
  const c = d?.receipt.extraction?.candidates?.find((x) => x.kind === 'event' && x.id === slug);
  return c?.label || slug;
}

// ───────────────────────── Buchhaltung (Desktop) ─────────────────────────

function DeskAccounting({ form, r, meta, set }: { form: Form; r: Receipt; meta: Meta; set: (p: Record<string, unknown>, o?: { fast?: boolean; local?: Form }) => void }) {
  const groups = useMemo(() => {
    const m = new Map<string, typeof meta.konten>();
    for (const k of meta.konten) { const a = m.get(k.gruppe) || []; a.push(k); m.set(k.gruppe, a); }
    return Array.from(m.entries());
  }, [meta.konten]);
  const vatLines = (Array.isArray(form.vat_lines) ? form.vat_lines : []) as VatLine[];
  const cur = String(form.currency || 'CHF');

  const kontoSelect = (field: 'account' | 'contra_account' | 'vat_account', label: string) => (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <select value={String(form[field] || '')} onChange={(e) => set({ [field]: e.target.value }, { fast: true })}
        className="mt-0.5 w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm" style={{ color: NAVY }}>
        <option value="">{field === 'vat_account' ? '– keine Vorsteuer –' : '– automatisch –'}</option>
        {groups.map(([g, ks]) => (
          <optgroup key={g} label={g}>
            {ks.map((k) => <option key={k.nr} value={k.nr}>{k.nr} {k.name}</option>)}
          </optgroup>
        ))}
        {form[field] && !meta.konten.some((k) => k.nr === form[field]) ? <option value={String(form[field])}>{String(form[field])} (nicht im Kontenplan)</option> : null}
      </select>
    </label>
  );

  const setLines = (lines: VatLine[]) => set({ vat_lines: lines }, { fast: true });

  return (
    <div className="space-y-3 rounded-2xl border p-3" style={{ borderColor: '#cfd8e3', background: '#f7f9fc' }}>
      <div className="text-xs font-bold uppercase tracking-wider" style={{ color: NAVY }}>Buchhaltung</div>
      <div className="grid grid-cols-2 gap-2">
        {kontoSelect('account', 'Konto (Soll)')}
        {kontoSelect('contra_account', 'Gegenkonto (Haben)')}
        {kontoSelect('vat_account', 'Vorsteuerkonto')}
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Betrag CHF {cur !== 'CHF' ? `(Kurs ${r.fx_rate})` : ''}</span>
          <input type="number" step="0.01" value={Number(form.amount_chf) || ''} onChange={(e) => set({ amount_chf: e.target.value })}
            className="mt-0.5 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Land</span>
          <input value={String(form.country || '')} maxLength={2} onChange={(e) => set({ country: e.target.value.toUpperCase() })} placeholder="CH"
            className="mt-0.5 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm uppercase" />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rechnungsnr.</span>
          <input value={String(form.invoice_no || '')} onChange={(e) => set({ invoice_no: e.target.value })} className="mt-0.5 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm" />
        </label>
        <label className="col-span-2 block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">UID / MWST-Nr. Lieferant</span>
          <input value={String(form.supplier_vat_id || '')} onChange={(e) => set({ supplier_vat_id: e.target.value })} className="mt-0.5 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm" />
        </label>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">MWST-Zeilen ({cur})</span>
          <button type="button" onClick={() => setLines([...vatLines, { rate: 8.1, vat: 0, net: 0 }])} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: ORANGE }}><Plus className="h-3.5 w-3.5" /> Satz</button>
        </div>
        {vatLines.length === 0 && <p className="text-xs text-slate-400">Keine MWST erfasst.</p>}
        {vatLines.map((l, i) => (
          <div key={i} className="mb-1 flex items-center gap-2">
            <input type="number" step="0.1" value={l.rate} onChange={(e) => { const n = [...vatLines]; n[i] = { ...l, rate: Number(e.target.value) }; setLines(n); }} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <span className="text-xs text-slate-500">%</span>
            <input type="number" step="0.01" value={l.vat} onChange={(e) => { const n = [...vatLines]; n[i] = { ...l, vat: Number(e.target.value), net: round2((l.net || 0)) }; setLines(n); }} className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
            <span className="text-xs text-slate-500">Steuer</span>
            <button type="button" onClick={() => setLines(vatLines.filter((_, k) => k !== i))} className="ml-auto text-slate-400 hover:text-red-500" aria-label="Zeile entfernen"><X className="h-4 w-4" /></button>
          </div>
        ))}
        {r.vat_account === '' && totalVat(vatLines) > 0 && <p className="text-xs text-amber-700">Ausländische MWST – nicht als Vorsteuer abziehbar.</p>}
      </div>
    </div>
  );
}

// ───────────────────────── Bausteine ─────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children, title }: { active?: boolean; onClick?: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className="rounded-full border px-3.5 py-2 text-sm font-semibold transition active:scale-95"
      style={{ borderColor: active ? NAVY : '#e5e8ed', background: active ? NAVY : '#fff', color: active ? '#fff' : NAVY }}>
      {children}
    </button>
  );
}

function Btn({ primary, onClick, disabled, children, icon }: { primary?: boolean; onClick?: () => void; disabled?: boolean; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition disabled:opacity-40"
      style={primary ? { background: ORANGE, color: '#fff' } : { background: '#fff', color: NAVY, border: '1px solid #e5e8ed' }}>
      {icon}{children}
    </button>
  );
}

function Banner({ tone, icon, children }: { tone: 'warn' | 'danger' | 'ok' | 'info'; icon: React.ReactNode; children: React.ReactNode }) {
  const c = { warn: ['#fff7e6', '#92400e'], danger: ['#fef2f2', '#991b1b'], ok: ['#f0fdf4', '#166534'], info: ['#eff6ff', '#1e40af'] }[tone];
  return <div className="flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm" style={{ background: c[0], color: c[1] }}><span className="mt-0.5">{icon}</span><span>{children}</span></div>;
}

function AmountInput({ value, onChange, big }: { value: number; onChange: (v: number) => void; big: boolean }) {
  const [text, setText] = useState(value ? value.toFixed(2) : '');
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value ? value.toFixed(2) : ''); }, [value]);
  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder="0.00"
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; const n = Number(text.replace(/[’' ]/g, '').replace(',', '.')); setText(n ? n.toFixed(2) : ''); }}
      onChange={(e) => {
        const t = e.target.value.replace(/[^0-9.,’' ]/g, '');
        setText(t);
        const n = Number(t.replace(/[’' ]/g, '').replace(',', '.'));
        if (Number.isFinite(n)) onChange(round2(n));
      }}
      className={`w-full rounded-2xl border border-slate-200 px-4 font-black tabular-nums tracking-tight ${big ? 'py-3 text-4xl' : 'py-2 text-2xl'}`}
      style={{ color: NAVY }}
      aria-label="Betrag"
    />
  );
}

function SupplierInput({ value, suppliers, onType, onPick, big }: { value: string; suppliers: Meta['suppliers']; onType: (v: string) => void; onPick: (s: Meta['suppliers'][number]) => void; big: boolean }) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const list = useMemo(() => {
    if (!q) return suppliers.slice(0, 6);
    return suppliers.filter((s) => s.supplier.toLowerCase().includes(q) && s.supplier.toLowerCase() !== q).slice(0, 6);
  }, [q, suppliers]);
  return (
    <div className="relative">
      <input value={value} onChange={(e) => { onType(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="z. B. SBB, Restaurant Kronenhalle, Ticketmaster"
        className={`w-full rounded-2xl border border-slate-200 px-4 font-semibold ${big ? 'py-3 text-lg' : 'py-2 text-[15px]'}`} style={{ color: NAVY }} autoComplete="off" />
      {!value && !open && list.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {list.slice(0, 5).map((s) => <Chip key={s.supplier} onClick={() => onPick(s)}>{s.supplier}</Chip>)}
        </div>
      )}
      {open && list.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          {list.map((s) => (
            <button key={s.supplier} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(s); setOpen(false); }}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
              <span className="font-semibold" style={{ color: NAVY }}>{s.supplier}</span>
              <span className="text-xs text-slate-400">{s.count}× {s.category ? '· gewohnt' : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssocPicker({ label, candidates, onPick }: { label: string; candidates: AssocCandidate[]; onPick: (c: AssocCandidate | null) => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<AssocCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) { setRes([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { setRes((await api.assoc(q)).candidates); } catch { setRes([]); } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (label) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border px-3 py-2.5" style={{ borderColor: ORANGE, background: '#fff3ec' }}>
        <span className="text-lg">🧩</span>
        <span className="flex-1 text-sm font-semibold" style={{ color: NAVY }}>{label}</span>
        <button type="button" onClick={() => onPick(null)} className="text-slate-400" aria-label="Zuordnung entfernen"><X className="h-4 w-4" /></button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {candidates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {candidates.map((c) => (
            <button key={`${c.kind}:${c.id}`} type="button" onClick={() => onPick(c)} title={c.reason}
              className="rounded-2xl border px-3 py-2 text-left text-sm transition active:scale-95" style={{ borderColor: '#f5c542', background: '#fffbeb' }}>
              <span className="font-semibold" style={{ color: NAVY }}>{c.kind === 'anfrage' ? '📋' : '🏟️'} {c.label}</span>
              <span className="block text-[11px] text-slate-500">{c.reason}{c.sub ? ` · ${c.sub}` : ''}</span>
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Event, RQ-Nummer oder Kunde suchen"
          className="w-full rounded-2xl border border-slate-200 py-2.5 pl-9 pr-3 text-[15px]" style={{ color: NAVY }} />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {res.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {res.map((c) => (
            <button key={`${c.kind}:${c.id}`} type="button" onClick={() => { onPick(c); setQ(''); setRes([]); }}
              className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50">
              <span>{c.kind === 'anfrage' ? '📋' : '🏟️'}</span>
              <span className="flex-1"><span className="block text-sm font-semibold" style={{ color: NAVY }}>{c.label}</span>{c.sub && <span className="block text-[11px] text-slate-500">{c.sub}</span>}</span>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
