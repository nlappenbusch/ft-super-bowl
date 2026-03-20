import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronRight, Home, Layers } from 'lucide-react';
import EventDiscoverCard, { type EventDiscoverCardData } from '@/components/EventDiscoverCard';
import { getEventsList, getPackagesList, getSeriesList } from '@/lib/eventData';
import { getCategorySeoBySlug } from '@/lib/categorySeoStore';
import { toCategorySlug } from '@/lib/category';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
}

async function loadCategoryData(categorySlug: string) {
  const [allSeries, allEvents, allPackages] = await Promise.all([
    getSeriesList(),
    getEventsList(),
    getPackagesList()
  ]);

  const series = allSeries.filter(
    (item) => item.status !== 'archived' && toCategorySlug(item.category || 'sonstiges') === categorySlug
  );

  const seriesIds = new Set(series.map((item) => item.id));
  const events = allEvents.filter((event) => event.series_id && seriesIds.has(event.series_id));

  const minPriceByEventId = allPackages.reduce((map, item) => {
    if (!item.event_id) return map;
    if (typeof item.price !== 'number' || item.price <= 0) return map;

    const current = map.get(item.event_id);
    if (typeof current === 'number') {
      map.set(item.event_id, Math.min(current, item.price));
      return map;
    }

    map.set(item.event_id, item.price);
    return map;
  }, new Map<string, number>());

  return { series, events, minPriceByEventId };
}

function formatMonthYear(value?: string | null) {
  if (!value) return 'Datum folgt';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('de-CH', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function getSeriesFallbackSeoText(series: Awaited<ReturnType<typeof loadCategoryData>>['series']) {
  return (
    series.find((item) => item.category_seo_text && item.category_seo_text.trim())
      ?.category_seo_text
      ?.trim() || ''
  );
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const { series } = await loadCategoryData(category);
  if (series.length === 0) return {};

  const categoryName = series[0].category;
  const categorySeo = getCategorySeoBySlug(category);
  const fallbackSeoText = getSeriesFallbackSeoText(series);
  const description =
    categorySeo?.meta_description?.trim() ||
    categorySeo?.intro_text?.trim() ||
    fallbackSeoText ||
    `Alle Eventserien und Events in der Kategorie ${categoryName}.`;

  return {
    title: `${categoryName} | Faltin Travel`,
    description: description.slice(0, 160)
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const { series, events, minPriceByEventId } = await loadCategoryData(category);

  if (series.length === 0) {
    return notFound();
  }

  const categoryName = series[0].category;
  const categorySeo = getCategorySeoBySlug(category);
  const categorySeoText =
    categorySeo?.intro_text?.trim() ||
    getSeriesFallbackSeoText(series);
  const seriesById = new Map(series.map((item) => [item.id, item]));

  const topEvents: EventDiscoverCardData[] = events
    .slice(0, 6)
    .map((event) => {
      const parentSeries = event.series_id ? seriesById.get(event.series_id) : null;
      return {
        id: event.id,
        title: event.title || event.name,
        image: event.hero_image || event.ticket_image || parentSeries?.hero_image || '/header-neu1260-1.webp',
        description:
          event.description ||
          'Direkter Einstieg ins Event mit verfügbaren Tickets, Paketen und Reiseinfos.',
        category: parentSeries?.category || categoryName,
        categorySlug: toCategorySlug(parentSeries?.category || categoryName),
        dateLabel: formatMonthYear(event.start_date),
        location: [event.location_city, event.location_country].filter(Boolean).join(', ') || 'Ort folgt',
        href: `/events/${event.slug}`,
        fromPrice: minPriceByEventId.get(event.id) ?? null,
        currency: 'CHF'
      };
    });

  const seriesTiles = series.map((item) => ({
    id: item.id,
    href: `/${item.slug}`,
    title: item.title,
    image: item.hero_image || '/header-neu1260-1.webp',
    description:
      item.description ||
      'Alle Events dieser Serie mit Ticketoptionen, Hotelpaketen und Reisedetails.'
  }));

  return (
    <div className="min-h-screen text-white" style={{ backgroundImage: 'linear-gradient(202deg, #184a7b 0%, #143047 100%)' }}>
      <section className="relative overflow-hidden px-4 pt-6 pb-12 md:pt-8 md:pb-14">
        <div className="container mx-auto relative z-10">
          <div className="inline-flex max-w-full rounded-xl border border-white/15 bg-gradient-to-r from-white/5 to-white/8 backdrop-blur-sm p-2.5 mb-6">
            <nav className="flex items-center gap-1.5 text-sm flex-wrap">
              <Link href="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/75 hover:text-white transition-all duration-200 font-medium">
                <Home className="w-4 h-4" />
                <span>Home</span>
              </Link>
              <ChevronRight className="w-4 h-4 text-white/30" />
              <Link href="/?scroll=categories" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/75 hover:text-white transition-all duration-200">
                <Layers className="w-4 h-4" />
                <span>Kategorien</span>
              </Link>
              <ChevronRight className="w-4 h-4 text-white/30" />
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-400/20 to-cyan-400/20 border border-blue-300/30">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-cyan-100 to-blue-100 font-bold">{categoryName}</span>
              </div>
            </nav>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-center" style={{ fontFamily: 'var(--font-display)' }}>
            Unsere {categoryName} Tickets & Reisen
          </h1>

          <p className="text-center text-white/85 mt-3 text-lg">
            Erst zur passenden Serie orientieren, dann das konkrete Event auswählen.
          </p>

          {categorySeoText && (
            <div className="mt-10 overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-[#173e66]/95 via-[#1f4f82]/92 to-[#285d94]/90 shadow-[0_22px_46px_rgba(2,12,30,0.28)]">
              <div className="p-6 sm:p-7 lg:p-8">
                <p className="inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100">
                  Kategorie Guide
                </p>
                <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  {categoryName}: Infos und Highlights
                </h2>
                <p className="mt-3 text-base leading-relaxed text-blue-50/95">{categorySeoText}</p>
              </div>
            </div>
          )}

          {topEvents.length > 0 && (
            <div className="mt-12">
              <div className="flex items-center justify-between gap-3 mb-6">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  Beliebte Events (Direkteinstieg)
                </h2>
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-300/40 text-sm font-semibold text-blue-100 backdrop-blur-sm">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                  {topEvents.length} Events
                </span>
              </div>
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {topEvents.map((tile) => (
                  <EventDiscoverCard key={tile.id} event={tile} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-14">
            <div className="flex items-center justify-between gap-3 mb-6">
              <h2 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                Alle Serien in {categoryName}
              </h2>
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-300/40 text-sm font-semibold text-indigo-100 backdrop-blur-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                {seriesTiles.length} Serien
              </span>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {seriesTiles.map((tile) => (
                <Link
                  key={tile.id}
                  href={tile.href}
                  className="group overflow-hidden rounded-2xl shadow-[0_10px_24px_rgba(15,23,42,0.16)] border border-white/10 bg-slate-900 block transition-all duration-250 hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(15,23,42,0.22)]"
                >
                  <div className="relative h-52 w-full overflow-hidden">
                    <img
                      src={tile.image}
                      alt={tile.title}
                      className="h-full w-full object-cover transition-[filter] duration-400 ease-out group-hover:brightness-110 group-hover:saturate-115"
                      loading="lazy"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/18 to-transparent opacity-70 group-hover:opacity-55 transition-opacity duration-300" />
                  </div>
                  <div className="p-5 bg-[#3f6de0] min-h-[250px]">
                    <h3 className="text-[1.95rem] leading-tight font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
                      {tile.title}
                    </h3>
                    <p className="text-[1.2rem] leading-[1.55] mt-3 text-white/95">
                      {tile.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
