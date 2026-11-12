'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, PageHeader, Badge, Button, EmptyState, Spinner } from '@/components/admin/ui';
import { Voicemail as VoicemailIcon, Phone, RefreshCw, Check, RotateCcw, Search, Copy, ExternalLink, ListTodo } from 'lucide-react';
import type { Voicemail, VoicemailAnfrage } from '@/lib/voicemailBoard';

type Filter = 'offen' | 'erledigt' | 'alle';
interface Mitarbeiter { id: string; name: string }
const TZ = 'Europe/Zurich';

const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('de-CH', { timeZone: TZ, ...o }).format(d);
const tagKey = (d: Date) => fmt(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
/** Datum als yyyy-mm-dd in Zürcher Zeit (für <input type="date">). */
const isoTag = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(d);

function tagTitel(d: Date): string {
  const k = tagKey(d);
  if (k === tagKey(new Date())) return 'Heute';
  if (k === tagKey(new Date(Date.now() - 864e5))) return 'Gestern';
  return fmt(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** «HauptNr.CQ2» → Warteschlange 2, «HauptNr.AA» → Sprachmenü. */
function linieName(l: string): string {
  const cq = /CQ(\d*)/i.exec(l);
  if (cq) return 'Warteschlange' + (cq[1] ? ' ' + cq[1] : '');
  if (/AA/i.test(l)) return 'Sprachmenü';
  return l;
}

const nummerVon = (v: Voicemail) => (v.anrufer || 'Unbekannt').replace(/\s*\(Ungeprüft\)/, '');

/* ─── Aufgabe aus Voicemail ───────────────────────────────────────────────── */

function AufgabeFormular({ v, anfrage, team, onSpeichern, onAbbrechen }: {
  v: Voicemail;
  anfrage?: VoicemailAnfrage;
  team: Mitarbeiter[];
  onSpeichern: (d: Record<string, string>) => Promise<string | null>;
  onAbbrechen: () => void;
}) {
  const d = new Date(v.empfangen);
  const nummer = nummerVon(v);
  const [titel, setTitel] = useState(
    anfrage ? `Rückruf ${anfrage.customer_name || nummer} – ${anfrage.request_number}` : `Rückruf ${nummer} (Voicemail)`);
  const [zustaendig, setZustaendig] = useState('');
  const [faellig, setFaellig] = useState(isoTag(new Date()));
  const [prio, setPrio] = useState('normal');
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const beschreibung = [
    `Voicemail vom ${fmt(d, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr`,
    `von ${nummer} · ${linieName(v.linie)} · ${Math.round(v.dauer || 0)} s`,
    '',
    v.text ? `«${v.text}»` : '(keine Sprache erkannt)',
    '',
    ...(anfrage ? [`Anfrage: ${anfrage.request_number}${anfrage.package_title ? ' – ' + anfrage.package_title : ''}`] : []),
    'Aufnahme anhören: Verkauf › Voicemails',
  ].join('\n');

  const feld = { border: `1.5px solid ${COLORS.stroke}` };
  return (
    <form data-vm
      className="mt-3 grid gap-2 rounded-xl p-3 sm:grid-cols-[1fr_180px_150px_120px]"
      style={{ background: COLORS.surfaceMuted }}
      onSubmit={async (e) => {
        e.preventDefault();
        setLaeuft(true);
        const f = await onSpeichern({
          key: v.key, title: titel, description: beschreibung, assignee_id: zustaendig,
          due_date: faellig, priority: prio, booking_id: anfrage?.id || '',
        });
        setLaeuft(false);
        setFehler(f);
      }}
    >
      <input value={titel} onChange={(e) => setTitel(e.target.value)} required maxLength={200} aria-label="Titel der Aufgabe"
             className="rounded-xl bg-white px-3 py-1.5 text-sm" style={feld} />
      <select value={zustaendig} onChange={(e) => setZustaendig(e.target.value)} aria-label="Zuständig"
              className="rounded-xl bg-white px-3 py-1.5 text-sm" style={feld}>
        <option value="">Zuständig: offen</option>
        {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <input type="date" value={faellig} onChange={(e) => setFaellig(e.target.value)} aria-label="Fällig am"
             className="rounded-xl bg-white px-3 py-1.5 text-sm" style={feld} />
      <select value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Priorität"
              className="rounded-xl bg-white px-3 py-1.5 text-sm" style={feld}>
        <option value="niedrig">Niedrig</option>
        <option value="normal">Normal</option>
        <option value="hoch">Hoch</option>
      </select>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
        <Button size="sm" type="submit" disabled={laeuft}><ListTodo size={14} /> {laeuft ? 'Wird erstellt …' : 'Aufgabe erstellen'}</Button>
        <Button size="sm" variant="ghost" type="button" onClick={onAbbrechen}>Abbrechen</Button>
        <span className="text-xs" style={{ color: COLORS.textMuted }}>
          Transkript, Nummer{anfrage ? ' und Anfrage' : ''} kommen in die Beschreibung. Die Voicemail gilt danach als erledigt.
        </span>
        {fehler && <span className="text-xs font-semibold" style={{ color: COLORS.danger }}>{fehler}</span>}
      </div>
    </form>
  );
}

/* ─── Karte ───────────────────────────────────────────────────────────────── */

function VoicemailKarte({ v, anfragen, team, onSetzen, onAufgabe }: {
  v: Voicemail;
  anfragen: Record<string, VoicemailAnfrage>;
  team: Mitarbeiter[];
  onSetzen: (key: string, erledigt: boolean, notiz: string) => Promise<void>;
  onAufgabe: (d: Record<string, string>) => Promise<string | null>;
}) {
  const [notizOffen, setNotizOffen] = useState(false);
  const [aufgabeOffen, setAufgabeOffen] = useState(false);
  const [notiz, setNotiz] = useState(v.notiz ?? '');
  const [kopiert, setKopiert] = useState<string | null>(null);
  const d = new Date(v.empfangen);
  const nummer = nummerVon(v);
  const ungeprueft = /Ungeprüft/.test(v.anrufer || '');
  const erledigt = !!v.erledigt_von;
  const anfrage = v.refs.map((r) => anfragen[r]).find(Boolean);

  const kopieren = (r: string) => {
    navigator.clipboard?.writeText(r);
    setKopiert(r);
    setTimeout(() => setKopiert(null), 1400);
  };

  return (
    <article
      className="grid gap-x-5 gap-y-2 rounded-2xl p-5 sm:grid-cols-[64px_1fr]"
      style={{ background: '#fff', border: `1px solid ${COLORS.stroke}`, opacity: erledigt ? 0.65 : 1 }}
    >
      <div className="flex items-baseline gap-2 sm:block">
        <div className="text-xl font-extrabold tabular-nums" style={{ color: COLORS.navy }}>
          {fmt(d, { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div className="text-xs" style={{ color: COLORS.textMuted }}>{fmt(d, { day: '2-digit', month: '2-digit' })}</div>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {v.tel ? (
            <a href={`tel:${v.tel}`} className="text-base font-bold hover:underline" style={{ color: COLORS.navy }}>{nummer}</a>
          ) : (
            <span className="text-base font-bold" style={{ color: COLORS.navy }}>{nummer}</span>
          )}
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {[linieName(v.linie), `${Math.round(v.dauer || 0)} s`, ungeprueft ? 'Nummer ungeprüft' : null].filter(Boolean).join(' · ')}
          </span>
          {v.anrufe_gesamt > 1 && <Badge tone="accent">{v.anruf_nr}. Nachricht dieser Nummer</Badge>}
        </div>

        <p className="my-2.5 text-[15px] leading-relaxed" style={{ color: v.text ? COLORS.text : COLORS.textMuted, fontStyle: v.text ? 'normal' : 'italic' }}>
          {v.text || 'Keine Sprache erkannt – vermutlich aufgelegt.'}
        </p>

        {v.refs.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {v.refs.map((r) => anfragen[r] ? (
              <Link
                key={r}
                href={`/admin/crm?rq=${encodeURIComponent(r)}`}
                title="Anfrage im CRM öffnen"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs hover:underline"
                style={{ background: '#eef2f7', border: `1px solid ${COLORS.stroke}`, color: COLORS.navy }}
              >
                <ExternalLink size={12} />
                <span className="font-mono font-bold">{r}</span>
                {(anfragen[r].customer_name || anfragen[r].package_title) && (
                  <span>{[anfragen[r].customer_name, anfragen[r].package_title].filter(Boolean).join(' · ')}</span>
                )}
              </Link>
            ) : (
              <button
                key={r}
                onClick={() => kopieren(r)}
                title={r.startsWith('RQ-') ? 'Anfrage nicht in next gefunden – Nummer kopieren' : 'Nummer kopieren'}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-xs font-bold"
                style={{ background: COLORS.surfaceMuted, border: `1px solid ${COLORS.stroke}`, color: COLORS.navy }}
              >
                {kopiert === r ? <Check size={12} /> : <Copy size={12} />} {r}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <audio controls preload="none" className="h-9 min-w-[220px] flex-1" src={`/api/admin/voicemails/audio?key=${encodeURIComponent(v.key)}`} />
          {v.tel && (
            <a href={`tel:${v.tel}`} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
               style={{ border: `1.5px solid ${COLORS.stroke}`, color: COLORS.navy }}>
              <Phone size={14} /> Zurückrufen
            </a>
          )}
          {v.aufgabe_id ? (
            <Link href={`/admin/aufgaben/${v.aufgabe_id}`} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
                  style={{ background: '#eef2f7', color: COLORS.navy }}>
              <ListTodo size={14} /> {v.aufgabe_nr || 'Aufgabe'} öffnen
            </Link>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => { setAufgabeOffen((x) => !x); setNotizOffen(false); }}>
              <ListTodo size={14} /> Aufgabe erstellen
            </Button>
          )}
          {erledigt ? (
            <Button size="sm" variant="secondary" onClick={() => onSetzen(v.key, false, v.notiz ?? '')}>
              <RotateCcw size={14} /> Wieder öffnen
            </Button>
          ) : (
            <Button size="sm" onClick={() => { setNotizOffen(true); setAufgabeOffen(false); }}><Check size={14} /> Erledigt</Button>
          )}
        </div>

        {aufgabeOffen && !v.aufgabe_id && (
          <AufgabeFormular
            v={v} anfrage={anfrage} team={team}
            onAbbrechen={() => setAufgabeOffen(false)}
            onSpeichern={onAufgabe}
          />
        )}

        {notizOffen && !erledigt && (
          <form data-vm
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={async (e) => { e.preventDefault(); await onSetzen(v.key, true, notiz); setNotizOffen(false); }}
          >
            <input
              autoFocus
              value={notiz}
              onChange={(e) => setNotiz(e.target.value)}
              maxLength={500}
              placeholder="Notiz (optional), z. B. «zurückgerufen, Offerte folgt»"
              className="min-w-[200px] flex-1 rounded-xl px-3 py-1.5 text-sm"
              style={{ border: `1.5px solid ${COLORS.stroke}` }}
            />
            <Button size="sm" type="submit">Als erledigt speichern</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setNotizOffen(false)}>Abbrechen</Button>
          </form>
        )}

        {erledigt && (
          <div className="mt-3 rounded-lg px-3 py-1.5 text-xs" style={{ background: '#f0fdf4', color: COLORS.ok }}>
            Erledigt von <b>{v.erledigt_von}</b>
            {v.erledigt_am ? `, ${fmt(new Date(v.erledigt_am), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
            {v.notiz ? ` – ${v.notiz}` : ''}
          </div>
        )}
      </div>
    </article>
  );
}

/* ─── Seite ───────────────────────────────────────────────────────────────── */

export default function VoicemailsPage() {
  const [daten, setDaten] = useState<Voicemail[] | null>(null);
  const [anfragen, setAnfragen] = useState<Record<string, VoicemailAnfrage>>({});
  const [team, setTeam] = useState<Mitarbeiter[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('offen');
  const [suche, setSuche] = useState('');
  const [laedt, setLaedt] = useState(false);

  const laden = useCallback(async () => {
    setLaedt(true);
    try {
      const r = await fetch('/api/admin/voicemails', { cache: 'no-store' });
      const j = await r.json();
      if (!j.success) throw new Error(j.error || 'Fehler');
      setDaten(j.voicemails);
      setAnfragen(j.anfragen || {});
      setFehler(null);
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setLaedt(false);
    }
  }, []);

  useEffect(() => {
    fetch('/api/admin/team').then((r) => r.json()).then((r) => {
      if (r.success) setTeam((r.data || []).map((e: Mitarbeiter) => ({ id: e.id, name: e.name })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    laden();
    const t = setInterval(() => {
      const beschaeftigt = Array.from(document.querySelectorAll('audio')).some((a) => !a.paused)
        || !!document.querySelector('form[data-vm]');
      if (document.visibilityState === 'visible' && !beschaeftigt) laden();
    }, 60_000);
    return () => clearInterval(t);
  }, [laden]);

  const setzen = useCallback(async (key: string, erledigt: boolean, notiz: string) => {
    await fetch('/api/admin/voicemails/erledigt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, erledigt, notiz }),
    });
    await laden();
  }, [laden]);

  const aufgabe = useCallback(async (d: Record<string, string>): Promise<string | null> => {
    try {
      const r = await fetch('/api/admin/voicemails/aufgabe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      const j = await r.json();
      if (!j.success) return j.error || 'Aufgabe konnte nicht erstellt werden.';
      await laden();
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [laden]);

  const offen = daten?.filter((v) => !v.erledigt_von).length ?? 0;

  const sicht = useMemo(() => {
    if (!daten) return [];
    const q = suche.trim().toLowerCase();
    return daten.filter((v) => {
      const a = v.refs.map((r) => anfragen[r]).filter(Boolean);
      return (filter === 'alle' || (filter === 'offen') === !v.erledigt_von) &&
        (!q || [v.anrufer, v.tel, v.text, v.notiz, v.erledigt_von, v.aufgabe_nr, ...v.refs,
          ...a.map((x) => `${x.customer_name ?? ''} ${x.package_title ?? ''}`)].join(' ').toLowerCase().includes(q));
    });
  }, [daten, anfragen, filter, suche]);

  const gruppen = useMemo(() => {
    const out: { titel: string; items: Voicemail[] }[] = [];
    for (const v of sicht) {
      const t = tagTitel(new Date(v.empfangen));
      if (out.at(-1)?.titel !== t) out.push({ titel: t, items: [] });
      out.at(-1)!.items.push(v);
    }
    return out;
  }, [sicht]);

  const FILTER: { id: Filter; label: string }[] = [
    { id: 'offen', label: `Offen${daten ? ` (${offen})` : ''}` },
    { id: 'erledigt', label: 'Erledigt' },
    { id: 'alle', label: 'Alle' },
  ];

  return (
    <AdminShell title="Voicemails">
      <PageHeader
        title="Voicemails"
        description="Anrufbeantworter aller Gruppen (Warteschlangen und Sprachmenü), automatisch transkribiert. Neue Nachrichten erscheinen nach 2–3 Minuten."
        actions={<Button variant="secondary" size="sm" onClick={laden} disabled={laedt}><RefreshCw size={14} className={laedt ? 'animate-spin' : ''} /> Aktualisieren</Button>}
      />

      <div className="mb-2 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-xl" style={{ border: `1.5px solid ${COLORS.stroke}`, background: '#fff' }}>
          {FILTER.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className="px-4 py-1.5 text-sm font-semibold"
              style={filter === f.id ? { background: COLORS.navy, color: '#fff' } : { color: COLORS.textMuted }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl px-3 py-1.5" style={{ border: `1.5px solid ${COLORS.stroke}`, background: '#fff' }}>
          <Search size={15} style={{ color: COLORS.textMuted }} />
          <input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Suchen: Nummer, Kunde, RQ-…, FT…, TASK-…, Notiz"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {fehler && (
        <div className="my-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#fef2f2', color: COLORS.danger }}>{fehler}</div>
      )}

      {!daten && !fehler && <div className="flex justify-center py-16"><Spinner /></div>}

      {daten && sicht.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={<VoicemailIcon size={32} />}
            title={filter === 'offen' && !suche ? 'Keine offenen Voicemails' : 'Nichts gefunden'}
            description={filter === 'offen' && !suche ? 'Alle Nachrichten sind erledigt.' : undefined}
          />
        </div>
      )}

      {gruppen.map((g) => (
        <section key={g.titel}>
          <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>{g.titel}</h2>
          <div className="flex flex-col gap-2.5">
            {g.items.map((v) => (
              <VoicemailKarte
                key={v.key + (v.erledigt_von ?? '') + (v.aufgabe_id ?? '')}
                v={v} anfragen={anfragen} team={team} onSetzen={setzen} onAufgabe={aufgabe}
              />
            ))}
          </div>
        </section>
      ))}
    </AdminShell>
  );
}
