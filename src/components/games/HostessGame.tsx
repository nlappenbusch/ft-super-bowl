'use client';

/**
 * Hospitality Hunt – Moorhuhn-Style im Stadion.
 * Ziele poppen zufällig auf, ein Klick/Tap "erwischt" sie (Comic-Pop +
 * Punkte), danach respawnen sie an anderer Stelle — sie kommen also immer
 * wieder. 60-Sekunden-Runden, Combo-Bonus, Highscore in localStorage.
 *
 * Eigene Gesichter/Figuren: freigestellte PNGs unter
 *   public/games/targets/target-1.png … target-7.png
 * ablegen (transparenter Hintergrund, Hochformat). Fehlt ein Bild,
 * springt automatisch ein Emoji-Ersatz ein.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const NAVY = '#143047';
const ORANGE = '#d9531e';
const ROUND_SECONDS = 60;
const TARGET_COUNT = 7;
const FALLBACK = ['💁‍♀️', '🙋‍♀️', '💃', '🙆‍♀️', '🤷‍♀️', '🕺', '🤵'];

interface Target {
  id: number;
  x: number;      // Prozent
  y: number;      // Prozent
  visible: boolean;
  popping: boolean;
  spriteOk: boolean;
  scale: number;
  flip: boolean;
}

export default function HostessGame() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [highscore, setHighscore] = useState(0);
  const [floaters, setFloaters] = useState<Array<{ id: number; x: number; y: number; text: string }>>([]);
  const comboTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floaterId = useRef(0);

  useEffect(() => {
    setHighscore(Number(localStorage.getItem('ft-hunt-hs') || 0));
  }, []);

  const randomPos = () => ({
    x: 6 + Math.random() * 82,
    y: 18 + Math.random() * 62,
  });

  const spawnAll = () => {
    setTargets(Array.from({ length: TARGET_COUNT }, (_, i) => ({
      id: i,
      ...randomPos(),
      visible: true,
      popping: false,
      spriteOk: true,
      scale: 0.85 + Math.random() * 0.4,
      flip: Math.random() < 0.5,
    })));
  };

  // Runden-Timer
  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) {
      setRunning(false);
      setGameOver(true);
      setHighscore((hs) => {
        const next = Math.max(hs, score);
        localStorage.setItem('ft-hunt-hs', String(next));
        return next;
      });
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [running, timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ziele wandern gelegentlich von selbst (macht's lebendig)
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setTargets((prev) => prev.map((tg) =>
        tg.visible && !tg.popping && Math.random() < 0.25
          ? { ...tg, ...randomPos(), flip: Math.random() < 0.5 }
          : tg
      ));
    }, 2200);
    return () => clearInterval(t);
  }, [running]);

  const hit = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!running) return;
    const nextCombo = combo + 1;
    const points = 10 + Math.min(nextCombo - 1, 5) * 2; // Combo-Bonus bis +10
    setCombo(nextCombo);
    if (comboTimer.current) clearTimeout(comboTimer.current);
    comboTimer.current = setTimeout(() => setCombo(0), 1800);
    setScore((s) => s + points);

    const fid = ++floaterId.current;
    const rect = (e.currentTarget.closest('[data-arena]') as HTMLElement).getBoundingClientRect();
    setFloaters((f) => [...f, {
      id: fid,
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
      text: nextCombo >= 3 ? `+${points} 🔥` : `+${points}`,
    }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== fid)), 900);

    // Pop-Animation → verschwinden → an neuer Stelle wieder auftauchen
    setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, popping: true } : t)));
    setTimeout(() => {
      setTargets((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false, popping: false } : t)));
    }, 260);
    setTimeout(() => {
      setTargets((prev) => prev.map((t) =>
        t.id === id ? { ...t, ...randomPos(), visible: true, scale: 0.85 + Math.random() * 0.4, flip: Math.random() < 0.5 } : t
      ));
    }, 900 + Math.random() * 1400);
  };

  const start = () => {
    setScore(0);
    setCombo(0);
    setTimeLeft(ROUND_SECONDS);
    setGameOver(false);
    spawnAll();
    setRunning(true);
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: `radial-gradient(1200px 600px at 50% -10%, #1d4468 0%, ${NAVY} 55%, #0c2138 100%)` }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/games" className="text-sm font-bold text-white/70 hover:text-white">← FT Arcade</Link>
          <div className="flex items-center gap-4 text-sm font-bold text-white">
            <span>⭐ {score}</span>
            {combo >= 3 && <span style={{ color: ORANGE }}>Combo ×{combo} 🔥</span>}
            <span>⏱ {timeLeft}s</span>
            <span className="text-white/50">Best: {highscore}</span>
          </div>
        </div>

        <div
          data-arena
          className="relative overflow-hidden rounded-2xl border border-white/15 shadow-2xl select-none"
          style={{
            height: 520,
            cursor: running ? 'crosshair' : 'default',
            background: 'linear-gradient(180deg, #10314f 0%, #143047 42%, #1a5c38 42.5%, #14522f 70%, #1a5c38 100%)',
          }}
        >
          {/* Stadion-Deko */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[42%] opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.16) 0 3px, transparent 3px 14px)' }} />
          <div className="pointer-events-none absolute inset-x-8 top-[42%] h-1 rounded bg-white/40" />
          <div className="pointer-events-none absolute left-1/2 top-[62%] h-28 w-56 -translate-x-1/2 rounded-[50%] border-4 border-white/25" />
          <div className="pointer-events-none absolute left-4 top-3 rounded bg-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white/50">Faltin Travel Arena</div>

          {/* Ziele */}
          {running && targets.map((t) => t.visible && (
            <button
              key={t.id}
              type="button"
              onClick={(e) => hit(t.id, e)}
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform"
              style={{
                left: `${t.x}%`,
                top: `${t.y}%`,
                transform: `translate(-50%,-50%) scale(${t.popping ? 1.6 : t.scale}) ${t.flip ? 'scaleX(-1)' : ''} ${t.popping ? 'rotate(14deg)' : ''}`,
                opacity: t.popping ? 0 : 1,
                transition: 'transform .25s ease, opacity .25s ease, left 1.1s ease, top 1.1s ease',
                filter: 'drop-shadow(0 6px 8px rgba(0,0,0,.4))',
              }}
              aria-label="Ziel"
            >
              {t.spriteOk ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/games/targets/target-${t.id + 1}.png`}
                  alt=""
                  draggable={false}
                  className="pointer-events-none h-28 w-auto md:h-36"
                  onError={() => setTargets((prev) => prev.map((x) => (x.id === t.id ? { ...x, spriteOk: false } : x)))}
                />
              ) : (
                <span className="text-6xl md:text-7xl">{FALLBACK[t.id % FALLBACK.length]}</span>
              )}
            </button>
          ))}

          {/* Punkte-Floater */}
          {floaters.map((f) => (
            <div key={f.id} className="pointer-events-none absolute animate-bounce text-xl font-black" style={{ left: `${f.x}%`, top: `${f.y}%`, color: ORANGE, textShadow: '0 2px 4px rgba(0,0,0,.5)' }}>
              {f.text}
            </div>
          ))}

          {/* Start / Game Over */}
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(12,33,56,0.82)' }}>
              <div className="text-6xl">🎯</div>
              <h1 className="text-3xl font-black text-white">Hospitality Hunt</h1>
              {gameOver && (
                <p className="text-lg font-bold" style={{ color: ORANGE }}>
                  Zeit! {score} Punkte{score >= highscore && score > 0 ? ' · Neuer Rekord! 🏆' : ''}
                </p>
              )}
              <p className="max-w-md text-center text-sm text-white/60">
                Das Promo-Team poppt überall in der Arena auf — erwische so viele wie möglich in {ROUND_SECONDS} Sekunden.
                Schnelle Serien geben Combo-Bonus. Und keine Sorge: <strong className="text-white/80">Alle kommen wieder.</strong>
              </p>
              <button onClick={start} className="rounded-xl px-8 py-3 text-lg font-black text-white transition-transform hover:scale-105" style={{ background: ORANGE }}>
                {gameOver ? 'Revanche!' : 'Start'}
              </button>
              <p className="px-6 text-center text-[11px] text-white/35">
                Eigene Ziele: freigestellte PNGs als <code>public/games/targets/target-1.png … target-{TARGET_COUNT}.png</code> ablegen — sonst springt das Emoji-Team ein.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
