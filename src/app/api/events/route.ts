import { NextResponse } from 'next/server';
import {
  getEventsList, getEventsBySeriesSlug, getEventBySlug, getSeriesById, eventPath,
  type EventRecord,
} from '@/lib/eventData';
import { getLoginBaseUrl } from '@/lib/graphMailer';
import { siteConfig } from '@/lib/siteConfig';

function publicBaseUrl(): string {
  return (getLoginBaseUrl() || process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url).replace(/\/+$/, '');
}

function absolutize(base: string, p?: string | null): string | null {
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) return p;
  return `${base}${p.startsWith('/') ? '' : '/'}${p}`;
}

/** Event-Record für externe Nutzung (WordPress-Shortcodes) reduzieren. */
async function toPublicEvent(e: EventRecord, base: string) {
  const series = e.series_id ? await getSeriesById(e.series_id) : null;
  const segment = e.url_segment || e.slug;
  return {
    slug: e.slug,
    series_slug: series?.slug || null,
    name: e.name,
    title: e.title,
    description: e.description || '',
    start_date: e.start_date || null,
    end_date: e.end_date || null,
    venue: e.venue || null,
    location_city: e.location_city || null,
    location_country: e.location_country || null,
    hero_image: absolutize(base, e.hero_image),
    url: `${base}${eventPath(segment, series?.slug || null)}`,
    status: e.status || 'active',
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const serie = url.searchParams.get('serie');
  const eventSlug = url.searchParams.get('event');
  const base = publicBaseUrl();

  if (eventSlug) {
    const e = await getEventBySlug(eventSlug);
    if (!e) return NextResponse.json({ success: false, error: 'Event nicht gefunden' }, { status: 404 });
    return NextResponse.json({ success: true, data: await toPublicEvent(e, base) });
  }

  if (serie) {
    const events = (await getEventsBySeriesSlug(serie)).filter((e) => (e.status || 'active') === 'active');
    const data = await Promise.all(events.map((e) => toPublicEvent(e, base)));
    data.sort((a, b) => (a.start_date || '9999').localeCompare(b.start_date || '9999'));
    return NextResponse.json({ success: true, data });
  }

  const events = await getEventsList();
  return NextResponse.json({ success: true, data: events });
}
