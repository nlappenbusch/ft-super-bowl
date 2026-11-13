'use client';
/**
 * belegeClient.ts — Typen, API-Aufrufe und kleine Helfer der Belege-Oberflächen (Handy + Desktop).
 */
import type { Receipt, PointsBreakdown, AssocCandidate, Badge } from '@/lib/belege/model';
import type { Konto, Kategorie, GegenkontoRegeln } from '@/lib/belege/kontenplan';

export type { Receipt, PointsBreakdown, AssocCandidate, Badge };

export interface Me { id: string; name: string; email: string; reviewer: boolean }
export interface SupplierHist { supplier: string; count: number; category: string; account: string; payment: string; currency: string; vat_rate: number | null; country: string }
export interface Stats {
  points: number;
  level: { level: { name: string; emoji: string; min: number }; next: { name: string; emoji: string; min: number } | null; progress: number };
  streak: number;
  receipts: number;
  today: { count: number; chf: number };
  badges: Badge[];
}
export interface LeaderRow { id: string; name: string; points: number; receipts: number; level: string; emoji: string }
export interface Meta {
  me: Me;
  kategorien: Omit<Kategorie, 'words'>[];
  zahlungsarten: { key: string; label: string; emoji: string; hint: string }[];
  konten: Konto[];
  regeln: GegenkontoRegeln;
  suppliers: SupplierHist[];
  defaults: { payment: string; currency: string };
  stats: Stats;
  leaderboard: LeaderRow[];
  ai: boolean;
}
export interface Detail {
  receipt: Receipt;
  log: Array<{ at: string; actor_name: string; action: string; detail: string }>;
  booking_label: string;
  ocr_text: string;
  points: PointsBreakdown;
  cheer: { text: string; emoji: string };
  editable: boolean;
}

async function j<T>(res: Response): Promise<T> {
  const d = await res.json().catch(() => ({ success: false, error: `Fehler ${res.status}` }));
  if (res.status === 401) {
    const from = typeof window !== 'undefined' ? window.location.pathname : '/belege';
    if (typeof window !== 'undefined') window.location.href = `/admin/login?from=${encodeURIComponent(from)}`;
  }
  if (!d.success) throw new Error(d.error || `Fehler ${res.status}`);
  return d.data as T;
}

export const api = {
  meta: () => fetch('/api/admin/belege/meta', { cache: 'no-store' }).then((r) => j<Meta>(r)),
  list: (p: { status?: string; mine?: boolean; q?: string }) => {
    const sp = new URLSearchParams();
    if (p.status) sp.set('status', p.status);
    if (p.mine) sp.set('mine', '1');
    if (p.q) sp.set('q', p.q);
    return fetch(`/api/admin/belege?${sp}`, { cache: 'no-store' }).then((r) => j<{ items: Receipt[]; counts: Record<string, number>; me: Me }>(r));
  },
  get: (id: string, full = false) => fetch(`/api/admin/belege/${id}${full ? '?full=1' : ''}`, { cache: 'no-store' }).then((r) => j<Detail>(r)),
  patch: (id: string, patch: Record<string, unknown>) =>
    fetch(`/api/admin/belege/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      .then((r) => j<{ receipt: Receipt; points: PointsBreakdown; booking_label: string }>(r)),
  action: (id: string, action: string, note = '') =>
    fetch(`/api/admin/belege/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, note }) })
      .then((r) => j<{ receipt: Receipt; points?: PointsBreakdown; cheer?: { text: string; emoji: string } }>(r)),
  assoc: (q: string) => fetch(`/api/admin/belege/meta?assoc=${encodeURIComponent(q)}`, { cache: 'no-store' }).then((r) => j<{ candidates: AssocCandidate[] }>(r)),
  saveRules: (r: Partial<GegenkontoRegeln>) =>
    fetch('/api/admin/belege/meta', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }).then((x) => j<{ regeln: GegenkontoRegeln }>(x)),
};

/** Upload mit Fortschritt (XHR, damit die Prozentanzeige auf dem Handy läuft). */
export function uploadReceipt(file: Blob, name: string, source: 'handy' | 'desktop', onProgress?: (p: number) => void): Promise<Receipt> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file, name);
    fd.append('source', source);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/belege/upload');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status === 401) { window.location.href = '/admin/login?from=/belege'; return; }
        if (d.success) resolve(d.data as Receipt);
        else reject(new Error(d.error || `Fehler ${xhr.status}`));
      } catch {
        reject(new Error(`Upload fehlgeschlagen (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Keine Verbindung – bitte nochmal versuchen.'));
    xhr.send(fd);
  });
}

/**
 * Handyfotos vor dem Upload verkleinern (max. 2200 px, JPEG 0.86): schneller Upload auch im
 * Stadion-WLAN, OCR und KI lesen das problemlos. PDFs und unlesbare Formate gehen unverändert.
 */
export async function shrinkImage(file: File): Promise<{ blob: Blob; name: string }> {
  if (!file.type.startsWith('image/') || file.size < 600_000) return { blob: file, name: file.name };
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const max = 2200;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { blob: file, name: file.name };
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    if (!blob || blob.size >= file.size) return { blob: file, name: file.name };
    return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg' };
  } catch {
    return { blob: file, name: file.name };
  }
}

export function money(n: number, cur = 'CHF'): string {
  const v = (Number(n) || 0).toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${cur} ${v}`;
}

export function dateCH(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function todayIso(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function fileUrl(r: Pick<Receipt, 'id' | 'has_thumb' | 'updated_at'>, thumb = false): string {
  return `/api/admin/belege/${r.id}/datei${thumb && r.has_thumb ? '?thumb=1' : ''}`;
}

export const STATUS_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  eingang: { bg: '#fff4e5', fg: '#b45309', label: 'Ergänzen' },
  rueckfrage: { bg: '#fee2e2', fg: '#b91c1c', label: 'Rückfrage' },
  erfasst: { bg: '#e0f2fe', fg: '#0369a1', label: 'Bei der Buchhaltung' },
  freigegeben: { bg: '#dcfce7', fg: '#15803d', label: 'Freigegeben' },
  verbucht: { bg: '#ede9fe', fg: '#6d28d9', label: 'Verbucht' },
  verworfen: { bg: '#f1f5f9', fg: '#64748b', label: 'Verworfen' },
};

// ───────────────────────── Klang + Vibration ─────────────────────────

let audioCtx: AudioContext | null = null;

/** Münz-Klang (WebAudio, ohne Datei). Jackpot = längere Kaskade. */
export function coinSound(jackpot = false): void {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    const ctx = audioCtx;
    const notes = jackpot ? [988, 1319, 1568, 1976, 2349, 2637] : [988, 1319];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + i * (jackpot ? 0.09 : 0.08);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.25);
    });
  } catch { /* ohne Ton */ }
}

export function buzz(pattern: number[]): void {
  try { navigator.vibrate?.(pattern); } catch { /* */ }
}

/** Kleine Sprüche, damit Geld ausgeben sich gut anfühlt. */
export const SPEND_LINES = [
  'Geld ausgegeben, Beleg erfasst – genau so geht das.',
  'Die Buchhaltung dankt. Und dein künftiges Ich auch.',
  'Kein Zettel im Portemonnaie, kein schlechtes Gewissen.',
  'Ausgabe sauber gelandet. Weiter so!',
  'Das war ein Profi-Move.',
  'Natalie lächelt gerade, ohne zu wissen warum.',
  'Spesen? Erledigt. Zeit für das nächste Highlight.',
];
