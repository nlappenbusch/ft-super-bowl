import { NextResponse } from 'next/server';
import { readReport, runScan } from '@/lib/statusCheck';
import { computeFixPlan, createFixPr, type FixScope } from '@/lib/autoFix';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/admin/status/fix-pr  body: { scope }  → legt Branch + PR via GitHub-API an. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = (['security', 'minor', 'all'].includes(body.scope) ? body.scope : 'all') as FixScope;

    let report = await readReport();
    if (!report) report = await runScan(true);
    const plan = computeFixPlan(report, scope);

    const result = await createFixPr(plan);
    if (!result.success) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    return NextResponse.json({ success: true, url: result.url, branch: result.branch, count: plan.items.length });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
