import { NextResponse } from 'next/server';
import { suggestMeta } from '@/lib/seoCheck';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/admin/seo/suggest  body: { path }  → KI-Vorschlag Title + Meta-Description. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const p = typeof body.path === 'string' ? body.path : '/';
    const res = await suggestMeta(p);
    return NextResponse.json(res.ok ? { success: true, ...res } : { success: false, error: res.error }, { status: res.ok ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
