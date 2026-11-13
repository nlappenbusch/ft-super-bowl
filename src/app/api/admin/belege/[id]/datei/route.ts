/** GET /api/admin/belege/[id]/datei[?thumb=1][&download=1] — Belegdatei bzw. Vorschaubild. */
import { NextResponse } from 'next/server';
import { requireBelegeUser, jsonError } from '@/lib/belege/actor';
import { canSee, getReceipt, readReceiptFile } from '@/lib/belege/store';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const r = await getReceipt(id);
  if (!r || !canSee(r, user)) return jsonError('Beleg nicht gefunden', 404);
  const sp = new URL(req.url).searchParams;
  const f = await readReceiptFile(id, sp.get('thumb') === '1');
  if (!f) return jsonError('Datei fehlt', 404);
  const ext = f.mime === 'application/pdf' ? 'pdf' : f.mime.split('/')[1] || 'bin';
  const name = `${r.number}${r.supplier ? `_${r.supplier.replace(/[^A-Za-z0-9äöüÄÖÜ-]+/g, '-').slice(0, 40)}` : ''}.${ext}`;
  return new NextResponse(new Uint8Array(f.buffer), {
    headers: {
      'Content-Type': f.mime,
      'Content-Length': String(f.buffer.length),
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': `${sp.get('download') === '1' ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(name)}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
