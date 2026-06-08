import { MetadataRoute } from 'next';
import { getSeriesList, getEventsList } from '@/lib/eventData';
import { toCategorySlug } from '@/lib/category';
import { siteConfig } from '@/lib/siteConfig';

// Domain-agnostisch: nutzt NEXT_PUBLIC_SITE_URL (siehe siteConfig), Fallback faltintravel.com
const BASE = siteConfig.url.replace(/\/+$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/kalender`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/ueber-uns`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/kontakt`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/booking`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/agb`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  try {
    const [series, events] = await Promise.all([getSeriesList(), getEventsList()]);
    const activeSeries = series.filter((s) => (s.status ?? 'active') !== 'archived');
    const slugById = new Map(series.map((s) => [s.id, s.slug]));

    // Kategorie-Seiten (eindeutig)
    const categorySlugs = new Set(activeSeries.map((s) => toCategorySlug(s.category || 'sonstiges')));
    for (const cat of categorySlugs) {
      entries.push({ url: `${BASE}/kategorie/${cat}`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 });
    }

    // Serien-Hubs
    for (const s of activeSeries) {
      entries.push({ url: `${BASE}/${s.slug}`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 });
    }

    // Events (kanonischer Pfad /<serie>/<edition>)
    for (const e of events) {
      const seriesSlug = e.series_id ? slugById.get(e.series_id) : undefined;
      const seg = e.url_segment || e.slug;
      const url = seriesSlug ? `${BASE}/${seriesSlug}/${seg}` : `${BASE}/events/${e.slug}`;
      entries.push({ url, lastModified: now, changeFrequency: 'weekly', priority: 0.9 });
    }
  } catch {
    // Fallback: nur statische Einträge
  }

  return entries;
}
