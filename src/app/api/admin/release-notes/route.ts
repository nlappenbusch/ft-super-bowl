import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { runReleaseNotes, releaseNotesStatus } from '@/lib/releaseNotes';

/** GET → Status der Release-Notes-Mail (Toggle, GitHub-Zugang, letzter Lauf). */
export async function GET() {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  return NextResponse.json({ success: true, data: releaseNotesStatus() });
}

/**
 * POST → sofort prüfen & verschicken (manueller Test). Ohne neue Merges seit
 * dem letzten Lauf geht keine Mail raus (reason im Ergebnis).
 */
export async function POST() {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  try {
    const result = await runReleaseNotes({ force: true });
    if (!result.configured) {
      return NextResponse.json({ success: false, error: result.reason || 'Nicht konfiguriert.' }, { status: 409 });
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
