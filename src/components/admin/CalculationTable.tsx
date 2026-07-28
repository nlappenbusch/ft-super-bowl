'use client';

/**
 * CalculationTable — sauber formatierte Kalkulationstabelle (TASK-00116).
 * Gruppiert nach Kategorie, mit Zwischensummen, Kurs-Spalte und
 * EK/Marge/VK-Fuß. Alle Preise pro Person. Verwendet im Editor und im
 * Accordion der Übersicht.
 */
import { COLORS } from '@/components/admin/ui';
import {
  CALC_CATEGORIES, computeTotals, itemEk, fmtMoney, categoryLabel,
  type CalcItem, type MarginMode,
} from '@/lib/calcModel';
import { convertAmount, type CalcCurrency, type RatesSnapshot } from '@/lib/fxRates';

export default function CalculationTable({
  items, target, rates, marginMode, marginValue,
}: {
  items: CalcItem[];
  target: CalcCurrency;
  rates: RatesSnapshot | null;
  marginMode: MarginMode;
  marginValue: number;
}) {
  const totals = computeTotals(items, target, rates, marginMode, marginValue);

  // Kategorien in Definitions-Reihenfolge + unbekannte Alt-Kategorien hinten anstellen.
  const knownIds = CALC_CATEGORIES.map((c) => c.id as string);
  const extraIds = Array.from(new Set(items.map((i) => i.category))).filter((c) => !knownIds.includes(c));
  const groups = [...knownIds, ...extraIds]
    .map((id) => ({ id, label: categoryLabel(id), items: items.filter((i) => i.category === id && (i.description.trim() || i.amount > 0)) }))
    .filter((g) => g.items.length > 0);

  if (groups.length === 0) {
    return <p className="py-4 text-sm" style={{ color: COLORS.textMuted }}>Noch keine Positionen erfasst.</p>;
  }

  const cellNum = 'px-3 py-2 text-right tabular-nums whitespace-nowrap';

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: COLORS.stroke }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider" style={{ color: COLORS.textMuted, background: COLORS.surfaceMuted }}>
            <th className="px-3 py-2.5 font-bold">Position</th>
            <th className="px-3 py-2.5 text-center font-bold">Menge</th>
            <th className="px-3 py-2.5 text-right font-bold">EK p.P.</th>
            <th className="px-3 py-2.5 text-right font-bold">Kurs</th>
            <th className="px-3 py-2.5 text-right font-bold">EK p.P. ({target})</th>
          </tr>
        </thead>
        {groups.map((g) => {
          const subTotal = rates ? g.items.reduce((s, i) => s + convertAmount(itemEk(i), i.currency, target, rates), 0) : null;
          return (
            <tbody key={g.id}>
              <tr>
                <td colSpan={5} className="border-t px-3 pb-1 pt-2.5 text-xs font-extrabold uppercase tracking-wider" style={{ color: COLORS.accent, borderColor: COLORS.stroke }}>
                  {g.label}
                </td>
              </tr>
              {g.items.map((item) => {
                const rate = rates && item.currency !== target ? convertAmount(1, item.currency, target, rates) : null;
                const inTarget = rates ? convertAmount(itemEk(item), item.currency, target, rates) : null;
                return (
                  <tr key={item.id} className="border-t" style={{ borderColor: '#f1f4f8' }}>
                    <td className="px-3 py-2" style={{ color: COLORS.navy }}>
                      <span className="font-medium">{item.description.trim() || g.label}</span>
                      {(item.room_category || '').trim() && (
                        <span className="block text-xs" style={{ color: COLORS.textMuted }}>{item.room_category}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-gray-600">{item.qty}×</td>
                    <td className={cellNum} style={{ color: COLORS.navy }}>{fmtMoney(item.amount, item.currency)}</td>
                    <td className={cellNum} style={{ color: COLORS.textMuted }}>{rate !== null ? rate.toFixed(4) : '–'}</td>
                    <td className={`${cellNum} font-semibold`} style={{ color: COLORS.navy }}>
                      {inTarget !== null ? fmtMoney(inTarget, target) : '–'}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: '#fafbfc' }}>
                <td colSpan={4} className="border-t px-3 py-1.5 text-right text-xs font-semibold" style={{ color: COLORS.textMuted, borderColor: '#f1f4f8' }}>
                  Zwischensumme {g.label}
                </td>
                <td className="border-t px-3 py-1.5 text-right text-xs font-bold tabular-nums" style={{ color: COLORS.navy, borderColor: '#f1f4f8' }}>
                  {subTotal !== null ? fmtMoney(subTotal, target) : '–'}
                </td>
              </tr>
            </tbody>
          );
        })}
        <tfoot>
          {totals ? (
            <>
              <tr className="border-t-2" style={{ borderColor: COLORS.navy }}>
                <td colSpan={4} className="px-3 pb-1 pt-2.5 text-right text-sm font-bold" style={{ color: COLORS.navy }}>EK gesamt (pro Person)</td>
                <td className="px-3 pb-1 pt-2.5 text-right text-sm font-bold tabular-nums" style={{ color: COLORS.navy }}>{fmtMoney(totals.ekTarget, target)}</td>
              </tr>
              <tr>
                <td colSpan={4} className="px-3 py-1 text-right text-sm" style={{ color: totals.marginAmount < 0 ? COLORS.danger : COLORS.textMuted }}>
                  Marge ({totals.marginPercent.toFixed(1).replace('.', ',')} %)
                </td>
                <td className="px-3 py-1 text-right text-sm font-semibold tabular-nums" style={{ color: totals.marginAmount < 0 ? COLORS.danger : COLORS.textMuted }}>
                  {fmtMoney(totals.marginAmount, target)}
                </td>
              </tr>
              <tr>
                <td colSpan={4} className="px-3 pb-3 pt-1 text-right text-base font-extrabold" style={{ color: COLORS.navy }}>VK gesamt (pro Person)</td>
                <td className="px-3 pb-3 pt-1 text-right text-base font-extrabold tabular-nums" style={{ color: COLORS.accent }}>{fmtMoney(totals.vkTarget, target)}</td>
              </tr>
            </>
          ) : (
            <tr className="border-t" style={{ borderColor: COLORS.stroke }}>
              <td colSpan={5} className="px-3 py-3 text-xs font-medium" style={{ color: COLORS.warn }}>
                Keine Wechselkurse verfügbar — Summen können nicht berechnet werden.
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
