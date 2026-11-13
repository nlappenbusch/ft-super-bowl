/**
 * GET  /api/admin/belege/export?from=YYYY-MM-DD&to=YYYY-MM-DD&status=freigegeben — CSV für den Treuhänder.
 * POST /api/admin/belege/export { from, to } — wie GET (nur freigegebene), markiert die Belege danach als «verbucht».
 * Nur Prüfende.
 */
import { NextResponse } from 'next/server';
import { requireBelegeUser, jsonError } from '@/lib/belege/actor';
import { exportCsv, markExported } from '@/lib/belege/store';
import type { ReceiptStatus } from '@/lib/belege/model';

export const dynamic = 'force-dynamic';

function baseUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'next.faltintravel.com';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

function fileName(from: string, to: string): string {
  return `Belege_Faltin_${from || 'alle'}_${to || new Date().toISOString().slice(0, 10)}.csv`;
}

function csvResponse(csv: string, name: string) {
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: Request) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  if (!user.reviewer) return jsonError('Nur für die Buchhaltung.', 403);
  const sp = new URL(req.url).searchParams;
  const status = (sp.get('status') || 'freigegeben').split(',').filter((s) => ['freigegeben', 'verbucht'].includes(s)) as ReceiptStatus[];
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  const { csv } = await exportCsv({ from, to, statuses: status.length ? status : ['freigegeben'], baseUrl: baseUrl(req) });
  return csvResponse(csv, fileName(from, to));
}

export async function POST(req: Request) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  if (!user.reviewer) return jsonError('Nur für die Buchhaltung.', 403);
  const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
  const { csv, ids } = await exportCsv({ from: body.from || '', to: body.to || '', statuses: ['freigegeben'], baseUrl: baseUrl(req) });
  if (!ids.length) return jsonError('Keine freigegebenen Belege im Zeitraum.');
  await markExported(ids, user);
  return csvResponse(csv, fileName(body.from || '', body.to || ''));
}
