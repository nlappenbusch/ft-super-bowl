import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/apiGuard';
import { getTrafficsConfig, searchOffers, TrafficsError, type TrafficsSearchResult } from '@/lib/traffics';
import { COMPARE_PRODUCTS, compareOffers, sanitizeSearchParams, type TrafficsProductType } from '@/lib/trafficsModel';

type Part = { ok: true; data: TrafficsSearchResult } | { ok: false; error: string };

/**
 * POST { …Suchparameter wie /search } → Pauschal, Nur-Flug und Nur-Hotel PARALLEL
 * (max. 3 Connector-Anfragen pro Klick, gecachte Teile kosten keine Anfrage) plus
 * Vergleich je Hotel: günstigste Pauschale vs. günstigster Flug + günstigstes Hotel.
 */
export async function POST(request: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ops = getTrafficsConfig().tourOperators;

  // Pauschal-Parameter vorab prüfen → verständliche Fehlermeldung statt drei Teilfehler
  const base = sanitizeSearchParams({ ...body, productType: 'pauschal' }, ops);
  if (!base.ok) return NextResponse.json({ success: false, error: base.error }, { status: 400 });

  const parts = {} as Record<TrafficsProductType, Part>;
  await Promise.all(COMPARE_PRODUCTS.map(async (productType) => {
    const parsed = sanitizeSearchParams({ ...body, productType }, ops);
    if (!parsed.ok) { parts[productType] = { ok: false, error: parsed.error }; return; }
    try {
      parts[productType] = { ok: true, data: await searchOffers(parsed.params) };
    } catch (e) {
      parts[productType] = { ok: false, error: e instanceof TrafficsError ? e.message : 'Suche fehlgeschlagen' };
    }
  }));

  const list = (p: Part) => (p.ok ? p.data.offers : []);
  const comparison = compareOffers(list(parts.pauschal), list(parts.flight), list(parts.hotelonly));
  return NextResponse.json({ success: true, data: { parts, comparison } });
}
