import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectReceipt, homography, applyH, warpInto, warpSize, quadDrift, type Quad } from '../src/lib/belege/scan.ts';

/** Synthetisches Foto: dunkler Tisch, leicht gedrehter weisser Beleg mit Textzeilen. */
function photo(w: number, h: number, quad: Quad, bg = 60): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  const H = homography(quad, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = applyH(H, x, y);
    const inside = p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
    const text = inside && p.x > 0.1 && p.x < 0.85 && Math.floor(p.y * 130) % 4 === 0;
    const v = inside ? (text ? 40 : 235) : bg + ((x * 7 + y * 13) % 20);
    const i = (y * w + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255;
  }
  return px;
}

test('Scan: gedrehten Beleg auf dunklem Tisch finden', () => {
  const truth: Quad = [{ x: 70, y: 40 }, { x: 220, y: 60 }, { x: 200, y: 380 }, { x: 45, y: 360 }];
  const d = detectReceipt(photo(280, 420, truth), 280, 420);
  assert.ok(d, 'nichts gefunden');
  for (let i = 0; i < 4; i++) {
    assert.ok(Math.hypot(d!.quad[i].x - truth[i].x, d!.quad[i].y - truth[i].y) < 12, `Ecke ${i}: ${JSON.stringify(d!.quad[i])}`);
  }
  assert.ok(d!.confidence > 0.85, `Konfidenz ${d!.confidence}`);
});

test('Scan: heller Hintergrund ohne Kontrast → kein Zuschnitt', () => {
  const truth: Quad = [{ x: 70, y: 40 }, { x: 220, y: 60 }, { x: 200, y: 380 }, { x: 45, y: 360 }];
  assert.equal(detectReceipt(photo(280, 420, truth, 225), 280, 420), null);
});

test('Homographie bildet die Ecken exakt ab, Entzerren ergibt helles Papier', () => {
  const q: Quad = [{ x: 10, y: 5 }, { x: 90, y: 12 }, { x: 85, y: 110 }, { x: 4, y: 100 }];
  const H = homography([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], q);
  for (const [u, v, i] of [[0, 0, 0], [1, 0, 1], [1, 1, 2], [0, 1, 3]] as const) {
    const p = applyH(H, u, v);
    assert.ok(Math.abs(p.x - q[i].x) < 1e-6 && Math.abs(p.y - q[i].y) < 1e-6);
  }
  const src = photo(120, 130, q);
  const { w, h } = warpSize(q, 500);
  const dst = new Uint8ClampedArray(w * h * 4);
  warpInto(src, 120, 130, q, dst, w, h);
  // Rand des entzerrten Bildes ist Papier (hell), nicht Tisch
  const corner = (x: number, y: number) => dst[(y * w + x) * 4];
  assert.ok(corner(2, 2) > 180 && corner(w - 3, h - 3) > 180);
  assert.ok(quadDrift(q, q, 100, 100) === 0);
});
