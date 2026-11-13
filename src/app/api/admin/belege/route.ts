/**
 * GET /api/admin/belege?status=eingang,erfasst&mine=1&q=… — Belege auflisten (+ Zähler je Status).
 * Mitarbeitende sehen nur eigene Belege, Prüfende (Admins) alle.
 */
import { NextResponse } from 'next/server';
import { requireBelegeUser } from '@/lib/belege/actor';
import { listReceipts, statusCounts } from '@/lib/belege/store';
import type { ReceiptStatus } from '@/lib/belege/model';

export const dynamic = 'force-dynamic';

const STATUSES: ReceiptStatus[] = ['eingang', 'erfasst', 'rueckfrage', 'freigegeben', 'verbucht', 'verworfen'];

export async function GET(req: Request) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  const sp = new URL(req.url).searchParams;
  const statuses = (sp.get('status') || '').split(',').filter((s): s is ReceiptStatus => (STATUSES as string[]).includes(s));
  const mine = sp.get('mine') === '1';
  const [items, counts] = await Promise.all([
    listReceipts({ user, statuses, mine, q: sp.get('q') || '', limit: Number(sp.get('limit')) || 300 }),
    statusCounts(user, mine),
  ]);
  return NextResponse.json({ success: true, data: { items, counts, me: user } });
}
