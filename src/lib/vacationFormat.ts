/**
 * vacationFormat.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Reine Formatierungs-Helfer für Abwesenheiten (Datum, Zeitraum, Tage, Typ).
 * Ohne DB-/Server-Abhängigkeiten → auch in Client-Komponenten importierbar.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type VacationType = 'urlaub' | 'krankheit' | 'kompensation' | 'sonstiges';
export type VacationStatus = 'beantragt' | 'genehmigt' | 'abgelehnt';

export const VACATION_TYPE_LABEL: Record<VacationType, string> = {
  urlaub: 'Urlaub',
  krankheit: 'Krankheit',
  kompensation: 'Kompensation',
  sonstiges: 'Sonstiges',
};

/** Bezeichnung des Vorgangs, z.B. für Benachrichtigungstitel. */
export const VACATION_REQUEST_LABEL: Record<VacationType, string> = {
  urlaub: 'Urlaubsantrag',
  krankheit: 'Krankmeldung',
  kompensation: 'Kompensationsantrag',
  sonstiges: 'Abwesenheitsantrag',
};

function parts(iso: string): { y: string; m: string; d: string } {
  const [y = '', m = '', d = ''] = (iso || '').split('-');
  return { y, m, d };
}

/** 2026-10-14 → "14.10." (mit Jahr: "14.10.2026"). */
export function fmtDayDe(iso: string, withYear = false): string {
  const { y, m, d } = parts(iso);
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${withYear ? y : ''}`;
}

/**
 * Kompakter Zeitraum: "12.–16.10.", "28.09.–02.10.", "14.10." (ein Tag),
 * über den Jahreswechsel "28.12.2026–04.01.2027".
 */
export function fmtRangeDe(start: string, end: string): string {
  if (!end || start === end) return fmtDayDe(start);
  const a = parts(start), b = parts(end);
  if (a.y !== b.y) return `${fmtDayDe(start, true)}–${fmtDayDe(end, true)}`;
  if (a.m === b.m) return `${a.d}.–${b.d}.${b.m}.`;
  return `${fmtDayDe(start)}–${fmtDayDe(end)}`;
}

/** Wie fmtRangeDe, aber mit Jahr: "12.–16.10.2026", "14.10.2026". */
export function fmtRangeDeYear(start: string, end: string): string {
  const r = fmtRangeDe(start, end);
  const sameYear = !end || start.slice(0, 4) === end.slice(0, 4);
  return sameYear ? `${r}${(end || start).slice(0, 4)}` : r;
}

/** Zahl mit Dezimalkomma, max. 2 Nachkommastellen: 2.5 → "2,5", -2 → "−2". */
export function fmtNumDe(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Math.abs(r)).replace('.', ',').replace(/^/, r < 0 ? '−' : '');
}

/** 5 → "5 Tage", 1 → "1 Tag", 0.5 → "½ Tag", 2.5 → "2,5 Tage". */
export function fmtDaysDe(days: number): string {
  if (days === 0.5) return '½ Tag';
  return `${fmtNumDe(days)} ${days === 1 ? 'Tag' : 'Tage'}`;
}

/** Vorname aus einem Anzeigenamen ("Nathalie Muster" → "Nathalie"). */
export function firstName(name: string): string {
  return (name || '').trim().split(/\s+/)[0] || name || '';
}
