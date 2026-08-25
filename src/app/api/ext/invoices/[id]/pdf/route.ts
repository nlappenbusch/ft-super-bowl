import { NextResponse } from 'next/server';
import { verifyApiKey, extractApiKey } from '@/lib/apiKeyStore';
import { internalApiKey, INTERNAL_KEY_HEADER } from '@/lib/apiGuard';

/**
 * GET /api/ext/invoices/[id]/pdf — Rechnungs-PDF per API-Key.
 * Auth: Authorization: Bearer ftk_… ODER ?key=ftk_…. Die eigentliche
 * PDF-Erzeugung bleibt in /api/invoices/[id]/pdf; dieser Endpoint reicht den
 * Aufruf mit dem internen Loopback-Schlüssel durch (gleiches Muster wie das
 * Kundenportal).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  const raw = extractApiKey(req) || url.searchParams.get('key');
  const key = await verifyApiKey(raw);
  if (!key) {
    return NextResponse.json({ success: false, error: 'Ungültiger oder fehlender API-Key' }, { status: 401 });
  }
  const { id } = await params;
  const target = new URL(`/api/invoices/${encodeURIComponent(id)}/pdf`, url.origin);
  const res = await fetch(target, { headers: { [INTERNAL_KEY_HEADER]: internalApiKey() } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    return NextResponse.json({ success: false, error: (body as { error?: string }).error || 'PDF nicht verfügbar' }, { status: res.status });
  }
  const pdf = await res.arrayBuffer();
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': res.headers.get('content-disposition') || 'inline; filename="Rechnung.pdf"',
    },
  });
}
