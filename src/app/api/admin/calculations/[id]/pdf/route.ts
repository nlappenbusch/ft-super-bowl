import { NextResponse } from 'next/server';
import { getCalculation } from '@/lib/calculationStore';
import { buildCalculationPdf, type CalcPdfVariant } from '@/lib/calculationPdf';

/**
 * GET /api/admin/calculations/[id]/pdf[?variant=intern]
 * → Angebots-PDF (Kundenvariante ohne EK/Marge) bzw. interne Variante
 *   mit voller Kalkulationstabelle auf Seite 2.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const calc = await getCalculation(id);
    if (!calc) return NextResponse.json({ success: false, error: 'Kalkulation nicht gefunden' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const variant: CalcPdfVariant = searchParams.get('variant') === 'intern' ? 'intern' : 'kunde';
    const pdf = buildCalculationPdf(calc, variant);
    const base = (calc.calc_number || calc.id.slice(0, 8)).replace(/[^A-Za-z0-9-]/g, '');
    const filename = variant === 'intern' ? `Kalkulation_${base}_intern.pdf` : `Angebot_${base}.pdf`;

    return new NextResponse(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Kalkulations-PDF-Fehler:', error);
    return NextResponse.json(
      { success: false, error: 'Fehler bei PDF-Generierung: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
