'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Ticket, Hotel, Wine, MapPin, Bus, Gift, Check, Star, ArrowRight, ChevronDown, ChevronUp, Camera } from 'lucide-react';

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
  /** Hotelfotos — erstes Bild ist der Card-Header, weitere als klickbare Thumbnails. */
  images?: string[] | null;
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
  price, currency, popular, availableSpots, includes = [], images,
}: PackageProProps) {
  const [open, setOpen] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  // Kontingent: explizite 0 = ausgebucht (sichtbar, nicht buchbar). Zahlen werden nie angezeigt.
  const soldOut = availableSpots === 0;
  const lowSpots = !soldOut && typeof availableSpots === 'number' && availableSpots > 0 && availableSpots <= 10;
  const photos = (images || []).filter(Boolean);
  const heroImg = photos[Math.min(imgIdx, Math.max(photos.length - 1, 0))];
  const href = `/booking?${eventSlug ? `event=${encodeURIComponent(eventSlug)}&` : ''}package=${encodeURIComponent(id)}&persons=2`;

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white transition-all hover:-translate-y-1"
      style={{
        border: popular && !soldOut ? `2px solid ${NAVY}` : '0.5px solid #d8e0ea',
        boxShadow: popular && !soldOut ? '0 10px 26px rgba(20,48,71,0.16)' : '0 2px 10px rgba(20,48,71,0.06)',
      }}
    >
      {/* ── Foto-Header ── */}
      {heroImg && (
        <div className="relative h-44 md:h-48 overflow-hidden" style={{ background: '#eef2f7' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImg}
            alt={hotel || title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            style={soldOut ? { filter: 'grayscale(0.55) brightness(0.9)' } : undefined}
            loading="lazy"
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(20,48,71,0.05) 40%, rgba(20,48,71,0.68) 100%)' }} />

          {/* Badges auf dem Bild */}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5 pr-3">
            {badge && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.92)', color: NAVY }}>
                {badge}
              </span>
            )}
            {popular && !soldOut && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: ORANGE }}>
                <Star className="h-3 w-3 fill-current" aria-hidden /> Highlight
              </span>
            )}
          </div>

          {soldOut && (
            <span className="absolute right-3 top-3 rounded-full px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wide text-white" style={{ background: 'rgba(20,48,71,0.92)' }}>
              Ausgebucht
            </span>
          )}

          {/* Hotelname + Sterne unten auf dem Bild */}
          <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
            <div className="min-w-0">
              {hotel && <div className="truncate text-[13px] font-bold text-white drop-shadow">{hotel}</div>}
              {stars > 0 && <div className="text-[11px] leading-tight" style={{ color: '#f5b301' }}>{'★'.repeat(stars)}</div>}
            </div>
            {photos.length > 1 && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white" style={{ background: 'rgba(20,48,71,0.55)' }}>
                <Camera className="h-3 w-3" aria-hidden /> {photos.length} Fotos
              </span>
            )}
          </div>
        </div>
      )}

      {/* Thumbnails (klickbar) */}
      {photos.length > 1 && (
        <div className="flex gap-1.5 px-4 pt-3 md:px-5">
          {photos.slice(0, 4).map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setImgIdx(i)}
              className="h-12 w-16 shrink-0 overflow-hidden rounded-md transition-all"
              style={{
                outline: i === imgIdx ? `2px solid ${ORANGE}` : '1px solid #d8e0ea',
                outlineOffset: '-1px',
                opacity: i === imgIdx ? 1 : 0.75,
              }}
              aria-label={`Foto ${i + 1} anzeigen`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col p-4 md:p-5">
        {/* Fallback-Badges, wenn kein Foto vorhanden */}
        {!heroImg && (badge || popular || soldOut) && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {badge && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: '#eef2f7', color: NAVY }}>{badge}</span>
            )}
            {popular && !soldOut && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: ORANGE }}>
                <Star className="h-3 w-3 fill-current" aria-hidden /> Highlight
              </span>
            )}
            {soldOut && (
              <span className="rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white" style={{ background: NAVY }}>Ausgebucht</span>
            )}
          </div>
        )}

        <h3 className="mb-1 text-[17px] font-extrabold leading-snug" style={{ color: NAVY }}>
          {title}
        </h3>
        {shortDescription && (
          <p className="text-[13px] leading-relaxed" style={{ color: '#5b6b7d' }}>
            {shortDescription}
          </p>
        )}

        {includes.length > 0 && (
          <>
            <div className="my-3.5 border-t" style={{ borderColor: '#eef2f7' }} />
            {/* Mobile: Leistungen einklappbar (Vorschau spart Scrollen) */}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="mb-1.5 flex items-center gap-1 text-[12px] font-bold sm:hidden"
              style={{ color: NAVY }}
              aria-expanded={open}
            >
              {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {open ? 'Leistungen ausblenden' : `Leistungen anzeigen (${includes.length})`}
            </button>
            <ul className={`${open ? 'flex' : 'hidden'} flex-col gap-2 text-[13px] sm:flex`} style={{ color: '#33404d' }}>
              {includes.slice(0, 6).map((inc, i) => (
                <li key={i} className="flex items-center gap-2">
                  <IncludeIcon k={inc.icon || inc.type} />
                  <span className="leading-snug">{inc.name}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-auto pt-4" style={{ borderTop: '0.5px solid #eef2f7', marginTop: '16px' }}>
          {(hotel || nights > 0) && !heroImg && (
            <div className="mb-2.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: '#8190a0' }}>
              {hotel && <span>{hotel}</span>}
              {stars > 0 && <span style={{ color: '#f5b301' }}>{'★'.repeat(stars)}</span>}
              {nights > 0 && <span>· {nights} {nights === 1 ? 'Nacht' : 'Nächte'}</span>}
            </div>
          )}
          {nights > 0 && heroImg && (
            <div className="mb-2 text-[11.5px]" style={{ color: '#8190a0' }}>
              {nights} {nights === 1 ? 'Nacht' : 'Nächte'} · Preis pro Person im Doppelzimmer
            </div>
          )}
          {lowSpots && (
            <div className="mb-1.5 text-[11.5px] font-bold" style={{ color: ORANGE }}>
              Nur noch wenige Plätze verfügbar
            </div>
          )}
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-[12px]" style={{ color: '#8190a0' }}>ab</div>
              <div className="text-[24px] font-extrabold leading-none" style={{ color: soldOut ? '#8190a0' : NAVY }}>
                {fmtPrice(price, currency)}
              </div>
              {!heroImg && <div className="text-[11.5px]" style={{ color: '#8190a0' }}>pro Person im Doppelzimmer</div>}
            </div>
          </div>

          {soldOut ? (
            <div
              className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-bold"
              style={{ background: '#eef2f7', color: '#8190a0', border: '1.5px solid #d8e0ea' }}
              aria-disabled="true"
            >
              Ausgebucht
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
