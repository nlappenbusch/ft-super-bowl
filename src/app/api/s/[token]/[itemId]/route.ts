/**
 * GET /api/s/[token]/[itemId] — öffentlicher Download einer Datei aus einem Teil-Link.
 * Bewusst ohne Session: der Token ist die Berechtigung (plus Passwort-Cookie, falls gesetzt).
 */
import { NextResponse } from 'next/server';
import { resolvePublicShare } from '@/lib/files/publicAccess';
import { countDownload } from '@/lib/files/store';
import { fileResponse, isFirstRequest } from '@/lib/files/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 3600;

export async function GET(req: Request, { params }: { params: Promise<{ token: string; itemId: string }> }) {
  const { token, itemId } = await params;
  const acc = await resolvePublicShare(token);
  if (acc.status === 'expired') return NextResponse.json({ success: false, error: 'Link abgelaufen' }, { status: 410 });
  if (acc.status !== 'ok') return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: acc.status === 'locked' ? 401 : 404 });
  const item = acc.share.items.find((i) => i.id === itemId);
  if (!item) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  const inline = new URL(req.url).searchParams.get('inline') === '1';
  if (!inline && isFirstRequest(req)) await countDownload(acc.share.id, [item.id]);
  return fileResponse(req, item, { inline });
}
