import { NextResponse } from 'next/server';
import { getSettings, saveSettings, type TrafficsSettings } from '@/lib/settingsStore';
import { getTrafficsConfig, trafficsUsage } from '@/lib/traffics';
import { requireAdminSession } from '@/lib/apiGuard';

/** GET → Traffics-Zugang (Key nur als „gesetzt"-Flag) + Anfragezähler. */
export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;
  const t = getSettings().traffics;
  const cfg = getTrafficsConfig();
  return NextResponse.json({
    success: true,
    data: {
      has_key: !!cfg.authKey,
      key_source: cfg.keySource,
      mock: cfg.mock,
      base_url: t.base_url,
      tour_operators: t.tour_operators,
      cache_minutes: t.cache_minutes,
      max_requests_per_hour: t.max_requests_per_hour,
      usage: trafficsUsage(),
    },
  });
}

/**
 * POST { auth_key?, clear_key?, base_url?, tour_operators?, cache_minutes?, max_requests_per_hour? }
 * Key wird nur überschrieben, wenn ein Wert kommt (oder clear_key: true).
 */
export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Partial<TrafficsSettings> = {};
  if (typeof body.auth_key === 'string' && body.auth_key.trim()) updates.auth_key = body.auth_key.trim();
  if (body.clear_key === true) updates.auth_key = '';
  if (typeof body.base_url === 'string') {
    const u = body.base_url.trim();
    if (u && !/^https:\/\/[^\s]+$/.test(u)) {
      return NextResponse.json({ success: false, error: 'Basis-URL muss mit https:// beginnen.' }, { status: 400 });
    }
    updates.base_url = u;
  }
  if (typeof body.tour_operators === 'string') updates.tour_operators = body.tour_operators.trim().toUpperCase().slice(0, 60);
  if (body.cache_minutes !== undefined) updates.cache_minutes = Math.max(1, Math.min(1440, Math.round(Number(body.cache_minutes)) || 60));
  if (body.max_requests_per_hour !== undefined) {
    updates.max_requests_per_hour = Math.max(1, Math.min(500, Math.round(Number(body.max_requests_per_hour)) || 30));
  }
  saveSettings({ traffics: updates as TrafficsSettings });
  return NextResponse.json({ success: true });
}
