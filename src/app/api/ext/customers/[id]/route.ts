import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { getCustomer } from '@/lib/customerStore';

/** GET → einzelner Kunde inkl. verknüpfter Daten (read-only). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const { id } = await params;
  const c = await getCustomer(id);
  if (!c) return NextResponse.json({ success: false, error: 'Kunde nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: c });
}
