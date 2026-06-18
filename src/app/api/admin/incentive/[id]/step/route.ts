import { NextResponse } from 'next/server';
import { getIncentivePlan, updateIncentivePlan } from '@/lib/incentive/store';
import { stepDestinations, stepItinerary, stepFeasibility, stepImages } from '@/lib/incentive/engine';
import type { IncentivePlan } from '@/lib/incentive/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/incentive/[id]/step – führt genau die nächste Generierungs-Phase aus
 * und speichert das Zwischenergebnis. Client ruft wiederholt auf, bis status != 'generating'.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rec = await getIncentivePlan(id);
  if (!rec) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  if (rec.status !== 'generating') return NextResponse.json({ success: true, data: rec });

  const step = rec.progress?.step || 1;
  const dests = rec.progress?.destinations;

  try {
    if (step === 1) {
      const { ranked, chosenPeriod } = await stepDestinations(rec.brief);
      const top = ranked[0];
      const plan: IncentivePlan = {
        destination: top, rankedAlternatives: ranked.slice(1), chosenPeriod,
        introTitle: '', introText: '', summary: '', days: [],
        accommodation: { name: '', description: '' }, logistics: '', wowHighlights: [],
        feasibility: { ok: false, score: 0, issues: [], notes: '' },
      };
      await updateIncentivePlan(id, { plan, progress: { step: 2, total: 4, label: `Tag-für-Tag-Plan & WOW-Momente für ${top.name} …`, destinations: ranked } });
    } else if (step === 2) {
      if (!rec.plan) throw new Error('Zwischenstand fehlt.');
      const itin = await stepItinerary(rec.brief, rec.plan.destination);
      const plan: IncentivePlan = { ...rec.plan, ...itin };
      await updateIncentivePlan(id, { plan, progress: { step: 3, total: 4, label: 'Machbarkeit & Konsistenz werden geprüft …', destinations: dests } });
    } else if (step === 3) {
      if (!rec.plan) throw new Error('Zwischenstand fehlt.');
      const feasibility = await stepFeasibility(rec.brief, rec.plan.destination, rec.plan.days, rec.plan.logistics);
      const plan: IncentivePlan = { ...rec.plan, feasibility };
      await updateIncentivePlan(id, { plan, progress: { step: 4, total: 4, label: 'Inspirierende Bilder werden gesucht …', destinations: dests } });
    } else {
      if (!rec.plan) throw new Error('Zwischenstand fehlt.');
      const { destination, days } = await stepImages(rec.plan.destination, rec.plan.days);
      const plan: IncentivePlan = { ...rec.plan, destination, days };
      await updateIncentivePlan(id, { plan, status: 'final', title: plan.introTitle || `Incentive nach ${destination.name}`, error: '' });
    }
  } catch (e) {
    await updateIncentivePlan(id, { status: 'error', error: (e as Error).message }).catch(() => {});
  }

  const updated = await getIncentivePlan(id);
  return NextResponse.json({ success: true, data: updated });
}
