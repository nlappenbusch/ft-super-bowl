import { NextResponse } from 'next/server';
import { createInvoiceFromCalculation, type InvoiceFromCalcOptions } from '@/lib/offerInvoice';

/**
 * POST /api/admin/calculations/[id]/invoice
 * { persons?, due_in_days?, included_services?, event_name?, description?, extra_ids? }
 * → erzeugt aus der Kalkulation eine Rechnung im Stil der bestehenden
 *   Rechnungen: EINE Pauschalposition (persons × VK p.P.), Leistungen als
 *   „inkludierte Leistungen" ohne Einzelpreise, gewählte Zusatzoptionen als
 *   eigene Positionen. Logik in src/lib/offerInvoice.ts (geteilt mit MCP).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as InvoiceFromCalcOptions;
    const result = await createInvoiceFromCalculation(id, body);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    console.error('Rechnung-aus-Kalkulation-Fehler:', error);
    return NextResponse.json(
      { success: false, error: 'Rechnung konnte nicht erstellt werden: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
