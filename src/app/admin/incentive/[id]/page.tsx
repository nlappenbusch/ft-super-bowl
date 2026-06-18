'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, Button, Spinner, Badge } from '@/components/admin/ui';
import { ArrowLeft, Presentation, ListChecks, Printer, AlertTriangle, CheckCircle2, Cloud, MapPin } from 'lucide-react';
import type { IncentivePlanRecord, IncentivePlan, DayPlan } from '@/lib/incentive/types';

const NAVY = '#143047'; const ACCENT = '#d9531e';

export default function IncentivePlanPage() {
  const params = useParams();
  const id = String(params.id || '');
  const [rec, setRec] = useState<IncentivePlanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'plan' | 'deck'>('plan');

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/incentive/${id}`).then((x) => x.json()).catch(() => null);
    if (r?.success) setRec(r.data);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Während die KI generiert: alle 4 s neu laden.
  useEffect(() => {
    if (rec?.status === 'generating') {
      const t = setTimeout(load, 4000);
      return () => clearTimeout(t);
    }
  }, [rec?.status, load]);

  if (loading) return <AdminShell title="Incentive"><div className="py-16 text-center"><Spinner /></div></AdminShell>;
  if (!rec) return <AdminShell title="Incentive"><p className="text-gray-500">Plan nicht gefunden. <Link href="/admin/incentive" className="underline">Zurück</Link></p></AdminShell>;

  if (rec.status === 'generating') {
    return (
      <AdminShell title="Incentive">
        <Link href="/admin/incentive" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-gray-500"><ArrowLeft className="h-3.5 w-3.5" /> Alle Reisen</Link>
        <SectionCard title="KI plant Ihre Reise …">
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Spinner />
            <p className="max-w-md text-sm text-gray-600">Ziele werden vorgeschlagen, nach Bestwetter sortiert, ein Tag-für-Tag-Plan mit WOW-Momenten erstellt, geprüft und bebildert. Diese Seite aktualisiert sich automatisch (30–90 Sek.).</p>
          </div>
        </SectionCard>
      </AdminShell>
    );
  }

  if (rec.status === 'error' || !rec.plan) {
    return (
      <AdminShell title="Incentive">
        <Link href="/admin/incentive" className="mb-4 inline-flex items-center gap-1 text-xs font-semibold text-gray-500"><ArrowLeft className="h-3.5 w-3.5" /> Alle Reisen</Link>
        <SectionCard title="Generierung fehlgeschlagen">
          <div className="flex items-start gap-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <p>Die Reise konnte nicht erstellt werden.</p>
              {rec.error && <p className="mt-1 text-xs text-gray-500">{rec.error}</p>}
              <p className="mt-2 text-gray-600">Bitte erneut versuchen. Häufigste Ursache: KI nicht konfiguriert (Admin → KI) oder eine Zeitüberschreitung.</p>
            </div>
          </div>
        </SectionCard>
      </AdminShell>
    );
  }

  const plan = rec.plan;

  return (
    <AdminShell title="Incentive">
      <div className="mb-5 flex items-center justify-between gap-3 no-print">
        <Link href="/admin/incentive" className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500"><ArrowLeft className="h-3.5 w-3.5" /> Alle Reisen</Link>
        <div className="flex gap-2">
          <Button variant={mode === 'plan' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('plan')}><ListChecks className="h-4 w-4" /> Plan</Button>
          <Button variant={mode === 'deck' ? 'primary' : 'secondary'} size="sm" onClick={() => setMode('deck')}><Presentation className="h-4 w-4" /> Präsentation</Button>
          {mode === 'deck' && <Button variant="accent" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /> Als PDF drucken</Button>}
        </div>
      </div>

      {mode === 'plan' ? <PlanView plan={plan} brief={rec.brief} /> : <Deck plan={plan} brief={rec.brief} />}
    </AdminShell>
  );
}

function PlanView({ plan, brief }: { plan: IncentivePlan; brief: IncentivePlanRecord['brief'] }) {
  const d = plan.destination;
  return (
    <div className="grid gap-6">
      <SectionCard title={plan.introTitle} icon={<MapPin className="h-5 w-5" />}>
        <div className="grid gap-4 md:grid-cols-3">
          {d.imageUrl && <img src={d.imageUrl} alt={d.name} className="h-44 w-full rounded-xl object-cover md:col-span-1" />}
          <div className="md:col-span-2">
            <div className="mb-1 text-lg font-extrabold" style={{ color: NAVY }}>{d.name}, {d.country}</div>
            <p className="text-sm leading-relaxed text-gray-700">{plan.introText}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="navy">{brief.groupSize} Personen</Badge>
              <Badge tone="navy">{brief.days} Tage</Badge>
              <Badge tone="muted">{plan.chosenPeriod.start} – {plan.chosenPeriod.end}</Badge>
              {plan.estBudgetPerPerson && <Badge tone="accent">{plan.estBudgetPerPerson}</Badge>}
              {d.weather && <Badge tone="info"><Cloud className="mr-1 inline h-3 w-3" />{d.weather.summary} · Score {d.weather.score}</Badge>}
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 grid gap-4">
          {plan.days.map((day) => <DayCard key={day.day} day={day} />)}
        </div>
        <div className="grid gap-4">
          <SectionCard title="Machbarkeit & Konsistenz">
            <div className="mb-2 flex items-center gap-2">
              {plan.feasibility.ok ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
              <span className="text-sm font-bold" style={{ color: NAVY }}>Score {plan.feasibility.score}/100</span>
            </div>
            <p className="text-sm text-gray-600">{plan.feasibility.notes}</p>
            {plan.feasibility.issues.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-700">
                {plan.feasibility.issues.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            )}
          </SectionCard>
          <SectionCard title="WOW-Momente">
            <ul className="grid gap-1.5 text-sm text-gray-700">
              {plan.wowHighlights.map((w, i) => <li key={i} className="flex gap-2"><span style={{ color: ACCENT }}>★</span> {w}</li>)}
            </ul>
          </SectionCard>
          <SectionCard title="Unterkunft & Logistik">
            <div className="text-sm font-bold" style={{ color: NAVY }}>{plan.accommodation.name}</div>
            <p className="text-sm text-gray-600">{plan.accommodation.description}</p>
            {plan.accommodation.bookingHint && <p className="mt-1 text-xs text-gray-400">{plan.accommodation.bookingHint}</p>}
            <p className="mt-3 text-sm text-gray-600">{plan.logistics}</p>
          </SectionCard>
          {plan.rankedAlternatives.length > 0 && (
            <SectionCard title="Alternativen (nach Wetter)">
              <div className="grid gap-1.5">
                {plan.rankedAlternatives.slice(0, 4).map((alt, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: '#f5f7fa' }}>
                    <span style={{ color: NAVY }}>{alt.name}, {alt.country}</span>
                    {alt.weather && <span className="text-xs text-gray-500">{Math.round(alt.weather.tempMaxAvg)}°C · Score {alt.weather.score}</span>}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

function DayCard({ day }: { day: DayPlan }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: '#eef2f7' }}>
      <div className="flex gap-4 p-4">
        {day.imageUrl && <img src={day.imageUrl} alt={day.title} className="h-24 w-32 flex-shrink-0 rounded-xl object-cover" />}
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-wide" style={{ color: ACCENT }}>Tag {day.day} · {day.theme}</div>
          <div className="text-base font-extrabold" style={{ color: NAVY }}>{day.title}</div>
          <p className="mt-1 text-sm text-gray-600">{day.text}</p>
        </div>
      </div>
      <div className="grid gap-2 px-4 pb-4 text-sm text-gray-700 sm:grid-cols-3">
        <div><span className="font-semibold" style={{ color: NAVY }}>Vormittag</span><br />{day.morning}</div>
        <div><span className="font-semibold" style={{ color: NAVY }}>Nachmittag</span><br />{day.afternoon}</div>
        <div><span className="font-semibold" style={{ color: NAVY }}>Abend</span><br />{day.evening}</div>
      </div>
      {day.wow && <div className="mx-4 mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: '#fff7ed', color: '#9a3412' }}>★ WOW: {day.wow}</div>}
    </div>
  );
}

/* ─── Präsentations-Deck ─────────────────────────────────────────────── */

interface Slide { kind: 'intro' | 'day' | 'outro'; title: string; subtitle?: string; text?: string; image?: string; day?: DayPlan }

function Deck({ plan, brief }: { plan: IncentivePlan; brief: IncentivePlanRecord['brief'] }) {
  const slides: Slide[] = [
    { kind: 'intro', title: plan.introTitle, subtitle: `${plan.destination.name}, ${plan.destination.country} · ${brief.days} Tage · ${brief.groupSize} Personen`, text: plan.introText, image: plan.destination.imageUrl },
    ...plan.days.map((day): Slide => ({ kind: 'day', title: day.title, subtitle: `Tag ${day.day} · ${day.theme}`, text: day.text, image: day.imageUrl, day })),
    { kind: 'outro', title: 'Wir liefern Emotionen', subtitle: plan.estBudgetPerPerson || '', text: plan.wowHighlights.join('  ·  '), image: plan.destination.imageUrl },
  ];
  const [i, setI] = useState(0);
  const cur = slides[i];

  return (
    <div>
      <style>{`@media print { .no-print{display:none!important} .deck-stage{display:none!important} .print-slides{display:block!important} .print-slide{page-break-after:always;height:100vh} } .print-slides{display:none}`}</style>

      {/* interaktive Bühne */}
      <div className="deck-stage">
        <SlideView slide={cur} />
        <div className="mt-3 flex items-center justify-between no-print">
          <Button variant="secondary" size="sm" onClick={() => setI(Math.max(0, i - 1))} >← Zurück</Button>
          <div className="flex gap-1.5">
            {slides.map((_, idx) => <button key={idx} onClick={() => setI(idx)} style={{ width: 9, height: 9, borderRadius: 999, border: 'none', cursor: 'pointer', background: idx === i ? ACCENT : '#cbd5e1' }} />)}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setI(Math.min(slides.length - 1, i + 1))}>Weiter →</Button>
        </div>
      </div>

      {/* Druckversion: alle Slides */}
      <div className="print-slides">
        {slides.map((s, idx) => <div key={idx} className="print-slide"><SlideView slide={s} /></div>)}
      </div>
    </div>
  );
}

function SlideView({ slide }: { slide: Slide }) {
  const bg = slide.image || '';
  return (
    <div style={{ position: 'relative', width: '100%', minHeight: '64vh', borderRadius: 18, overflow: 'hidden', background: NAVY, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {bg && <img src={bg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.55 }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(20,48,71,0.92) 10%, rgba(20,48,71,0.25) 70%)' }} />
      <div style={{ position: 'relative', padding: '40px 44px' }}>
        {slide.subtitle && <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: '#ffd2bd' }}>{slide.subtitle}</div>}
        <h1 style={{ margin: '6px 0 10px', fontSize: 34, fontWeight: 900, lineHeight: 1.1 }}>{slide.title}</h1>
        {slide.text && <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, maxWidth: 760, color: '#eef2f7' }}>{slide.text}</p>}
        {slide.day && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, maxWidth: 820 }}>
            {([['Vormittag', slide.day.morning], ['Nachmittag', slide.day.afternoon], ['Abend', slide.day.evening]] as const).map(([k, v]) => (
              <div key={k} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: '#ffd2bd' }}>{k}</div>
                <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {slide.day?.wow && <div style={{ marginTop: 14, display: 'inline-block', background: ACCENT, borderRadius: 999, padding: '7px 16px', fontSize: 13, fontWeight: 800 }}>★ {slide.day.wow}</div>}
      </div>
    </div>
  );
}
