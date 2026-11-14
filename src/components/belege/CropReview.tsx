'use client';
/**
 * CropReview — Kontrolle nach der Aufnahme: erkannter Ausschnitt mit vier Ecken zum Verschieben,
 * daneben die gerade gezogene Vorschau. «Übernehmen» entzerrt in voller Auflösung.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, RotateCcw, Maximize, Loader2 } from 'lucide-react';
import { warpCanvas, canvasToJpeg, fullQuad, type Quad } from './scanDom';

const ORANGE = '#d9531e';

export default function CropReview({ canvas, quad: initial, onRetake, onDone }: {
  canvas: HTMLCanvasElement;
  quad: Quad | null;
  onRetake: () => void;
  onDone: (blob: Blob, cropped: boolean) => void;
}) {
  const W = canvas.width, H = canvas.height;
  const [quad, setQuad] = useState<Quad>(() => initial || fullQuad(W, H, 0.02));
  const [found] = useState(!!initial);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Vorschaubild (klein, schnell) für die Anzeige
  const src = useMemo(() => {
    const f = Math.min(1, 1400 / Math.max(W, H));
    const c = document.createElement('canvas');
    c.width = Math.round(W * f);
    c.height = Math.round(H * f);
    c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.8);
  }, [canvas, W, H]);

  const toImg = (e: React.PointerEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = pt.matrixTransform(m.inverse());
    return { x: Math.min(W, Math.max(0, p.x)), y: Math.min(H, Math.max(0, p.y)) };
  };

  const onDown = (e: React.PointerEvent) => {
    const p = toImg(e);
    if (!p) return;
    let best = -1, bd = Infinity;
    quad.forEach((q, i) => { const d = Math.hypot(q.x - p.x, q.y - p.y); if (d < bd) { bd = d; best = i; } });
    // Trefferradius ~ 12 % der Bildbreite (Finger!)
    if (bd > Math.max(W, H) * 0.14) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag(best);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag === null) return;
    const p = toImg(e);
    if (!p) return;
    setQuad((q) => q.map((c, i) => (i === drag ? p : c)) as Quad);
  };
  const onUp = () => setDrag(null);

  const accept = async () => {
    setBusy(true);
    // Rechnen lassen, nachdem der Spinner gezeichnet ist
    await new Promise((r) => setTimeout(r, 30));
    try {
      const full = quad.every((p, i) => {
        const f = fullQuad(W, H)[i];
        return Math.abs(p.x - f.x) < W * 0.03 && Math.abs(p.y - f.y) < H * 0.03;
      });
      const out = full ? canvas : warpCanvas(canvas, quad);
      onDone(await canvasToJpeg(out), !full);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { try { navigator.vibrate?.(15); } catch { /* */ } }, []);

  const r = Math.max(W, H) * 0.028;
  const pts = quad.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-[#0b1622] text-white" role="dialog" aria-label="Ausschnitt prüfen">
      <div className="px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] text-center">
        <div className="text-lg font-black">{found ? 'Beleg erkannt ✓' : 'Ausschnitt wählen'}</div>
        <div className="text-xs text-white/60">{found ? 'Passt der Rahmen? Ecken lassen sich verschieben.' : 'Ecken auf die Belegecken ziehen – oder ganzes Foto nehmen.'}</div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="max-h-full max-w-full touch-none select-none" style={{ aspectRatio: `${W} / ${H}` }}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <image href={src} x={0} y={0} width={W} height={H} />
          <path d={`M0 0H${W}V${H}H0Z M${pts.split(' ').join(' L')}Z`} fill="rgba(0,0,0,.55)" fillRule="evenodd" />
          <polygon points={pts} fill="none" stroke={ORANGE} strokeWidth={r * 0.25} strokeLinejoin="round" />
          {quad.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={r * 1.9} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={drag === i ? r * 1.25 : r} fill="#fff" stroke={ORANGE} strokeWidth={r * 0.3} />
            </g>
          ))}
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={onRetake} disabled={busy} className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 py-3 text-xs font-bold">
          <RotateCcw className="h-5 w-5" /> Nochmal
        </button>
        <button type="button" onClick={() => setQuad(fullQuad(W, H))} disabled={busy} className="flex flex-col items-center gap-1 rounded-2xl bg-white/10 py-3 text-xs font-bold">
          <Maximize className="h-5 w-5" /> Ganzes Foto
        </button>
        <button type="button" onClick={() => void accept()} disabled={busy} className="flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-black" style={{ background: ORANGE }}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />} Übernehmen
        </button>
      </div>
    </div>
  );
}
