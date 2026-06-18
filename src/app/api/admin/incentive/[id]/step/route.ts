import { NextResponse } from 'next/server';
import { getIncentivePlan, updateIncentivePlan } from '@/lib/incentive/store';
import { stepDestinations, stepFrame, stepDay, stepFeasibility, stepImages } from '@/lib/incentive/engine';
import type { IncentivePlan, IncentiveProgress } from '@/lib/incentive/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/incentive/[id]/step – führt genau die nächste Phase aus (kurzer Request).
 * Phasen: destinations → frame → day(0..N-1) → feasibility → images → final.
 * Client ruft wiederholt auf, bis status != 'generating'.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await getIncentivePlan(id);
  if (!rec) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  if (rec.status !== 'generating') return NextResponse.json({ success: true, data: rec });

  const phase = rec.progress?.phase || 'destinations';
  const dests = rec.progress?.destinations;
  const N = rec.brief.days || 1;

  try {
    if (phase === 'destinations') {
      const { ranked, chosenPeriod } = await stepDestinations(rec.brief);
      const top = ranked[0];
      const plan: IncentivePlan = {
        destination: top, rankedAlternatives: ranked.slice(1), chosenPeriod,
        introTitle: '', introText: '', summary: '', days: [],
        accommodation: { name: '', description: '' }, logistics: '', wowHighlights: [],
        feasibility: { ok: false, score: 0, issues: [], notes: '' },
      };
      const progress: IncentiveProgress = { step: 2, total: 4, phase: 'frame', label: 'Reise-Gerüst, Unterkunft & Highlights …', destinations: ranked };
      await updateIncentivePlan(id, { plan, progress });
    } else if (phase === 'frame') {
      if (!rec.plan) throw new Error('Zwischenstand fehlt.');
      const frame = await stepFrame(rec.brief, rec.plan.destination);
      const plan: IncentivePlan = { ...rec.plan, ...frame };
      const progress: IncentiveProgress = { step: 2, total: 4, phase: 'day', dayIndex: 0, label: `Tag 1 von ${N} wird geplant …`, destinations: dests };
      await updateIncentivePlan(id, { plan, progress });
    } else if (phase === 'day') {
      if (!rec.plan) throw new Error('Zwischenstand fehlt.');
      const idx = rec.progress?.dayIndex || 0;
      const stub = rec.plan.days[idx];
      const filled = await stepDay(rec.brief, rec.plan.destination, stub, N);
      const days = rec.plan.days.map((d, i) => (i === idx ? filled : d));
      const plan: IncentivePlan = { ...rec.plan, days };
      const next = idx + 1;
      const progress: IncentiveProgress = next < N
        ? { step: 2, total: 4, phase: 'day', dayIndex: next, label: `Tag ${next + 1} von ${N} wird geplant …`, destinations: dests }
        : { step: 3, total: 4, phase: 'feasibility', label: 'Machbarkeit & Konsistenz werden geprüft …', destinations: dests };
      await updateIncentivePlan(id, { plan, progress });
    } else if (phase === 'feasibility') {
      if (!rec.plan) throw new Error('Zwischenstand fehlt.');
      const feasibility = await stepFeasibility(rec.brief, rec.plan.destination, rec.plan.days, rec.plan.logistics);
      const plan: IncentivePlan = { ...rec.plan, feasibility };
      const progress: IncentiveProgress = { step: 4, total: 4, phase: 'images', label: 'Inspirierende Bilder werden gesucht …', destinations: dests };
      await updateIncentivePlan(id, { plan, progress });
    } else {
      if (!rec.plan) throw new Error('Zwischenstand fehlt.');
      const { destination, days } = await stepImages(rec.plan.destination, rec.plan.days);
      const plan: IncentivePlan = { ...rec.plan, destination, days };
      await updateIncentivePlan(id, { plan, status: 'final', title: plan.introTitle || `Incentive nach ${destination.name}`, error: '' });
    }
  } catch (e) {
    const where = phase === 'day' ? `day ${(rec.progress?.dayIndex || 0) + 1}` : phase;
    await updateIncentivePlan(id, { status: 'error', error: `[${where}] ${(e as Error).message}` }).catch(() => {});
  }

  const updated = await getIncentivePlan(id);
  return NextResponse.json({ success: true, data: updated });
}
