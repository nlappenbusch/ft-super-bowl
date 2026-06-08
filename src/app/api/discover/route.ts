import { NextResponse } from 'next/server';
import { toCategorySlug } from '@/lib/category';
import { getEventsList, getPackagesList, getSeriesList } from '@/lib/eventData';

function formatMonthYear(value?: string | null) {
  if (!value) return 'Datum folgt';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('de-CH', {
    month: 'long',
    year: 'numeric'
  }).format(date);
}

export async function GET() {
  const [series, events, packages] = await Promise.all([
    getSeriesList(),
    getEventsList(),
    getPackagesList()
  ]);

  const seriesById = new Map(series.map((item) => [item.id, item]));
  const pricesByEvent = packages.reduce((map, pkg) => {
    if (!pkg.event_id) return map;

    if (!map.has(pkg.event_id)) {
      map.set(pkg.event_id, [] as number[]);
    }

    if (typeof pkg.price === 'number' && pkg.price > 0) {
      map.get(pkg.event_id)?.push(pkg.price);
    }

    return map;
  }, new Map<string, number[]>());

  const cards = events
    .map((event) => {
      const parentSeries = event.series_id ? seriesById.get(event.series_id) : null;
      if (!parentSeries || parentSeries.status === 'archived') return null;

      const eventPrices = pricesByEvent.get(event.id) || [];
      const fromPrice = eventPrices.length > 0 ? Math.min(...eventPrices) : null;

      return {
        id: event.id,
        slug: event.slug,
        title: event.title || event.name,
        description: event.description || 'Exklusives Event mit Ticket- und Reiseloesungen auf Anfrage.',
        image: event.hero_image || event.ticket_image || parentSeries.hero_image || '/header-neu1260-1.webp',
        category: parentSeries.category || 'Sonstiges',
        categorySlug: toCategorySlug(parentSeries.category || 'sonstiges'),
        dateLabel: formatMonthYear(event.start_date),
        location: [event.location_city, event.location_country].filter(Boolean).join(', ') || 'Ort folgt',
        href: parentSeries.slug ? `/${parentSeries.slug}/${event.slug}` : `/events/${event.slug}`,
        fromPrice,
        currency: 'CHF'
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return NextResponse.json({ success: true, data: cards });
}
