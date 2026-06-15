import { NextResponse } from 'next/server';
import { readReport, runScan } from '@/lib/statusCheck';
import { computeFixPlan, aiFixGuidance, getGithubConfig, type FixScope } from '@/lib/autoFix';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/status/fix-plan?scope=all&ai=1&format=json|script|pkg
 *  - format=json  (default): { plan, ai?, github }
 *  - format=script: Upgrade-Skript als .sh (Download)
 *  - format=pkg:    aktualisierte package.json (Download)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = (['security', 'minor', 'all'].includes(searchParams.get('scope') || '') ? searchParams.get('scope') : 'all') as FixScope;
    const format = searchParams.get('format') || 'json';

    let report = await readReport();
    if (!report) report = await runScan(true);
    const plan = computeFixPlan(report, scope);

    if (format === 'script') {
      return new NextResponse(plan.script, {
        headers: { 'Content-Type': 'text/x-shellscript; charset=utf-8', 'Content-Disposition': 'attachment; filename="auto-fix.sh"', 'Cache-Control': 'no-store' },
      });
    }
    if (format === 'pkg') {
      return new NextResponse(plan.updatedPackageJson, {
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="package.json"', 'Cache-Control': 'no-store' },
      });
    }

    const ai = searchParams.get('ai') === '1' ? await aiFixGuidance(plan, report) : null;
    const g = getGithubConfig();
    return NextResponse.json({
      success: true,
      plan,
      ai,
      github: { configured: g.configured, owner: g.owner, repo: g.repo, base: g.base },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
