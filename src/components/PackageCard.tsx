'use client';

import Link from 'next/link';
import { Star, Hotel } from 'lucide-react';
import { useState } from 'react';

interface PackageCardProps {
  id: string;
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
}

export default function PackageCard({ 
  id, 
  stars, 
  nights, 
  price, 
  title, 
  description, 
  popular,
  singleSurcharge = 1485,
  availableSpots = 12,
  rating = 4.8,
  reviews = 156
}: PackageCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [numberOfPersons, setNumberOfPersons] = useState(2);

  const pricePerPerson = price;
  const estimatedTotal = numberOfPersons * pricePerPerson;
  
  const handlePersonsChange = (persons: number) => {
    setNumberOfPersons(persons);
  };

  return (
    <>
      <div className={`relative bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${popular ? 'ring-4 ring-blue-500' : ''}`}>
        {popular && (
          <div style={{ background: 'linear-gradient(135deg, #f14624 0%, #d63d1f 100%)' }} className="absolute top-0 left-0 right-0 text-white px-6 py-2 text-sm font-bold text-center z-10">
            ⭐ Offizielles Hospitality-Package
          </div>
        )}
        
        {/* Availability Badge */}
        <div className="absolute top-5 right-5 bg-red-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg z-10 animate-pulse">
          ⏰ Nur noch {availableSpots} Plätze
        </div>

        <div className="p-8 pt-16">
          {/* Title & Rating */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Hotel className="w-6 h-6" style={{ color: '#184a7b' }} />
              <h4 className="text-2xl font-bold text-gray-900">{title}</h4>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center">
                {[...Array(stars)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-gray-900">{rating}/5</span>
                <span className="text-gray-500">({reviews} Bewertungen)</span>
              </div>
            </div>
          </div>

          <p className="text-gray-600 mb-6 text-base leading-relaxed">{description}</p>

          {/* Person Count Selection */}
          <div className="bg-yellow-50 p-5 rounded-lg mb-5 border-2 border-yellow-400">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">👥</span>
                <label className="text-base font-semibold text-gray-900">
                  Anzahl Reisende:
                </label>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePersonsChange(Math.max(1, numberOfPersons - 1))}
                  disabled={numberOfPersons <= 1}
                  className="w-10 h-10 rounded-lg border-2 font-bold text-xl flex items-center justify-center transition-all duration-200"
                  style={{
                    borderColor: '#184a7b',
                    background: numberOfPersons <= 1 ? '#e5e7eb' : 'white',
                    color: numberOfPersons <= 1 ? '#9ca3af' : '#184a7b',
                    cursor: numberOfPersons <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  −
                </button>
                
                <div 
                  className="min-w-[140px] text-center text-lg font-bold px-4 py-2 bg-white rounded-lg border-2"
                  style={{ color: '#184a7b', borderColor: '#184a7b' }}
                >
                  {numberOfPersons} {numberOfPersons === 1 ? 'Person' : 'Personen'}
                </div>
                
                <button
                  onClick={() => handlePersonsChange(Math.min(10, numberOfPersons + 1))}
                  disabled={numberOfPersons >= 10}
                  className="w-10 h-10 rounded-lg border-2 text-white font-bold text-xl flex items-center justify-center transition-all duration-200"
                  style={{
                    borderColor: '#184a7b',
                    background: numberOfPersons >= 10 ? '#e5e7eb' : '#184a7b',
                    cursor: numberOfPersons >= 10 ? 'not-allowed' : 'pointer'
                  }}
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600 text-center">
              💡 Die Zimmerkonfiguration können Sie im nächsten Schritt anpassen
            </div>
          </div>

          {/* Package Details */}
          <div className="mb-6 bg-gray-50 p-5 rounded-lg border-2 border-gray-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600 mb-1">📅 Reisezeitraum:</div>
                <div className="font-semibold text-gray-900">12.-16. Februar 2027</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">🏨 Übernachtungen:</div>
                <div className="font-semibold text-gray-900">{nights} Nächte im Doppelzimmer</div>
              </div>
            </div>
          </div>

          {/* Price & CTA */}
          <div className="border-t-2 border-gray-200 pt-6">
            <div className="flex justify-between items-start flex-wrap gap-4 mb-6">
              <div>
                <div className="text-4xl font-bold transition-all duration-300" style={{ color: '#184a7b' }}>
                  {pricePerPerson.toLocaleString('de-DE')} €
                </div>
                <div className="text-sm text-gray-600 mt-1 mb-2">pro Person im Doppelzimmer</div>
                {numberOfPersons > 1 && (
                  <div className="inline-block mt-2 px-3 py-2 bg-red-50 rounded-lg">
                    <div className="text-lg font-bold" style={{ color: '#f14624' }}>
                      ab {estimatedTotal.toLocaleString('de-DE')} € Gesamt
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      für {numberOfPersons} Personen (geschätzt)
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Link
              href={`/booking?package=${id}&persons=${numberOfPersons}`}
              className="block w-full text-white font-bold py-4 px-6 rounded-lg text-center transition-all duration-300 text-lg"
              style={{ 
                backgroundColor: isHovered ? '#d63d1f' : '#f14624',
                transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                boxShadow: isHovered ? '0 10px 25px rgba(241, 70, 36, 0.3)' : '0 2px 4px rgba(241, 70, 36, 0.2)'
              }}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              Jetzt für {numberOfPersons} {numberOfPersons === 1 ? 'Person' : 'Personen'} anfragen →
            </Link>

            {/* Trust Elements */}
            <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="text-green-500 font-bold">✓</span> Sichere Buchung
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="text-green-500 font-bold">✓</span> Reisegarantie
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="text-green-500 font-bold">✓</span> Kostenlose Beratung
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="text-green-500 font-bold">✓</span> Flexible Zahlung
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
