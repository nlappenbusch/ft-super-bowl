import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PackageCard from '@/components/PackageCard';
import EventContactForm from '@/components/EventContactForm';
import { generateEventSchema, generateProductSchema } from '@/lib/schema';
import { getEventBySlug, getEventFaqs, getPackagesByEventSlug, getSeriesById, getPinIconsList } from '@/lib/eventData';
import LageplanMap from '@/components/LageplanMap';

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

/* ─── Date helpers ──────────────────────────────────────────────────────────── */

function parseFlexibleDate(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const date = new Date(Number(dotMatch[3]), Number(dotMatch[2]) - 1, Number(dotMatch[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
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
  if (from && to) return `${from} – ${to}`;
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
  return [event.location_city, event.location_name, event.venue, event.location_region, event.location_country]
    .filter(Boolean)
    .join(', ');
}

function buildHeroSubline(event: {
  name?: string | null; venue?: string | null; location_name?: string | null;
  location_city?: string | null; location_region?: string | null; location_country?: string | null;
  start_date?: string | null; end_date?: string | null;
}) {
  const baseName = event.name || 'Event';
  const location = getEventLocationLine(event);
  const dateRange = getEventDateRange(event.start_date, event.end_date);
  const parts = [baseName];
  if (location) parts.push(`Ort: ${location}`);
  if (dateRange) parts.push(`Termin: ${dateRange}`);
  return parts.join(' | ');
}

function buildHeroIntro(event: { description?: string | null; name?: string | null; title?: string | null }) {
  if (event.description) return event.description;
  const baseName = event.name || event.title || 'dieses Event';
  return `Tickets sind heiß begehrt und dementsprechend schwer erhältlich. Als mehrfach ausgezeichneter Sportreisen-Spezialist bieten wir unseren Kunden die Möglichkeit, ${baseName} live zu erleben.`;
}

function buildFirstParagraphHeading(event: { first_paragraph_heading?: string | null; name?: string | null; title?: string | null }) {
  if (event.first_paragraph_heading) return event.first_paragraph_heading;
  return `Erleben Sie ${event.name || event.title || 'unser Event'} live!`;
}

function buildFirstParagraphText(event: { first_paragraph_text?: string | null; name?: string | null; title?: string | null }) {
  if (event.first_paragraph_text) return event.first_paragraph_text;
  const eventName = event.name || event.title || 'das Event';
  return `Mit Faltin Travel erleben Sie ${eventName} mit sorgfältig zusammengestellten Tickets und passenden Reisebausteinen. Wir begleiten Sie von der Anfrage bis zur Rückreise.`;
}

/* ─── Metadata ──────────────────────────────────────────────────────────────── */

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

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return notFound();

  const packages = await getPackagesByEventSlug(slug);
  const faqs = await getEventFaqs(slug);
  const series = event.series_id ? await getSeriesById(event.series_id) : null;

  const showAbout       = event.show_about       ?? true;
  const showPackages    = event.show_packages     ?? true;
  const showFaqs        = event.show_faqs         ?? true;
  const showSpielplan   = event.show_spielplan    ?? false;
  const spielplan       = event.spielplan         || [];
  const showWissenswertes       = event.show_wissenswertes       ?? false;
  const wissenswertesTitle      = event.wissenswertes_title      || `Wissenswertes zu ${event.name || event.title}`;
  const wissenswertesText       = event.wissenswertes_text       || '';
  const wissenswertesAccordionTitle = event.wissenswertes_accordion_title || 'Weitere Infos';
  const wissenswertesAccordionText  = event.wissenswertes_accordion_text  || '';
  const showStadionplan    = event.show_stadionplan    ?? false;
  const stadionplanTitle   = event.stadionplan_title   || 'Stadionplan';
  const stadionplanVenueName = event.stadionplan_venue_name || event.venue || '';
  const stadionplanImage   = event.stadionplan_image   || '';
  const stadionplanDescription = event.stadionplan_description || '';
  const showLageplan = event.show_lageplan ?? false;
  const eventPins = (event.lageplan_pins || []) as Array<{
    id: string; name: string; lat: number; lng: number; icon_id: string; label?: string | null;
  }>;
  // Auto-geocode query from venue/location when no manual pins are placed
  const geocodeQuery = [event.venue, event.location_name, event.location_city, event.location_region, event.location_country]
    .filter(Boolean)
    .join(', ');
  const venueLabel = event.venue || event.location_name || event.location_city || event.name || '';
  const hasLageplan = showLageplan && (eventPins.length > 0 || geocodeQuery.length > 0);
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

  const heroSubline = buildHeroSubline(event);
  const heroIntro   = buildHeroIntro(event);
  const eventDateRange = getEventDateRange(event.start_date, event.end_date);
  const bookingHref = event.base_url
    ? `${event.base_url.replace(/\/$/, '')}/booking?event=${encodeURIComponent(event.slug)}`
    : `/booking?event=${encodeURIComponent(event.slug)}`;
  const heroCtaLabel        = `Jetzt ${event.name || event.title || 'Event'} Tickets unverbindlich anfragen`;
  const firstParagraphHeading = buildFirstParagraphHeading(event);
  const firstParagraphText    = buildFirstParagraphText(event);
  const firstParagraphImages  = [event.first_paragraph_image_1, event.first_paragraph_image_2, event.first_paragraph_image_3].filter(Boolean) as string[];

  /* anchor nav items */
  const anchors = [
    showAbout       && { label: 'Leistungen',    href: '#leistungen' },
    showSpielplan   && spielplan.length > 0 && { label: 'Spielplan',   href: '#spielplan'  },
    showWissenswertes && { label: 'Wissenswertes', href: '#wissenswertes' },
    showStadionplan && { label: 'Stadionplan',   href: '#stadionplan' },
    hasLageplan     && { label: 'Lageplan',      href: '#lageplan'    },
    showPackages    && { label: 'Tickets',       href: '#tickets'     },
    showFaqs        && { label: 'FAQ',           href: '#faq'         },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="min-h-screen font-sans" style={{ fontFamily: "'Montserrat', 'Open Sans', system-ui, sans-serif" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: 420 }}>
        {/* Background image */}
        {event.hero_image ? (
          <div className="absolute inset-0">
            <Image src={event.hero_image} alt={event.title || event.name || 'Event'} fill className="object-cover object-center" priority />
            <div className="absolute inset-0" style={{ background: 'rgba(14,34,56,0.45)' }} />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#184a7b 0%,#143047 100%)' }} />
        )}

        {/* Content box — same navy overlay box as Faltin Travel */}
        <div className="relative z-10 flex flex-col items-center justify-center px-4 py-16">
          {series && (
            <Link
              href={`/${series.slug}`}
              className="mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
            >
              {series.title}
            </Link>
          )}

          {/* The navy text box */}
          <div
            className="w-full max-w-4xl text-center rounded-sm px-8 py-10"
            style={{ background: 'rgba(14,34,56,0.82)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-3">
              {event.title || event.name}
            </h1>
            <p className="text-sm md:text-base font-semibold text-white/80 mb-5 tracking-tight">
              {heroSubline}
            </p>
            <p className="text-base md:text-lg text-white/90 leading-relaxed max-w-3xl mx-auto">
              {heroIntro}
            </p>
          </div>

          {/* CTA */}
          <div className="mt-6">
            <Link
              href={bookingHref}
              className="inline-flex items-center rounded-sm px-8 py-4 text-base md:text-lg font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg"
              style={{ background: '#d9531e' }}
            >
              {heroCtaLabel}
            </Link>
          </div>

          {/* Trust line */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs md:text-sm font-semibold text-white/85">
            {['Schweizer Reisegarantie', 'Offizielle Hospitality-Tickets', '20+ Jahre Erfahrung'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="#f5c842">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STICKY ANCHOR NAV ────────────────────────────────────────────────── */}
      {anchors.length > 0 && (
        <nav
          className="sticky z-40 overflow-x-auto"
          style={{
            top: 86,
            background: '#143047',
            borderBottom: '2px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex w-full max-w-6xl mx-auto">
            {anchors.map((anchor, i) => (
              <a
                key={anchor.href}
                href={anchor.href}
                className="flex-1 text-center text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 px-4 py-5 transition-all whitespace-nowrap tracking-wide"
                style={{ borderRight: i < anchors.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none' }}
              >
                {anchor.label}
              </a>
            ))}
          </div>
        </nav>
      )}

      {/* ── LEISTUNGEN / ABOUT ───────────────────────────────────────────────── */}
      {showAbout && (
        <section className="py-14 px-4 bg-white scroll-mt-40" id="leistungen">
          <div className="container mx-auto max-w-6xl">
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-10 items-center">
              {/* Text */}
              <div>
                <h2 className="text-3xl md:text-4xl font-extrabold mb-5 leading-tight" style={{ color: '#143047' }}>
                  {firstParagraphHeading}
                </h2>
                <p className="text-base md:text-lg leading-relaxed text-gray-700">
                  {firstParagraphText}
                </p>
              </div>
              {/* Images */}
              {firstParagraphImages.length > 0 && (
                <div className="grid grid-cols-1 gap-3">
                  {firstParagraphImages.slice(0, 2).map((imageUrl, index) => (
                    <div key={`${imageUrl}-${index}`} className="relative h-52 rounded-xl overflow-hidden bg-gray-100">
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
          </div>
        </section>
      )}

      {/* ── SPIELPLAN ────────────────────────────────────────────────────────── */}
      {showSpielplan && spielplan && spielplan.length > 0 && (
        <section className="py-14 px-4 scroll-mt-40" id="spielplan" style={{ background: '#f5f7fa', borderTop: '1px solid #e5e8ed', borderBottom: '1px solid #e5e8ed' }}>
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-8 leading-tight" style={{ color: '#143047' }}>
              Spielplan
            </h2>
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead style={{ background: '#143047' }}>
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Datum</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Session</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Spielpaarung</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-white/70">Runde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spielplan.map((item, idx) => (
                      <tr key={idx} className="border-t border-gray-100 hover:bg-blue-50/40 transition">
                        <td className="px-6 py-4 font-bold whitespace-nowrap" style={{ color: '#143047' }}>{item.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center rounded-sm px-3 py-1 text-xs font-bold text-white" style={{ background: '#143047' }}>
                            {item.session}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-700 whitespace-pre-line leading-relaxed">{item.matchup}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.round ? (
                            <span className="inline-flex items-center rounded-sm bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                              {item.round}
                            </span>
                          ) : <span className="text-gray-400">–</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── WISSENSWERTES ────────────────────────────────────────────────────── */}
      {showWissenswertes && (
        <section className="py-14 px-4 bg-white scroll-mt-40" id="wissenswertes">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-5 leading-tight" style={{ color: '#143047' }}>
              {wissenswertesTitle}
            </h2>
            <p className="text-base md:text-lg leading-relaxed text-gray-700 mb-6">
              {wissenswertesText}
            </p>
            {wissenswertesAccordionText && (
              <details
                className="group overflow-hidden border rounded-sm [&_summary::-webkit-details-marker]:hidden"
                style={{ borderColor: '#143047' }}
              >
                <summary
                  className="flex cursor-pointer items-center justify-between px-6 py-4 font-bold text-base select-none hover:bg-blue-50/30 transition"
                  style={{ color: '#143047' }}
                >
                  <span>{wissenswertesAccordionTitle}</span>
                  <div
                    className="flex items-center justify-center w-7 h-7 rounded-full border font-bold text-xl leading-none transition-all duration-300 group-open:rotate-45"
                    style={{ borderColor: '#d9531e', color: '#d9531e' }}
                  >
                    +
                  </div>
                </summary>
                <div className="px-6 pb-6 pt-4 text-gray-700 text-base leading-relaxed space-y-4 border-t border-gray-200 whitespace-pre-line">
                  {wissenswertesAccordionText.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </details>
            )}
          </div>
        </section>
      )}

      {/* ── STADIONPLAN ──────────────────────────────────────────────────────── */}
      {showStadionplan && (
        <section className="py-14 px-4 scroll-mt-40" id="stadionplan" style={{ background: '#f5f7fa', borderTop: '1px solid #e5e8ed', borderBottom: '1px solid #e5e8ed' }}>
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-8 leading-tight" style={{ color: '#143047' }}>
              {stadionplanTitle}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.2fr] gap-10 items-start">
              {stadionplanImage ? (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm flex justify-center items-center">
                  <img src={stadionplanImage} alt={stadionplanTitle} className="max-h-[500px] w-auto object-contain rounded-lg" />
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-gray-400 text-sm">
                  Kein Plan-Bild hinterlegt
                </div>
              )}
              <div className="flex flex-col justify-start">
                {stadionplanVenueName && (
                  <h3 className="text-xl md:text-2xl font-extrabold mb-5 leading-tight" style={{ color: '#143047' }}>
                    {stadionplanVenueName}
                  </h3>
                )}
                <div className="text-gray-700 text-sm md:text-base leading-relaxed space-y-4">
                  {stadionplanDescription.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── LAGEPLAN ─────────────────────────────────────────────────────────── */}
      {hasLageplan && (
        <section className="py-14 px-4 bg-white scroll-mt-40" id="lageplan">
          <div className="container mx-auto max-w-6xl">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-2 leading-tight" style={{ color: '#143047' }}>
              Lageplan
            </h2>
            {getEventLocationLine(event) && (
              <p className="text-base text-gray-600 mb-8 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="#d9531e">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                {getEventLocationLine(event)}
              </p>
            )}
            <div className="w-full" style={{ height: 480 }}>
              <LageplanMap pins={eventPins} pinIcons={pinIcons} geocodeQuery={geocodeQuery} venueLabel={venueLabel} />
            </div>
          </div>
        </section>
      )}

      {/* ── PACKAGES / TICKETS ───────────────────────────────────────────────── */}
      {showPackages && (
        <section className="py-14 px-4 scroll-mt-40" id="tickets" style={{ background: '#f5f7fa', borderTop: '1px solid #e5e8ed' }}>
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-2 leading-tight text-center" style={{ color: '#143047' }}>
              Unsere Tickets
            </h2>
            <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
              Wählen Sie Ihr Package — von einzelnen Spieltagen bis zu exklusiven Halbfinale- und Finale-Kombinationen.
            </p>

            {packages.length === 0 && (
              <EventContactForm
                eventSlug={event.slug}
                eventName={event.name || event.title}
              />
            )}

            {/* ── Package overview selector grid ── */}
            {packages.length > 1 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                {packages.map((pkg, i) => (
                  <a
                    key={pkg.id}
                    href={`#pkg-${pkg.slug || pkg.id}`}
                    className="group block rounded-xl p-5 transition-all hover:-translate-y-1"
                    style={{
                      background: pkg.popular ? '#143047' : 'white',
                      border: pkg.popular ? '2px solid #143047' : '1.5px solid #e5e8ed',
                      boxShadow: pkg.popular ? '0 6px 20px rgba(20,48,71,0.18)' : '0 2px 8px rgba(0,0,0,0.06)',
                      color: pkg.popular ? 'white' : '#143047',
                    }}
                  >
                    {pkg.popular && (
                      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f5c842' }}>★ Empfohlen</div>
                    )}
                    {pkg.available_spots && pkg.available_spots <= 10 && (
                      <div className="text-xs font-bold mb-2" style={{ color: pkg.popular ? '#fca5a5' : '#d9531e' }}>
                        Nur noch {pkg.available_spots} Plätze
                      </div>
                    )}
                    <div className="font-extrabold text-base leading-tight mb-1">{pkg.title}</div>
                    <div className="text-sm mb-3" style={{ opacity: 0.7 }}>{pkg.short_description?.slice(0, 80)}{(pkg.short_description?.length ?? 0) > 80 ? '…' : ''}</div>
                    <div className="font-extrabold text-2xl">
                      {Number(pkg.price || 0).toLocaleString('de-DE')} €
                    </div>
                    <div className="text-xs mt-0.5" style={{ opacity: 0.65 }}>pro Person im DZ</div>
                    <div
                      className="mt-4 text-xs font-bold text-center py-2 rounded-lg transition-all group-hover:opacity-90"
                      style={{
                        background: pkg.popular ? '#d9531e' : '#143047',
                        color: 'white',
                      }}
                    >
                      Details & Buchen →
                    </div>
                  </a>
                ))}
              </div>
            )}

            {/* ── Full package cards ── */}
            <div className="space-y-8">
              {packages.map((pkg) => (
                <div key={pkg.id} id={`pkg-${pkg.slug || pkg.id}`} className="scroll-mt-40">
                  <PackageCard
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
                    eventDateRange={eventDateRange || undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ──────────────────────────────────────────────────────────────── */}
      {showFaqs && (
        <section className="py-14 px-4 bg-white scroll-mt-40" id="faq">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-8 leading-tight" style={{ color: '#143047' }}>
              FAQ zu {event.name || event.title}
            </h2>
            {faqs.length === 0 ? (
              <p className="text-gray-400">Noch keine FAQs hinterlegt.</p>
            ) : (
              <div className="divide-y" style={{ borderTop: '1px solid #e5e8ed' }}>
                {faqs.map((faq) => (
                  <details
                    key={faq.id}
                    className="group [&_summary::-webkit-details-marker]:hidden"
                    style={{ borderBottom: '1px solid #e5e8ed' }}
                  >
                    <summary
                      className="flex cursor-pointer items-center justify-between py-5 font-semibold text-base md:text-lg select-none hover:bg-blue-50/20 px-2 transition rounded-sm"
                      style={{ color: '#143047' }}
                    >
                      <span className="pr-4 leading-snug">{faq.question}</span>
                      {/* Circle chevron — exactly like Faltin Travel */}
                      <div
                        className="flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 transition-all duration-300"
                        style={{ borderColor: '#143047', color: '#143047' }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth="2.5"
                          stroke="currentColor"
                          className="w-4 h-4 transition-transform duration-300 group-open:rotate-180"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </summary>
                    <div className="px-2 pb-5 pt-2 text-gray-700 text-sm md:text-base leading-relaxed whitespace-pre-line">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── BOTTOM CTA STRIP ─────────────────────────────────────────────────── */}
      <section className="py-12 px-4 text-center" style={{ background: '#143047' }}>
        <p className="text-white/70 text-sm mb-4 uppercase tracking-widest font-semibold">Bereit für Ihr Erlebnis?</p>
        <Link
          href={bookingHref}
          className="inline-flex items-center rounded-sm px-8 py-4 text-base md:text-lg font-bold text-white transition-all hover:opacity-90 hover:scale-[1.02] shadow-lg"
          style={{ background: '#d9531e' }}
        >
          {heroCtaLabel}
        </Link>
      </section>
    </div>
  );
}
