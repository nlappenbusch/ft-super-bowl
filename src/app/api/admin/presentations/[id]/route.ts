import { NextResponse } from 'next/server';
import { deleteDeck, duplicateDeck, getDeck, newShareToken, updateDeck } from '@/lib/presentation/store';
import { getSettings } from '@/lib/settingsStore';
import type { DeckLang, Slide } from '@/lib/presentation/types';

export const dynamic = 'force-dynamic';

/** Firmenangaben für die Kontaktpanels – ohne Secrets aus den Settings. */
function companyInfo() {
  const c = getSettings().company;
  return {
    name: c.name, street: c.street, zip: c.zip, city: c.city, country: c.country,
    phone: c.phone, email: c.email, website: c.website,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deck = await getDeck(id);
  if (!deck) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: deck, company: companyInfo() });
}

/**
 * PATCH – Deck speichern. Alle Felder optional.
 * `rotateToken: true` erzeugt einen neuen Teil-Link (alter Link wird ungültig).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await getDeck(id);
  if (!existing) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const lang: DeckLang | undefined = ['de', 'en', 'fr'].includes(body.lang) ? body.lang : undefined;

  await updateDeck(id, {
    title: typeof body.title === 'string' ? body.title : undefined,
    lang,
    status: body.status === 'final' || body.status === 'draft' ? body.status : undefined,
    meta: typeof body.meta === 'object' && body.meta ? body.meta : undefined,
    slides: Array.isArray(body.slides) ? (body.slides as Slide[]) : undefined,
    share_enabled: typeof body.share_enabled === 'boolean' ? body.share_enabled : undefined,
    share_token: body.rotateToken ? newShareToken() : (existing.share_token ? undefined : newShareToken()),
  });

  const deck = await getDeck(id);
  return NextResponse.json({ success: true, data: deck });
}

/** POST – Deck duplizieren (z.B. als Basis für eine weitere Sprache). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const copyId = await duplicateDeck(id, typeof body.title === 'string' ? body.title : undefined);
  if (!copyId) return NextResponse.json({ success: false, error: 'Nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, id: copyId });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteDeck(id);
  return NextResponse.json({ success: true });
}
