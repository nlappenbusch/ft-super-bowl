'use client';
/**
 * CameraCapture — Live-Kamera im Vollbild. Sucht den Beleg im Sucher (oranger Rahmen) und löst
 * automatisch aus, sobald er ~1 s ruhig im Bild liegt. Manuell auslösen, Licht, Galerie.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Zap, ZapOff, Image as ImageIcon, Loader2 } from 'lucide-react';
import { quadDrift } from '@/lib/belege/scan';
import { detectIn, makeCanvas, fileToCanvas, getPref, setPref, PREF_AUTOSHOT, PREF_AUTOSTART, type Quad } from './scanDom';

const ORANGE = '#d9531e';
const STABLE_FRAMES = 7; // × ~150 ms ≈ 1 s ruhig halten

export interface Shot { canvas: HTMLCanvasElement; quad: Quad | null; name: string }

export default function CameraCapture({ onShot, onClose, onFallback, onFile }: {
  onShot: (s: Shot) => void;
  /** PDF aus der Galerie: unverändert hochladen. */
  onFile: (f: File) => void;
  onClose: () => void;
  /** Kamera geht nicht (keine Freigabe, kein Gerät) → klassische Dateiauswahl. */
  onFallback: (reason: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scratch = useRef<HTMLCanvasElement | null>(null);
  const lastQuad = useRef<Quad | null>(null);
  const stable = useRef(0);
  const busy = useRef(false);
  const galleryRef = useRef<HTMLInputElement | null>(null);
  // Eltern übergeben oft Inline-Funktionen – über Refs, damit die Kamera nicht neu startet
  const onShotRef = useRef(onShot);
  const onFallbackRef = useRef(onFallback);
  onShotRef.current = onShot;
  onFallbackRef.current = onFallback;
  const onFileRef = useRef(onFile);
  onFileRef.current = onFile;

  const [ready, setReady] = useState(false);
  const [quad, setQuad] = useState<Quad | null>(null);
  const [progress, setProgress] = useState(0);
  const [auto, setAuto] = useState(() => getPref(PREF_AUTOSHOT, true));
  const [autostart, setAutostart] = useState(() => getPref(PREF_AUTOSTART, true));
  const [torch, setTorch] = useState<boolean | null>(null); // null = nicht verfügbar
  const [flash, setFlash] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [dims, setDims] = useState({ vw: 0, vh: 0, bw: 0, bh: 0 });

  // Kamera starten
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() || {}) as MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };
        if (caps.torch) setTorch(false);
        if (caps.focusMode?.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => {});
        }
        setReady(true);
      } catch (e) {
        const name = (e as Error).name;
        onFallbackRef.current(name === 'NotAllowedError' ? 'Kamera nicht freigegeben – bitte Foto auswählen oder die Kamera in den Browser-Einstellungen erlauben.' : 'Kamera nicht verfügbar.');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Grösse von Video und Anzeige (für die Umrechnung «object-cover»)
  useEffect(() => {
    const upd = () => {
      const v = videoRef.current, b = boxRef.current;
      if (!v || !b) return;
      setDims({ vw: v.videoWidth, vh: v.videoHeight, bw: b.clientWidth, bh: b.clientHeight });
    };
    upd();
    const v = videoRef.current;
    v?.addEventListener('loadedmetadata', upd);
    v?.addEventListener('resize', upd);
    window.addEventListener('resize', upd);
    return () => { v?.removeEventListener('loadedmetadata', upd); v?.removeEventListener('resize', upd); window.removeEventListener('resize', upd); };
  }, [ready]);

  const capture = useCallback(async (live: Quad | null) => {
    if (busy.current) return;
    busy.current = true;
    setCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    try { navigator.vibrate?.(30); } catch { /* */ }
    const v = videoRef.current!;
    let canvas: HTMLCanvasElement | null = null;
    let fromVideo = false;
    // Volle Fotoauflösung, wo der Browser das kann (Chrome/Android)
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture;
      if (track && IC) {
        const blob = await Promise.race([
          new IC(track).takePhoto(),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 2500)),
        ]);
        canvas = await fileToCanvas(blob, 2800);
      }
    } catch { canvas = null; }
    if (!canvas) {
      canvas = makeCanvas(v.videoWidth, v.videoHeight);
      canvas.getContext('2d')!.drawImage(v, 0, 0);
      fromVideo = true;
    }
    let q = detectIn(canvas, canvas.width, canvas.height)?.quad || null;
    if (!q && live && fromVideo) q = live;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onShotRef.current({ canvas, quad: q, name: `beleg-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg` });
  }, []);

  // Suche im Sucher, ca. 6–7× pro Sekunde
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      const v = videoRef.current;
      if (!v || busy.current || !v.videoWidth) return;
      if (!scratch.current) scratch.current = makeCanvas(16, 16);
      const d = detectIn(v, v.videoWidth, v.videoHeight, scratch.current);
      const q = d?.quad || null;
      setQuad(q);
      if (q && lastQuad.current && quadDrift(q, lastQuad.current, v.videoWidth, v.videoHeight) < 0.012) stable.current++;
      else stable.current = 0;
      lastQuad.current = q;
      setProgress(q ? Math.min(1, stable.current / STABLE_FRAMES) : 0);
      if (auto && q && stable.current >= STABLE_FRAMES) void capture(q);
    }, 150);
    return () => clearInterval(t);
  }, [ready, auto, capture]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || torch === null) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch { setTorch(null); }
  };

  const onGallery = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (f.type === 'application/pdf' || !f.type.startsWith('image/')) { streamRef.current?.getTracks().forEach((t) => t.stop()); onFileRef.current(f); return; }
    busy.current = true;
    setCapturing(true);
    const canvas = await fileToCanvas(f);
    const q = detectIn(canvas, canvas.width, canvas.height)?.quad || null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onShotRef.current({ canvas, quad: q, name: f.name.replace(/\.[^.]+$/, '') + '.jpg' });
  };

  // Video-Koordinaten → Anzeige (object-cover)
  const { vw, vh, bw, bh } = dims;
  const scale = vw && vh ? Math.max(bw / vw, bh / vh) : 1;
  const ox = (bw - vw * scale) / 2;
  const oy = (bh - vh * scale) / 2;
  const pts = quad ? quad.map((p) => `${(p.x * scale + ox).toFixed(1)},${(p.y * scale + oy).toFixed(1)}`).join(' ') : '';

  const hint = !ready ? 'Kamera startet …'
    : capturing ? 'Aufgenommen ✓'
      : !quad ? 'Beleg ins Bild halten – am besten auf dunklem Untergrund'
        : auto ? (progress < 1 ? 'Gefunden – kurz stillhalten …' : 'Aufnahme …') : 'Gefunden – jetzt auslösen';

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white" role="dialog" aria-label="Beleg fotografieren">
      <div ref={boxRef} className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
        {quad && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${bw} ${bh}`} preserveAspectRatio="none">
            <polygon points={pts} fill="rgba(217,83,30,.18)" stroke={ORANGE} strokeWidth={4} strokeLinejoin="round" />
          </svg>
        )}
        {flash && <div className="absolute inset-0 bg-white/80" />}

        {/* oben */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
          <button type="button" onClick={onClose} className="rounded-full bg-black/40 p-2.5" aria-label="Kamera schliessen"><X className="h-6 w-6" /></button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { const v = !auto; setAuto(v); setPref(PREF_AUTOSHOT, v); }}
              className="rounded-full px-3 py-2 text-xs font-bold" style={{ background: auto ? ORANGE : 'rgba(0,0,0,.45)' }}>
              Auto {auto ? 'an' : 'aus'}
            </button>
            {torch !== null && (
              <button type="button" onClick={() => void toggleTorch()} className="rounded-full bg-black/40 p-2.5" aria-label="Licht">
                {torch ? <Zap className="h-5 w-5 text-yellow-300" /> : <ZapOff className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {/* Hinweis */}
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-6">
          <span className="rounded-full bg-black/60 px-4 py-2 text-center text-sm font-semibold">{hint}</span>
        </div>
      </div>

      {/* unten */}
      <div className="flex items-center justify-between bg-black px-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <button type="button" onClick={() => galleryRef.current?.click()} className="flex w-16 flex-col items-center gap-1 text-[11px] font-semibold text-white/80">
          <ImageIcon className="h-7 w-7" /> Galerie
        </button>
        <input ref={galleryRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => void onGallery(e.target.files)} />

        <button type="button" disabled={!ready || capturing} onClick={() => void capture(quad)} aria-label="Auslösen"
          className="relative h-20 w-20 rounded-full border-4 border-white/90 disabled:opacity-50">
          <svg className="absolute -inset-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)] -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="47" fill="none" stroke={ORANGE} strokeWidth="6" strokeDasharray={`${progress * 295} 295`} strokeLinecap="round" />
          </svg>
          <span className="absolute inset-2 flex items-center justify-center rounded-full" style={{ background: quad ? ORANGE : '#fff' }}>
            {capturing && <Loader2 className="h-6 w-6 animate-spin text-white" />}
          </span>
        </button>

        <label className="flex w-16 flex-col items-center gap-1 text-center text-[10px] font-semibold leading-tight text-white/70">
          <input type="checkbox" checked={autostart} onChange={(e) => { setAutostart(e.target.checked); setPref(PREF_AUTOSTART, e.target.checked); }} className="h-5 w-5 accent-[#d9531e]" />
          beim Start öffnen
        </label>
      </div>
    </div>
  );
}
