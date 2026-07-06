'use client';

import { useMemo, useState } from 'react';
import { Send, Star, MapPin, Check, X } from 'lucide-react';
import { NL_LEAGUES, NL_FLAG, NL_HOME_CITY, nlFormatDate } from '@/lib/nationsLeague';
import EventContactForm from '@/components/EventContactForm';

const NAVY = '#143047';
const ACCENT = '#d9531e';

function flagUrl(team: string, big = false): string {
  return `https://flagcdn.com/${big ? 'w40' : 'w20'}/${NL_FLAG[team] || 'un'}.png`;
}

const BIG = new Set(['Deutschland', 'Frankreich', 'Spanien', 'Italien', 'England', 'Niederlande', 'Portugal', 'Belgien', 'Kroatien', 'Dänemark']);

interface Fx { md: number; date: string; home: string; away: string; group: string }

function Flag({ team, big = false }: { team: string; big?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={flagUrl(team, big)} alt="" width={big ? 26 : 20} height={big ? 17 : 13} loading="lazy" style={{ display: 'inline-block', borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }} />;
}

function hostText(home: string): string {
  return NL_HOME_CITY[home] || home;
}
function matchLabel(f: Fx): string {
  return `${f.home} – ${f.away} · ${nlFormatDate(f.date)} · ${hostText(f.home)}`;
}
function keyOf(f: Fx): string {
  return `${f.group}|${f.date}|${f.home}|${f.away}`;
}

const GROUPS = ['A1', 'A2', 'A3', 'A4'];

export default function NationsLeagueFixtures() {
  const all = useMemo<Fx[]>(() => {
    const lg = NL_LEAGUES.find((l) => l.id === 'A');
    const out: Fx[] = [];
    lg?.groups.forEach((g) => g.fixtures.forEach((fx) => out.push({ ...fx, group: g.id })));
    return out.sort((a, b) => a.date.localeCompare(b.date) || a.group.localeCompare(b.group));
  }, []);

  const featured = useMemo(() => all.filter((f) => BIG.has(f.home) && BIG.has(f.away)).slice(0, 4), [all]);
  const hostNations = useMemo(() => Array.from(new Set(all.map((f) => f.home))).sort((a, b) => a.localeCompare(b)), [all]);

  const [group, setGroup] = useState('all');
  const [md, setMd] = useState(0);
  const [host, setHost] = useState('all');
  const [sel, setSel] = useState<Record<string, Fx>>({});

  // Anfrage-Dialog
  const [anfrageLabels, setAnfrageLabels] = useState<string[] | null>(null);
  const openAnfrage = (labels: string[]) => setAnfrageLabels(labels);
  const closeAnfrage = () => setAnfrageLabels(null);

  const filtered = useMemo(
    () => all.filter((f) => (group === 'all' || f.group === group) && (md === 0 || f.md === md) && (host === 'all' || f.home === host)),
    [all, group, md, host],
  );
  const byDate = useMemo(() => {
    const m = new Map<string, Fx[]>();
    for (const f of filtered) { const a = m.get(f.date) || []; a.push(f); m.set(f.date, a); }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const selList = Object.values(sel);
  const toggle = (f: Fx) => setSel((prev) => {
    const k = keyOf(f); const next = { ...prev };
    if (next[k]) delete next[k]; else next[k] = f;
    return next;
  });

  const initialMessage = anfrageLabels && anfrageLabels.length
    ? `Ich interessiere mich für folgende Nations-League-Spiele:\n${anfrageLabels.map((l) => `• ${l}`).join('\n')}\n\nBitte senden Sie mir ein unverbindliches Angebot.`
    : undefined;

  return (
    <div style={{ paddingBottom: selList.length ? 72 : 0 }}>
      {/* Top-Spiele */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2">
          <Star className="h-5 w-5" style={{ color: ACCENT }} />
          <h3 className="text-xl font-extrabold" style={{ color: NAVY }}>Top-Spiele der League A</h3>
        </div>
        <p className="mb-3 text-sm text-gray-500">Die Kracher der obersten Liga – jedes Spiel direkt anfragbar.</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((f, i) => (
            <div key={i} className="flex flex-col overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid #e5e8ed', boxShadow: '0 4px 20px rgba(20,48,71,0.06)' }}>
              <div className="px-4 pt-4">
                <span className="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: ACCENT }}>Gruppe {f.group} · Spieltag {f.md}</span>
              </div>
              <div className="flex flex-col items-center gap-2 px-4 py-4 text-center">
                <div className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: NAVY }}><Flag team={f.home} big /> {f.home}</div>
                <span className="text-xs font-semibold" style={{ color: '#9ca3af' }}>gegen</span>
                <div className="flex items-center gap-2 text-[15px] font-extrabold" style={{ color: NAVY }}><Flag team={f.away} big /> {f.away}</div>
                <div className="mt-1 text-xs" style={{ color: '#6b7280' }}>{nlFormatDate(f.date)}</div>
                <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: ACCENT }}><MapPin className="h-3.5 w-3.5" /> {hostText(f.home)}</div>
              </div>
              <button onClick={() => openAnfrage([matchLabel(f)])} className="mt-auto flex items-center justify-center gap-1.5 py-3 text-sm font-bold text-white transition hover:opacity-90" style={{ background: ACCENT }}>
                <Send className="h-4 w-4" /> Reise anfragen
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Filter */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {[{ id: 'all', label: 'Alle Gruppen' }, ...GROUPS.map((g) => ({ id: g, label: `Gruppe ${g}` }))].map((g) => {
          const active = group === g.id;
          return (
            <button key={g.id} onClick={() => setGroup(g.id)} className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition"
              style={active ? { background: NAVY, color: '#fff' } : { background: '#fff', color: '#475569', border: '1px solid #e5e8ed' }}>
              {g.label}
            </button>
          );
        })}
        <select value={md} onChange={(e) => setMd(Number(e.target.value))} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold" style={{ borderColor: '#e5e8ed', color: NAVY }}>
          <option value={0}>Alle Spieltage</option>
          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Spieltag {n}</option>)}
        </select>
        <select value={host} onChange={(e) => setHost(e.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold" style={{ borderColor: '#e5e8ed', color: NAVY }}>
          <option value="all">Alle Austragungsorte</option>
          {hostNations.map((n) => <option key={n} value={n}>{hostText(n)}</option>)}
        </select>
      </div>

      <p className="mb-4 text-sm" style={{ color: '#6b7280' }}>{filtered.length} Spiele · Kästchen anhaken und mehrere Spiele gemeinsam anfragen</p>

      {/* Spiele nach Datum */}
      <div className="space-y-6">
        {byDate.map(([date, games]) => (
          <div key={date}>
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-extrabold" style={{ color: NAVY }}>{nlFormatDate(date)}</span>
              <span className="h-px flex-1" style={{ background: '#e5e8ed' }} />
            </div>
            <div className="grid gap-2.5 lg:grid-cols-2">
              {games.map((g) => {
                const checked = !!sel[keyOf(g)];
                return (
                  <div key={keyOf(g)} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5" style={{ border: `1px solid ${checked ? ACCENT : '#e5e8ed'}` }}>
                    <button onClick={() => toggle(g)} title="Für Anfrage auswählen" className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition" style={{ borderColor: checked ? ACCENT : '#cbd5e1', background: checked ? ACCENT : '#fff' }}>
                      {checked && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: NAVY }}>{g.group}</span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
                        <Flag team={g.home} /> <span className="truncate">{g.home}</span>
                        <span className="text-[11px] font-bold" style={{ color: '#9ca3af' }}>–</span>
                        <Flag team={g.away} /> <span className="truncate">{g.away}</span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px]" style={{ color: '#6b7280' }}><MapPin className="h-3 w-3" /> {hostText(g.home)} · Spieltag {g.md}</span>
                    </div>
                    <button onClick={() => openAnfrage([matchLabel(g)])} title="Dieses Spiel anfragen" className="shrink-0 rounded-lg p-1.5 transition hover:bg-orange-50" style={{ color: ACCENT }}>
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 flex items-start gap-1.5 text-xs" style={{ color: '#9ca3af' }}>
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Austragungsort = Gastgeberland des Heimteams. Die genaue Arena/Stadt wird vom Verband bzw. der UEFA näher am Spieltermin bestätigt.
      </p>

      {/* Sticky Auswahl-Leiste */}
      {selList.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3" style={{ background: NAVY, borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="container mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white">{selList.length} {selList.length === 1 ? 'Spiel' : 'Spiele'} ausgewählt</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setSel({})} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-white/80 transition hover:text-white" title="Auswahl leeren">
                <X className="h-4 w-4" /> Leeren
              </button>
              <button onClick={() => openAnfrage(selList.map(matchLabel))} className="flex items-center gap-1.5 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90" style={{ background: ACCENT }}>
                <Send className="h-4 w-4" /> Auswahl anfragen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anfrage-Dialog (direkt hier, kein Seitenwechsel) */}
      {anfrageLabels && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6" style={{ background: 'rgba(9,20,34,0.55)' }} onClick={closeAnfrage}>
          <div className="my-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-white/80">
                {anfrageLabels.length} {anfrageLabels.length === 1 ? 'Spiel' : 'Spiele'} ausgewählt
              </span>
              <button onClick={closeAnfrage} className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20">
                <X className="h-4 w-4" /> Schließen
              </button>
            </div>
            <EventContactForm
              eventSlug="uefa-nations-league-2026"
              eventName="UEFA Nations League 2026/27"
              title="Spiele anfragen"
              intro="Ihre Auswahl steht schon in der Nachricht – ergänzen Sie einfach Ihre Kontaktdaten, wir melden uns unverbindlich."
              initialMessage={initialMessage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
