'use client';

/**
 * ProgramView — Tagesablauf aus den Kalkulationspositionen (Leistungsdatum,
 * Uhrzeit, Strecke). Intern mit Anbieter und Preisstatus.
 */
import { COLORS } from '@/components/admin/ui';
import {
  buildProgram, programTime, programDayLabel, programPrefix, fmtRoute, categoryLabel, priceStatusLabel, type CalcItem,
} from '@/lib/calcModel';

export default function ProgramView({ items }: { items: CalcItem[] }) {
  const days = buildProgram(items);
  if (days.length === 0) {
    return <p className="text-sm" style={{ color: COLORS.textMuted }}>Noch keine Positionen mit Leistungsdatum.</p>;
  }
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <div key={d.date || 'ohne'}>
          <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wider" style={{ color: COLORS.accent }}>
            {programDayLabel(days, d.date)}
          </div>
          <ol className="border-l-2 pl-3" style={{ borderColor: COLORS.stroke }}>
            {d.entries.map((e, i) => {
              const it = e.item;
              const route = fmtRoute(it);
              const meta = [it.supplier_name, priceStatusLabel(it.price_status)].filter(Boolean).join(' · ');
              return (
                <li key={`${it.id}-${e.phase}-${i}`} className="relative py-1.5">
                  <span className="absolute -left-[17px] top-3 h-2 w-2 rounded-full" style={{ background: COLORS.accent }} />
                  <div className="flex gap-3">
                    <span className="w-24 shrink-0 text-xs font-bold tabular-nums" style={{ color: COLORS.navy }}>{programTime(e) || '—'}</span>
                    <div className="min-w-0 text-sm" style={{ color: COLORS.navy }}>
                      <span className="font-semibold">
                        {programPrefix(e)}
                        {it.description.trim() || categoryLabel(it.category)}
                      </span>
                      {route && <span className="block text-xs" style={{ color: COLORS.textMuted }}>{route}</span>}
                      {it.pickup_point && <span className="block text-xs" style={{ color: COLORS.textMuted }}>Treffpunkt: {it.pickup_point}</span>}
                      {meta && <span className="block text-[11px]" style={{ color: '#9ca3af' }}>{meta}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
