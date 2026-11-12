'use client';

/**
 * CalcItemDetails — aufklappbare Zusatzangaben einer Kalkulationsposition:
 * Uhrzeiten, Anbieter (intern), Preisstatus, Quelle und bei Transfers die
 * Strecke (von/nach, km, Fahrzeit, Fahrzeug, Treffpunkt). Alles optional.
 */
import { useState } from 'react';
import { COLORS } from '@/components/admin/ui';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { PRICE_STATUSES, priceStatusLabel, fmtRoute, fmtTimeRange, type CalcItem } from '@/lib/calcModel';

const INPUT = 'w-full rounded-lg border px-2.5 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 transition';

export default function CalcItemDetails({ item, onPatch }: { item: CalcItem; onPatch: (p: Partial<CalcItem>) => void }) {
  const isTransfer = item.category === 'transfer' || item.category === 'flug';
  const filled = !!(item.time_from || item.supplier_name || item.route_from || item.price_status || item.supplier_ref);
  const [open, setOpen] = useState(false);
  const style = { borderColor: COLORS.stroke };
  const summary = [
    fmtTimeRange(item),
    item.supplier_name,
    priceStatusLabel(item.price_status),
    isTransfer ? fmtRoute(item) : '',
  ].filter(Boolean).join(' · ');

  const text = (key: keyof CalcItem, placeholder: string, extra?: Partial<React.InputHTMLAttributes<HTMLInputElement>>) => (
    <input
      className={INPUT} style={style} placeholder={placeholder}
      value={(item[key] as string | number | undefined) ?? ''}
      onChange={(e) => onPatch({ [key]: e.target.value } as Partial<CalcItem>)}
      {...extra}
    />
  );
  const num = (key: 'distance_km' | 'duration_min', placeholder: string) => (
    <input
      type="number" min={0} className={INPUT} style={style} placeholder={placeholder}
      value={item[key] ?? ''}
      onChange={(e) => onPatch({ [key]: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value) || 0) })}
    />
  );
  const label = (t: string) => <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider" style={{ color: '#9ca3af' }}>{t}</span>;

  return (
    <div className="mt-1.5">
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className="inline-flex max-w-full items-center gap-1 text-[11px] font-semibold hover:underline"
        style={{ color: filled ? COLORS.navy : COLORS.accent }}
      >
        {open ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
        <span className="truncate">{filled && !open ? summary || 'Details' : `Details${isTransfer ? ' & Strecke' : ''} (Uhrzeit, Anbieter${isTransfer ? ', Route' : ''})`}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border p-2.5" style={{ borderColor: '#eef1f5', background: '#fbfcfe' }}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label>{label('Uhrzeit von')}{text('time_from', '09:35', { type: 'time' })}</label>
            <label>{label('Uhrzeit bis')}{text('time_to', '12:25', { type: 'time' })}</label>
            <label className="col-span-2">{label('Preisstatus')}
              <select className={`${INPUT} bg-white`} style={style} value={item.price_status || ''}
                onChange={(e) => onPatch({ price_status: (e.target.value || '') as CalcItem['price_status'] })}>
                <option value="">— offen —</option>
                {PRICE_STATUSES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label>{label('Anbieter')}{text('supplier_name', 'z. B. WE-BUS')}</label>
            <label>{label('Kontakt (E-Mail / Telefon)')}{text('supplier_contact', 'rent@we-bus.com')}</label>
            <label>{label('Angebots-/Buchungscode')}{text('supplier_ref', 'z. B. DER AGP10050ND')}</label>
          </div>
          <label className="block">{label('Quelle / Beleg (URL)')}
            <div className="flex items-center gap-1.5">
              {text('source_url', 'https://…')}
              {item.source_url && /^https?:\/\//.test(item.source_url) && (
                <a href={item.source_url} target="_blank" rel="noreferrer" title="Quelle öffnen"><ExternalLink className="h-3.5 w-3.5" style={{ color: COLORS.accent }} /></a>
              )}
            </div>
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label>{label('Strecke von')}{text('route_from', 'z. B. Flughafen AGP')}</label>
            <label>{label('Strecke nach')}{text('route_to', 'z. B. Gran Hotel Miramar')}</label>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label>{label('Distanz km')}{num('distance_km', '12')}</label>
            <label>{label('Fahrzeit min')}{num('duration_min', '25')}</label>
            <label className="col-span-2">{label('Fahrzeug')}{text('vehicle', 'VIP-Reisebus 50 Plätze')}</label>
          </div>
          <label className="block">{label('Treffpunkt / Abholort')}{text('pickup_point', 'z. B. Hotel-Lobby, Ausgang Ankunft T3')}</label>
          <p className="text-[10px]" style={{ color: '#9ca3af' }}>Anbieter, Kontakt, Code, Preisstatus und Quelle sind intern — sie erscheinen nie im Kunden-PDF.</p>
        </div>
      )}
    </div>
  );
}
