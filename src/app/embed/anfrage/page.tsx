import EventContactForm from '@/components/EventContactForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Unverbindlich anfragen | Faltin Travel',
  description: 'Stellen Sie unverbindlich Ihre Anfrage für ein individuelles Reisepaket.',
  robots: { index: false, follow: false },
};

// Embed-Route für WordPress: nur das Anfrage-Formular (ohne Header/Footer)
// Aufruf z. B.: /embed/anfrage?event=super-bowl-2027&name=Super%20Bowl%20LXI%202027
export default async function AnfrageEmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string; name?: string }>;
}) {
  const { event, name } = await searchParams;

  return (
    <div className="wordpress-embed" style={{ padding: '8px', maxWidth: 760, margin: '0 auto' }}>
      <EventContactForm
        eventSlug={event || 'allgemeine-anfrage'}
        eventName={name || undefined}
      />
    </div>
  );
}
