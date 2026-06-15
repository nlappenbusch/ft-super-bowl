import { NextResponse } from 'next/server';
import { runSeoScan } from '@/lib/seoCheck';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** POST /api/admin/seo/scan – Voll-Scan (Seiten + Technik + JSON-LD + GEO + KI), speichert + liefert. */
export async function POST() {
  try {
    const report = await runSeoScan(true);
    return NextResponse.json({ success: true, report });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
