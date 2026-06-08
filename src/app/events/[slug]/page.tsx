import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import EventPageView from '@/components/event/EventPageView';
import { generateEventSchema, generateProductSchema } from '@/lib/schema';
import {
  getEventBySlug, getEventFaqs, getPackagesByEventSlug, getSeriesById, getPinIconsList,
} from '@/lib/eventData';

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};
  const title = event.title || event.name || 'Event';
  const description = event.description || `Tickets & Packages für ${event.name || event.slug}`;
  return {
    title,
    description,
    openGraph: { title, description, images: event.hero_image ? [{ url: event.hero_image }] : undefined },
  };
}

/**
 * Alt-Route /events/<slug>. Leitet dauerhaft (308) auf den kanonischen
 * Pfad /<serie>/<event> um. Events ohne Serie werden hier weiterhin gerendert.
 */
export default async function LegacyEventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return notFound();

  const series = event.series_id ? await getSeriesById(event.series_id) : null;
  if (series?.slug) {
    permanentRedirect(`/${series.slug}/${event.url_segment || event.slug}`);
  }

  // Fallback: Event ohne Serie -> hier rendern (kein kanonischer Serien-Pfad)
  const packages = await getPackagesByEventSlug(slug);
  const faqs = await getEventFaqs(slug);
  const showLageplan = event.show_lageplan ?? false;
  const eventPins = (event.lageplan_pins || []) as Array<{ id: string; lat: number; lng: number }>;
  const pinIcons = showLageplan && eventPins.length > 0 ? await getPinIconsList() : [];

  const primaryPackage = packages[0];
  const eventSchema = generateEventSchema({
    name: event.name || event.title,
    description: event.description || undefined,
    startDate: event.start_date || undefined,
    endDate: event.end_date || undefined,
    venue: event.venue || undefined,
    address: {
      addressLocality: event.location_city || undefined,
      addressRegion: event.location_region || undefined,
      addressCountry: event.location_country || undefined,
    },
  });
  const productSchema = generateProductSchema({
    name: primaryPackage ? `${event.name || event.title} Package - ${primaryPackage.title}` : undefined,
    description: primaryPackage?.description || primaryPackage?.short_description || undefined,
    price: primaryPackage?.price || undefined,
    priceCurrency: primaryPackage?.currency || undefined,
    url: event.base_url ? `${event.base_url}/booking?event=${encodeURIComponent(event.slug)}` : undefined,
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <EventPageView event={event} series={series} packages={packages} faqs={faqs} pinIcons={pinIcons} />
    </>
  );
}
