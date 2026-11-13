'use client';
/**
 * BelegeMobile — Handy-App für belege.faltintravel.com: Foto knipsen → wird gelesen → kurz
 * bestätigen → Punkte. Listen «Ergänzen», «Bei der Buchhaltung», «Erledigt», dazu Erfolge.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, FileUp, Flame, Loader2, Trophy, ChevronRight, X, Monitor } from 'lucide-react';
import ReceiptEditor, { type SubmittedInfo } from './ReceiptEditor';
import Celebration, { type CelebrationData } from './Celebration';
import CameraCapture, { type Shot } from './CameraCapture';
import CropReview from './CropReview';
import { hasLiveCamera, getPref, PREF_AUTOSTART, fileToCanvas, detectIn } from './scanDom';
import { api, uploadReceipt, shrinkImage, money, dateCH, fileUrl, STATUS_TONE, type Meta, type Receipt } from './belegeClient';

const NAVY = '#143047';
const ORANGE = '#d9531e';

type Tab = 'start' | 'erfolge';

export default function BelegeMobile() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [items, setItems] = useState<Receipt[]>([]);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('start');
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploads, setUploads] = useState<Array<{ key: string; name: string; p: number; err?: string }>>([]);
  const [party, setParty] = useState<CelebrationData | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [camOpen, setCamOpen] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const autoStarted = useRef(false);

  const reload = useCallback(async () => {
    try {
      const [m, l] = await Promise.all([api.meta(), api.list({ mine: true })]);
      setMeta(m);
      setItems(l.items);
      setErr('');
      return m;
    } catch (e) {
      setErr((e as Error).message);
      return null;
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  // Beleg per Link öffnen (#B26-00012 bzw. ?id=)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setOpenId(id);
  }, []);

  const uploadOne = async (blob: Blob, name: string): Promise<string | null> => {
    const key = `${Date.now()}-${Math.random()}`;
    setUploads((u) => [...u, { key, name, p: 0 }]);
    try {
      const r = await uploadReceipt(blob, name, 'handy', (p) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, p } : x))));
      setItems((it) => [r, ...it.filter((x) => x.id !== r.id)]);
      setUploads((u) => u.filter((x) => x.key !== key));
      return r.id;
    } catch (e) {
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, err: (e as Error).message } : x)));
      setTimeout(() => setUploads((u) => u.filter((x) => x.key !== key)), 6000);
      return null;
    }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files);
    if (camRef.current) camRef.current.value = '';
    if (fileRef.current) fileRef.current.value = '';
    // Einzelnes Foto: Ausschnitt erkennen und zur Kontrolle zeigen
    if (list.length === 1 && list[0].type.startsWith('image/')) {
      try {
        const canvas = await fileToCanvas(list[0]);
        const q = detectIn(canvas, canvas.width, canvas.height)?.quad || null;
        setShot({ canvas, quad: q, name: list[0].name.replace(/\.[^.]+$/, '') + '.jpg' });
        return;
      } catch { /* unbekanntes Format (z. B. HEIC) → unverändert hochladen */ }
    }
    let first: string | null = null;
    for (const f of list) {
      const { blob, name } = await shrinkImage(f);
      const id = await uploadOne(blob, name);
      if (!first && id) first = id;
    }
    if (first) setOpenId(first);
  };

  const openCamera = () => {
    if (hasLiveCamera()) setCamOpen(true);
    else camRef.current?.click();
  };

  const onShot = useCallback((s: Shot) => { setCamOpen(false); setShot(s); }, []);
  const onCamFallback = useCallback((reason: string) => {
    setCamOpen(false);
    if (reason) setErr(reason);
  }, []);
  const onCamFile = useCallback((f: File) => {
    setCamOpen(false);
    void uploadOne(f, f.name).then((id) => { if (id) setOpenId(id); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCropped = async (blob: Blob) => {
    const name = shot?.name || 'beleg.jpg';
    setShot(null);
    const id = await uploadOne(blob, name);
    if (id) setOpenId(id);
  };

  // Handy: Kamera beim Öffnen der App gleich starten (abschaltbar im Sucher)
  useEffect(() => {
    if (!meta || autoStarted.current) return;
    autoStarted.current = true;
    const phone = window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 1023px)').matches;
    const linked = new URLSearchParams(window.location.search).get('id');
    const wanted = new URLSearchParams(window.location.search).get('kamera');
    if ((wanted === '1' || (phone && getPref(PREF_AUTOSTART, true))) && !linked && hasLiveCamera()) setCamOpen(true);
  }, [meta]);

  const onSubmitted = async (info: SubmittedInfo) => {
    const before = meta?.stats;
    const after = (await reload())?.stats;
    setOpenId(null);
    const levelUp = before && after && after.level.level.name !== before.level.level.name ? { name: after.level.level.name, emoji: after.level.level.emoji } : null;
    setParty({
      cheer: info.cheer,
      points: info.points,
      amount: info.receipt.amount_gross,
      currency: info.receipt.currency,
      levelUp,
      progress: after ? {
        from: levelUp ? 0 : before?.level.progress ?? 0,
        to: after.level.progress,
        nextName: after.level.next ? `${after.level.next.emoji} ${after.level.next.name}` : null,
        toNext: after.level.next ? after.level.next.min - after.points : 0,
      } : null,
    });
  };

  const onChanged = useCallback((r: Receipt) => {
    setItems((it) => it.map((x) => (x.id === r.id ? r : x)));
  }, []);

  if (!meta) {
    return (
      <Shell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-slate-500">
          {err ? <p className="px-6 text-center text-red-600">{err}</p> : <Loader2 className="h-7 w-7 animate-spin" />}
        </div>
      </Shell>
    );
  }

  const s = meta.stats;
  const todo = items.filter((r) => r.status === 'eingang' || r.status === 'rueckfrage');
  const atAcc = items.filter((r) => r.status === 'erfasst');
  const done = items.filter((r) => r.status === 'freigegeben' || r.status === 'verbucht').slice(0, 15);

  return (
    <Shell>
      {/* Kopf: Stufe, Punkte, Serie */}
      <header className="px-5 pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-white" style={{ background: `linear-gradient(160deg, ${NAVY} 0%, #1d4566 100%)` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/faltin-logo.svg" alt="Faltin Travel" className="h-6 brightness-0 invert" />
            <span className="text-sm font-semibold text-white/70">Belege</span>
          </div>
          {meta.me.reviewer && (
            <a href="/admin/belege" className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold"><Monitor className="h-3.5 w-3.5" /> Prüfen</a>
          )}
        </div>
        <p className="mt-4 text-sm text-white/70">Hallo {meta.me.name.split(' ')[0]}</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <div className="text-2xl font-black">{s.level.level.emoji} {s.level.level.name}</div>
            <div className="text-sm text-white/70"><b className="text-[#f5c542]">{s.points.toLocaleString('de-CH')}</b> Punkte</div>
          </div>
          {s.streak > 0 && (
            <div className="flex items-center gap-1 rounded-2xl bg-white/10 px-3 py-2 text-sm font-bold">
              <Flame className="h-4 w-4 text-orange-400" /> {s.streak} {s.streak === 1 ? 'Tag' : 'Tage'}
            </div>
          )}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full" style={{ width: `${Math.round(s.level.progress * 100)}%`, background: `linear-gradient(90deg, ${ORANGE}, #f5c542)` }} />
        </div>
        <p className="mt-1.5 text-xs text-white/60">
          {s.level.next ? `Noch ${s.level.next.min - s.points} Punkte bis ${s.level.next.emoji} ${s.level.next.name}` : 'Höchste Stufe 👑'}
          {s.today.count > 0 && ` · heute ${s.today.count} ${s.today.count === 1 ? 'Beleg' : 'Belege'}, ${money(s.today.chf)}`}
        </p>
      </header>

      {tab === 'start' ? (
        <main className="-mt-4 space-y-5 rounded-t-3xl bg-[#f4f6f9] px-4 pb-28 pt-5">
          {/* Grosse Aufnahme-Taste */}
          <button type="button" onClick={openCamera}
            className="flex w-full items-center justify-center gap-3 rounded-3xl py-6 text-xl font-black text-white shadow-[0_10px_30px_-10px_rgba(217,83,30,.7)] transition active:scale-[.98]"
            style={{ background: ORANGE }}>
            <Camera className="h-7 w-7" /> Beleg fotografieren
          </button>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold" style={{ color: NAVY }}>
            <FileUp className="h-4 w-4" /> Foto oder PDF auswählen
          </button>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFiles(e.target.files)} />
          <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />

          {uploads.map((u) => (
            <div key={u.key} className="rounded-2xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-semibold" style={{ color: NAVY }}>{u.name}</span>
                <span className={u.err ? 'text-red-600' : 'text-slate-500'}>{u.err || `${Math.round(u.p * 100)}%`}</span>
              </div>
              {!u.err && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full transition-[width]" style={{ width: `${Math.round(u.p * 100)}%`, background: ORANGE }} /></div>}
            </div>
          ))}

          {err && <p className="text-sm text-red-600">{err}</p>}

          <List title="Ergänzen" hint="Noch kurz bestätigen" items={todo} onOpen={setOpenId} accent />
          <List title="Bei der Buchhaltung" hint="Wird geprüft" items={atAcc} onOpen={setOpenId} />
          <List title="Erledigt" hint="Freigegeben" items={done} onOpen={setOpenId} />

          {items.length === 0 && uploads.length === 0 && (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-8 text-center">
              <div className="text-4xl">🧾</div>
              <p className="mt-2 font-bold" style={{ color: NAVY }}>Noch keine Belege</p>
              <p className="mt-1 text-sm text-slate-500">Quittung direkt nach dem Bezahlen fotografieren – das bringt Extrapunkte und spart später das Suchen.</p>
            </div>
          )}
        </main>
      ) : (
        <Erfolge meta={meta} />
      )}

      {/* Untere Leiste */}
      {!openId && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto flex max-w-lg">
            <TabBtn active={tab === 'start'} onClick={() => setTab('start')} icon={<Camera className="h-5 w-5" />} label="Belege" badge={todo.length} />
            <TabBtn active={tab === 'erfolge'} onClick={() => setTab('erfolge')} icon={<Trophy className="h-5 w-5" />} label="Erfolge" />
          </div>
        </nav>
      )}

      {/* Beleg-Blatt */}
      {openId && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#f4f6f9]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
            <span className="font-bold" style={{ color: NAVY }}>Beleg</span>
            <button type="button" onClick={() => { setOpenId(null); void reload(); }} className="rounded-full p-1.5 text-slate-500" aria-label="Schliessen"><X className="h-5 w-5" /></button>
          </div>
          <div className="mx-auto max-w-lg px-4 pt-4">
            <ReceiptEditor id={openId} meta={meta} mode="mobile" onClose={() => { setOpenId(null); void reload(); }} onChanged={onChanged} onSubmitted={(i) => void onSubmitted(i)} />
          </div>
        </div>
      )}

      {camOpen && <CameraCapture onShot={onShot} onClose={() => setCamOpen(false)} onFallback={onCamFallback} onFile={onCamFile} />}
      {shot && <CropReview canvas={shot.canvas} quad={shot.quad} onRetake={() => { setShot(null); if (hasLiveCamera()) setCamOpen(true); else camRef.current?.click(); }} onDone={(b) => void onCropped(b)} />}
      {party && <Celebration data={party} onClose={() => setParty(null)} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto min-h-[100dvh] max-w-lg bg-[#f4f6f9]">{children}</div>;
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button type="button" onClick={onClick} className="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-bold" style={{ color: active ? ORANGE : '#94a3b8' }}>
      {icon}{label}
      {!!badge && <span className="absolute right-[calc(50%-22px)] top-1.5 min-w-[18px] rounded-full px-1 text-[10px] leading-[18px] text-white" style={{ background: ORANGE }}>{badge}</span>}
    </button>
  );
}

function List({ title, hint, items, onOpen, accent }: { title: string; hint: string; items: Receipt[]; onOpen: (id: string) => void; accent?: boolean }) {
  if (!items.length) return null;
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-base font-black" style={{ color: NAVY }}>{title} <span className="text-slate-400">{items.length}</span></h2>
        <span className="text-xs text-slate-400">{hint}</span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {items.map((r) => {
          const tone = STATUS_TONE[r.status];
          const reading = r.analysis_status === 'laeuft' || r.analysis_status === 'offen';
          return (
            <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-0 active:bg-slate-50">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                {r.has_thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl(r, true)} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : <span className="flex h-full items-center justify-center text-xl">📄</span>}
                {reading && <span className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="h-4 w-4 animate-spin text-white" /></span>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold" style={{ color: NAVY }}>{r.supplier || (reading ? 'Wird gelesen …' : 'Lieferant fehlt')}</div>
                <div className="truncate text-xs text-slate-500">{dateCH(r.receipt_date) || '–'} · {r.status === 'rueckfrage' ? <b className="text-red-600">Rückfrage</b> : tone.label}</div>
              </div>
              <div className="text-right">
                <div className="font-black tabular-nums" style={{ color: accent ? ORANGE : NAVY }}>{r.amount_gross ? money(r.amount_gross, r.currency) : '–'}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Erfolge({ meta }: { meta: Meta }) {
  const s = meta.stats;
  const earned = s.badges.filter((b) => b.earned).length;
  return (
    <main className="-mt-4 space-y-5 rounded-t-3xl bg-[#f4f6f9] px-4 pb-28 pt-5">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Belege" value={String(s.receipts)} />
        <Stat label="Serie" value={`${s.streak} 🔥`} />
        <Stat label="Abzeichen" value={`${earned}/${s.badges.length}`} />
      </div>

      <section>
        <h2 className="mb-2 px-1 text-base font-black" style={{ color: NAVY }}>Abzeichen</h2>
        <div className="grid grid-cols-3 gap-2">
          {s.badges.map((b) => (
            <div key={b.id} className="rounded-2xl bg-white p-3 text-center shadow-sm" style={{ opacity: b.earned ? 1 : 0.45 }} title={b.desc}>
              <div className={`text-3xl ${b.earned ? '' : 'grayscale'}`}>{b.emoji}</div>
              <div className="mt-1 text-xs font-bold" style={{ color: NAVY }}>{b.label}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-slate-500">{b.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {meta.leaderboard.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-base font-black" style={{ color: NAVY }}>Rangliste <span className="text-xs font-semibold text-slate-400">letzte 30 Tage</span></h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {meta.leaderboard.map((row, i) => (
              <div key={row.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-0" style={row.id === meta.me.id ? { background: '#fff3ec' } : undefined}>
                <span className="w-7 text-center text-lg font-black" style={{ color: i < 3 ? ORANGE : '#94a3b8' }}>{['🥇', '🥈', '🥉'][i] || i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold" style={{ color: NAVY }}>{row.name}</div>
                  <div className="text-xs text-slate-500">{row.emoji} {row.level} · {row.receipts} Belege</div>
                </div>
                <span className="font-black tabular-nums" style={{ color: NAVY }}>{row.points}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
        <h2 className="mb-1 font-black" style={{ color: NAVY }}>So gibt es Punkte</h2>
        <ul className="space-y-1">
          <li>🧾 Jeder Beleg: <b>10</b></li>
          <li>⚡ Am selben Tag erfasst: <b>+10</b> (bis 3 Tage: +5)</li>
          <li>✅ Komplett ausgefüllt: <b>+5</b></li>
          <li>🧩 Event oder Anfrage zugeordnet: <b>+5</b></li>
          <li>🏅 Ohne Rückfrage freigegeben: <b>+5</b></li>
          <li>🎰 Ab und zu: <b>Jackpot ×3</b></li>
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
      <div className="text-xl font-black" style={{ color: NAVY }}>{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
}
