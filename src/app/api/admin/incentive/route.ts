import { NextResponse } from 'next/server';
import { createIncentivePlan, listIncentivePlans, updateIncentivePlan } from '@/lib/incentive/store';
import type { IncentiveBrief } from '@/lib/incentive/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const plans = await listIncentivePlans();
  return NextResponse.json({ success: true, data: plans });
}

/**
 * POST – Brief entgegennehmen, Plan-Datensatz anlegen (status 'generating', Schritt 1).
 * Die eigentliche Generierung treibt der Client in kurzen Einzelschritten über
 * /api/admin/incentive/[id]/step (vermeidet Proxy-Timeout & Background-Kill).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const brief = (body.brief || {}) as IncentiveBrief;
    if (!brief.groupSize || !brief.days || !Array.isArray(brief.periods) || !brief.periods.length) {
      return NextResponse.json({ success: false, error: 'Gruppengröße, Tage und mind. ein Reisezeitraum sind erforderlich.' }, { status: 400 });
    }
    const id = await createIncentivePlan('Incentive wird geplant …', brief, null, 'generating');
    await updateIncentivePlan(id, { progress: { step: 1, total: 4, label: 'Passende Reiseziele & Bestwetter …' } });
    return NextResponse.json({ success: true, id });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
  }
}
