/**
 * GET  /api/admin/files — alle aktiven Freigaben (alle Interne sehen alles) + freier Speicher.
 * POST /api/admin/files — neue Freigabe { title?, message?, days? | expires_at?, password? }.
 * Geschützt durch die Middleware (/api/admin/*).
 */
import { NextResponse } from 'next/server';
import { createShare, freeDiskBytes, listShares } from '@/lib/files/store';
import { currentActor } from '@/lib/files/actor';
import { FILES_CHUNK_BYTES, FILES_DAY_PRESETS, FILES_DEFAULT_DAYS, FILES_MAX_DAYS, FILES_MAX_FILE_BYTES } from '@/lib/files/config';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const includeDeleted = new URL(req.url).searchParams.get('deleted') === '1';
  const actor = await currentActor();
  const shares = await listShares({ includeDeleted });
  return NextResponse.json({
    success: true,
    data: shares,
    me: actor,
    config: {
      default_days: FILES_DEFAULT_DAYS, max_days: FILES_MAX_DAYS, presets: FILES_DAY_PRESETS,
      max_file_bytes: FILES_MAX_FILE_BYTES, chunk_bytes: FILES_CHUNK_BYTES, free_bytes: freeDiskBytes(),
    },
  });
}

export async function POST(req: Request) {
  const actor = await currentActor();
  if (!actor) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const share = await createShare(actor, body || {});
  return NextResponse.json({ success: true, data: share });
}
