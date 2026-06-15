import { NextResponse } from 'next/server';
import { getSettings, saveSettings, type GithubSettings } from '@/lib/settingsStore';

export const dynamic = 'force-dynamic';

/** GET: Konfig-Status (Token nur als gesetzt-Flag). */
export async function GET() {
  const g = getSettings().github;
  return NextResponse.json({
    success: true,
    data: {
      owner: g.owner,
      repo: g.repo,
      base_branch: g.base_branch,
      has_token: !!(g.token || process.env.GITHUB_TOKEN),
      env_fallback: !!process.env.GITHUB_TOKEN,
    },
  });
}

/** POST: GitHub-Konfig speichern. Token nur überschreiben, wenn ein Wert kommt. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updates: Partial<GithubSettings> = {};
    if (typeof body.token === 'string' && body.token.trim()) updates.token = body.token.trim();
    if (typeof body.owner === 'string' && body.owner.trim()) updates.owner = body.owner.trim();
    if (typeof body.repo === 'string' && body.repo.trim()) updates.repo = body.repo.trim();
    if (typeof body.base_branch === 'string' && body.base_branch.trim()) updates.base_branch = body.base_branch.trim();
    saveSettings({ github: updates as GithubSettings });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
