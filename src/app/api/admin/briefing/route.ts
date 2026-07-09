import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { runDailyBriefing, briefingStatus } from '@/lib/dailyBriefing';

/** GET → Status des Tages-Briefings (Toggle, Stunde, letzter Versand). */
export async function GET() {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  return NextResponse.json({ success: true, data: briefingStatus() });
}

/**
 * POST → Briefing sofort verschicken (manueller Test, unabhängig von Uhrzeit
 * und Tages-Deduplizierung; zählt danach als heutiger Versand).
 */
export async function POST() {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  try {
    const result = await runDailyBriefing({ force: true });
    if (!result.configured) {
      return NextResponse.json({ success: false, error: 'Microsoft Graph ist nicht konfiguriert.' }, { status: 409 });
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
