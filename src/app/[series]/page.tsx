import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Calendar, MapPin } from 'lucide-react';
import { getEventsBySeriesSlug, getSeriesBySlug } from '@/lib/eventData';

interface SeriesPageProps {
  params: Promise<{ series: string }>;
}

const reservedSlugs = new Set([
  'admin',
  'booking',
  'events',
  'embed',
  'agb',
  'shortcode-test',
  'wordpress-preview',
  'api',
  'sitemap.xml',
  'robots.txt'
]);

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
  const { series } = await params;
  if (reservedSlugs.has(series)) return {};

  const seriesData = await getSeriesBySlug(series);
  if (!seriesData) return {};

  return {
    title: seriesData.title,
    description: seriesData.description || `Event-Serie ${seriesData.title}`,
    openGraph: {
      title: seriesData.title,
      description: seriesData.description || undefined,
      images: seriesData.hero_image ? [{ url: seriesData.hero_image }] : undefined
    }
  };
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { series } = await params;
  if (reservedSlugs.has(series)) return notFound();

  const seriesData = await getSeriesBySlug(series);
  if (!seriesData) return notFound();

  const events = await getEventsBySeriesSlug(series);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="relative z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center text-sm font-semibold text-white/80 hover:text-white">
            Zurueck zur Uebersicht
          </Link>
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">{seriesData.category}</span>
        </div>
      </header>

      <section className="relative px-4 pt-8 pb-16 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(241, 70, 36, 0.35), transparent 55%), radial-gradient(circle at 80% 10%, rgba(24, 74, 123, 0.6), transparent 50%)'
          }}
        />
        {seriesData.hero_image && (
          <div className="absolute inset-0 opacity-20">
            <Image src={seriesData.hero_image} alt={seriesData.title} fill className="object-cover" />
          </div>
        )}
        <div className="container mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] bg-white/10 px-4 py-2 rounded-full">
            {seriesData.category}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mt-6" style={{ fontFamily: 'var(--font-display)' }}>
            {seriesData.title}
          </h1>
          {seriesData.description && (
            <p className="text-lg md:text-xl text-white/80 max-w-3xl mt-4">
              {seriesData.description}
            </p>
          )}
        </div>
      </section>

      <section className="bg-white text-gray-900 py-14 px-4">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Eventauswahl</div>
              <h2 className="text-3xl md:text-4xl font-bold mt-3" style={{ fontFamily: 'var(--font-display)' }}>
                Events in dieser Serie
              </h2>
              <p className="text-gray-600 mt-2">Waehlen Sie ein Event aus und sehen Sie die Packages.</p>
            </div>
            <div className="text-sm text-gray-500">{events.length} Events</div>
          </div>

          {events.length === 0 ? (
            <p className="text-center text-gray-500">Noch keine Events hinterlegt.</p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => {
                const dateLabel = formatDate(event.start_date);
                const locationLabel = [event.location_city, event.location_region, event.location_country]
                  .filter(Boolean)
                  .join(', ');

                return (
                  <Link
                    key={event.id}
                    href={`/events/${event.slug}`}
                    className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition" style={{ background: 'linear-gradient(135deg, rgba(24,74,123,0.08), rgba(241,70,36,0.08))' }} />
                    <div className="relative p-6">
                      <div className="text-xs uppercase tracking-[0.2em] text-gray-400">{event.slug}</div>
                      <div className="text-xl font-semibold text-gray-900 mt-3">{event.title || event.name}</div>
                      <div className="mt-4 space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span>{dateLabel || 'Datum folgt'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-orange-500" />
                          <span>{locationLabel || 'Ort folgt'}</span>
                        </div>
                      </div>
                      <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700">
                        Zum Event
                        <span>→</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
