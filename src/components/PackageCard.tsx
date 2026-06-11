'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import { useState } from 'react';

interface PackageCardProps {
  id: string;
  eventSlug?: string;
  stars: number;
  nights: number;
  price: number;
  title: string;
  description: string;
  popular?: boolean;
  singleSurcharge?: number;
  availableSpots?: number;
  rating?: number;
  reviews?: number;
  /** Event date range string, e.g. "23.05. – 06.06.2027" */
  eventDateRange?: string;
  /** ISO-Währungscode des Package-Preises, z.B. "EUR" oder "CHF" (Default: EUR) */
  currency?: string;
}

/** Preis inkl. Währung formatieren – EUR mit €-Suffix, alles andere mit Code-Präfix (z.B. "CHF 1'315"). */
export function formatPackagePrice(amount: number, currency?: string): string {
  const cur = (currency || 'EUR').toUpperCase();
  if (cur === 'EUR') return `${amount.toLocaleString('de-DE')} €`;
  return `${cur} ${amount.toLocaleString('de-CH')}`;
}

export default function PackageCard({
  id,
  eventSlug,
  stars,
  nights,
  price,
  title,
  description,
  popular,
  singleSurcharge,
  availableSpots,
  rating,
  reviews,
  eventDateRange,
  currency,
}: PackageCardProps) {
  const [numberOfPersons, setNumberOfPersons] = useState(2);

  const pricePerPerson = price;
  const estimatedTotal = numberOfPersons * pricePerPerson;

  const hasSpots = typeof availableSpots === 'number' && availableSpots > 0;
  const hasRating = typeof rating === 'number' && rating > 0;
  const hasReviews = typeof reviews === 'number' && reviews > 0;

  return (
    <div
      className="relative bg-white rounded-xl overflow-hidden"
      style={{
        border: popular ? '2px solid #143047' : '1.5px solid #e5e8ed',
        boxShadow: popular ? '0 6px 24px rgba(20,48,71,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Popular banner */}
      {popular && (
        <div
          className="text-white px-6 py-2.5 text-sm font-bold text-center"
          style={{ background: '#143047' }}
        >
          ⭐ Offizielles Hospitality-Package
        </div>
      )}

      {/* Availability badge */}
      {hasSpots && (
        <div
          className="absolute top-4 right-4 text-white px-3 py-1 rounded-full text-xs font-bold z-10"
          style={{ background: '#d9531e' }}
        >
          Nur noch {availableSpots} Plätze
        </div>
      )}

      <div className={`p-6 md:p-8 ${popular ? '' : 'pt-6'} ${hasSpots ? 'pt-10' : ''}`}>

        {/* Title */}
        <div className="mb-1 pr-24">
          <h4 className="text-xl md:text-2xl font-extrabold leading-tight" style={{ color: '#143047' }}>
            {title}
          </h4>
        </div>

        {/* Stars + Rating */}
        <div className="flex items-center gap-3 mb-4">
          {stars > 0 && (
            <div className="flex items-center gap-0.5">
              {[...Array(stars)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          )}
          {hasRating && (
            <span className="text-sm text-gray-600">
              <span className="font-bold text-gray-800">{rating}/5</span>
              {hasReviews && <span className="ml-1">({reviews} Bewertungen)</span>}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-gray-600 mb-6 text-sm md:text-base leading-relaxed">{description}</p>

        {/* Details row */}
        <div
          className="mb-5 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm"
          style={{ background: '#f5f7fa', border: '1px solid #e5e8ed' }}
        >
          <div>
            <div className="text-gray-500 mb-0.5">📅 Reisezeitraum</div>
            <div className="font-semibold text-gray-900">
              {eventDateRange || '–'}
            </div>
          </div>
          <div>
            <div className="text-gray-500 mb-0.5">🏨 Übernachtungen</div>
            <div className="font-semibold text-gray-900">
              {nights > 0 ? `${nights} Nächte im DZ` : '–'}
            </div>
          </div>
          {singleSurcharge && singleSurcharge > 0 ? (
            <div className="col-span-2">
              <div className="text-gray-500 mb-0.5">👤 Einzelzimmer-Zuschlag</div>
              <div className="font-semibold text-gray-900">+ {formatPackagePrice(singleSurcharge, currency)}</div>
            </div>
          ) : null}
        </div>

        {/* Person selector */}
        <div
          className="mb-5 rounded-lg p-4"
          style={{ background: '#fffbf5', border: '2px solid #f5c842' }}
        >
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">👥</span>
              <label className="text-sm font-semibold text-gray-900">Anzahl Reisende:</label>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNumberOfPersons(Math.max(1, numberOfPersons - 1))}
                disabled={numberOfPersons <= 1}
                className="w-9 h-9 rounded-lg border-2 font-bold text-lg flex items-center justify-center transition-all"
                style={{
                  borderColor: '#143047',
                  background: numberOfPersons <= 1 ? '#e5e7eb' : 'white',
                  color: numberOfPersons <= 1 ? '#9ca3af' : '#143047',
                  cursor: numberOfPersons <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                −
              </button>
              <div
                className="min-w-[120px] text-center text-base font-bold px-3 py-2 bg-white rounded-lg border-2"
                style={{ color: '#143047', borderColor: '#143047' }}
              >
                {numberOfPersons} {numberOfPersons === 1 ? 'Person' : 'Personen'}
              </div>
              <button
                onClick={() => setNumberOfPersons(Math.min(10, numberOfPersons + 1))}
                disabled={numberOfPersons >= 10}
                className="w-9 h-9 rounded-lg border-2 text-white font-bold text-lg flex items-center justify-center transition-all"
                style={{
                  borderColor: '#143047',
                  background: numberOfPersons >= 10 ? '#e5e7eb' : '#143047',
                  cursor: numberOfPersons >= 10 ? 'not-allowed' : 'pointer',
                }}
              >
                +
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            💡 Zimmerkonfiguration im nächsten Schritt anpassbar
          </p>
        </div>

        {/* Price + CTA */}
        <div style={{ borderTop: '1.5px solid #e5e8ed', paddingTop: '1.25rem' }}>
          <div className="mb-4">
            <div className="text-4xl font-extrabold" style={{ color: '#143047' }}>
              {formatPackagePrice(pricePerPerson, currency)}
            </div>
            <div className="text-sm text-gray-500 mt-0.5">pro Person im Doppelzimmer</div>
            {numberOfPersons > 1 && (
              <div className="mt-2 inline-block rounded-lg px-3 py-1.5" style={{ background: '#fff3ee', border: '1px solid #f5c2af' }}>
                <span className="text-base font-bold" style={{ color: '#d9531e' }}>
                  ab {formatPackagePrice(estimatedTotal, currency)} Gesamt
                </span>
                <span className="text-xs text-gray-500 ml-2">für {numberOfPersons} Personen (geschätzt)</span>
              </div>
            )}
          </div>

          <Link
            href={`/booking?${eventSlug ? `event=${encodeURIComponent(eventSlug)}&` : ''}package=${encodeURIComponent(id)}&persons=${numberOfPersons}`}
            className="block w-full text-white font-bold py-4 px-6 rounded-lg text-center text-base md:text-lg transition-all hover:opacity-90 hover:-translate-y-0.5"
            style={{ background: '#d9531e', boxShadow: '0 4px 12px rgba(217,83,30,0.25)' }}
          >
            Jetzt für {numberOfPersons} {numberOfPersons === 1 ? 'Person' : 'Personen'} anfragen →
          </Link>

          <div className="flex flex-wrap justify-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid #f0f0f0' }}>
            {['Sichere Buchung', 'Reisegarantie', 'Kostenlose Beratung', 'Flexible Zahlung'].map((t) => (
              <div key={t} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="text-green-500 font-bold">✓</span> {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
