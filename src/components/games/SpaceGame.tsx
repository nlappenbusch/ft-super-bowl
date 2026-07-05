'use client';

/**
 * Faltin One – Space Shooter im FT-Corporate-Style.
 * Canvas + requestAnimationFrame, keine Assets: Gegner sind Emoji-"Geraffel"
 * (Footballs, Pokale, Koffer …), das von rechts entgegenfliegt.
 * Steuerung: Pfeile/WASD oder Maus/Touch, Leertaste/Klick schießt.
 * Highscore in localStorage ("ft-space-hs").
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

const NAVY = '#143047';
const ORANGE = '#d9531e';
const ENEMIES = ['🏈', '🎾', '⚽', '🏆', '🧳', '🎫', '🏟️', '🥨'];

interface Enemy { x: number; y: number; vx: number; wobble: number; size: number; emoji: string; hp: number }
interface Shot { x: number; y: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Star { x: number; y: number; s: number; v: number }

export default function SpaceGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [highscore, setHighscore] = useState(0);
  const restartRef = useRef(0);

  useEffect(() => {
    setHighscore(Number(localStorage.getItem('ft-space-hs') || 0));
  }, []);

  useEffect(() => {
    if (!running) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const ship = { x: 70, y: H / 2, cooldown: 0 };
    let enemies: Enemy[] = [];
    let shots: Shot[] = [];
    let particles: Particle[] = [];
    const stars: Star[] = Array.from({ length: 90 }, () => ({
      x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.8 + 0.4, v: Math.random() * 1.2 + 0.3,
    }));
    let localScore = 0;
    let localLives = 3;
    let spawnTimer = 0;
    let elapsed = 0;
    let raf = 0;
    let alive = true;
    const keys: Record<string, boolean> = {};
    let shooting = false;

    const onKeyDown = (e: KeyboardEvent) => {
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
      keys[e.key.toLowerCase()] = true;
      if (e.key === ' ') shooting = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
      if (e.key === ' ') shooting = false;
    };
    const toLocal = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H };
    };
    const onMove = (e: PointerEvent) => {
      const p = toLocal(e.clientX, e.clientY);
      ship.x = Math.max(30, Math.min(W * 0.6, p.x));
      ship.y = Math.max(20, Math.min(H - 20, p.y));
    };
    const onDown = () => { shooting = true; };
    const onUp = () => { shooting = false; };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);

    const boom = (x: number, y: number, color: string, n = 14) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * 3.5 + 1;
        particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color });
      }
    };

    const loop = () => {
      if (!alive) return;
      elapsed += 1;
      const speedup = 1 + Math.min(elapsed / 3600, 1.6); // wird über ~1 Min. schneller

      // Steuerung (Tastatur)
      const spd = 5.2;
      if (keys['arrowup'] || keys['w']) ship.y -= spd;
      if (keys['arrowdown'] || keys['s']) ship.y += spd;
      if (keys['arrowleft'] || keys['a']) ship.x -= spd;
      if (keys['arrowright'] || keys['d']) ship.x += spd;
      ship.x = Math.max(30, Math.min(W * 0.6, ship.x));
      ship.y = Math.max(20, Math.min(H - 20, ship.y));

      // Schießen
      if (ship.cooldown > 0) ship.cooldown -= 1;
      if (shooting && ship.cooldown <= 0) {
        shots.push({ x: ship.x + 26, y: ship.y });
        ship.cooldown = 9;
      }

      // Spawnen
      spawnTimer -= 1;
      if (spawnTimer <= 0) {
        const size = Math.random() < 0.18 ? 46 : 30;
        enemies.push({
          x: W + 40,
          y: 30 + Math.random() * (H - 60),
          vx: (Math.random() * 1.6 + 1.6) * speedup,
          wobble: Math.random() * Math.PI * 2,
          size,
          emoji: ENEMIES[Math.floor(Math.random() * ENEMIES.length)],
          hp: size > 40 ? 2 : 1,
        });
        spawnTimer = Math.max(14, 42 - elapsed / 90);
      }

      // Bewegung
      shots = shots.filter((s) => (s.x += 10.5) < W + 20);
      enemies.forEach((e) => { e.x -= e.vx; e.wobble += 0.05; e.y += Math.sin(e.wobble) * 1.2; });
      particles.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.life -= 0.025; });
      particles = particles.filter((p) => p.life > 0);
      stars.forEach((st) => { st.x -= st.v * speedup; if (st.x < 0) { st.x = W; st.y = Math.random() * H; } });

      // Treffer Schuss → Gegner
      for (const s of shots) {
        for (const e of enemies) {
          if (Math.abs(s.x - e.x) < e.size * 0.6 && Math.abs(s.y - e.y) < e.size * 0.6) {
            e.hp -= 1; s.x = W + 999;
            if (e.hp <= 0) {
              localScore += e.size > 40 ? 25 : 10;
              setScore(localScore);
              boom(e.x, e.y, ORANGE);
              e.x = -999;
            } else {
              boom(s.x, s.y, '#ffffff', 5);
            }
          }
        }
      }
      // Gegner entkommen / Kollision mit Schiff
      for (const e of enemies) {
        if (e.x < -50) { e.x = -999; localLives -= 1; setLives(localLives); boom(30, e.y, '#e11d48', 8); }
        else if (Math.abs(e.x - ship.x) < e.size * 0.55 + 14 && Math.abs(e.y - ship.y) < e.size * 0.55 + 10) {
          e.x = -999; localLives -= 1; setLives(localLives); boom(ship.x, ship.y, '#e11d48', 20);
        }
      }
      enemies = enemies.filter((e) => e.x > -100);

      // ── Zeichnen ──
      ctx.fillStyle = '#0c2138';
      ctx.fillRect(0, 0, W, H);
      const grad = ctx.createRadialGradient(W * 0.7, H * 0.3, 60, W * 0.7, H * 0.3, 600);
      grad.addColorStop(0, 'rgba(29,68,104,0.55)');
      grad.addColorStop(1, 'rgba(12,33,56,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      stars.forEach((st) => ctx.fillRect(st.x, st.y, st.s, st.s));

      // Schiff: FT-Gleiter
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.fillStyle = ORANGE;                      // Triebwerk
      ctx.beginPath();
      ctx.moveTo(-24, -6); ctx.lineTo(-38 - Math.random() * 8, 0); ctx.lineTo(-24, 6); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';                   // Rumpf
      ctx.beginPath();
      ctx.moveTo(28, 0); ctx.lineTo(-22, -14); ctx.lineTo(-14, 0); ctx.lineTo(-22, 14); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = NAVY;
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('FT', -10, 4);
      ctx.restore();

      // Schüsse
      ctx.fillStyle = ORANGE;
      shots.forEach((s) => ctx.fillRect(s.x - 8, s.y - 2, 14, 4));

      // Gegner
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      enemies.forEach((e) => { ctx.font = `${e.size}px serif`; ctx.fillText(e.emoji, e.x, e.y); });

      // Partikel
      particles.forEach((p) => {
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
      });
      ctx.globalAlpha = 1;

      if (localLives <= 0) {
        alive = false;
        setGameOver(true);
        setRunning(false);
        setHighscore((hs) => {
          const next = Math.max(hs, localScore);
          localStorage.setItem('ft-space-hs', String(next));
          return next;
        });
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, [running, restartRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    setScore(0);
    setLives(3);
    setGameOver(false);
    restartRef.current += 1;
    setRunning(true);
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: `radial-gradient(1200px 600px at 50% -10%, #1d4468 0%, ${NAVY} 55%, #0c2138 100%)` }}>
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/games" className="text-sm font-bold text-white/70 hover:text-white">← FT Arcade</Link>
          <div className="flex items-center gap-4 text-sm font-bold text-white">
            <span>⭐ {score}</span>
            <span>{'❤️'.repeat(Math.max(lives, 0)) || '💀'}</span>
            <span className="text-white/50">Best: {highscore}</span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/15 shadow-2xl">
          <canvas ref={canvasRef} width={900} height={520} className="block h-auto w-full touch-none select-none" style={{ cursor: running ? 'crosshair' : 'default' }} />
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4" style={{ background: 'rgba(12,33,56,0.82)' }}>
              <div className="text-6xl">🚀</div>
              <h1 className="text-3xl font-black text-white">Faltin One</h1>
              {gameOver && (
                <p className="text-lg font-bold" style={{ color: ORANGE }}>
                  Game Over — {score} Punkte{score >= highscore && score > 0 ? ' · Neuer Rekord! 🏆' : ''}
                </p>
              )}
              <p className="max-w-md text-center text-sm text-white/60">
                Pfeiltasten/WASD oder Maus zum Steuern · Leertaste oder Klick zum Schießen.<br />
                Lass kein Geraffel an dir vorbei — 3 Leben.
              </p>
              <button onClick={start} className="rounded-xl px-8 py-3 text-lg font-black text-white transition-transform hover:scale-105" style={{ background: ORANGE }}>
                {gameOver ? 'Nochmal!' : 'Start'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
