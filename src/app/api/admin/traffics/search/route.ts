import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/apiGuard';
import { getTrafficsConfig, searchOffers, TrafficsError } from '@/lib/traffics';
import { sanitizeSearchParams } from '@/lib/trafficsModel';

/**
 * POST { productType, fromDate, toDate, adults, departureAirports, arrivalAirports,
 *        minCategory, roomTypes, boardTypes, tourOperators, carrierCodes, directOnly, hotelName, limit }
 * → { offers, total, cached, mock }. Genau EINE Connector-Anfrage pro (nicht gecachter) Suche.
 */
export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const parsed = sanitizeSearchParams(body, getTrafficsConfig().tourOperators);
  if (!parsed.ok) return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
  try {
    const result = await searchOffers(parsed.params);
    return NextResponse.json({ success: true, data: result, params: parsed.params });
  } catch (e) {
    const status = e instanceof TrafficsError ? e.status : 500;
    return NextResponse.json({ success: false, error: (e as Error).message }, { status });
  }
}
