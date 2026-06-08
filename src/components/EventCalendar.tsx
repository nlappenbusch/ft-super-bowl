'use client';

/**
 * EventCalendar – interaktiver Event-Zeitstrahl.
 * Daten kommen server-gerendert (SEO), Filter & Countdown laufen clientseitig.
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, CalendarDays, Star } from 'lucide-react';

export interface CalEvent {
  href: string;
  name: string;
  category: string;
  seriesTitle: string | null;
  dateLabel: string;
  startISO: string;
  location: string | null;
  image: string | null;
  featured: boolean;
  monthLabel: string;
}

function countdownLabel(startISO: string, now: number | null): string | null {
  if (now === null) return null;
  const d = new Date(`${startISO}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const days = Math.ceil((d.getTime() - now) / 86400000);
  if (days < 0) return 'läuft';
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  return `in ${days} Tagen`;
}

export default function EventCalendar({ events }: { events: CalEvent[] }) {
  const [now, setNow] = useState<number | null>(null);
  const [active, setActive] = useState<string>('all');
  useEffect(() => { setNow(Date.now()); }, []);

  const categories = useMemo(() => {
    const set = new Set(events.map((e) => e.category).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [events]);

  const filtered = useMemo(
    () => (active === 'all' ? events : events.filter((e) => e.category === active)),
    [events, active]
  );

  const featured = useMemo(() => filtered.filter((e) => e.featured), [filtered]);

  // Nach Monat gruppieren (Reihenfolge bleibt, da events bereits sortiert sind)
  const groups = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const e of filtered) {
      if (!map.has(e.monthLabel)) map.set(e.monthLabel, []);
      map.get(e.monthLabel)!.push(e);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      {/* Filter-Tabs */}
      {categories.length > 2 && (
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setActive(c)}
              className="rounded-full px-4 py-2 text-sm font-bold transition-all"
              style={{
                background: active === c ? '#143047' : '#eef2f7',
                color: active === c ? '#fff' : '#143047',
                boxShadow: active === c ? '0 6px 16px rgba(20,48,71,0.25)' : 'none',
              }}
            >
              {c === 'all' ? 'Alle' : c}
            </button>
          ))}
        </div>
      )}

      {/* Featured-Spotlight */}
      {featured.length > 0 && (
        <div className="mb-14 grid gap-5 md:grid-cols-2">
          {featured.slice(0, 2).map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="group relative overflow-hidden rounded-2xl text-white shadow-xl"
              style={{ minHeight: 230 }}
            >
              {e.image && <Image src={e.image} alt={e.name} fill className="object-cover transition-transform duration-700 group-hover:scale-105" />}
              <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,24,40,0.35) 0%, rgba(11,24,40,0.88) 100%)' }} />
              <div className="relative flex h-full flex-col justify-end p-6">
                <span className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest" style={{ background: '#d9531e' }}>
                  <Star className="h-3.5 w-3.5" /> Featured
                </span>
                <h3 className="text-2xl font-extrabold leading-tight">{e.name}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" style={{ color: '#f5c842' }} /> {e.dateLabel}</span>
                  {e.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" style={{ color: '#f5c842' }} /> {e.location}</span>}
                  {countdownLabel(e.startISO, now) && (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: 'rgba(245,200,66,0.22)', color: '#f5c842' }}>{countdownLabel(e.startISO, now)}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Zeitstrahl */}
      {groups.length === 0 ? (
        <p className="py-16 text-center text-gray-400">Aktuell keine anstehenden Events in dieser Kategorie.</p>
      ) : (
        <div className="relative">
          {groups.map(([month, items]) => (
            <div key={month} className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <span className="rounded-full px-4 py-1.5 text-sm font-extrabold uppercase tracking-widest text-white" style={{ background: '#143047' }}>{month}</span>
                <span className="h-px flex-1" style={{ background: '#e5e8ed' }} />
              </div>

              <ol className="relative ml-3 space-y-4 border-l-2" style={{ borderColor: '#dbe3ec' }}>
                {items.map((e) => {
                  const cd = countdownLabel(e.startISO, now);
                  return (
                    <li key={e.href} className="relative pl-6">
                      <span
                        className="absolute -left-[9px] top-5 h-4 w-4 rounded-full border-2 border-white"
                        style={{ background: e.featured ? '#d9531e' : '#3a7cbe', boxShadow: '0 0 0 3px #e8eef5' }}
                      />
                      <Link
                        href={e.href}
                        className="flex flex-col gap-3 rounded-xl border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center"
                        style={{ borderColor: e.featured ? '#f0c08a' : '#e5e8ed' }}
                      >
                        {e.image && (
                          <span className="relative h-20 w-full shrink-0 overflow-hidden rounded-lg sm:w-32">
                            <Image src={e.image} alt={e.name} fill className="object-cover" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            {e.featured && <Star className="h-4 w-4" style={{ color: '#d9531e' }} />}
                            <span className="text-base font-extrabold" style={{ color: '#143047' }}>{e.name}</span>
                            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: '#eef2f7', color: '#18395a' }}>{e.category}</span>
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-gray-400" /> {e.dateLabel}</span>
                            {e.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-gray-400" /> {e.location}</span>}
                          </span>
                        </span>
                        {cd && (
                          <span className="shrink-0 rounded-full px-3 py-1.5 text-sm font-bold" style={{ background: e.featured ? '#fbe7d6' : '#eef3fb', color: e.featured ? '#b8511f' : '#18395a' }}>
                            {cd}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
