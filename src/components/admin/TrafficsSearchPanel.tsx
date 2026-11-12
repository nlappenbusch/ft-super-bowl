'use client';

/**
 * TrafficsSearchPanel — DERTOUR-Suche (Traffics Connector API v3) im Kalkulations-Editor.
 * Suche → Trefferliste (Hotel, Sterne, Ort, Zimmer, Verpflegung, Preis, Flugzeiten)
 * → Übernahme als Position(en) (EK pro Person, Menge = Nächte, Leistungsdatum).
 *
 * Sparsam: Connector-Anfragen NUR beim Klick auf „Suchen" bzw. „Verfügbarkeit prüfen".
 * Kein Polling, keine Suche beim Tippen. Das Panel lädt beim Öffnen nur den Zugangsstatus
 * vom eigenen Server (keine Connector-Anfrage).
 */
import { useState } from 'react';
import { COLORS, SectionCard, Button, Field, TextInput, SelectInput, Badge, Spinner } from '@/components/admin/ui';
import { Plane, Search, Plus, ShieldCheck, KeyRound, ChevronDown, ChevronUp } from 'lucide-react';
import { fmtMoney, fmtServiceDate, type CalcItem } from '@/lib/calcModel';
import { isCalcCurrency } from '@/lib/fxRates';
import { fmtLegs, offerToItems, nightsBetweenIso, type TrafficsOffer, type TrafficsProductType } from '@/lib/trafficsModel';
import type { HotelInfo } from '@/lib/hotelLookup';

interface ConfigInfo {
  has_key: boolean;
  key_source: 'settings' | 'env' | 'none';
  mock: boolean;
  tour_operators: string;
  cache_minutes: number;
  max_requests_per_hour: number;
  usage: { requests_last_hour: number; cached_searches: number; last_error: { at: string; message: string } | null };
}

interface SearchMeta { total: number; cached: boolean; mock: boolean; fetched_at: string }

const PRODUCT_LABEL: Record<TrafficsProductType, string> = {
  pauschal: 'Pauschal (Flug + Hotel)',
  hotelonly: 'Nur Hotel',
  flight: 'Nur Flug',
};

const BOARD_OPTIONS = [
  { v: '', l: 'egal' },
  { v: 'OV', l: 'ohne Verpflegung' },
  { v: 'F', l: 'Frühstück' },
  { v: 'HP', l: 'Halbpension' },
  { v: 'VP', l: 'Vollpension' },
  { v: 'AI', l: 'All Inclusive' },
];

export default function TrafficsSearchPanel({
  travelStart, travelEnd, pax, onAdopt,
}: {
  travelStart: string;
  travelEnd: string;
  pax: number;
  onAdopt: (items: CalcItem[], hotel?: HotelInfo | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ConfigInfo | null>(null);
  const [showAccess, setShowAccess] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // Suchformular — Voreinstellung passend zu Gruppen-Incentives (EZ, 5*, DER)
  const [productType, setProductType] = useState<TrafficsProductType>('pauschal');
  const [fromDate, setFromDate] = useState(travelStart);
  const [toDate, setToDate] = useState(travelEnd);
  const [departure, setDeparture] = useState('ZRH');
  const [arrival, setArrival] = useState('');
  const [adults, setAdults] = useState(1);
  const [roomType, setRoomType] = useState('EZ');
  const [board, setBoard] = useState('');
  const [minCategory, setMinCategory] = useState(5);
  const [carrier, setCarrier] = useState('');
  const [directOnly, setDirectOnly] = useState(true);
  const [hotelName, setHotelName] = useState('');
  const [operators, setOperators] = useState('');

  const [searching, setSearching] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [offers, setOffers] = useState<TrafficsOffer[]>([]);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [verify, setVerify] = useState<Record<string, { loading?: boolean; text?: string; ok?: boolean }>>({});
  const [adopted, setAdopted] = useState<string[]>([]);

  const loadConfig = async () => {
    const res = await fetch('/api/admin/traffics/config').then((r) => r.json()).catch(() => null);
    if (res?.success) {
      setConfig(res.data);
      if (!operators) setOperators(res.data.tour_operators || 'DER');
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      if (!fromDate && travelStart) setFromDate(travelStart);
      if (!toDate && travelEnd) setToDate(travelEnd);
      if (!config) loadConfig();
    }
  };

  const saveKey = async (clear = false) => {
    setSavingKey(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/traffics/config', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clear ? { clear_key: true } : { auth_key: keyInput }),
      }).then((r) => r.json());
      if (!res?.success) { setErr(res?.error || 'Speichern fehlgeschlagen'); return; }
      setKeyInput('');
      setShowAccess(false);
      await loadConfig();
    } finally {
      setSavingKey(false);
    }
  };

  const search = async () => {
    if (searching) return;
    setSearching(true);
    setErr(null);
    setVerify({});
    try {
      const res = await fetch('/api/admin/traffics/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productType, fromDate, toDate, adults,
          departureAirports: departure, arrivalAirports: arrival,
          roomTypes: roomType, boardTypes: board, minCategory,
          tourOperators: operators, carrierCodes: carrier, directOnly, hotelName,
        }),
      }).then((r) => r.json());
      if (!res?.success) { setErr(res?.error || 'Suche fehlgeschlagen'); return; }
      setOffers(res.data.offers || []);
      setMeta({ total: res.data.total, cached: res.data.cached, mock: res.data.mock, fetched_at: res.data.fetched_at });
      setAdopted([]);
      loadConfig(); // Zähler aktualisieren (eigener Server, keine Connector-Anfrage)
    } catch {
      setErr('Suche fehlgeschlagen');
    } finally {
      setSearching(false);
    }
  };

  const verifyOne = async (o: TrafficsOffer) => {
    setVerify((v) => ({ ...v, [o.code]: { loading: true } }));
    const res = await fetch('/api/admin/traffics/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: o.code, adults }),
    }).then((r) => r.json()).catch(() => null);
    setVerify((v) => ({
      ...v,
      [o.code]: res?.success
        ? { ok: res.data.status === 'OK', text: `${res.data.status || '?'}${res.data.message ? ` — ${res.data.message}` : ''}${res.data.cached ? ' (Cache)' : ''}` }
        : { ok: false, text: res?.error || 'Prüfung fehlgeschlagen' },
    }));
    loadConfig();
  };

  const adopt = (o: TrafficsOffer) => {
    const items: CalcItem[] = offerToItems(o, () => crypto.randomUUID()).map((it) => ({
      ...it,
      currency: isCalcCurrency(it.currency) ? it.currency : 'EUR',
    }));
    const hotel: HotelInfo | null = o.hotelName
      ? { name: o.hotelName, street: '', zip: '', city: o.location, country: o.country, url: '', source: 'traffics' }
      : null;
    onAdopt(items, hotel);
    setAdopted((a) => [...a, o.code]);
  };

  const nights = nightsBetweenIso(fromDate, toDate);
  const canSearch = !!config?.has_key && !!fromDate && !!toDate && nights > 0 && !!arrival.trim()
    && (productType === 'hotelonly' || !!departure.trim());
  const cell = 'px-2 py-2 align-top';

  return (
    <SectionCard
      title="DERTOUR-Suche (Traffics)"
      description="Hotel-, Pauschal- und Flugangebote über den Traffics Connector — Treffer direkt als Position übernehmen."
      icon={<Plane className="h-5 w-5" />}
      actions={
        <Button variant="secondary" size="sm" onClick={toggle}>
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />} {open ? 'Schliessen' : 'Suche öffnen'}
        </Button>
      }
    >
      {!open ? (
        <p className="text-xs" style={{ color: COLORS.textMuted }}>
          Jede Suche ist genau eine Anfrage an Traffics/DERTOUR. Gleiche Suchen kommen aus dem Cache, es läuft nichts im Hintergrund.
        </p>
      ) : !config ? (
        <div className="py-4 text-center"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          {/* Zugang */}
          <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: COLORS.textMuted }}>
            {config.has_key
              ? <Badge tone="ok">{config.mock ? 'Beispieldaten (mock)' : `Zugang aktiv${config.key_source === 'env' ? ' (ENV)' : ''}`}</Badge>
              : <Badge tone="danger">Kein authKey hinterlegt</Badge>}
            <span>
              Anfragen letzte Stunde: <b style={{ color: COLORS.navy }}>{config.usage.requests_last_hour}</b> / {config.max_requests_per_hour}
              {' · '}Cache {config.cache_minutes} min
            </span>
            <button onClick={() => setShowAccess((s) => !s)} className="ml-auto inline-flex items-center gap-1 font-semibold hover:underline" style={{ color: COLORS.accent }}>
              <KeyRound className="h-3.5 w-3.5" /> Zugang
            </button>
          </div>
          {(showAccess || !config.has_key) && (
            <div className="rounded-xl border p-3" style={{ borderColor: COLORS.stroke, background: COLORS.surfaceMuted }}>
              <Field
                label="Traffics authKey"
                hint="Wird nur serverseitig gespeichert (settings.json) und nie wieder angezeigt. „mock“ liefert Beispieldaten ohne Anfrage."
              >
                <div className="flex flex-wrap gap-2">
                  <TextInput
                    type="password" autoComplete="off" className="min-w-56 flex-1"
                    placeholder={config.has_key ? 'Neuen Key eintragen, um den bestehenden zu ersetzen' : 'authKey von traffics'}
                    value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
                  />
                  <Button variant="accent" size="sm" onClick={() => saveKey(false)} disabled={savingKey || !keyInput.trim()}>
                    {savingKey ? <Spinner className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />} Speichern
                  </Button>
                  {config.key_source === 'settings' && (
                    <Button variant="ghost" size="sm" onClick={() => saveKey(true)} disabled={savingKey}>Key entfernen</Button>
                  )}
                </div>
              </Field>
            </div>
          )}

          {/* Suchformular */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Produkt">
              <SelectInput value={productType} onChange={(e) => setProductType(e.target.value as TrafficsProductType)}>
                {(Object.keys(PRODUCT_LABEL) as TrafficsProductType[]).map((p) => <option key={p} value={p}>{PRODUCT_LABEL[p]}</option>)}
              </SelectInput>
            </Field>
            <Field label="Anreise">
              <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </Field>
            <Field label="Abreise" hint={nights > 0 ? `${nights} ${nights === 1 ? 'Nacht' : 'Nächte'}` : undefined}>
              <TextInput type="date" value={toDate} min={fromDate || undefined} onChange={(e) => setToDate(e.target.value)} />
            </Field>
            <Field label="Erw. pro Zimmer" hint="Preis kommt pro Person">
              <TextInput type="number" min={1} max={8} value={adults} onChange={(e) => setAdults(Math.min(8, Math.max(1, Number(e.target.value) || 1)))} />
            </Field>
            {productType !== 'hotelonly' && (
              <Field label="Abflug (IATA)">
                <TextInput value={departure} placeholder="ZRH" onChange={(e) => setDeparture(e.target.value.toUpperCase())} />
              </Field>
            )}
            <Field label="Ziel-Flughafen (IATA)" hint="z. B. AGP für Málaga">
              <TextInput value={arrival} placeholder="AGP" onChange={(e) => setArrival(e.target.value.toUpperCase())} />
            </Field>
            {productType !== 'flight' && (
              <>
                <Field label="Zimmer">
                  <SelectInput value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                    <option value="">egal</option>
                    <option value="EZ">Einzelzimmer (EZ)</option>
                    <option value="DZ">Doppelzimmer (DZ)</option>
                    <option value="SU">Suite (SU)</option>
                  </SelectInput>
                </Field>
                <Field label="Verpflegung">
                  <SelectInput value={board} onChange={(e) => setBoard(e.target.value)}>
                    {BOARD_OPTIONS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Mind. Sterne">
                  <SelectInput value={minCategory} onChange={(e) => setMinCategory(Number(e.target.value))}>
                    {[0, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 0 ? 'egal' : `${n}*`}</option>)}
                  </SelectInput>
                </Field>
                <Field label="Hotelname (optional)">
                  <TextInput value={hotelName} placeholder="z. B. Miramar" onChange={(e) => setHotelName(e.target.value)} />
                </Field>
                <Field label="Veranstalter">
                  <TextInput value={operators} placeholder="DER" onChange={(e) => setOperators(e.target.value.toUpperCase())} />
                </Field>
              </>
            )}
            {productType !== 'hotelonly' && (
              <>
                <Field label="Airline (IATA)" hint="z. B. LX">
                  <TextInput value={carrier} placeholder="LX" onChange={(e) => setCarrier(e.target.value.toUpperCase())} />
                </Field>
                <Field label="Flug">
                  <label className="flex h-[42px] cursor-pointer items-center gap-2 text-sm" style={{ color: COLORS.navy }}>
                    <input type="checkbox" checked={directOnly} onChange={(e) => setDirectOnly(e.target.checked)} style={{ accentColor: COLORS.accent }} />
                    nur Direktflug
                  </label>
                </Field>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="accent" onClick={search} disabled={searching || !canSearch}>
              {searching ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />} Suchen
            </Button>
            <span className="text-[11px]" style={{ color: '#9ca3af' }}>
              Preise kommen pro Person für den ganzen Zeitraum. Für {pax > 1 ? `${pax} Personen` : 'Gruppen'} ist das ein Richtwert,
              kein Kontingent. Die Gruppe bitte separat bei DERTOUR anfragen.
            </span>
          </div>

          {err && (
            <div className="rounded-xl border px-3 py-2 text-sm font-medium" style={{ borderColor: '#fecaca', background: '#fef2f2', color: COLORS.danger }}>{err}</div>
          )}

          {meta && (
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              {offers.length} von {meta.total} Treffern · günstigste zuerst
              {meta.cached ? ' · aus dem Cache (keine neue Anfrage)' : ''}
              {meta.mock ? ' · BEISPIELDATEN' : ''}
              {' · Stand '}{new Date(meta.fetched_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}

          {offers.length > 0 && (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: COLORS.stroke }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider" style={{ color: COLORS.textMuted, background: COLORS.surfaceMuted }}>
                    <th className="px-2 py-2 font-bold">Hotel / Ort</th>
                    <th className="px-2 py-2 font-bold">Zimmer · Verpflegung</th>
                    <th className="px-2 py-2 font-bold">Termin</th>
                    <th className="px-2 py-2 font-bold">Flug</th>
                    <th className="px-2 py-2 text-right font-bold">Preis p.P.</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => {
                    const v = verify[o.code];
                    const done = adopted.includes(o.code);
                    return (
                      <tr key={o.code} className="border-t" style={{ borderColor: '#f1f4f8' }}>
                        <td className={`${cell} min-w-48`} style={{ color: COLORS.navy }}>
                          <span className="font-semibold">{o.hotelName || 'Flug'}</span>
                          {o.category > 0 && <span className="ml-1 text-xs" style={{ color: COLORS.accent }}>{'★'.repeat(Math.min(6, Math.round(o.category)))}</span>}
                          <span className="block text-xs" style={{ color: COLORS.textMuted }}>
                            {[o.location, o.region, o.country].filter(Boolean).join(', ')}{o.tourOperator ? ` · ${o.tourOperator}` : ''}
                          </span>
                        </td>
                        <td className={`${cell} text-xs`} style={{ color: COLORS.navy }}>
                          {[o.roomType, o.board].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className={`${cell} whitespace-nowrap text-xs tabular-nums`} style={{ color: COLORS.navy }}>
                          {fmtServiceDate(o.fromDate, o.toDate)}
                          {o.nights > 0 && <span className="block" style={{ color: COLORS.textMuted }}>{o.nights} N.</span>}
                        </td>
                        <td className={`${cell} text-xs tabular-nums`} style={{ color: COLORS.navy }}>
                          {o.outbound.length || o.inbound.length ? (
                            <>
                              {o.outbound.length > 0 && <span className="block whitespace-nowrap">Hin: {fmtLegs(o.outbound)}</span>}
                              {o.inbound.length > 0 && <span className="block whitespace-nowrap">Rück: {fmtLegs(o.inbound)}</span>}
                            </>
                          ) : '—'}
                        </td>
                        <td className={`${cell} whitespace-nowrap text-right font-bold tabular-nums`} style={{ color: COLORS.navy }}>
                          {fmtMoney(o.personPrice, o.currency)}
                          {o.nights > 0 && o.hotelName && (
                            <span className="block text-[11px] font-normal" style={{ color: COLORS.textMuted }}>
                              {fmtMoney(o.personPrice / o.nights, o.currency)} / Nacht
                            </span>
                          )}
                        </td>
                        <td className={`${cell} whitespace-nowrap text-right`}>
                          <div className="flex flex-col items-end gap-1">
                            <Button variant={done ? 'secondary' : 'accent'} size="sm" onClick={() => adopt(o)}>
                              <Plus className="h-3.5 w-3.5" /> {done ? 'Nochmals' : 'Übernehmen'}
                            </Button>
                            <button
                              onClick={() => verifyOne(o)} disabled={v?.loading}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline disabled:opacity-50"
                              style={{ color: COLORS.textMuted }}
                              title="Fragt dieses eine Angebot live beim Veranstalter ab (1 Anfrage)"
                            >
                              {v?.loading ? <Spinner className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />} Verfügbarkeit prüfen
                            </button>
                            {v?.text && (
                              <span className="max-w-48 text-right text-[11px]" style={{ color: v.ok ? COLORS.ok : COLORS.danger }}>{v.text}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {meta && offers.length === 0 && !err && (
            <p className="text-sm" style={{ color: COLORS.textMuted }}>Keine Angebote gefunden. Filter lockern, z. B. ohne Airline oder Verpflegung.</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}
