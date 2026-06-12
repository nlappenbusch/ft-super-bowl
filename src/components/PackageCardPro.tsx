'use client';

import Link from 'next/link';
import { Ticket, Hotel, Wine, MapPin, Bus, Gift, Check, Star, ArrowRight } from 'lucide-react';

export interface PackageProInclude {
  name: string;
  type?: string | null;
  icon?: string | null;
}

export interface PackageProProps {
  id: string;
  eventSlug?: string;
  badge?: string;
  title: string;
  shortDescription?: string;
  hotel?: string;
  stars?: number;
  nights?: number;
  price: number;
  currency?: string;
  popular?: boolean;
  availableSpots?: number | null;
  includes?: PackageProInclude[];
}

const NAVY = '#143047';
const ORANGE = '#d9531e';

function fmtPrice(amount: number, currency?: string): string {
  const cur = (currency || 'EUR').toUpperCase();
  if (cur === 'EUR') return `${amount.toLocaleString('de-DE')} €`;
  return `${cur} ${amount.toLocaleString('de-CH')}`;
}

function IncludeIcon({ k }: { k?: string | null }) {
  const map: Record<string, typeof Ticket> = {
    ticket: Ticket, hotel: Hotel, hospitality: Wine,
    transfer: Bus, map: MapPin, gift: Gift, check: Check,
  };
  const Cmp = map[(k || 'check').toLowerCase()] || Check;
  return <Cmp className="h-[15px] w-[15px] shrink-0" style={{ color: ORANGE }} aria-hidden />;
}

export default function PackageCardPro({
  id, eventSlug, badge, title, shortDescription, hotel, stars = 0, nights = 0,
  price, currency, popular, availableSpots, includes = [],
}: PackageProProps) {
  const lowSpots = typeof availableSpots === 'number' && availableSpots > 0 && availableSpots <= 10;
  const href = `/booking?${eventSlug ? `event=${encodeURIComponent(eventSlug)}&` : ''}package=${encodeURIComponent(id)}&persons=2`;

  return (
    <div
      className="relative flex flex-col rounded-xl bg-white p-4 md:p-5 transition-all hover:-translate-y-1"
      style={{
        border: popular ? `2px solid ${NAVY}` : '0.5px solid #d8e0ea',
        boxShadow: popular ? '0 10px 26px rgba(20,48,71,0.16)' : '0 2px 10px rgba(20,48,71,0.06)',
      }}
    >
      {popular && (
        <span
          className="absolute -top-3 left-4 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold text-white"
          style={{ background: ORANGE }}
        >
          <Star className="h-3 w-3 fill-current" aria-hidden /> Highlight
        </span>
      )}

      {badge && (
        <span
          className="self-start rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={
            popular
              ? { background: '#fbe9e1', color: '#993c1d', marginTop: 6 }
              : { background: '#eef2f7', color: NAVY }
          }
        >
          {badge}
        </span>
      )}

      <h3 className="mt-2.5 mb-1 text-base font-extrabold leading-snug" style={{ color: NAVY }}>
        {title}
      </h3>
      {shortDescription && (
        <p className="text-[12.5px] leading-relaxed" style={{ color: '#5b6b7d' }}>
          {shortDescription}
        </p>
      )}

      {includes.length > 0 && (
        <>
          <div className="my-3 border-t" style={{ borderColor: '#eef2f7' }} />
          <ul className="flex flex-col gap-[7px] text-[12.5px]" style={{ color: '#33404d' }}>
            {includes.slice(0, 5).map((inc, i) => (
              <li key={i} className="flex items-center gap-[7px]">
                <IncludeIcon k={inc.icon || inc.type} />
                <span className="leading-snug">{inc.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto pt-3.5" style={{ borderTop: '0.5px solid #eef2f7', marginTop: '14px' }}>
        {(hotel || nights > 0 || stars > 0) && (
          <div className="mb-2.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: '#8190a0' }}>
            {hotel && <span>{hotel}</span>}
            {stars > 0 && <span style={{ color: '#f5b301' }}>{'★'.repeat(stars)}</span>}
            {nights > 0 && <span>· {nights} {nights === 1 ? 'Nacht' : 'Nächte'}</span>}
          </div>
        )}
        {lowSpots && (
          <div className="mb-1.5 text-[11.5px] font-bold" style={{ color: ORANGE }}>
            Nur noch {availableSpots} Plätze
          </div>
        )}
        <div className="text-[12px]" style={{ color: '#8190a0' }}>ab</div>
        <div className="text-[22px] font-extrabold leading-none" style={{ color: NAVY }}>
          {fmtPrice(price, currency)}
        </div>
        <div className="text-[11.5px]" style={{ color: '#8190a0' }}>pro Person im Doppelzimmer</div>

        <Link
          href={href}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-bold transition-all hover:opacity-90"
          style={
            popular
              ? { background: ORANGE, color: '#fff' }
              : { border: `1.5px solid ${NAVY}`, color: NAVY }
          }
        >
          Unverbindlich anfragen
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
