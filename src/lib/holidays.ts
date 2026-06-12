/**
 * holidays.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gesetzliche Feiertage im Kanton Zürich (arbeitsfrei, dem Sonntag gleichgestellt).
 * Bewegliche Feiertage werden über die Gauß'sche Osterformel berechnet.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface Holiday {
  /** ISO-Datum YYYY-MM-DD */
  date: string;
  name: string;
}

/** Ostersonntag (gregorianisch, anonyme Gauß-Formel). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=März, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

/** Gesetzliche Feiertage Kanton ZH für ein Jahr (sortiert). */
export function zhHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const list: Holiday[] = [
    { date: `${year}-01-01`, name: 'Neujahr' },
    { date: `${year}-01-02`, name: 'Berchtoldstag' },
    { date: iso(addDays(easter, -2)), name: 'Karfreitag' },
    { date: iso(addDays(easter, 1)), name: 'Ostermontag' },
    { date: `${year}-05-01`, name: 'Tag der Arbeit' },
    { date: iso(addDays(easter, 39)), name: 'Auffahrt' },
    { date: iso(addDays(easter, 50)), name: 'Pfingstmontag' },
    { date: `${year}-08-01`, name: 'Bundesfeier' },
    { date: `${year}-12-25`, name: 'Weihnachten' },
    { date: `${year}-12-26`, name: 'Stephanstag' },
  ];
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

const cache = new Map<number, Map<string, string>>();

function holidayMap(year: number): Map<string, string> {
  let m = cache.get(year);
  if (!m) {
    m = new Map(zhHolidays(year).map((h) => [h.date, h.name]));
    cache.set(year, m);
  }
  return m;
}

/** Feiertagsname für ein ISO-Datum, sonst null. */
export function holidayName(isoDate: string): string | null {
  const year = parseInt(isoDate.slice(0, 4), 10);
  if (!year) return null;
  return holidayMap(year).get(isoDate) || null;
}

export function isZhHoliday(isoDate: string): boolean {
  return holidayName(isoDate) !== null;
}

/**
 * Wochenarbeitszeit: Stunden pro Wochentag (0 = Sonntag … 6 = Samstag,
 * wie Date.getUTCDay()). Default: Mo–Fr je 8.4h (42h-Woche).
 */
export type WeeklyHours = [number, number, number, number, number, number, number];

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = [0, 8.4, 8.4, 8.4, 8.4, 8.4, 0];

/** Soll-Stunden eines Tages: 0 an ZH-Feiertagen, sonst laut Wochenplan. */
export function targetHoursForDate(isoDate: string, weekly: WeeklyHours): number {
  if (isZhHoliday(isoDate)) return 0;
  const d = new Date(`${isoDate}T00:00:00Z`);
  return weekly[d.getUTCDay()] || 0;
}

/** Arbeitstag laut Wochenplan und kein Feiertag? */
export function isWorkingDay(isoDate: string, weekly: WeeklyHours): boolean {
  return targetHoursForDate(isoDate, weekly) > 0;
}

/** Alle ISO-Daten von from bis to (inklusive). */
export function eachDay(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let d = new Date(`${fromIso}T00:00:00Z`);
  const end = new Date(`${toIso}T00:00:00Z`);
  while (d.getTime() <= end.getTime()) {
    out.push(iso(d));
    d = addDays(d, 1);
  }
  return out;
}

/** Anzahl Arbeitstage in einem Zeitraum (für Urlaubsverbrauch). */
export function workingDaysBetween(fromIso: string, toIso: string, weekly: WeeklyHours): number {
  return eachDay(fromIso, toIso).filter((day) => isWorkingDay(day, weekly)).length;
}

/** Soll-Stunden-Summe eines Zeitraums. */
export function targetHoursBetween(fromIso: string, toIso: string, weekly: WeeklyHours): number {
  return eachDay(fromIso, toIso).reduce((sum, day) => sum + targetHoursForDate(day, weekly), 0);
}
