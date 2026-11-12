import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hedged } from '../src/lib/mailbox/hedge.ts';

const TRANSIENT = new Set([429, 500, 502, 503, 504]);
const opts = (hedgeMs = 30) => ({ hedgeMs, timeoutMs: () => 2000, transient: (s: number) => TRANSIENT.has(s) });

/** Antwort nach `ms`, bricht bei Abort mit AbortError ab. */
const after = (ms: number, status: number, calls: { aborted: number }) => (signal: AbortSignal) =>
  new Promise<Response>((resolve, reject) => {
    const t = setTimeout(() => resolve(new Response(String(status), { status })), ms);
    signal.addEventListener('abort', () => { clearTimeout(t); calls.aborted++; reject(signal.reason ?? new DOMException('x', 'AbortError')); });
  });

test('schnelle Antwort: kein zweiter Aufruf', async () => {
  let n = 0;
  const c = { aborted: 0 };
  const r = await hedged((s) => { n++; return after(5, 200, c)(s); }, opts(50));
  assert.equal(r?.status, 200);
  await new Promise((x) => setTimeout(x, 80));
  assert.equal(n, 1);
});

test('erster Aufruf hängt: zweiter gewinnt, erster wird abgebrochen', async () => {
  let n = 0;
  const c = { aborted: 0 };
  const t0 = Date.now();
  const r = await hedged((s) => (++n === 1 ? after(1500, 504, c)(s) : after(5, 200, c)(s)), opts(30));
  assert.equal(r?.status, 200);
  assert.ok(Date.now() - t0 < 500, 'wartet nicht auf den hängenden Aufruf');
  assert.equal(n, 2);
  assert.equal(c.aborted, 1);
});

test('zweiter liefert 503, erster kommt später ok: erster gewinnt', async () => {
  let n = 0;
  const c = { aborted: 0 };
  const r = await hedged((s) => (++n === 1 ? after(120, 200, c)(s) : after(5, 503, c)(s)), opts(30));
  assert.equal(r?.status, 200);
});

test('beide vorübergehend kaputt: letzte Fehlerantwort für den Aufrufer', async () => {
  let n = 0;
  const c = { aborted: 0 };
  const r = await hedged((s) => (++n === 1 ? after(80, 502, c)(s) : after(10, 503, c)(s)), opts(30));
  assert.equal(r?.status, 502);
});

test('schneller 503 vor dem zweiten Aufruf: sofort zurück (Wiederholung macht der Aufrufer)', async () => {
  let n = 0;
  const c = { aborted: 0 };
  const r = await hedged((s) => { n++; return after(5, 503, c)(s); }, opts(100));
  assert.equal(r?.status, 503);
  await new Promise((x) => setTimeout(x, 150));
  assert.equal(n, 1);
});

test('endgültiger Fehler (404) gewinnt sofort', async () => {
  const c = { aborted: 0 };
  const r = await hedged(after(5, 404, c), opts(50));
  assert.equal(r?.status, 404);
});

test('Zeitüberschreitung beider Aufrufe: null', async () => {
  const c = { aborted: 0 };
  const r = await hedged(after(5000, 200, c), { ...opts(20), timeoutMs: () => 60 });
  assert.equal(r, null);
});

test('anderer Fehler (kein Netzfehler) wird weitergereicht', async () => {
  await assert.rejects(hedged(() => Promise.reject(new Error('kein Token')), opts(20)), /kein Token/);
});
