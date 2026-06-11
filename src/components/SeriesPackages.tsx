'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';

export interface SeriesPackageItem {
  id: string;
  slug: string;
  title: string;
  price: number;
  currency?: string;
  popular: boolean;
  shortDescription: string;
  availableSpots: number | null;
}

function fmtPrice(amount: number, currency?: string): string {
  const cur = (currency || 'EUR').toUpperCase();
  if (cur === 'EUR') return `${amount.toLocaleString('de-DE')} €`;
  return `${cur} ${amount.toLocaleString('de-CH')}`;
}
export interface SeriesPackageGroup {
  eventSegment: string;
  eventName: string;
  packages: SeriesPackageItem[];
}

export default function SeriesPackages({
  seriesSlug,
  groups,
}: {
  seriesSlug: string;
  groups: SeriesPackageGroup[];
}) {
  const [filter, setFilter] = useState<string>('all');
  const total = groups.reduce((s, g) => s + g.packages.length, 0);
  const visible = filter === 'all' ? groups : groups.filter((g) => g.eventSegment === filter);

  const rows = visible.flatMap((g) =>
    g.packages.map((p) => ({ ...p, eventSegment: g.eventSegment, eventName: g.eventName }))
  );

  return (
    <div>
      {/* Filter */}
      {groups.length > 1 && (
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="rounded-full px-4 py-2 text-sm font-bold transition-all"
            style={{ background: filter === 'all' ? '#143047' : '#eef2f7', color: filter === 'all' ? '#fff' : '#143047' }}
          >
            Alle ({total})
          </button>
          {groups.map((g) => (
            <button
              key={g.eventSegment}
              type="button"
              onClick={() => setFilter(g.eventSegment)}
              className="rounded-full px-4 py-2 text-sm font-bold transition-all"
              style={{ background: filter === g.eventSegment ? '#143047' : '#eef2f7', color: filter === g.eventSegment ? '#fff' : '#143047' }}
            >
              {g.eventName} ({g.packages.length})
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((p) => (
          <Link
            key={`${p.eventSegment}-${p.id}`}
            href={`/${seriesSlug}/${p.eventSegment}#pkg-${p.slug || p.id}`}
            className="group flex flex-col rounded-2xl p-5 transition-all hover:-translate-y-1"
            style={{
              background: p.popular ? '#143047' : '#fff',
              border: p.popular ? '2px solid #143047' : '1.5px solid #e5e8ed',
              color: p.popular ? '#fff' : '#143047',
              boxShadow: p.popular ? '0 10px 26px rgba(20,48,71,0.18)' : '0 2px 10px rgba(20,48,71,0.06)',
            }}
          >
            {/* Event-Zuordnung */}
            <div className="mb-2 flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
                style={{ background: p.popular ? 'rgba(255,255,255,0.15)' : '#eef2f7', color: p.popular ? '#fff' : '#143047' }}
              >
                {p.eventName}
              </span>
              {p.popular && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: '#f5c842' }}>
                  <Star className="h-3.5 w-3.5 fill-current" /> Beliebt
                </span>
              )}
            </div>

            <div className="text-lg font-extrabold leading-snug">{p.title}</div>
            {p.shortDescription && (
              <div className="mt-1 text-sm" style={{ opacity: 0.72 }}>
                {p.shortDescription.slice(0, 90)}{p.shortDescription.length > 90 ? '…' : ''}
              </div>
            )}
            {p.availableSpots !== null && p.availableSpots <= 10 && (
              <div className="mt-2 text-xs font-bold" style={{ color: p.popular ? '#fca5a5' : '#d9531e' }}>
                Nur noch {p.availableSpots} Plätze
              </div>
            )}

            <div className="mt-auto pt-4">
              {p.price > 0 && (
                <>
                  <div className="text-2xl font-extrabold">ab {fmtPrice(p.price, p.currency)}</div>
                  <div className="text-xs" style={{ opacity: 0.65 }}>pro Person im DZ</div>
                </>
              )}
              <div
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-all group-hover:opacity-90"
                style={{ background: p.popular ? '#d9531e' : '#143047', color: '#fff' }}
              >
                Details &amp; Buchen <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
