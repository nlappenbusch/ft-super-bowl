'use client';

import { MapPin, Users, ArrowRight } from 'lucide-react';

export interface SpielortItem {
  name: string;
  subtitle?: string | null;
  capacity?: string | null;
  note?: string | null;
  filter?: string | null;
}

/**
 * Spielorte/Vereine-Modul: generisches Karten-Grid.
 * Einsatz z.B. für Top-Clubs einer Liga (Bundesliga) oder Host-Cities (WM 2026).
 * Klick auf eine Karte filtert den Spielplan und scrollt dorthin.
 */
export default function SpielorteSection({
  items,
  hasSpielplan,
  onSelect,
}: {
  items: SpielortItem[];
  hasSpielplan: boolean;
  onSelect: (filter: string) => void;
}) {
  const handleClick = (item: SpielortItem) => {
    if (!hasSpielplan || !item.filter) return;
    onSelect(item.filter);
    // Zum Spielplan scrollen (nach dem Re-Render)
    requestAnimationFrame(() => {
      document.getElementById('spielplan')?.scrollIntoView({ behavior: 'smooth' });
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const clickable = hasSpielplan && !!item.filter;
        return (
          <button
            key={item.name}
            type="button"
            onClick={() => handleClick(item)}
            disabled={!clickable}
            className={`group flex flex-col rounded-xl bg-white p-5 text-left transition-all ${clickable ? 'cursor-pointer hover:-translate-y-1 hover:shadow-lg' : 'cursor-default'}`}
            style={{ border: '1.5px solid #e5e8ed', boxShadow: '0 2px 8px rgba(20,48,71,0.06)' }}
          >
            <div className="mb-1 text-base font-extrabold leading-snug" style={{ color: '#143047' }}>
              {item.name}
            </div>
            {item.subtitle && (
              <div className="mb-2 flex items-start gap-1.5 text-sm text-gray-600">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: '#d9531e' }} />
                <span>{item.subtitle}</span>
              </div>
            )}
            {item.capacity && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                <Users className="h-3.5 w-3.5 shrink-0" style={{ color: '#143047' }} />
                {item.capacity}
              </div>
            )}
            {item.note && (
              <div className="mt-2 inline-flex self-start rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: '#eef3fb', color: '#18395a' }}>
                {item.note}
              </div>
            )}
            {clickable && (
              <div className="mt-auto flex items-center gap-1 pt-3 text-xs font-bold transition-colors" style={{ color: '#d9531e' }}>
                Spiele anzeigen
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
