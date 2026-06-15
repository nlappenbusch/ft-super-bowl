import { NextResponse } from 'next/server';
import { runScan } from '@/lib/statusCheck';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/admin/status/scan – Voll-Scan (Versionen + CVEs + KI), speichert + liefert Report. */
export async function POST() {
  try {
    const report = await runScan(true);
    return NextResponse.json({ success: true, report });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
