import { NextResponse } from 'next/server';
import { generateIncentivePlan } from '@/lib/incentive/engine';
import { createIncentivePlan, listIncentivePlans } from '@/lib/incentive/store';
import type { IncentiveBrief } from '@/lib/incentive/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET() {
  const plans = await listIncentivePlans();
  return NextResponse.json({ success: true, data: plans });
}

/** POST – Brief entgegennehmen, KI-Plan generieren, speichern. */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const brief = (body.brief || {}) as IncentiveBrief;
    if (!brief.groupSize || !brief.days || !Array.isArray(brief.periods) || !brief.periods.length) {
      return NextResponse.json({ success: false, error: 'Gruppengröße, Tage und mind. ein Reisezeitraum sind erforderlich.' }, { status: 400 });
    }
    const plan = await generateIncentivePlan(brief);
    const id = await createIncentivePlan(plan.introTitle || `Incentive nach ${plan.destination.name}`, brief, plan, 'final');
    return NextResponse.json({ success: true, id, plan });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
