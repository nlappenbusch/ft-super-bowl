/**
 * belege/model.ts — Datentypen und reine Logik von Faltin Belege:
 * MWST-Rechnung, Vollständigkeit, Status-Übergänge und das Punktespiel.
 * Client + Server + Tests (tests/belegeModel.test.ts), keine Node-Abhängigkeiten.
 */

export type ReceiptStatus = 'eingang' | 'erfasst' | 'rueckfrage' | 'freigegeben' | 'verbucht' | 'verworfen';
export type AnalysisStatus = 'offen' | 'laeuft' | 'fertig' | 'fehler';

export const STATUS_LABEL: Record<ReceiptStatus, string> = {
  eingang: 'Eingang',
  erfasst: 'Zu prüfen',
  rueckfrage: 'Rückfrage',
  freigegeben: 'Freigegeben',
  verbucht: 'Verbucht',
  verworfen: 'Verworfen',
};

export interface VatLine { rate: number; vat: number; net: number }

export interface Receipt {
  id: string;
  number: string;
  status: ReceiptStatus;
  source: 'handy' | 'desktop' | 'mail';
  created_by: string;
  created_by_name: string;
  created_by_email: string;
  file_name: string;
  file_mime: string;
  file_size: number;
  file_hash: string;
  has_thumb: boolean;
  receipt_date: string;
  supplier: string;
  supplier_vat_id: string;
  country: string;
  invoice_no: string;
  description: string;
  category: string;
  currency: string;
  amount_gross: number;
  vat_lines: VatLine[];
  amount_chf: number;
  fx_rate: number;
  payment: string;
  account: string;
  contra_account: string;
  vat_account: string;
  event_slug: string;
  booking_id: string;
  booking_ref: string;
  notes: string;
  analysis_status: AnalysisStatus;
  analysis_method: string;
  analysis_error: string;
  extraction: ReceiptExtraction | null;
  duplicate_of: string;
  reviewed_by_name: string;
  reviewed_at: string;
  review_note: string;
  expense_id: string;
  exported_at: string;
  created_at: string;
  updated_at: string;
}

export interface ReceiptSuggestion { field: string; value: string; label: string; source: 'beleg' | 'ki' | 'verlauf' | 'regel' }

export interface ReceiptExtraction {
  method: string;
  ocr_confidence?: number;
  text_length?: number;
  parsed?: Record<string, unknown>;
  ai?: Record<string, unknown> | null;
  ai_reason?: string;
  suggestions?: ReceiptSuggestion[];
  candidates?: AssocCandidate[];
  at?: string;
}

export interface AssocCandidate {
  kind: 'anfrage' | 'event';
  id: string;
  label: string;
  sub?: string;
  event_slug?: string;
  reason: string;
}

// ───────────────────────── MWST ─────────────────────────

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Steuerbetrag aus Bruttobetrag und Satz (inkl. MWST). */
export function vatFromGross(gross: number, rate: number): VatLine {
  const g = round2(gross);
  const vat = rate > 0 ? round2((g * rate) / (100 + rate)) : 0;
  return { rate, vat, net: round2(g - vat) };
}

export function totalVat(lines: VatLine[] | null | undefined): number {
  return round2((lines || []).reduce((s, l) => s + (Number(l.vat) || 0), 0));
}

/** Pflichtfelder für «erfasst» (Prüfung durch die Buchhaltung). */
export function missingFields(r: Pick<Receipt, 'supplier' | 'receipt_date' | 'amount_gross' | 'currency' | 'category' | 'payment'>): string[] {
  const miss: string[] = [];
  if (!r.supplier?.trim()) miss.push('Lieferant');
  if (!r.receipt_date) miss.push('Datum');
  if (!(Number(r.amount_gross) > 0)) miss.push('Betrag');
  if (!r.currency) miss.push('Währung');
  if (!r.category) miss.push('Kategorie');
  if (!r.payment) miss.push('Bezahlt mit');
  return miss;
}

/** Zusätzlich für die Freigabe (Buchhaltung). */
export function missingForApproval(r: Receipt): string[] {
  const miss = missingFields(r);
  if (!r.account) miss.push('Konto');
  if (!r.contra_account) miss.push('Gegenkonto');
  if (!(r.amount_chf > 0)) miss.push('Betrag CHF');
  return miss;
}

/** Wer darf was? Erfassende bearbeiten bis zur Freigabe, die Buchhaltung immer (ausser verbucht). */
export function canEdit(r: Pick<Receipt, 'status' | 'created_by'>, user: { id: string; reviewer: boolean }): boolean {
  if (r.status === 'verbucht') return false;
  if (r.status === 'freigegeben') return false; // erst «Freigabe aufheben»
  if (user.reviewer) return true;
  return r.created_by === user.id && (r.status === 'eingang' || r.status === 'rueckfrage' || r.status === 'erfasst');
}

// ───────────────────────── Punktespiel ─────────────────────────

/** Deterministischer Hash (FNV-1a) – Jackpot soll beim Neuladen nicht wechseln. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface PointsBreakdown { total: number; parts: Array<{ label: string; points: number }>; jackpot: boolean }

/**
 * Punkte für einen Beleg. Belohnt wird, was der Buchhaltung Arbeit spart:
 * sofort erfassen (am Tag des Kaufs), vollständig ausfüllen, Zuordnung zu Event/Anfrage,
 * Freigabe ohne Rückfrage. Jeder ~12. Beleg ist ein Jackpot (×3).
 */
export function receiptPoints(r: Pick<Receipt, 'id' | 'status' | 'receipt_date' | 'created_at' | 'supplier' | 'amount_gross' | 'currency' | 'category' | 'payment' | 'event_slug' | 'booking_id' | 'review_note'>): PointsBreakdown {
  if (r.status === 'verworfen') return { total: 0, parts: [], jackpot: false };
  const parts: Array<{ label: string; points: number }> = [{ label: 'Beleg erfasst', points: 10 }];
  const created = (r.created_at || '').slice(0, 10);
  if (r.receipt_date && created && r.receipt_date === created) parts.push({ label: 'Gleich am selben Tag', points: 10 });
  else if (r.receipt_date && created && daysBetween(r.receipt_date, created) <= 3) parts.push({ label: 'Innert 3 Tagen', points: 5 });
  if (missingFields(r).length === 0) parts.push({ label: 'Komplett ausgefüllt', points: 5 });
  if (r.event_slug || r.booking_id) parts.push({ label: 'Event/Anfrage zugeordnet', points: 5 });
  if ((r.status === 'freigegeben' || r.status === 'verbucht') && !r.review_note) parts.push({ label: 'Ohne Rückfrage freigegeben', points: 5 });
  let total = parts.reduce((s, p) => s + p.points, 0);
  const jackpot = hash32(r.id) % 12 === 0;
  if (jackpot) {
    parts.push({ label: 'JACKPOT ×3', points: total * 2 });
    total *= 3;
  }
  return { total, parts, jackpot };
}

export function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 9999;
  return Math.round(Math.abs(db - da) / 86400000);
}

export interface Level { name: string; emoji: string; min: number }

/** Sportliche Stufen – passend zu Faltins Events. */
export const LEVELS: Level[] = [
  { name: 'Rookie', emoji: '🌱', min: 0 },
  { name: 'Starter', emoji: '👟', min: 100 },
  { name: 'Profi', emoji: '🏅', min: 300 },
  { name: 'All-Star', emoji: '⭐', min: 700 },
  { name: 'MVP', emoji: '🏆', min: 1500 },
  { name: 'Hall of Fame', emoji: '👑', min: 3000 },
];

export function levelFor(points: number): { level: Level; next: Level | null; progress: number } {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (points >= LEVELS[k].min) i = k;
  const level = LEVELS[i];
  const next = LEVELS[i + 1] || null;
  const progress = next ? Math.min(1, (points - level.min) / (next.min - level.min)) : 1;
  return { level, next, progress };
}

/** Jubel-Ruf nach dem Speichern – aus den Sportarten, die Faltin verkauft. */
export const CHEERS = [
  { text: 'Touchdown!', emoji: '🏈' },
  { text: '180!', emoji: '🎯' },
  { text: 'Hole in One!', emoji: '⛳' },
  { text: 'Ace!', emoji: '🎾' },
  { text: 'Goal!', emoji: '⚽' },
  { text: 'Pole Position!', emoji: '🏎️' },
  { text: 'Slam Dunk!', emoji: '🏀' },
  { text: 'Home Run!', emoji: '⚾' },
];

export function cheerFor(id: string): { text: string; emoji: string } {
  return CHEERS[hash32(`${id}:cheer`) % CHEERS.length];
}

/**
 * Serie: aufeinanderfolgende Arbeitstage mit mindestens einem Beleg, bis heute bzw. gestern.
 * Wochenenden unterbrechen die Serie nicht.
 */
export function streakDays(days: string[], today: string): number {
  const set = new Set(days.map((d) => d.slice(0, 10)));
  let d = new Date(`${today}T00:00:00Z`);
  // Heute noch nichts? Dann zählt die Serie bis gestern weiter.
  if (!set.has(fmt(d))) d = prevWorkday(d);
  let n = 0;
  while (set.has(fmt(d))) {
    n++;
    d = prevWorkday(d);
  }
  return n;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function prevWorkday(d: Date): Date {
  const x = new Date(d.getTime() - 86400000);
  const wd = x.getUTCDay();
  if (wd === 0) return new Date(x.getTime() - 2 * 86400000);
  if (wd === 6) return new Date(x.getTime() - 86400000);
  return x;
}

export interface Badge { id: string; emoji: string; label: string; desc: string; earned: boolean }

type BadgeInput = Pick<Receipt, 'id' | 'status' | 'receipt_date' | 'created_at' | 'currency' | 'amount_chf' | 'event_slug' | 'booking_id' | 'supplier' | 'amount_gross' | 'category' | 'payment' | 'review_note'>;

export function badgesFor(list: BadgeInput[], today: string): Badge[] {
  const live = list.filter((r) => r.status !== 'verworfen');
  const perDay = new Map<string, number>();
  for (const r of live) {
    const d = (r.created_at || '').slice(0, 10);
    perDay.set(d, (perDay.get(d) || 0) + 1);
  }
  const sameDay = live.filter((r) => r.receipt_date && r.receipt_date === (r.created_at || '').slice(0, 10)).length;
  const currencies = new Set(live.map((r) => r.currency).filter(Boolean));
  const hours = live.map((r) => new Date(r.created_at).getHours());
  const streak = streakDays(live.map((r) => r.created_at), today);
  const assigned = live.filter((r) => r.event_slug || r.booking_id).length;
  const clean = live.filter((r) => (r.status === 'freigegeben' || r.status === 'verbucht') && !r.review_note).length;
  const b = (id: string, emoji: string, label: string, desc: string, earned: boolean): Badge => ({ id, emoji, label, desc, earned });
  return [
    b('erster', '🏈', 'Kick-off', 'Den ersten Beleg erfasst', live.length >= 1),
    b('hattrick', '⚽', 'Hattrick', 'Drei Belege an einem Tag', Array.from(perDay.values()).some((n) => n >= 3)),
    b('blitz', '⚡', 'Blitzlicht', '10 Belege noch am Kauftag erfasst', sameDay >= 10),
    b('welt', '🌍', 'Weltenbummler', 'Belege in 3 Währungen', currencies.size >= 3),
    b('serie', '🔥', 'Lauf', '5 Arbeitstage in Folge Belege erfasst', streak >= 5),
    b('frueh', '🌅', 'Frühaufsteher', 'Einen Beleg vor 7 Uhr erfasst', hours.some((h) => h < 7)),
    b('nacht', '🌙', 'Nachtschicht', 'Einen Beleg nach 22 Uhr erfasst', hours.some((h) => h >= 22)),
    b('gross', '💎', 'Big Spender', 'Ein Beleg über CHF 1’000', live.some((r) => r.amount_chf >= 1000)),
    b('zuordnung', '🧩', 'Spielmacher', '10 Belege einem Event oder einer Anfrage zugeordnet', assigned >= 10),
    b('sauber', '✅', 'Fair Play', '25 Belege ohne Rückfrage freigegeben', clean >= 25),
    b('hundert', '💯', 'Century', '100 Belege erfasst', live.length >= 100),
  ];
}
