/**
 * /s/[token] — öffentliche Download-Seite von Faltin Files (für Externe).
 * Bewusst ohne Session: der Token ist die Berechtigung (+ Passwort, falls gesetzt).
 * Nach Ablauf/Löschung: freundliche "abgelaufen"-Seite. Kein Index.
 */
import type { Metadata } from 'next';
import { resolvePublicShare } from '@/lib/files/publicAccess';
import { getSettings } from '@/lib/settingsStore';
import { zipSize, ZIP_MAX_BYTES } from '@/lib/files/http';
import SharedFilesView from '@/components/files/SharedFilesView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dateien – Faltin Travel',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export default async function SharedFilesPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const acc = await resolvePublicShare(token);
  const c = getSettings().company;
  const company = { name: c.name, phone: c.phone, email: c.email, website: c.website };

  if (acc.status === 'missing' || acc.status === 'expired') {
    return <SharedFilesView token={token} state={acc.status} company={company} />;
  }
  const s = acc.share;
  const view = {
    title: s.title,
    message: acc.status === 'ok' ? s.message : '',
    sender: s.created_by_name,
    expires_at: s.expires_at,
    total_size: s.total_size,
    zip: s.items.length > 1 && zipSize(s.items) <= ZIP_MAX_BYTES,
    items: acc.status === 'ok' ? s.items.map((i) => ({ id: i.id, name: i.name, size: i.size, mime: i.mime })) : [],
    count: s.items.length,
  };
  return <SharedFilesView token={token} state={acc.status} company={company} share={view} />;
}
