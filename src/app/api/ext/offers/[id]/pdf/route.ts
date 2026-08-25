import { NextResponse } from 'next/server';
import { verifyApiKey, extractApiKey } from '@/lib/apiKeyStore';
import { getCalculation } from '@/lib/calculationStore';
import { getCustomer } from '@/lib/customerStore';
import { buildCalculationPdf } from '@/lib/calculationPdf';

/**
 * GET /api/ext/offers/[id]/pdf — Angebots-PDF (Kundenvariante) per API-Key.
 * Auth: Authorization: Bearer ftk_… ODER ?key=ftk_… (für klickbare Links aus
 * MCP-Antworten). Liefert bewusst NUR die Kundenvariante — die interne
 * Kalkulationstabelle (EK/Marge) bleibt der Admin-Session vorbehalten.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(req.url);
  const raw = extractApiKey(req) || url.searchParams.get('key');
  const key = await verifyApiKey(raw);
  if (!key) {
    return NextResponse.json({ success: false, error: 'Ungültiger oder fehlender API-Key' }, { status: 401 });
  }
  const { id } = await params;
  const calc = await getCalculation(id);
  if (!calc) return NextResponse.json({ success: false, error: 'Angebot nicht gefunden' }, { status: 404 });

  const customer = calc.customer_id ? await getCustomer(calc.customer_id) : null;
  const pdf = buildCalculationPdf(calc, 'kunde', customer);
  const base = (calc.calc_number || calc.id.slice(0, 8)).replace(/[^A-Za-z0-9-]/g, '');
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Angebot_${base}.pdf"`,
    },
  });
}
