import { NextRequest, NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/settingsStore';
import { requireAdminSession } from '@/lib/apiGuard';

// Settings enthalten Secrets (admin_password, Graph client_secret, API-Keys)
// und werden nur vom Admin-Panel gelesen/geschrieben → Session-Pflicht.
export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;
  try {
    const settings = getSettings();
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
    const updated = saveSettings(body);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
