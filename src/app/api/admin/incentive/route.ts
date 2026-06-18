import { NextResponse } from 'next/server';
import { generateIncentivePlan } from '@/lib/incentive/engine';
import { createIncentivePlan, listIncentivePlans, updateIncentivePlan } from '@/lib/incentive/store';
import type { IncentiveBrief } from '@/lib/incentive/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const plans = await listIncentivePlans();
  return NextResponse.json({ success: true, data: plans });
}

/**
 * POST – Brief entgegennehmen, Plan-Datensatz sofort anlegen (status 'generating')
 * und die KI-Generierung im Hintergrund laufen lassen. Antwortet sofort mit der id,
 * damit kein Reverse-Proxy-Timeout greift (Generierung dauert 30–90 s).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const brief = (body.brief || {}) as IncentiveBrief;
    if (!brief.groupSize || !brief.days || !Array.isArray(brief.periods) || !brief.periods.length) {
      return NextResponse.json({ success: false, error: 'Gruppengröße, Tage und mind. ein Reisezeitraum sind erforderlich.' }, { status: 400 });
    }

    const id = await createIncentivePlan('Incentive wird geplant …', brief, null, 'generating');

    // Hintergrund-Generierung (Node-Standalone hält die Promise am Leben).
    void (async () => {
      try {
        const plan = await generateIncentivePlan(brief, (p) => updateIncentivePlan(id, { progress: p }));
        await updateIncentivePlan(id, {
          plan,
          status: 'final',
          title: plan.introTitle || `Incentive nach ${plan.destination.name}`,
          error: '',
        });
      } catch (e) {
        await updateIncentivePlan(id, { status: 'error', error: (e as Error).message }).catch(() => {});
      }
    })();

    return NextResponse.json({ success: true, id });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
