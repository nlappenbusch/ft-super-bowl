/**
 * GET /api/s/[token]/zip — alle Dateien eines Teil-Links als ZIP (gestreamt).
 */
import { NextResponse } from 'next/server';
import { resolvePublicShare } from '@/lib/files/publicAccess';
import { countDownload } from '@/lib/files/store';
import { ZIP_MAX_BYTES, zipResponse, zipSize } from '@/lib/files/http';

export const dynamic = 'force-dynamic';
export const maxDuration = 3600;

function zipName(title: string): string {
  const base = (title || 'Faltin-Travel-Dateien').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80) || 'Faltin-Travel-Dateien';
  return `${base}.zip`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const acc = await resolvePublicShare(token);
  if (acc.status === 'expired') return NextResponse.json({ success: false, error: 'Link abgelaufen' }, { status: 410 });
  if (acc.status !== 'ok') return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: acc.status === 'locked' ? 401 : 404 });
  const items = acc.share.items;
  if (!items.length) return NextResponse.json({ success: false, error: 'Keine Dateien' }, { status: 404 });
  if (zipSize(items) > ZIP_MAX_BYTES || items.length > 60000) {
    return NextResponse.json({ success: false, error: 'Zu gross für ein ZIP – bitte einzeln laden' }, { status: 413 });
  }
  await countDownload(acc.share.id, items.map((i) => i.id));
  return zipResponse(items, zipName(acc.share.title));
}
