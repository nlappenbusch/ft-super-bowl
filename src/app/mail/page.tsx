import type { Metadata, Viewport } from 'next';
import MailApp from '@/components/mail/MailApp';

export const metadata: Metadata = {
  title: 'Faltin Mail',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#143047' };

/**
 * /mail — Faltin Mail: eigener Mail-Client für die Faltin-Postfächer (eigenes + freigegebene),
 * mit Geschäftskontext, KI-Suche und Schreib-Assistent. Auch erreichbar als mail.faltintravel.com
 * (Middleware leitet dort «/» hierher). Geschützt über die Middleware (Admin-Login).
 */
export default function MailPage() {
  return <MailApp />;
}
