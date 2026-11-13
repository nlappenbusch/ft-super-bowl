/**
 * files/model.ts — reine Logik von Faltin Files (ohne DB/Dateisystem, testbar).
 */
const DAY_MS = 86_400_000;

/** Dateiname säubern: keine Pfade, keine Steuerzeichen, max. 200 Zeichen. */
export function cleanFileName(name: string): string {
  const base = String(name || '').split(/[\\/]/).pop() || '';
  // eslint-disable-next-line no-control-regex
  const s = base.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  return s || 'datei';
}

/**
 * Ablaufdatum aus Tagen (ab `from`) oder Datum (`YYYY-MM-DD` = Tagesende, oder ISO).
 * Mindestens 1 Stunde, höchstens `maxDays` ab `from`.
 */
export function resolveExpiry(
  input: { days?: unknown; expires_at?: unknown },
  from: number,
  limits: { defaultDays: number; maxDays: number },
): string {
  const max = from + limits.maxDays * DAY_MS;
  let t: number | null = null;
  if (typeof input.expires_at === 'string' && input.expires_at) {
    const d = new Date(input.expires_at.length === 10 ? `${input.expires_at}T23:59:59` : input.expires_at);
    if (!Number.isNaN(d.getTime())) t = d.getTime();
  }
  if (t === null) {
    const days = Number(input.days);
    t = from + (Number.isFinite(days) && days > 0 ? days : limits.defaultDays) * DAY_MS;
  }
  if (t < from + 60 * 60 * 1000) t = from + 60 * 60 * 1000;
  if (t > max) t = max;
  return new Date(t).toISOString();
}
