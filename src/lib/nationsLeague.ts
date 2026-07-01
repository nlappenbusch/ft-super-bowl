/**
 * nationsLeague.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * UEFA Nations League 2026/27 – Ligaphase: alle Ligen, Gruppen, Teams und
 * kompletten Spielpaarungen inkl. Termine. Auslosung 12.02.2026 (Brüssel),
 * Fixture-Liste von der UEFA am 13.02.2026 bestätigt.
 * Quelle: UEFA / Wikipedia (2026–27 UEFA Nations League).
 *
 * Verwendet von der SEO-Landingpage /uefa-nations-league-2026-27.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface NLFixture {
  md: number;        // Spieltag 1..6
  date: string;      // ISO, z.B. "2026-09-25"
  home: string;      // Team-Name (Key in NL_FLAG)
  away: string;
}
export interface NLGroup {
  id: string;        // "A1"
  teams: string[];   // in Setzlisten-Reihenfolge
  fixtures: NLFixture[];
}
export interface NLLeague {
  id: string;        // "A"
  name: string;      // "League A"
  note: string;      // kurze Erklärung (Auf-/Abstieg)
  groups: NLGroup[];
}

/** Spieltag-Fenster der Ligaphase. */
export const NL_MATCHDAYS: { md: number; window: string }[] = [
  { md: 1, window: '24.–26. Sept 2026' },
  { md: 2, window: '27.–29. Sept 2026' },
  { md: 3, window: '1.–3. Okt 2026' },
  { md: 4, window: '4.–6. Okt 2026' },
  { md: 5, window: '12.–14. Nov 2026' },
  { md: 6, window: '15.–17. Nov 2026' },
];

export const NL_META = {
  season: '2026/27',
  drawDate: '2026-02-12',
  drawCity: 'Brüssel',
  leaguePhase: '24. September – 17. November 2026',
  quarterFinals: '25.–30. März 2027',
  finals: '9.–13. Juni 2027',
  holders: 'Portugal',
  teams: 54,
};

/** Team-Name (deutsch) → ISO-Flag-Code (flagcdn). */
export const NL_FLAG: Record<string, string> = {
  Frankreich: 'fr', Italien: 'it', Belgien: 'be', Türkei: 'tr',
  Deutschland: 'de', Niederlande: 'nl', Serbien: 'rs', Griechenland: 'gr',
  Spanien: 'es', Kroatien: 'hr', England: 'gb-eng', Tschechien: 'cz',
  Portugal: 'pt', Dänemark: 'dk', Norwegen: 'no', Wales: 'gb-wls',
  Schottland: 'gb-sct', Schweiz: 'ch', Slowenien: 'si', Nordmazedonien: 'mk',
  Ungarn: 'hu', Ukraine: 'ua', Georgien: 'ge', Nordirland: 'gb-nir',
  Israel: 'il', Österreich: 'at', Irland: 'ie', Kosovo: 'xk',
  Polen: 'pl', 'Bosnien-Herzegowina': 'ba', Rumänien: 'ro', Schweden: 'se',
  Albanien: 'al', Finnland: 'fi', Belarus: 'by', 'San Marino': 'sm',
  Montenegro: 'me', Armenien: 'am', Zypern: 'cy', Lettland: 'lv',
  Kasachstan: 'kz', Slowakei: 'sk', Färöer: 'fo', Moldau: 'md',
  Island: 'is', Bulgarien: 'bg', Estland: 'ee', Luxemburg: 'lu',
  Gibraltar: 'gi', Malta: 'mt', Andorra: 'ad',
  Litauen: 'lt', Aserbaidschan: 'az', Liechtenstein: 'li',
};

const f = (md: number, date: string, home: string, away: string): NLFixture => ({ md, date, home, away });

export const NL_LEAGUES: NLLeague[] = [
  {
    id: 'A', name: 'League A', note: 'Gruppensieger & Zweite → Viertelfinale. Letzte je Gruppe steigen ab, Dritte in die Play-offs.',
    groups: [
      { id: 'A1', teams: ['Frankreich', 'Italien', 'Belgien', 'Türkei'], fixtures: [
        f(1, '2026-09-25', 'Türkei', 'Frankreich'), f(1, '2026-09-25', 'Italien', 'Belgien'),
        f(2, '2026-09-28', 'Belgien', 'Frankreich'), f(2, '2026-09-28', 'Türkei', 'Italien'),
        f(3, '2026-10-02', 'Frankreich', 'Italien'), f(3, '2026-10-02', 'Belgien', 'Türkei'),
        f(4, '2026-10-05', 'Frankreich', 'Belgien'), f(4, '2026-10-05', 'Italien', 'Türkei'),
        f(5, '2026-11-12', 'Italien', 'Frankreich'), f(5, '2026-11-12', 'Türkei', 'Belgien'),
        f(6, '2026-11-15', 'Frankreich', 'Türkei'), f(6, '2026-11-15', 'Belgien', 'Italien'),
      ] },
      { id: 'A2', teams: ['Deutschland', 'Niederlande', 'Serbien', 'Griechenland'], fixtures: [
        f(1, '2026-09-24', 'Niederlande', 'Deutschland'), f(1, '2026-09-24', 'Serbien', 'Griechenland'),
        f(2, '2026-09-27', 'Deutschland', 'Griechenland'), f(2, '2026-09-27', 'Serbien', 'Niederlande'),
        f(3, '2026-10-01', 'Deutschland', 'Serbien'), f(3, '2026-10-01', 'Griechenland', 'Niederlande'),
        f(4, '2026-10-04', 'Niederlande', 'Serbien'), f(4, '2026-10-04', 'Griechenland', 'Deutschland'),
        f(5, '2026-11-13', 'Serbien', 'Deutschland'), f(5, '2026-11-13', 'Niederlande', 'Griechenland'),
        f(6, '2026-11-16', 'Deutschland', 'Niederlande'), f(6, '2026-11-16', 'Griechenland', 'Serbien'),
      ] },
      { id: 'A3', teams: ['Spanien', 'Kroatien', 'England', 'Tschechien'], fixtures: [
        f(1, '2026-09-26', 'England', 'Spanien'), f(1, '2026-09-26', 'Tschechien', 'Kroatien'),
        f(2, '2026-09-29', 'Spanien', 'Kroatien'), f(2, '2026-09-29', 'Tschechien', 'England'),
        f(3, '2026-10-03', 'Spanien', 'Tschechien'), f(3, '2026-10-03', 'Kroatien', 'England'),
        f(4, '2026-10-06', 'Kroatien', 'Spanien'), f(4, '2026-10-06', 'England', 'Tschechien'),
        f(5, '2026-11-12', 'England', 'Kroatien'), f(5, '2026-11-12', 'Tschechien', 'Spanien'),
        f(6, '2026-11-15', 'Spanien', 'England'), f(6, '2026-11-15', 'Kroatien', 'Tschechien'),
      ] },
      { id: 'A4', teams: ['Portugal', 'Dänemark', 'Norwegen', 'Wales'], fixtures: [
        f(1, '2026-09-24', 'Portugal', 'Wales'), f(1, '2026-09-24', 'Norwegen', 'Dänemark'),
        f(2, '2026-09-27', 'Dänemark', 'Wales'), f(2, '2026-09-27', 'Norwegen', 'Portugal'),
        f(3, '2026-10-01', 'Dänemark', 'Portugal'), f(3, '2026-10-01', 'Wales', 'Norwegen'),
        f(4, '2026-10-04', 'Portugal', 'Norwegen'), f(4, '2026-10-04', 'Wales', 'Dänemark'),
        f(5, '2026-11-14', 'Portugal', 'Dänemark'), f(5, '2026-11-14', 'Norwegen', 'Wales'),
        f(6, '2026-11-17', 'Dänemark', 'Norwegen'), f(6, '2026-11-17', 'Wales', 'Portugal'),
      ] },
    ],
  },
  {
    id: 'B', name: 'League B', note: 'Gruppensieger steigen direkt auf, Letzte steigen ab; Zweite/Dritte spielen Play-offs.',
    groups: [
      { id: 'B1', teams: ['Schottland', 'Schweiz', 'Slowenien', 'Nordmazedonien'], fixtures: [
        f(1, '2026-09-26', 'Slowenien', 'Schottland'), f(1, '2026-09-26', 'Nordmazedonien', 'Schweiz'),
        f(2, '2026-09-29', 'Schottland', 'Schweiz'), f(2, '2026-09-29', 'Slowenien', 'Nordmazedonien'),
        f(3, '2026-10-03', 'Schweiz', 'Slowenien'), f(3, '2026-10-03', 'Nordmazedonien', 'Schottland'),
        f(4, '2026-10-06', 'Schottland', 'Slowenien'), f(4, '2026-10-06', 'Schweiz', 'Nordmazedonien'),
        f(5, '2026-11-13', 'Schottland', 'Nordmazedonien'), f(5, '2026-11-13', 'Slowenien', 'Schweiz'),
        f(6, '2026-11-16', 'Schweiz', 'Schottland'), f(6, '2026-11-16', 'Nordmazedonien', 'Slowenien'),
      ] },
      { id: 'B2', teams: ['Ungarn', 'Ukraine', 'Georgien', 'Nordirland'], fixtures: [
        f(1, '2026-09-25', 'Ungarn', 'Ukraine'), f(1, '2026-09-25', 'Georgien', 'Nordirland'),
        f(2, '2026-09-28', 'Georgien', 'Ukraine'), f(2, '2026-09-28', 'Nordirland', 'Ungarn'),
        f(3, '2026-10-02', 'Ungarn', 'Georgien'), f(3, '2026-10-02', 'Ukraine', 'Nordirland'),
        f(4, '2026-10-05', 'Ukraine', 'Ungarn'), f(4, '2026-10-05', 'Nordirland', 'Georgien'),
        f(5, '2026-11-14', 'Georgien', 'Ungarn'), f(5, '2026-11-14', 'Nordirland', 'Ukraine'),
        f(6, '2026-11-17', 'Ungarn', 'Nordirland'), f(6, '2026-11-17', 'Ukraine', 'Georgien'),
      ] },
      { id: 'B3', teams: ['Israel', 'Österreich', 'Irland', 'Kosovo'], fixtures: [
        f(1, '2026-09-24', 'Österreich', 'Israel'), f(1, '2026-09-24', 'Kosovo', 'Irland'),
        f(2, '2026-09-27', 'Israel', 'Irland'), f(2, '2026-09-27', 'Österreich', 'Kosovo'),
        f(3, '2026-10-01', 'Israel', 'Kosovo'), f(3, '2026-10-01', 'Irland', 'Österreich'),
        f(4, '2026-10-04', 'Irland', 'Israel'), f(4, '2026-10-04', 'Kosovo', 'Österreich'),
        f(5, '2026-11-14', 'Österreich', 'Irland'), f(5, '2026-11-14', 'Kosovo', 'Israel'),
        f(6, '2026-11-17', 'Israel', 'Österreich'), f(6, '2026-11-17', 'Irland', 'Kosovo'),
      ] },
      { id: 'B4', teams: ['Polen', 'Bosnien-Herzegowina', 'Rumänien', 'Schweden'], fixtures: [
        f(1, '2026-09-25', 'Polen', 'Bosnien-Herzegowina'), f(1, '2026-09-25', 'Rumänien', 'Schweden'),
        f(2, '2026-09-28', 'Rumänien', 'Bosnien-Herzegowina'), f(2, '2026-09-28', 'Schweden', 'Polen'),
        f(3, '2026-10-02', 'Polen', 'Rumänien'), f(3, '2026-10-02', 'Bosnien-Herzegowina', 'Schweden'),
        f(4, '2026-10-05', 'Bosnien-Herzegowina', 'Polen'), f(4, '2026-10-05', 'Schweden', 'Rumänien'),
        f(5, '2026-11-14', 'Rumänien', 'Polen'), f(5, '2026-11-14', 'Schweden', 'Bosnien-Herzegowina'),
        f(6, '2026-11-17', 'Polen', 'Schweden'), f(6, '2026-11-17', 'Bosnien-Herzegowina', 'Rumänien'),
      ] },
    ],
  },
  {
    id: 'C', name: 'League C', note: 'Gruppensieger steigen direkt auf; die zwei schwächsten Vierten steigen ab.',
    groups: [
      { id: 'C1', teams: ['Albanien', 'Finnland', 'Belarus', 'San Marino'], fixtures: [
        f(1, '2026-09-26', 'Albanien', 'Belarus'), f(1, '2026-09-26', 'San Marino', 'Finnland'),
        f(2, '2026-09-29', 'Finnland', 'Belarus'), f(2, '2026-09-29', 'San Marino', 'Albanien'),
        f(3, '2026-10-03', 'Finnland', 'Albanien'), f(3, '2026-10-03', 'Belarus', 'San Marino'),
        f(4, '2026-10-06', 'Albanien', 'San Marino'), f(4, '2026-10-06', 'Belarus', 'Finnland'),
        f(5, '2026-11-12', 'Albanien', 'Finnland'), f(5, '2026-11-12', 'San Marino', 'Belarus'),
        f(6, '2026-11-15', 'Finnland', 'San Marino'), f(6, '2026-11-15', 'Belarus', 'Albanien'),
      ] },
      { id: 'C2', teams: ['Montenegro', 'Armenien', 'Zypern', 'Lettland'], fixtures: [
        f(1, '2026-09-25', 'Montenegro', 'Zypern'), f(1, '2026-09-25', 'Armenien', 'Lettland'),
        f(2, '2026-09-28', 'Armenien', 'Montenegro'), f(2, '2026-09-28', 'Lettland', 'Zypern'),
        f(3, '2026-10-02', 'Zypern', 'Armenien'), f(3, '2026-10-02', 'Lettland', 'Montenegro'),
        f(4, '2026-10-05', 'Montenegro', 'Armenien'), f(4, '2026-10-05', 'Zypern', 'Lettland'),
        f(5, '2026-11-12', 'Montenegro', 'Lettland'), f(5, '2026-11-12', 'Armenien', 'Zypern'),
        f(6, '2026-11-15', 'Zypern', 'Montenegro'), f(6, '2026-11-15', 'Lettland', 'Armenien'),
      ] },
      { id: 'C3', teams: ['Kasachstan', 'Slowakei', 'Färöer', 'Moldau'], fixtures: [
        f(1, '2026-09-26', 'Slowakei', 'Moldau'), f(1, '2026-09-26', 'Färöer', 'Kasachstan'),
        f(2, '2026-09-29', 'Slowakei', 'Kasachstan'), f(2, '2026-09-29', 'Moldau', 'Färöer'),
        f(3, '2026-10-02', 'Kasachstan', 'Moldau'), f(3, '2026-10-02', 'Färöer', 'Slowakei'),
        f(4, '2026-10-06', 'Kasachstan', 'Färöer'), f(4, '2026-10-06', 'Moldau', 'Slowakei'),
        f(5, '2026-11-13', 'Slowakei', 'Färöer'), f(5, '2026-11-13', 'Moldau', 'Kasachstan'),
        f(6, '2026-11-16', 'Kasachstan', 'Slowakei'), f(6, '2026-11-16', 'Färöer', 'Moldau'),
      ] },
      { id: 'C4', teams: ['Island', 'Bulgarien', 'Estland', 'Luxemburg'], fixtures: [
        f(1, '2026-09-26', 'Island', 'Estland'), f(1, '2026-09-26', 'Bulgarien', 'Luxemburg'),
        f(2, '2026-09-29', 'Bulgarien', 'Estland'), f(2, '2026-09-29', 'Luxemburg', 'Island'),
        f(3, '2026-10-03', 'Island', 'Bulgarien'), f(3, '2026-10-03', 'Estland', 'Luxemburg'),
        f(4, '2026-10-06', 'Estland', 'Island'), f(4, '2026-10-06', 'Luxemburg', 'Bulgarien'),
        f(5, '2026-11-13', 'Bulgarien', 'Island'), f(5, '2026-11-13', 'Luxemburg', 'Estland'),
        f(6, '2026-11-16', 'Island', 'Luxemburg'), f(6, '2026-11-16', 'Estland', 'Bulgarien'),
      ] },
    ],
  },
  {
    id: 'D', name: 'League D', note: 'Zwei Dreiergruppen, je vier Spiele. Gruppensieger steigen auf.',
    groups: [
      { id: 'D1', teams: ['Gibraltar', 'Malta', 'Andorra'], fixtures: [
        f(1, '2026-09-24', 'Andorra', 'Malta'),
        f(2, '2026-09-27', 'Gibraltar', 'Andorra'),
        f(3, '2026-10-01', 'Malta', 'Gibraltar'),
        f(4, '2026-10-04', 'Malta', 'Andorra'),
        f(5, '2026-11-13', 'Andorra', 'Gibraltar'),
        f(6, '2026-11-16', 'Gibraltar', 'Malta'),
      ] },
      { id: 'D2', teams: ['Litauen', 'Aserbaidschan', 'Liechtenstein'], fixtures: [
        f(1, '2026-09-24', 'Liechtenstein', 'Litauen'),
        f(2, '2026-09-27', 'Litauen', 'Aserbaidschan'),
        f(3, '2026-10-01', 'Aserbaidschan', 'Liechtenstein'),
        f(4, '2026-10-04', 'Aserbaidschan', 'Litauen'),
        f(5, '2026-11-13', 'Liechtenstein', 'Aserbaidschan'),
        f(6, '2026-11-16', 'Litauen', 'Liechtenstein'),
      ] },
    ],
  },
];

/** Alle Fixtures flach + chronologisch sortiert (für JSON-LD / Terminliste). */
export function nlAllFixtures(): (NLFixture & { league: string; group: string })[] {
  const out: (NLFixture & { league: string; group: string })[] = [];
  for (const lg of NL_LEAGUES) for (const g of lg.groups) for (const fx of g.fixtures) out.push({ ...fx, league: lg.id, group: g.id });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.group.localeCompare(b.group));
}

const DE_DATE = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
/** "2026-09-25" → "25. Sep 2026". */
export function nlFormatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return DE_DATE.format(d);
}
