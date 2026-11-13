'use client';
/**
 * Celebration — Jubel nach dem Erfassen eines Belegs: Sport-Ruf («Touchdown!», «180!»),
 * hochzählende Punkte, Konfetti und Münzregen, Münz-Klang + Vibration, Stufenaufstieg.
 * Jackpot (jeder ~12. Beleg): goldene Variante mit ×3.
 */
import { useEffect, useRef, useState } from 'react';
import { coinSound, buzz, money, SPEND_LINES, type PointsBreakdown } from './belegeClient';

export interface CelebrationData {
  cheer: { text: string; emoji: string };
  points: PointsBreakdown;
  amount: number;
  currency: string;
  levelUp?: { name: string; emoji: string } | null;
  progress?: { from: number; to: number; nextName: string | null; toNext: number } | null;
}

export default function Celebration({ data, onClose }: { data: CelebrationData; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shown, setShown] = useState(0);
  const [bar, setBar] = useState(data.progress?.from ?? 0);
  const [line] = useState(() => SPEND_LINES[Math.floor(Math.random() * SPEND_LINES.length)]);
  const jackpot = data.points.jackpot;

  // Punkte hochzählen + Klang
  useEffect(() => {
    coinSound(jackpot);
    buzz(jackpot ? [40, 60, 40, 60, 120] : [30, 40, 70]);
    const total = data.points.total;
    const start = performance.now();
    const dur = jackpot ? 1600 : 900;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setShown(Math.round(total * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const barT = setTimeout(() => setBar(data.progress?.to ?? 0), 350);
    const lvlT = data.levelUp ? setTimeout(() => { coinSound(true); buzz([80, 50, 80]); }, 1300) : null;
    return () => { cancelAnimationFrame(raf); clearTimeout(barT); if (lvlT) clearTimeout(lvlT); };
  }, [data, jackpot]);

  // Konfetti + Münzen
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    c.width = W * dpr;
    c.height = H * dpr;
    ctx.scale(dpr, dpr);
    const colors = jackpot ? ['#f5c542', '#ffd76a', '#e0a800', '#fff1b8', '#d9531e'] : ['#d9531e', '#143047', '#f5c542', '#22c55e', '#38bdf8', '#ffffff'];
    type P = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; color: string; coin: boolean; life: number };
    const parts: P[] = [];
    const burst = (n: number, coins: number) => {
      for (let i = 0; i < n; i++) {
        const coin = i < coins;
        parts.push({
          x: W / 2 + (Math.random() - 0.5) * 60,
          y: H * 0.22,
          vx: (Math.random() - 0.5) * (coin ? 9 : 14),
          vy: -Math.random() * (coin ? 14 : 16) - 4,
          r: coin ? 9 + Math.random() * 4 : 4 + Math.random() * 4,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          color: coin ? '#f5c542' : colors[i % colors.length],
          coin,
          life: 0,
        });
      }
    };
    burst(jackpot ? 220 : 130, jackpot ? 60 : 18);
    const second = setTimeout(() => burst(jackpot ? 160 : 60, jackpot ? 40 : 8), jackpot ? 500 : 650);
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.coin) {
          const squash = Math.abs(Math.cos(p.life / 6));
          ctx.scale(Math.max(0.2, squash), 1);
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fillStyle = '#f5c542';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#c08a00';
          ctx.stroke();
          ctx.fillStyle = '#c08a00';
          ctx.font = `bold ${p.r}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('F', 0, 1);
        } else {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.r / 2, -p.r, p.r, p.r * 2);
        }
        ctx.restore();
      }
      for (let i = parts.length - 1; i >= 0; i--) if (parts[i].y > H + 40) parts.splice(i, 1);
      if (parts.length) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); clearTimeout(second); };
  }, [jackpot]);

  const gold = '#f5c542';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-5" style={{ background: jackpot ? 'radial-gradient(circle at 50% 40%, #3a2a00 0%, #0b1622 70%)' : 'radial-gradient(circle at 50% 40%, #1d4566 0%, #0b1622 75%)' }} onClick={onClose} role="dialog" aria-label="Beleg erfasst">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 h-full w-full" />
      <div className="relative z-10 w-full max-w-sm text-center text-white" onClick={(e) => e.stopPropagation()}>
        <div className="belege-pop text-7xl leading-none">{data.cheer.emoji}</div>
        <div className="belege-pop mt-3 text-4xl font-black tracking-tight" style={{ color: jackpot ? gold : '#fff', animationDelay: '80ms' }}>
          {jackpot ? 'JACKPOT!' : data.cheer.text}
        </div>
        <div className="mt-4 text-6xl font-black tabular-nums" style={{ color: gold, textShadow: '0 4px 24px rgba(245,197,66,.45)' }}>+{shown}</div>
        <div className="text-sm font-semibold uppercase tracking-widest text-white/60">Punkte</div>

        <div className="mt-5 space-y-1 text-sm">
          {data.points.parts.map((p, i) => (
            <div key={i} className="belege-slide flex justify-between rounded-lg bg-white/5 px-3 py-1.5" style={{ animationDelay: `${300 + i * 120}ms` }}>
              <span className="text-white/80">{p.label}</span>
              <span className="font-bold" style={{ color: p.label.startsWith('JACKPOT') ? gold : '#86efac' }}>+{p.points}</span>
            </div>
          ))}
        </div>

        {data.progress && (
          <div className="mt-5">
            <div className="h-2.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full transition-[width] duration-[1200ms] ease-out" style={{ width: `${Math.round(bar * 100)}%`, background: `linear-gradient(90deg, #d9531e, ${gold})` }} />
            </div>
            <div className="mt-1.5 text-xs text-white/60">
              {data.progress.nextName ? `Noch ${data.progress.toNext} Punkte bis ${data.progress.nextName}` : 'Höchste Stufe erreicht 👑'}
            </div>
          </div>
        )}

        {data.levelUp && (
          <div className="belege-pop mt-5 rounded-2xl px-4 py-3 font-bold" style={{ background: 'rgba(245,197,66,.15)', border: `1px solid ${gold}`, color: gold, animationDelay: '1200ms' }}>
            Neue Stufe: {data.levelUp.emoji} {data.levelUp.name}
          </div>
        )}

        <p className="mt-5 text-sm text-white/70">{money(data.amount, data.currency)} · {line}</p>
        <button onClick={onClose} className="mt-6 w-full rounded-2xl py-4 text-lg font-extrabold" style={{ background: '#d9531e', color: '#fff' }}>
          Weiter
        </button>
      </div>
    </div>
  );
}
