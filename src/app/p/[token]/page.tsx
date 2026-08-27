/**
 * /p/[token] – öffentlich teilbare Präsentation.
 * Bewusst ohne Session: der Token IST die Berechtigung (nur gültig, solange die
 * Freigabe im Admin aktiv ist). Kein Eintrag in Suchmaschinen.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDeckByToken } from '@/lib/presentation/store';
import { getSettings } from '@/lib/settingsStore';
import DeckViewer from '@/components/presentation/DeckViewer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const deck = await getDeckByToken(token);
  return {
    title: deck ? `${deck.title} – Faltin Travel` : 'Präsentation – Faltin Travel',
    robots: { index: false, follow: false },
  };
}

export default async function SharedDeckPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const deck = await getDeckByToken(token);
  if (!deck) notFound();

  const c = getSettings().company;
  const company = {
    name: c.name, street: c.street, zip: c.zip, city: c.city, country: c.country,
    phone: c.phone, email: c.email, website: c.website,
  };

  return <DeckViewer deck={deck} company={company} pdfUrl={`/api/p/${token}`} />;
}
