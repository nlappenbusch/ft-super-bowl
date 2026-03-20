import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Calendar, MapPin, Users } from 'lucide-react';
import PackageCard from '@/components/PackageCard';
import { generateEventSchema, generateProductSchema } from '@/lib/schema';
import { getEventBySlug, getEventFaqs, getPackagesByEventSlug, getSeriesById } from '@/lib/eventData';

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

function parseFlexibleDate(value?: string | null): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Supports admin-style input like 29.06.2026
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const day = Number(dotMatch[1]);
    const month = Number(dotMatch[2]);
    const year = Number(dotMatch[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  // Fallback for ISO / RFC strings
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatEventDate(value?: string | null) {
  if (!value) return '';
  const date = parseFlexibleDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function getEventDateRange(start?: string | null, end?: string | null) {
  const from = formatEventDate(start);
  const to = formatEventDate(end);

  if (from && to) return `${from} - ${to}`;
  if (from) return from;
  return to;
}

function getEventLocationLine(event: {
  venue?: string | null;
  location_name?: string | null;
  location_city?: string | null;
  location_region?: string | null;
  location_country?: string | null;
}) {
  return [
    event.location_city,
    event.location_name,
    event.venue,
    event.location_region,
    event.location_country
  ]
    .filter(Boolean)
    .join(', ');
}

function buildHeroIntro(event: { name?: string | null; title?: string | null; description?: string | null }) {
  if (event.description) return event.description;

  const baseName = event.name || event.title || 'dieses Event';
  return `Tickets sind heiss begehrt und dementsprechend schwer erhaeltlich. Als mehrfach ausgezeichneter Sportreisen-Spezialist bieten wir unseren Kunden die Moeglichkeit, ${baseName} live zu erleben.`;
}

function buildHeroSubline(event: {
  name?: string | null;
  venue?: string | null;
  location_name?: string | null;
  location_city?: string | null;
  location_region?: string | null;
  location_country?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}) {
  const baseName = event.name || 'Event';
  const location = getEventLocationLine(event);
  const dateRange = getEventDateRange(event.start_date, event.end_date);

  const parts = [baseName];
  if (location) parts.push(`Ort: ${location}`);
  if (dateRange) parts.push(`Termin: ${dateRange}`);

  return parts.join(' | ');
}

function buildFirstParagraphHeading(event: { first_paragraph_heading?: string | null; name?: string | null; title?: string | null }) {
  if (event.first_paragraph_heading) return event.first_paragraph_heading;
  const eventName = event.name || event.title || 'unser Event';
  return `Erleben Sie ${eventName} live!`;
}

function buildFirstParagraphText(event: { first_paragraph_text?: string | null; name?: string | null; title?: string | null }) {
  if (event.first_paragraph_text) return event.first_paragraph_text;
  const eventName = event.name || event.title || 'das Event';
  return `Mit Faltin Travel erleben Sie ${eventName} mit sorgfaeltig zusammengestellten Tickets und passenden Reisebausteinen. Wir begleiten Sie von der Anfrage bis zur Rueckreise.`;
}

function formatEventDateForBadge(value?: string | null) {
  if (!value) return '';
  const date = parseFlexibleDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};

  const title = event.title || event.name || 'Event';
  const description = event.description || `Tickets & Packages fuer ${event.name || event.slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: event.hero_image ? [{ url: event.hero_image }] : undefined
    }
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return notFound();

  const packages = await getPackagesByEventSlug(slug);
  const faqs = await getEventFaqs(slug);
  const series = event.series_id ? await getSeriesById(event.series_id) : null;

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
      addressCountry: event.location_country || undefined
    }
  });

  const productSchema = generateProductSchema({
    name: primaryPackage ? `${event.name || event.title} Package - ${primaryPackage.title}` : undefined,
    description: primaryPackage?.description || primaryPackage?.short_description || undefined,
    price: primaryPackage?.price || undefined,
    priceCurrency: primaryPackage?.currency || undefined,
    url: event.base_url ? `${event.base_url}/booking?event=${encodeURIComponent(event.slug)}` : undefined
  });

  const displayDate = formatEventDateForBadge(event.start_date);
  const displayLocation = getEventLocationLine(event);
  const heroSubline = buildHeroSubline(event);
  const heroIntro = buildHeroIntro(event);
  const heroCtaLabel = `Jetzt \"${event.name || event.title || 'Event'}\" Tickets anfragen`;
  const bookingHref = event.base_url
    ? `${event.base_url.replace(/\/$/, '')}/booking?event=${encodeURIComponent(event.slug)}`
    : `/booking?event=${encodeURIComponent(event.slug)}`;
  const firstParagraphHeading = buildFirstParagraphHeading(event);
  const firstParagraphText = buildFirstParagraphText(event);
  const firstParagraphImages = [
    event.first_paragraph_image_1,
    event.first_paragraph_image_2,
    event.first_paragraph_image_3
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <section className="relative text-white py-14 px-4 overflow-hidden" style={{ backgroundImage: 'linear-gradient(202deg, #184a7b 0%, #143047 100%)' }}>
        {event.hero_image && (
          <div className="absolute inset-0 opacity-30">
            <Image src={event.hero_image} alt={event.title || event.name || 'Event'} fill className="object-cover" />
          </div>
        )}
        <div className="container mx-auto relative z-10 text-center">
          {series && (
            <Link href={`/${series.slug}`} className="inline-flex items-center gap-2 text-xs uppercase tracking-wide bg-white/10 px-3 py-1 rounded-full">
              {series.title}
            </Link>
          )}
          <h1 className="text-4xl md:text-5xl font-bold mb-3">{event.title || event.name}</h1>
          <p className="text-base md:text-lg opacity-90 max-w-5xl mx-auto">{heroSubline}</p>
          <p className="text-lg md:text-xl opacity-95 max-w-4xl mx-auto mt-5">{heroIntro}</p>
          <div className="mt-8">
            <Link
              href={bookingHref}
              className="inline-flex items-center rounded-full px-7 py-3 text-sm md:text-base font-semibold transition hover:opacity-90"
              style={{ backgroundColor: '#f14624', color: 'white' }}
            >
              {heroCtaLabel}
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-6 text-sm">
            {displayDate && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{displayDate}</span>
              </div>
            )}
            {(event.venue || displayLocation) && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{[event.venue, displayLocation].filter(Boolean).join(' • ')}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>Exklusive Packages</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-white">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900">{firstParagraphHeading}</h2>
          <p className="mt-5 text-base md:text-lg leading-relaxed text-gray-700 text-center max-w-4xl mx-auto">{firstParagraphText}</p>

          {firstParagraphImages.length > 0 && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
              {firstParagraphImages.map((imageUrl, index) => (
                <div key={`${imageUrl}-${index}`} className="relative h-64 md:h-72 rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                  <Image
                    src={imageUrl}
                    alt={`${event.title || event.name || 'Event'} Bild ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4 bg-gray-50" id="packages">
        <div className="container mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900">Packages fuer {event.name || event.title}</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Waehlen Sie Ihr perfektes Reise-Package.</p>
          </div>
          <div className="max-w-3xl mx-auto space-y-6">
            {packages.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-600">
                Aktuell sind noch keine Packages hinterlegt.
              </div>
            )}
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                id={pkg.slug || pkg.id}
                eventSlug={event.slug}
                stars={Number(pkg.stars || 0)}
                nights={Number(pkg.nights || 0)}
                price={Number(pkg.price || 0)}
                title={pkg.title || ''}
                description={pkg.short_description || pkg.description || ''}
                popular={Boolean(pkg.popular)}
                availableSpots={pkg.available_spots || undefined}
                rating={pkg.rating || undefined}
                reviews={pkg.reviews || undefined}
                singleSurcharge={pkg.single_supplement || undefined}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4 bg-white" id="faq">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-3xl md:text-4xl font-bold text-center mb-6 text-gray-900">FAQs</h3>
          {faqs.length === 0 ? (
            <p className="text-center text-gray-600">Noch keine FAQs hinterlegt.</p>
          ) : (
            <div className="space-y-4">
              {faqs.map((faq) => (
                <div key={faq.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="p-4 bg-gray-50">
                    <div className="font-semibold text-gray-900">{faq.question}</div>
                    <div className="mt-2 text-sm text-gray-600">{faq.answer}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
