'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Send, Star, LayoutGrid } from 'lucide-react';
import { NL_LEAGUES, NL_FLAG, nlFormatDate, nlAllFixtures } from '@/lib/nationsLeague';

const NAVY = '#143047';
const ACCENT = '#d9531e';
const LEAGUE_TONE: Record<string, string> = { A: '#d9531e', B: '#2f6fb0', C: '#3f9e6a', D: '#8a7bd8' };

function flagUrl(team: string, big = false): string {
  return `https://flagcdn.com/${big ? 'w40' : 'w20'}/${NL_FLAG[team] || 'un'}.png`;
}

/** Top-Nationen für die „Kracher"-Auswahl. */
const BIG = new Set([
  'Deutschland', 'Frankreich', 'Spanien', 'Italien', 'England', 'Niederlande', 'Portugal', 'Belgien', 'Kroatien', 'Dänemark',
]);

function Flag({ team, big = false }: { team: string; big?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={flagUrl(team, big)} alt="" width={big ? 26 : 20} height={big ? 17 : 13} loading="lazy" style={{ display: 'inline-block', borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }} />;
}

function anfrageHref(home: string, away: string): string {
  return `/kontakt?event=uefa-nations-league-2026&spiel=${encodeURIComponent(`${home} – ${away}`)}`;
}

const LEAGUES = [
  { id: 'all', label: 'Alle Ligen' },
  { id: 'A', label: 'League A' },
  { id: 'B', label: 'League B' },
  { id: 'C', label: 'League C' },
  { id: 'D', label: 'League D' },
];

export default function NationsLeagueFixtures() {
  const all = useMemo(() => nlAllFixtures(), []);
  const featured = useMemo(
    () => all.filter((f) => f.league === 'A' && BIG.has(f.home) && BIG.has(f.away)).slice(0, 4),
    [all],
  );

  const [league, setLeague] = useState<string>('all');
  const [md, setMd] = useState<number>(0);

  const filtered = useMemo(
    () => all.filter((f) => (league === 'all' || f.league === league) && (md === 0 || f.md === md)),
    [all, league, md],
  );

  // nach Datum gruppieren
  const byDate = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const f of filtered) {
      const arr = m.get(f.date) || [];
      arr.push(f);
      m.set(f.date, arr);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div>
      {/* Top-Spiele */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Star className="h-5 w-5" style={{ color: ACCENT }} />
          <h2 className="text-xl font-extrabold" style={{ color: NAVY }}>Top-Spiele</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((f, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid #e5e8ed', boxShadow: '0 4px 20px rgba(20,48,71,0.06)' }}>
              <div className="px-4 pt-4">
                <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: LEAGUE_TONE.A }}>League A · Spieltag {f.md}</span>
              </div>
              <div className="flex flex-col items-center gap-2 px-4 py-4 text-center">
                <div className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: NAVY }}>
                  <Flag team={f.home} big /> {f.home}
                </div>
                <span className="text-xs font-semibold" style={{ color: '#9ca3af' }}>gegen</span>
                <div className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: NAVY }}>
                  <Flag team={f.away} big /> {f.away}
                </div>
                <div className="mt-1 text-xs" style={{ color: '#6b7280' }}>{nlFormatDate(f.date)} · Gruppe {f.group}</div>
              </div>
              <Link href={anfrageHref(f.home, f.away)} className="mt-auto flex items-center justify-center gap-1.5 py-3 text-sm font-bold text-white transition hover:opacity-90" style={{ background: ACCENT }}>
                <Send className="h-4 w-4" /> Reise anfragen
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {LEAGUES.map((l) => {
            const active = league === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setLeague(l.id)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition"
                style={active
                  ? { background: NAVY, color: '#fff' }
                  : { background: '#fff', color: '#475569', border: '1px solid #e5e8ed' }}
              >
                {l.label}
              </button>
            );
          })}
        </div>
        <select
          value={md}
          onChange={(e) => setMd(Number(e.target.value))}
          className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold"
          style={{ borderColor: '#e5e8ed', color: NAVY }}
        >
          <option value={0}>Alle Spieltage</option>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Spieltag {n}</option>)}
        </select>
      </div>

      {/* Ergebnis-Zähler */}
      <p className="mb-4 flex items-center gap-1.5 text-sm" style={{ color: '#6b7280' }}>
        <LayoutGrid className="h-4 w-4" /> {filtered.length} Spiele
      </p>

      {/* Spiele nach Datum */}
      <div className="space-y-6">
        {byDate.map(([date, games]) => (
          <div key={date}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-extrabold" style={{ color: NAVY }}>{nlFormatDate(date)}</span>
              <span className="h-px flex-1" style={{ background: '#e5e8ed' }} />
            </div>
            <div className="grid gap-2.5 lg:grid-cols-2">
              {games.map((g, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5" style={{ border: '1px solid #e5e8ed' }}>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: LEAGUE_TONE[g.league] }}>{g.group}</span>
                  <span className="flex flex-1 items-center justify-end gap-1.5 text-right text-sm font-semibold" style={{ color: NAVY }}>
                    <span className="truncate">{g.home}</span> <Flag team={g.home} />
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: '#9ca3af' }}>–</span>
                  <span className="flex flex-1 items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
                    <Flag team={g.away} /> <span className="truncate">{g.away}</span>
                  </span>
                  <Link href={anfrageHref(g.home, g.away)} title="Reise anfragen" className="shrink-0 rounded-lg p-1.5 transition hover:bg-orange-50" style={{ color: ACCENT }}>
                    <Send className="h-4 w-4" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
