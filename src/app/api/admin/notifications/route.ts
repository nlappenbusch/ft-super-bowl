import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { listNotifications, countUnreadNotifications, markNotificationsRead } from '@/lib/staffStore';

/**
 * GET ?unread=1&limit=20 → Benachrichtigungen des angemeldeten Mitarbeiters.
 * Lokale Admin-Sessions haben keinen Mitarbeiter-Datensatz → leere Liste.
 */
export async function GET(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  if (!ctx.employee) return NextResponse.json({ success: true, data: [], unread: 0 });

  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get('unread') === '1';
  const limit = Number(url.searchParams.get('limit') || 30) || 30;
  const [data, unread] = await Promise.all([
    listNotifications(ctx.employee.id, { unreadOnly, limit }),
    countUnreadNotifications(ctx.employee.id),
  ]);
  return NextResponse.json({ success: true, data, unread });
}

/** PATCH { ids?: string[] } → als gelesen markieren (ohne ids: alle). */
export async function PATCH(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  if (!ctx.employee) return NextResponse.json({ success: true, changed: 0 });

  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.map(String) : undefined;
  const changed = await markNotificationsRead(ctx.employee.id, ids);
  return NextResponse.json({ success: true, changed });
}
