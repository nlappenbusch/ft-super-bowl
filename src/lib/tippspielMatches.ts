export type TippspielMatch = {
  id: number;
  kickoffAt: string;
  date: string;
  time: string;
  group: string;
  home: string;
  away: string;
  homeCode: string;
  awayCode: string;
  homeColor: string;
  awayColor: string;
  venue: string;
};

// Kick-off timestamps are stored in UTC; date/time labels are Europe/Zurich.
export const TIPPSPIEL_MATCHES: TippspielMatch[] = [
  { id: 1, kickoffAt: '2026-06-14T17:00:00Z', date: 'SO · 14. JUNI', time: '19:00', group: 'GRUPPE E', home: 'Deutschland', away: 'Curaçao', homeCode: 'GER', awayCode: 'CUW', homeColor: '#1f2937', awayColor: '#2563eb', venue: 'Houston Stadium · Houston' },
  { id: 2, kickoffAt: '2026-06-14T20:00:00Z', date: 'SO · 14. JUNI', time: '22:00', group: 'GRUPPE F', home: 'Niederlande', away: 'Japan', homeCode: 'NED', awayCode: 'JPN', homeColor: '#f97316', awayColor: '#f8fafc', venue: 'Dallas Stadium · Dallas' },
  { id: 3, kickoffAt: '2026-06-14T23:00:00Z', date: 'MO · 15. JUNI', time: '01:00', group: 'GRUPPE E', home: 'Côte d’Ivoire', away: 'Ecuador', homeCode: 'CIV', awayCode: 'ECU', homeColor: '#f97316', awayColor: '#facc15', venue: 'Philadelphia Stadium · Philadelphia' },
  { id: 4, kickoffAt: '2026-06-15T02:00:00Z', date: 'MO · 15. JUNI', time: '04:00', group: 'GRUPPE F', home: 'Schweden', away: 'Tunesien', homeCode: 'SWE', awayCode: 'TUN', homeColor: '#2563eb', awayColor: '#dc2626', venue: 'Monterrey Stadium · Monterrey' },
  { id: 5, kickoffAt: '2026-06-18T19:00:00Z', date: 'DO · 18. JUNI', time: '21:00', group: 'GRUPPE B', home: 'Schweiz', away: 'Bosnien-Herzegowina', homeCode: 'SUI', awayCode: 'BIH', homeColor: '#dc2626', awayColor: '#2563eb', venue: 'Los Angeles Stadium · Los Angeles' },
  { id: 6, kickoffAt: '2026-06-18T22:00:00Z', date: 'FR · 19. JUNI', time: '00:00', group: 'GRUPPE B', home: 'Kanada', away: 'Katar', homeCode: 'CAN', awayCode: 'QAT', homeColor: '#dc2626', awayColor: '#7f1d1d', venue: 'Vancouver Stadium · Vancouver' },
];

export const TIPPSPIEL_MATCH_BY_ID = new Map(TIPPSPIEL_MATCHES.map((match) => [match.id, match]));
