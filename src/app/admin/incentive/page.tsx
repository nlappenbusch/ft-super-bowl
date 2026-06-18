'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, InputField, Button, Spinner, Field } from '@/components/admin/ui';
import { Sparkles, Plus, Trash2, Wand2, MapPin, Calendar } from 'lucide-react';
import { STYLE_OPTIONS, BUDGET_LABELS, type IncentiveBrief, type DateRange } from '@/lib/incentive/types';

interface PlanRow { id: string; created_at: string; title: string; status: string }

export default function IncentiveBuilderPage() {
  const router = useRouter();
  const [groupSize, setGroupSize] = useState('20');
  const [days, setDays] = useState('4');
  const [periods, setPeriods] = useState<DateRange[]>([{ start: '', end: '' }]);
  const [useExcl, setUseExcl] = useState(false);
  const [exclusions, setExclusions] = useState<DateRange[]>([{ start: '', end: '' }]);
  const [departureRegion, setDepartureRegion] = useState('Zürich, Schweiz');
  const [budgetLevel, setBudgetLevel] = useState<IncentiveBrief['budgetLevel']>('premium');
  const [styles, setStyles] = useState<string[]>(['Teambuilding']);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [plans, setPlans] = useState<PlanRow[]>([]);

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/incentive').then((x) => x.json()).catch(() => null);
    if (r?.success) setPlans(r.data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleStyle = (s: string) => setStyles((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);
  const setRange = (arr: DateRange[], set: (v: DateRange[]) => void, i: number, k: 'start' | 'end', v: string) =>
    set(arr.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const generate = async () => {
    setError('');
    const brief: IncentiveBrief = {
      groupSize: parseInt(groupSize, 10) || 0,
      days: parseInt(days, 10) || 0,
      periods: periods.filter((p) => p.start && p.end),
      exclusions: useExcl ? exclusions.filter((p) => p.start && p.end) : [],
      departureRegion, budgetLevel, styles, notes,
    };
    if (!brief.groupSize || !brief.days || !brief.periods.length) {
      setError('Bitte Gruppengröße, Tage und mindestens einen vollständigen Reisezeitraum angeben.');
      return;
    }
    setGenerating(true);
    try {
      const r = await fetch('/api/admin/incentive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ brief }) });
      const j = await r.json();
      if (j.success && j.id) router.push(`/admin/incentive/${j.id}`);
      else setError(j.error || 'Generierung fehlgeschlagen.');
    } catch { setError('Verbindungsfehler.'); }
    finally { setGenerating(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Diesen Plan löschen?')) return;
    await fetch(`/api/admin/incentive/${id}`, { method: 'DELETE' });
    load();
  };

  const dateCls = 'rounded-lg border px-3 py-2 text-sm text-gray-900';

  return (
    <AdminShell title="Incentive Builder">
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-6 w-6" style={{ color: COLORS.accent }} />
        <div>
          <h2 className="text-2xl font-extrabold" style={{ color: COLORS.navy }}>Incentive Builder</h2>
          <p className="text-sm text-gray-500">KI plant aus euren Eckdaten eine komplette Incentive-Reise – inkl. Bestwetter-Ziel, Tagesplan, WOW-Momenten und Präsentation.</p>
        </div>
      </div>

      {generating ? (
        <SectionCard title="KI plant Ihre Reise …">
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Spinner />
            <p className="text-sm text-gray-600 max-w-md">Ziele werden vorgeschlagen, nach Bestwetter sortiert, ein Tag-für-Tag-Plan mit WOW-Momenten erstellt, geprüft und bebildert. Das dauert in der Regel 30–90 Sekunden.</p>
          </div>
        </SectionCard>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionCard title="Briefing" icon={<Wand2 className="h-5 w-5" />}
              actions={<Button variant="accent" onClick={generate}><Sparkles className="h-4 w-4" /> Reise generieren</Button>}>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <InputField label="Gruppengröße" type="number" value={groupSize} onChange={(e) => setGroupSize(e.target.value)} />
                  <InputField label="Anzahl Tage" type="number" value={days} onChange={(e) => setDays(e.target.value)} />
                  <div className="col-span-2">
                    <Field label="Budget-Niveau">
                      <select value={budgetLevel} onChange={(e) => setBudgetLevel(e.target.value as IncentiveBrief['budgetLevel'])} className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }}>
                        {Object.entries(BUDGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </Field>
                  </div>
                </div>

                <InputField label="Abflug-/Startregion" value={departureRegion} onChange={(e) => setDepartureRegion(e.target.value)} />

                <Field label="Mögliche Reisezeiträume">
                  <div className="grid gap-2">
                    {periods.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <input type="date" value={p.start} onChange={(e) => setRange(periods, setPeriods, i, 'start', e.target.value)} className={dateCls} style={{ borderColor: '#d8dde4' }} />
                        <span className="text-gray-400">bis</span>
                        <input type="date" value={p.end} onChange={(e) => setRange(periods, setPeriods, i, 'end', e.target.value)} className={dateCls} style={{ borderColor: '#d8dde4' }} />
                        {periods.length > 1 && <button onClick={() => setPeriods(periods.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    ))}
                    <button onClick={() => setPeriods([...periods, { start: '', end: '' }])} className="flex items-center gap-1 text-sm font-semibold" style={{ color: COLORS.accent }}><Plus className="h-4 w-4" /> Zeitraum hinzufügen</button>
                  </div>
                </Field>

                <div>
                  <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.navy }}>
                    <input type="checkbox" checked={useExcl} onChange={(e) => setUseExcl(e.target.checked)} /> Auszuschließende Zeiträume berücksichtigen
                  </label>
                  {useExcl && (
                    <div className="mt-2 grid gap-2">
                      {exclusions.map((p, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input type="date" value={p.start} onChange={(e) => setRange(exclusions, setExclusions, i, 'start', e.target.value)} className={dateCls} style={{ borderColor: '#d8dde4' }} />
                          <span className="text-gray-400">bis</span>
                          <input type="date" value={p.end} onChange={(e) => setRange(exclusions, setExclusions, i, 'end', e.target.value)} className={dateCls} style={{ borderColor: '#d8dde4' }} />
                          {exclusions.length > 1 && <button onClick={() => setExclusions(exclusions.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      ))}
                      <button onClick={() => setExclusions([...exclusions, { start: '', end: '' }])} className="flex items-center gap-1 text-sm font-semibold" style={{ color: COLORS.accent }}><Plus className="h-4 w-4" /> Ausschluss hinzufügen</button>
                    </div>
                  )}
                </div>

                <Field label="Stil / Schwerpunkte">
                  <div className="flex flex-wrap gap-2">
                    {STYLE_OPTIONS.map((s) => (
                      <button key={s} onClick={() => toggleStyle(s)} className="rounded-full px-3 py-1.5 text-xs font-bold border-2 transition"
                        style={{ background: styles.includes(s) ? COLORS.navy : 'white', borderColor: styles.includes(s) ? COLORS.navy : '#d8dde4', color: styles.includes(s) ? 'white' : '#475569' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Zusatzwünsche (optional)">
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="z.B. nachhaltige Anreise, vegetarische Optionen, ein bestimmtes Erlebnis …" className="w-full rounded-lg border px-3 py-2 text-sm text-gray-900" style={{ borderColor: '#d8dde4' }} />
                </Field>

                {error && <div className="rounded-lg px-4 py-2 text-sm" style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>{error}</div>}
              </div>
            </SectionCard>
          </div>

          <div>
            <SectionCard title={`Gespeicherte Reisen (${plans.length})`} icon={<MapPin className="h-5 w-5" />}>
              {plans.length === 0 ? <p className="text-sm text-gray-400">Noch keine Reisen generiert.</p> : (
                <div className="grid gap-2">
                  {plans.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5" style={{ borderColor: '#eef2f7' }}>
                      <Link href={`/admin/incentive/${p.id}`} className="min-w-0">
                        <div className="truncate text-sm font-semibold" style={{ color: COLORS.navy }}>{p.title}</div>
                        <div className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString('de-DE')}</div>
                      </Link>
                      <button onClick={() => del(p.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
