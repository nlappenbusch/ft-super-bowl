'use client';

/**
 * PlanningPanel — Reiseplanung je Kalkulation: Ablauf (Tage + Einträge),
 * schematische Timeline, DMC-/Anbieter-Optionen und Belege. Gespeichert wird
 * mit dem „Speichern"-Knopf der Kalkulation (Feld `planning`).
 */
import { useState } from 'react';
import { COLORS, SectionCard, Button, Badge } from '@/components/admin/ui';
import { CalendarRange, Plus, X, ArrowUp, ArrowDown, ExternalLink } from 'lucide-react';
import { fmtDateWeekday, type CalcItem } from '@/lib/calcModel';
import {
  PLAN_KINDS, SUPPLIER_TYPES, SUPPLIER_STATUSES, SOURCE_KINDS, dayBlocks, timelineRange, kindColor, kindLabel,
  entryRoute, entryTime, type Planning, type PlanDay, type PlanEntry, type PlanSupplier, type PlanSource,
} from '@/lib/planningModel';
import type { CalcInquiry } from '@/lib/inquiryModel';

type Tab = 'ablauf' | 'schema' | 'dmc' | 'belege';
const uid = () => crypto.randomUUID();
const IN = 'w-full rounded-md border px-2 py-1 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2';
const border = { borderColor: COLORS.stroke };

function newEntry(): PlanEntry {
  return { id: uid(), time_from: '', time_to: '', title: '', kind: 'programm', location: '', supplier: '', item_id: '', route_from: '', route_to: '', vehicle: '', price_note: '', status: '', note: '' };
}

export default function PlanningPanel({
  planning, onChange, items, inquiries = [],
}: {
  planning: Planning;
  onChange: (p: Planning) => void;
  items: CalcItem[];
  inquiries?: Pick<CalcInquiry, 'id' | 'supplier'>[];
}) {
  const [tab, setTab] = useState<Tab>(planning.days.length ? 'schema' : 'ablauf');
  const set = (patch: Partial<Planning>) => onChange({ ...planning, ...patch });
  const setDay = (i: number, patch: Partial<PlanDay>) => set({ days: planning.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const setEntry = (di: number, ei: number, patch: Partial<PlanEntry>) =>
    setDay(di, { entries: planning.days[di].entries.map((e, j) => (j === ei ? { ...e, ...patch } : e)) });
  const move = <T,>(list: T[], i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const c = [...list];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  };
  const entryCount = planning.days.reduce((n, d) => n + d.entries.length, 0);

  const tabs: Array<[Tab, string]> = [
    ['ablauf', `Ablauf (${planning.days.length} Tage · ${entryCount})`],
    ['schema', 'Schema'],
    ['dmc', `DMC & Anbieter (${planning.suppliers.length})`],
    ['belege', `Belege (${planning.sources.length})`],
  ];

  return (
    <SectionCard
      title="Reiseplanung"
      description="Tagesablauf mit Zeiten, Orten und Transfers, DMC-/Anbieter-Optionen und Belege. Anbieter, Preise und Status sind intern — im Angebots-PDF steht nur das Programm."
      icon={<CalendarRange className="h-5 w-5" />}
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className="rounded-full border px-3 py-1 text-xs font-semibold transition"
            style={tab === t ? { background: COLORS.navy, color: '#fff', borderColor: COLORS.navy } : { ...border, color: COLORS.navy }}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'ablauf' && (
        <div className="space-y-4">
          {planning.days.map((d, di) => (
            <div key={d.id} className="overflow-hidden rounded-xl border" style={border}>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2" style={{ background: COLORS.surfaceMuted }}>
                <span className="text-xs font-extrabold uppercase tracking-wider" style={{ color: COLORS.accent }}>Tag {di + 1}</span>
                <input type="date" className={`${IN} w-36`} style={border} value={d.date} onChange={(e) => setDay(di, { date: e.target.value })} />
                <input className={`${IN} min-w-48 flex-1`} style={border} placeholder="Titel, z. B. Granada & Alhambra" value={d.title} onChange={(e) => setDay(di, { title: e.target.value })} />
                <button title="nach oben" onClick={() => set({ days: move(planning.days, di, -1) })}><ArrowUp className="h-3.5 w-3.5" /></button>
                <button title="nach unten" onClick={() => set({ days: move(planning.days, di, 1) })}><ArrowDown className="h-3.5 w-3.5" /></button>
                <button title="Tag entfernen" onClick={() => set({ days: planning.days.filter((_, j) => j !== di) })}><X className="h-4 w-4 text-gray-400 hover:text-red-500" /></button>
              </div>
              <div className="divide-y" style={{ borderColor: '#f1f4f8' }}>
                {d.entries.map((e, ei) => (
                  <div key={e.id} className="space-y-1.5 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: kindColor(e.kind) }} />
                      <input type="time" className={`${IN} w-24`} style={border} value={e.time_from} onChange={(x) => setEntry(di, ei, { time_from: x.target.value })} />
                      <span className="text-xs text-gray-400">–</span>
                      <input type="time" className={`${IN} w-24`} style={border} value={e.time_to} onChange={(x) => setEntry(di, ei, { time_to: x.target.value })} />
                      <select className={`${IN} w-28 bg-white`} style={border} value={e.kind} onChange={(x) => setEntry(di, ei, { kind: x.target.value as PlanEntry['kind'] })}>
                        {PLAN_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                      </select>
                      <input className={`${IN} min-w-48 flex-1 font-semibold`} style={border} placeholder="Programmpunkt" value={e.title} onChange={(x) => setEntry(di, ei, { title: x.target.value })} />
                      <button title="nach oben" onClick={() => setDay(di, { entries: move(d.entries, ei, -1) })}><ArrowUp className="h-3.5 w-3.5" /></button>
                      <button title="nach unten" onClick={() => setDay(di, { entries: move(d.entries, ei, 1) })}><ArrowDown className="h-3.5 w-3.5" /></button>
                      <button title="Eintrag entfernen" onClick={() => setDay(di, { entries: d.entries.filter((_, j) => j !== ei) })}><X className="h-4 w-4 text-gray-400 hover:text-red-500" /></button>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 pl-5 sm:grid-cols-3">
                      <input className={IN} style={border} placeholder="Ort" value={e.location} onChange={(x) => setEntry(di, ei, { location: x.target.value })} />
                      <input className={IN} style={border} placeholder="Anbieter / Kontakt (intern)" value={e.supplier} onChange={(x) => setEntry(di, ei, { supplier: x.target.value })} />
                      <select className={`${IN} bg-white`} style={border} value={e.item_id} onChange={(x) => setEntry(di, ei, { item_id: x.target.value })}>
                        <option value="">— keine Position verknüpft —</option>
                        {items.filter((i) => i.description.trim()).map((i) => <option key={i.id} value={i.id}>{i.description.slice(0, 80)}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 pl-5 sm:grid-cols-6">
                      <input className={`${IN} col-span-2 sm:col-span-1`} style={border} placeholder="Strecke von" value={e.route_from} onChange={(x) => setEntry(di, ei, { route_from: x.target.value })} />
                      <input className={`${IN} col-span-2 sm:col-span-1`} style={border} placeholder="nach" value={e.route_to} onChange={(x) => setEntry(di, ei, { route_to: x.target.value })} />
                      <input type="number" min={0} className={IN} style={border} placeholder="km" value={e.distance_km ?? ''} onChange={(x) => setEntry(di, ei, { distance_km: x.target.value === '' ? undefined : Number(x.target.value) })} />
                      <input type="number" min={0} className={IN} style={border} placeholder="Min." value={e.duration_min ?? ''} onChange={(x) => setEntry(di, ei, { duration_min: x.target.value === '' ? undefined : Number(x.target.value) })} />
                      <input className={`${IN} col-span-2`} style={border} placeholder="Fahrzeug" value={e.vehicle} onChange={(x) => setEntry(di, ei, { vehicle: x.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 pl-5 sm:grid-cols-4">
                      <input className={IN} style={border} placeholder="Preis (intern), z. B. 34,15 € p.P." value={e.price_note} onChange={(x) => setEntry(di, ei, { price_note: x.target.value })} />
                      <input className={IN} style={border} placeholder="Status (intern), z. B. angefragt" value={e.status} onChange={(x) => setEntry(di, ei, { status: x.target.value })} />
                      <input className={`${IN} sm:col-span-2`} style={border} placeholder="Notiz" value={e.note} onChange={(x) => setEntry(di, ei, { note: x.target.value })} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-3 py-2">
                <Button variant="ghost" size="sm" onClick={() => setDay(di, { entries: [...d.entries, newEntry()] })}><Plus className="h-3.5 w-3.5" /> Eintrag</Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => {
              const last = planning.days[planning.days.length - 1]?.date;
              const next = last ? new Date(Date.parse(`${last}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : '';
              set({ days: [...planning.days, { id: uid(), date: next, title: '', entries: [] }] });
            }}><Plus className="h-3.5 w-3.5" /> Tag</Button>
          </div>
          <label className="block text-xs" style={{ color: COLORS.textMuted }}>
            <span className="mb-1 block font-semibold uppercase tracking-wider">Nicht kalkuliert / offen</span>
            <textarea className={IN} style={border} rows={2} value={planning.not_included} onChange={(e) => set({ not_included: e.target.value })} />
          </label>
        </div>
      )}

      {tab === 'schema' && <Schematic days={planning.days} />}

      {tab === 'dmc' && (
        <div className="space-y-2">
          {planning.suppliers.map((r, i) => {
            const up = (p: Partial<PlanSupplier>) => set({ suppliers: planning.suppliers.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={r.id} className="space-y-1.5 rounded-xl border p-2.5" style={border}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <input className={`${IN} min-w-48 flex-1 font-semibold`} style={border} placeholder="Name" value={r.name} onChange={(e) => up({ name: e.target.value })} />
                  <select className={`${IN} w-32 bg-white`} style={border} value={r.type} onChange={(e) => up({ type: e.target.value as PlanSupplier['type'] })}>
                    {SUPPLIER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <select className={`${IN} w-40 bg-white`} style={border} value={r.status} onChange={(e) => up({ status: e.target.value as PlanSupplier['status'] })}>
                    {SUPPLIER_STATUSES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  <button onClick={() => set({ suppliers: planning.suppliers.filter((_, j) => j !== i) })}><X className="h-4 w-4 text-gray-400 hover:text-red-500" /></button>
                </div>
                <input className={IN} style={border} placeholder="Kontakt (Person, E-Mail, Telefon)" value={r.contact} onChange={(e) => up({ contact: e.target.value })} />
                <textarea className={IN} style={border} rows={2} placeholder="Abdeckung / Leistungen" value={r.coverage} onChange={(e) => up({ coverage: e.target.value })} />
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  <input className={IN} style={border} placeholder="Quelle / Beleg" value={r.source} onChange={(e) => up({ source: e.target.value })} />
                  <input className={IN} style={border} placeholder="Notiz" value={r.note} onChange={(e) => up({ note: e.target.value })} />
                </div>
                {inquiries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span style={{ color: COLORS.textMuted }}>Anfragen:</span>
                    {inquiries.map((q) => {
                      const on = r.inquiry_ids.includes(q.id);
                      return (
                        <button key={q.id} onClick={() => up({ inquiry_ids: on ? r.inquiry_ids.filter((x) => x !== q.id) : [...r.inquiry_ids, q.id] })}
                          className="rounded-full border px-2 py-0.5" style={on ? { background: COLORS.navy, color: '#fff', borderColor: COLORS.navy } : border}>
                          {q.supplier.slice(0, 40) || 'Anfrage'}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <Button variant="secondary" size="sm" onClick={() => set({ suppliers: [...planning.suppliers, { id: uid(), name: '', type: 'dmc', contact: '', coverage: '', source: '', status: 'kandidat', inquiry_ids: [], note: '' }] })}>
            <Plus className="h-3.5 w-3.5" /> Anbieter / DMC
          </Button>
        </div>
      )}

      {tab === 'belege' && (
        <div className="space-y-1.5">
          {planning.sources.map((r, i) => {
            const up = (p: Partial<PlanSource>) => set({ sources: planning.sources.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-1.5">
                <input className={`${IN} w-14`} style={border} value={r.nr} onChange={(e) => up({ nr: e.target.value })} />
                <select className={`${IN} w-32 bg-white`} style={border} value={r.kind} onChange={(e) => up({ kind: e.target.value as PlanSource['kind'] })}>
                  {SOURCE_KINDS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <input className={`${IN} min-w-48 flex-1`} style={border} placeholder="Was ist belegt" value={r.what} onChange={(e) => up({ what: e.target.value })} />
                <input className={`${IN} min-w-48 flex-1`} style={border} placeholder="URL oder interne Quelle" value={r.ref} onChange={(e) => up({ ref: e.target.value })} />
                {/^https?:\/\//.test(r.ref) && <a href={r.ref} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" style={{ color: COLORS.accent }} /></a>}
                <button onClick={() => set({ sources: planning.sources.filter((_, j) => j !== i) })}><X className="h-4 w-4 text-gray-400 hover:text-red-500" /></button>
              </div>
            );
          })}
          <Button variant="secondary" size="sm" onClick={() => set({ sources: [...planning.sources, { id: uid(), nr: `B${planning.sources.length + 1}`, ref: '', what: '', kind: 'website', item_ids: [] }] })}>
            <Plus className="h-3.5 w-3.5" /> Beleg
          </Button>
        </div>
      )}
    </SectionCard>
  );
}

/** Schematische Timeline: je Tag eine Zeitachse mit farbigen Blöcken, Transfers als Pfeile. */
/** Platz (in Minuten), den ein Punkt-Ereignis ohne Endzeit auf der Achse belegt */
const POINT_MIN = 75;

export function Schematic({ days }: { days: PlanDay[] }) {
  const withTimes = days.filter((d) => dayBlocks(d).length);
  if (!withTimes.length) return <p className="text-sm" style={{ color: COLORS.textMuted }}>Noch keine Einträge mit Uhrzeit.</p>;
  const { from, to } = timelineRange(days);
  const span = to - from;
  const pct = (m: number) => `${((m - from) / span) * 100}%`;
  const hours: number[] = [];
  for (let h = from; h <= to; h += 60) hours.push(h);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PLAN_KINDS.map((k) => (
          <span key={k.id} className="inline-flex items-center gap-1 text-[11px]" style={{ color: COLORS.navy }}>
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: k.color }} /> {k.label}
          </span>
        ))}
      </div>
      {days.map((d, di) => {
        const blocks = dayBlocks(d);
        // Spuren: überlappende Blöcke untereinander legen
        const lanes: number[] = [];
        const placed = blocks.map((b) => {
          const end = b.point ? b.start + POINT_MIN : b.end;
          let lane = lanes.findIndex((l) => l <= b.start);
          if (lane < 0) { lane = lanes.length; lanes.push(end); } else lanes[lane] = end;
          return { ...b, lane };
        });
        const rows = Math.max(1, lanes.length);
        return (
          <div key={d.id}>
            <div className="mb-1 text-xs font-bold" style={{ color: COLORS.navy }}>
              <span style={{ color: COLORS.accent }}>Tag {di + 1}</span>{d.date ? ` · ${fmtDateWeekday(d.date)}` : ''}{d.title ? ` · ${d.title}` : ''}
            </div>
            <div className="relative rounded-lg border" style={{ ...border, height: rows * 46 + 18, background: '#fbfcfe' }}>
              {hours.map((h) => (
                <div key={h} className="absolute bottom-0 top-0 border-l" style={{ left: pct(h), borderColor: '#eef1f5' }}>
                  <span className="absolute -top-0 left-0.5 text-[9px] text-gray-400">{String(Math.floor(h / 60) % 24).padStart(2, '0')}</span>
                </div>
              ))}
              {placed.map(({ entry: e, start, end, point, lane }) => {
                const top = 14 + lane * 46;
                const route = entryRoute(e);
                if (e.kind === 'transfer' && !point) {
                  return (
                    <div key={e.id} className="absolute flex flex-col justify-center" style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})`, top, height: 40 }} title={`${entryTime(e)} ${e.title} ${route}`}>
                      <div className="relative h-0.5 w-full" style={{ background: kindColor('transfer') }}>
                        <span className="absolute -right-1 -top-[5px] text-[10px] leading-none" style={{ color: kindColor('transfer') }}>▶</span>
                      </div>
                      <span className="mt-1 truncate text-[9px] font-semibold" style={{ color: kindColor('transfer') }}>
                        {[e.distance_km ? `${e.distance_km} km` : '', e.duration_min ? `${e.duration_min} min` : '', e.route_to].filter(Boolean).join(' · ') || e.title}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={e.id} className="absolute overflow-hidden rounded-md px-1.5 py-0.5"
                    style={{
                      left: pct(start), width: `calc(${pct(point ? start + POINT_MIN - 5 : end)} - ${pct(start)})`, minWidth: 6, top, height: 40,
                      background: point ? '#fff' : kindColor(e.kind), color: point ? COLORS.navy : '#fff',
                      border: point ? `2px solid ${kindColor(e.kind)}` : undefined, opacity: e.kind === 'freizeit' ? 0.75 : 1,
                    }}
                    title={`${entryTime(e)} · ${kindLabel(e.kind)} · ${e.title}${e.location ? ` · ${e.location}` : ''}`}>
                    <span className="block truncate text-[10px] font-bold">{entryTime(e)}</span>
                    <span className="block truncate text-[10px]">{e.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-1.5">
        {days.flatMap((d) => d.entries).filter((e) => e.kind === 'transfer' && (e.distance_km || e.duration_min)).length > 0 && (
          <Badge tone="info">
            Transfers gesamt: {days.flatMap((d) => d.entries).filter((e) => e.kind === 'transfer').reduce((n, e) => n + (e.distance_km || 0), 0)} km
          </Badge>
        )}
      </div>
    </div>
  );
}
