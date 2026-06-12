import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { stampIn, stampOut, getRunningEntry } from '@/lib/staffStore';

/** GET: aktueller Stempel-Status des angemeldeten Mitarbeiters. */
export async function GET() {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  if (!ctx.employee) {
    return NextResponse.json({ success: true, data: { running: null, hasProfile: false } });
  }
  return NextResponse.json({ success: true, data: { running: getRunningEntry(ctx.employee.id), hasProfile: true } });
}

/** POST { action: 'in' | 'out', break_minutes? } – Stempeluhr für den eigenen Account. */
export async function POST(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  if (!ctx.employee) {
    return NextResponse.json({ success: false, error: 'Kein Mitarbeiterprofil – bitte per Microsoft anmelden' }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  if (body.action === 'in') {
    return NextResponse.json({ success: true, data: stampIn(ctx.employee.id) });
  }
  if (body.action === 'out') {
    const entry = stampOut(ctx.employee.id, Number(body.break_minutes) || 0);
    if (!entry) return NextResponse.json({ success: false, error: 'Nicht eingestempelt' }, { status: 400 });
    return NextResponse.json({ success: true, data: entry });
  }
  return NextResponse.json({ success: false, error: "action muss 'in' oder 'out' sein" }, { status: 400 });
}
