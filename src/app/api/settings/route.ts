import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settingsStore';
import { requireAdminSession } from '@/lib/apiGuard';

// Settings enthalten Secrets (Graph client_secret, API-Keys)
// und werden nur vom Admin-Panel gelesen/geschrieben → Session-Pflicht.
export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;
  try {
    // Traffics-authKey nie an den Browser geben — Pflege über /api/admin/traffics/config.
    const { traffics: _traffics, ...settings } = getSettings();
    void _traffics;
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  try {
    const body = await request.json();
    if (body && typeof body === 'object') delete body.traffics; // nur über /api/admin/traffics/config
    const { traffics: _traffics, ...updated } = saveSettings(body);
    void _traffics;
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
