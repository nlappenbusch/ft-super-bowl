import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getEvents,
  getSeries,
  findEventBySlug,
  findSeriesBySlug,
  findSeriesById,
  findPackageBySlug,
  findFaqsByEvent,
  findPackagesByEvent,
  findEventsBySeriesId,
  getPackages
} from './contentStore';

export const DEFAULT_EVENT_SLUG = process.env.DEFAULT_EVENT_SLUG || 'super-bowl-2027';
export const DEFAULT_PACKAGE_SLUG = process.env.DEFAULT_PACKAGE_SLUG || 'dream-hollywood';

export interface EventRecord {
  id: string;
  series_id?: string | null;
  slug: string;
  name: string;
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  venue?: string | null;
  location_name?: string | null;
  location_city?: string | null;
  location_region?: string | null;
  location_country?: string | null;
  hero_image?: string | null;
  ticket_image?: string | null;
  base_url?: string | null;
  first_paragraph_heading?: string | null;
  first_paragraph_text?: string | null;
  first_paragraph_image_1?: string | null;
  first_paragraph_image_2?: string | null;
  first_paragraph_image_3?: string | null;
}

export interface SeriesRecord {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category: string;
  category_seo_text?: string | null;
  hero_image?: string | null;
  status?: 'active' | 'draft' | 'archived' | null;
}

export interface PackageIncludeRecord {
  id?: string;
  type?: string | null;
  name: string;
  category?: string | null;
  status?: string | null;
  icon?: string | null;
  description?: string | null;
  sort_order?: number | null;
}

export interface PackageRecord {
  id: string;
  event_id: string;
  slug: string;
  package_name?: string | null;
  title: string;
  short_description?: string | null;
  description?: string | null;
  hotel?: string | null;
  stars?: number | null;
  nights?: number | null;
  price?: number | null;
  currency?: string | null;
  single_supplement?: number | null;
  popular?: boolean | null;
  available_spots?: number | null;
  rating?: number | null;
  reviews?: number | null;
  hotel_images?: string[] | null;
  distances?: { airport?: string; stadium?: string; downtown?: string } | null;
  room_categories?: string[] | null;
  extension_nights?: string | null;
  badge_text?: string | null;
  package_includes?: PackageIncludeRecord[] | null;
}

export interface EventFaqRecord {
  id: string;
  event_id: string;
  question: string;
  answer: string;
  sort_order?: number | null;
}

export interface PackageCardData {
  id: string;
  packageName: string;
  stars: number;
  nights: number;
  price: number;
  singleSupplement: number;
  title: string;
  description: string;
  hotel: string;
  hotelImages: string[];
  distances: {
    airport: string;
    stadium: string;
    downtown: string;
  };
  roomCategories: string[];
  popular: boolean;
  availableSpots: number;
  rating: number;
  reviews: number;
  includes: PackageIncludeRecord[];
  extensionNights: string;
  badgeText: string;
}

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return (findEventBySlug(slug) as EventRecord | null) || null;
  }

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as EventRecord;
}

export async function getEventsList(): Promise<EventRecord[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return (getEvents() as EventRecord[]) || [];
  }

  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true });

  if (error || !data) return [];
  return data as EventRecord[];
}

export async function getSeriesList(): Promise<SeriesRecord[]> {
  return (getSeries() as SeriesRecord[]) || [];
}

export async function getSeriesBySlug(slug: string): Promise<SeriesRecord | null> {
  return (findSeriesBySlug(slug) as SeriesRecord | null) || null;
}

export async function getSeriesById(id: string): Promise<SeriesRecord | null> {
  return (findSeriesById(id) as SeriesRecord | null) || null;
}

export async function getEventsBySeriesSlug(seriesSlug: string): Promise<EventRecord[]> {
  const series = findSeriesBySlug(seriesSlug);
  if (!series) return [];
  return (findEventsBySeriesId(series.id) as EventRecord[]) || [];
}

export async function getPackageBySlug(eventSlug: string, packageSlug: string): Promise<PackageRecord | null> {
  if (!isSupabaseConfigured() || !supabase) {
    const event = findEventBySlug(eventSlug);
    if (!event) return null;
    return (findPackageBySlug(event.id, packageSlug) as PackageRecord | null) || null;
  }

  const event = await getEventBySlug(eventSlug);
  if (!event) return null;

  const { data, error } = await supabase
    .from('packages')
    .select('*, package_includes(*)')
    .eq('event_id', event.id)
    .eq('slug', packageSlug)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as PackageRecord;
}

export async function getPackagesByEventSlug(eventSlug: string): Promise<PackageRecord[]> {
  if (!isSupabaseConfigured() || !supabase) {
    const event = findEventBySlug(eventSlug);
    if (!event) return [];
    return (findPackagesByEvent(event.id) as PackageRecord[]) || [];
  }

  const event = await getEventBySlug(eventSlug);
  if (!event) return [];

  const { data, error } = await supabase
    .from('packages')
    .select('*, package_includes(*)')
    .eq('event_id', event.id)
    .order('title', { ascending: true });

  if (error || !data) return [];
  return data as PackageRecord[];
}

export async function getPackagesList(): Promise<PackageRecord[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return (getPackages() as PackageRecord[]) || [];
  }

  const { data, error } = await supabase
    .from('packages')
    .select('*')
    .order('title', { ascending: true });

  if (error || !data) return [];
  return data as PackageRecord[];
}

export async function getEventFaqs(eventSlug: string): Promise<EventFaqRecord[]> {
  if (!isSupabaseConfigured() || !supabase) {
    const event = findEventBySlug(eventSlug);
    if (!event) return [];
    return (findFaqsByEvent(event.id) as EventFaqRecord[]) || [];
  }

  const event = await getEventBySlug(eventSlug);
  if (!event) return [];

  const { data, error } = await supabase
    .from('event_faqs')
    .select('*')
    .eq('event_id', event.id)
    .order('sort_order', { ascending: true });

  if (error || !data) return [];
  return data as EventFaqRecord[];
}

function resolveImageUrl(baseUrl: string, src: string): string {
  if (!src) return src;
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedSrc = src.startsWith('/') ? src : `/${src}`;
  return `${normalizedBase}${normalizedSrc}`;
}

function toSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]+/g, '_');
}

export function toPackageCardData(packageRecord: PackageRecord, baseUrl: string): PackageCardData {
  const hotelImages = (packageRecord.hotel_images || [])
    .filter((img): img is string => Boolean(img))
    .map((img) => resolveImageUrl(baseUrl, img));

  const distances = packageRecord.distances || {};
  const rawIncludes = packageRecord.package_includes || (packageRecord as PackageRecord & { includes?: PackageIncludeRecord[] }).includes || [];
  const includes = rawIncludes
    .map((item) => ({
      ...item,
      icon: item.icon || '',
      description: item.description || ''
    }))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return {
    id: toSafeId(packageRecord.slug || packageRecord.id),
    packageName: packageRecord.package_name || 'Ticket- & Hotel-Package',
    stars: packageRecord.stars || 0,
    nights: packageRecord.nights || 0,
    price: Number(packageRecord.price || 0),
    singleSupplement: Number(packageRecord.single_supplement || 0),
    title: packageRecord.title || '',
    description: packageRecord.description || packageRecord.short_description || '',
    hotel: packageRecord.hotel || packageRecord.title || '',
    hotelImages,
    distances: {
      airport: distances.airport || '',
      stadium: distances.stadium || '',
      downtown: distances.downtown || ''
    },
    roomCategories: packageRecord.room_categories || ['Doppelzimmer', 'Einzelzimmer'],
    popular: Boolean(packageRecord.popular),
    availableSpots: Number(packageRecord.available_spots || 0),
    rating: Number(packageRecord.rating || 0),
    reviews: Number(packageRecord.reviews || 0),
    includes,
    extensionNights: packageRecord.extension_nights || '',
    badgeText: packageRecord.badge_text || ''
  };
}
