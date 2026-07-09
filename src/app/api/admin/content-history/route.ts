import { NextResponse } from 'next/server';
import {
  listContentHistory,
  readContentHistorySnapshot,
  restoreContentHistorySnapshot,
} from '@/lib/contentStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Content-Historie (Snapshots aus data/backups/history/, entstehen bei jedem Speichern).
 *
 * GET  /api/admin/content-history            → Liste aller Snapshots (neueste zuerst)
 * GET  /api/admin/content-history?name=<n>   → Inhalt eines Snapshots (entpackt)
 * POST /api/admin/content-history            → { "restore": "<name>" } stellt Snapshot wieder her
 *                                              (der aktuelle Stand wird davor selbst gesichert)
 * Auth über die Admin-Middleware (/api/admin/*).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = (searchParams.get('name') || '').trim();
  if (name) {
    const data = readContentHistorySnapshot(name);
    if (data === null) {
      return NextResponse.json({ success: false, error: 'Snapshot nicht gefunden oder unlesbar.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, name, data });
  }
  return NextResponse.json({ success: true, data: listContentHistory() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { restore?: string };
    if (!body?.restore) {
      return NextResponse.json({ success: false, error: 'Feld "restore" (Snapshot-Name) fehlt.' }, { status: 400 });
    }
    const result = restoreContentHistorySnapshot(body.restore);
    return NextResponse.json({ success: true, restored: result.file });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message }, { status: 400 });
  }
}
