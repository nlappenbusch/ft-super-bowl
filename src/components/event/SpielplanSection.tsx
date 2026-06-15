'use client';

import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Table2, CalendarDays, MapPin, Send, ChevronDown } from 'lucide-react';

export interface SpielplanRow {
  date: string;
  session: string;
  matchup: string;
  round: string;
}

export type SpielplanLayout = 'tabelle' | 'karten' | 'auto';

const COLLAPSE_THRESHOLD = 18; // ab so vielen Zeilen wird eingeklappt
const COLLAPSED_ROWS = 12;     // sichtbare Zeilen im eingeklappten Zustand
const KARTEN_AUTO_MAX = 8;     // Auto-Modus: bis zu so vielen Paarungen → Karten-Ansicht

/**
 * Smartes Spielplan-Modul:
 * - Runden-Filter-Chips (sobald ≥2 Runden, z.B. Gruppenphase → Finale)
 * - Textsuche über alle Spalten (ab >12 Zeilen, z.B. Verein, Stadt, Stadion)
 * - Einklappen bei sehr langen Plänen (z.B. 104 WM-Spiele)
 * - Karten- oder Tabellen-Ansicht, umschaltbar; `layout='auto'` wählt initial selbst
 * - "Anfragen" pro Paarung (füllt das Anfrage-Formular vor), wenn `onRequest` gesetzt ist
 * - Extern steuerbar über `externalFilter` (z.B. Klick auf eine Spielort-Karte)
 */
export default function SpielplanSection({
  spielplan,
  externalFilter,
  layout = 'auto',
  onRequest,
}: {
  spielplan: SpielplanRow[];
  externalFilter?: string;
  layout?: SpielplanLayout;
  onRequest?: (matchLabel: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [round, setRound] = useState<string>('');
  const [expanded, setExpanded] = useState(false);
  // Initiale Ansicht: explizit gesetzt oder automatisch (wenige Paarungen → Karten)
  const initialView = layout === 'auto' ? (spielplan.length <= KARTEN_AUTO_MAX ? 'karten' : 'tabelle') : layout;
  const [view, setView] = useState<'tabelle' | 'karten'>(initialView);

  const matchLabel = (r: SpielplanRow) =>
    [r.matchup, r.date && `(${r.date})`].filter(Boolean).join(' ');

  const requestMatch = onRequest
    ? (r: SpielplanRow) => {
        onRequest(matchLabel(r));
        requestAnimationFrame(() => {
          document.getElementById('tickets')?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    : undefined;

  // Externer Filter (Spielorte-Karte) übernimmt die Suche
  useEffect(() => {
    if (externalFilter !== undefined) {
      setQuery(externalFilter);
      setRound('');
    }
  }, [externalFilter]);

  const rounds = useMemo(() => {
    const seen: string[] = [];
    for (const r of spielplan) {
      const v = (r.round || '').trim();
      if (v && !seen.includes(v)) seen.push(v);
    }
    return seen;
  }, [spielplan]);

  const sessions = useMemo(() => {
    const seen: string[] = [];
    for (const r of spielplan) {
      const v = (r.session || '').trim();
      if (v && !seen.includes(v)) seen.push(v);
    }
    return seen.sort((a, b) => a.localeCompare(b, 'de'));
  }, [spielplan]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return spielplan.filter((r) => {
      if (round && (r.round || '').trim() !== round) return false;
      if (!q) return true;
      return [r.date, r.session, r.matchup, r.round].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [spielplan, query, round]);

  const hasActiveFilter = query.trim() !== '' || round !== '';
  const collapsible = !hasActiveFilter && filtered.length > COLLAPSE_THRESHOLD;
  const visible = collapsible && !expanded ? filtered.slice(0, COLLAPSED_ROWS) : filtered;
  const showVenueFilter = sessions.length > 1;
  const showRoundChips = rounds.length >= 2;

  return (
    <div>
      {/* Ansicht-Umschalter */}
      {spielplan.length > 1 && (
        <div className="mb-4 flex justify-end">
          <div className="inline-flex overflow-hidden rounded-lg" style={{ border: '1.5px solid #d4dbe5' }}>
            {([
              { key: 'karten' as const, label: 'Paarungen', Icon: LayoutGrid },
              { key: 'tabelle' as const, label: 'Tabelle', Icon: Table2 },
            ]).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold transition-all"
                style={view === key ? { background: '#143047', color: '#fff' } : { background: '#fff', color: '#143047' }}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filterleiste */}
      {(showVenueFilter || showRoundChips) && (
        <div className="mb-6 space-y-3">
          {showRoundChips && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setRound('')}
                className="rounded-full px-4 py-1.5 text-xs font-bold transition-all"
                style={round === ''
                  ? { background: '#143047', color: '#fff' }
                  : { background: '#fff', color: '#143047', border: '1.5px solid #d4dbe5' }}
              >
                Alle Runden
              </button>
              {rounds.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRound(round === r ? '' : r)}
                  className="rounded-full px-4 py-1.5 text-xs font-bold transition-all"
                  style={round === r
                    ? { background: '#d9531e', color: '#fff' }
                    : { background: '#fff', color: '#143047', border: '1.5px solid #d4dbe5' }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          {showVenueFilter && (
            <div className="relative max-w-sm">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                value={sessions.find((s) => s === query || (!!query && s.toLowerCase().includes(query.toLowerCase()))) ?? ''}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full appearance-none rounded-lg border bg-white py-2.5 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#d9531e]"
                style={{ borderColor: '#d4dbe5', color: '#143047' }}
                aria-label="Spielort filtern"
              >
                <option value="">Alle Spielorte</option>
                {sessions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            </div>
          )}
          {hasActiveFilter && (
            <div className="text-xs font-semibold text-gray-500">
              {filtered.length} von {spielplan.length} {spielplan.length === 1 ? 'Termin' : 'Terminen'}
              <button
                type="button"
                onClick={() => { setQuery(''); setRound(''); }}
                className="ml-3 font-bold underline underline-offset-2"
                style={{ color: '#d9531e' }}
              >
                Filter zurücksetzen
              </button>
            </div>
          )}
        </div>
      )}

      {/* Karten-Ansicht (Paarungen) */}
      {view === 'karten' && (
        <div>
          {visible.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-10 text-center text-gray-400">
              Keine Termine gefunden –{' '}
              <button type="button" onClick={() => { setQuery(''); setRound(''); }} className="font-bold underline underline-offset-2" style={{ color: '#d9531e' }}>
                Filter zurücksetzen
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {visible.map((item, idx) => (
                <div
                  key={`${item.date}-${item.matchup}-${idx}`}
                  className="flex flex-col rounded-xl bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ border: '1.5px solid #e5e8ed', boxShadow: '0 2px 8px rgba(20,48,71,0.06)' }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {item.round && (

                      <span className="inline-flex items-center rounded-sm px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: '#143047' }}>
                        {item.round}
                      </span>
                    )}
                    {item.date && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500">
                        <CalendarDays className="h-3.5 w-3.5" style={{ color: '#d9531e' }} /> {item.date}
                      </span>
                    )}
                  </div>
                  <div className="text-base font-extrabold leading-snug" style={{ color: '#143047' }}>
                    {item.matchup || '–'}
                  </div>
                  {item.session && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-600">
                      <MapPin className="h-3.5 w-3.5 shrink-0" style={{ color: '#d9531e' }} /> {item.session}
                    </div>
                  )}
                  {requestMatch && (
                    <button
                      type="button"
                      onClick={() => requestMatch(item)}
                      className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
                      style={{ background: '#d9531e' }}
                    >
                      <Send className="h-3.5 w-3.5" /> Dieses Spiel anfragen
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {collapsible && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-4 block w-full rounded-xl border border-gray-200 bg-white py-3.5 text-center text-sm font-bold transition hover:bg-blue-50/50"
              style={{ color: '#143047' }}
            >
              {expanded ? '▲ Weniger anzeigen' : `▼ Alle ${filtered.length} Termine anzeigen`}
            </button>
          )}
        </div>
      )}

      {/* Tabellen-Ansicht */}
      {view === 'tabelle' && (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead style={{ background: '#143047' }}>
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Datum</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Session</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Spielpaarung</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Runde</th>
                {requestMatch && <th className="px-6 py-4" />}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={requestMatch ? 5 : 4} className="px-6 py-10 text-center text-gray-400">
                    Keine Termine gefunden – Filter anpassen oder{' '}
                    <button
                      type="button"
                      onClick={() => { setQuery(''); setRound(''); }}
                      className="font-bold underline underline-offset-2"
                      style={{ color: '#d9531e' }}
                    >
                      zurücksetzen
                    </button>
                    .
                  </td>
                </tr>
              ) : (
                visible.map((item, idx) => (
                  <tr key={`${item.date}-${item.matchup}-${idx}`} className="border-t border-gray-100 transition hover:bg-blue-50/40">
                    <td className="whitespace-nowrap px-6 py-4 font-bold" style={{ color: '#143047' }}>{item.date}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {item.session ? (
                        <span className="inline-flex items-center rounded-sm px-3 py-1 text-xs font-bold text-white" style={{ background: '#143047' }}>{item.session}</span>
                      ) : <span className="text-gray-400">–</span>}
                    </td>
                    <td className="whitespace-pre-line px-6 py-4 leading-relaxed text-gray-700">{item.matchup}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      {item.round ? (
                        <span className="inline-flex items-center rounded-sm bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">{item.round}</span>
                      ) : <span className="text-gray-400">–</span>}
                    </td>
                    {requestMatch && (
                      <td className="whitespace-nowrap px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => requestMatch(item)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-all hover:opacity-90"
                          style={{ background: '#d9531e' }}
                        >
                          <Send className="h-3 w-3" /> Anfragen
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {collapsible && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="block w-full border-t border-gray-200 py-3.5 text-center text-sm font-bold transition hover:bg-blue-50/50"
            style={{ color: '#143047' }}
          >
            {expanded ? '▲ Weniger anzeigen' : `▼ Alle ${filtered.length} Termine anzeigen`}
          </button>
        )}
      </div>
      )}
    </div>
  );
}
