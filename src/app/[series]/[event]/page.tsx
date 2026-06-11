import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import EventLiveEditor from '@/components/event/EventLiveEditor';
import { generateEventSchema, generateProductSchema, generateFaqPageSchema } from '@/lib/schema';
import { siteConfig } from '@/lib/siteConfig';
import { toCategorySlug } from '@/lib/category';
import {
  getEventBySlug, getEventsBySeriesSlug, getEventFaqs, getPackagesByEventSlug, getSeriesById, getPinIconsList,
} from '@/lib/eventData';

interface EventPageProps {
  params: Promise<{ series: string; event: string }>;
}

/** Event anhand url_segment (oder vollem slug) innerhalb der Serie auflösen. */
async function resolveEvent(seriesSlug: string, eventParam: string) {
  let event = await getEventBySlug(eventParam);
  if (!event) {
    const evts = await getEventsBySeriesSlug(seriesSlug);
    event = evts.find((e) => (e.url_segment || '') === eventParam) || null;
  }
  return event;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { series: seriesSlug, event: eventParam } = await params;
  const event = await resolveEvent(seriesSlug, eventParam);
  if (!event) return {};
  const title = event.seo_title || event.title || event.name || 'Event';
  const description = event.seo_description || event.description || `Tickets & Packages für ${event.name || event.slug}`;
  const seg = event.url_segment || event.slug;
  const canonical = `${(siteConfig.url || '').replace(/\/$/, '')}/${seriesSlug}/${seg}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, images: event.hero_image ? [{ url: event.hero_image }] : undefined },
  };
}

export default async function EventUnderSeriesPage({ params }: EventPageProps) {
  const { series: seriesSlug, event: eventParam } = await params;
  const event = await resolveEvent(seriesSlug, eventParam);
  if (!event) return notFound();

  const series = event.series_id ? await getSeriesById(event.series_id) : null;
  const canonicalSeg = event.url_segment || event.slug;

  // Auf kanonischen Pfad umleiten (falsche Serie ODER voller Slug statt url_segment)
  if ((series?.slug || '') !== seriesSlug || canonicalSeg !== eventParam) {
    permanentRedirect(series?.slug ? `/${series.slug}/${canonicalSeg}` : `/events/${event.slug}`);
  }

  const packages = await getPackagesByEventSlug(event.slug);
  const faqs = await getEventFaqs(event.slug);
  // Auto-Querverlinkung: andere aktive Events derselben Serie (max. 4)
  const siblings = series?.slug ? await getEventsBySeriesSlug(series.slug) : [];
  const relatedEvents = siblings
    .filter((e) => e.id !== event.id && (e.status ?? 'active') === 'active')
    .slice(0, 4)
    .map((e) => ({
      name: e.name || e.title || e.slug,
      href: `/${series!.slug}/${e.url_segment || e.slug}`,
      image: e.hero_image,
      start_date: e.start_date,
      end_date: e.end_date,
    }));
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
    // Spielplan-Paarungen als strukturierte subEvents (nur zukünftige, parsebare Termine)
    subEvents: (event.spielplan || []).map((r) => ({ name: r.matchup, date: r.date, venue: r.session, round: r.round })),
  });
  const productSchema = generateProductSchema({
    name: primaryPackage ? `${event.name || event.title} Package - ${primaryPackage.title}` : undefined,
    description: primaryPackage?.description || primaryPackage?.short_description || undefined,
    price: primaryPackage?.price || undefined,
    priceCurrency: primaryPackage?.currency || undefined,
    url: event.base_url ? `${event.base_url}/booking?event=${encodeURIComponent(event.slug)}` : undefined,
    ratingValue: primaryPackage?.rating || undefined,
    reviewCount: primaryPackage?.reviews || undefined,
  });

  const crumbs = [
    { name: 'Start', href: '/' },
    ...(series ? [{ name: series.category || 'Events', href: `/kategorie/${toCategorySlug(series.category || 'sonstiges')}` }] : []),
    ...(series ? [{ name: series.title, href: `/${series.slug}` }] : []),
    { name: event.name || event.title || 'Event', href: `/${seriesSlug}/${canonicalSeg}` },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      {faqs.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFaqPageSchema(faqs)) }} />
      )}
      <Breadcrumbs items={crumbs} />
      <EventLiveEditor event={event} series={series} packages={packages} faqs={faqs} pinIcons={pinIcons} relatedEvents={relatedEvents} />
    </>
  );
}
