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
  getPackages,
  getPins,
  getPinIcons
} from './contentStore';

export const DEFAULT_EVENT_SLUG = process.env.DEFAULT_EVENT_SLUG || '';
export const DEFAULT_PACKAGE_SLUG = process.env.DEFAULT_PACKAGE_SLUG || '';

/**
 * Kanonischer Event-Pfad: /<serie>/<event>. Fällt auf /events/<slug> zurück,
 * wenn keine Serie zugeordnet ist (diese URL leitet dann weiter/rendert).
 */
export function eventPath(eventSlug: string, seriesSlug?: string | null): string {
  return seriesSlug ? `/${seriesSlug}/${eventSlug}` : `/events/${eventSlug}`;
}

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
  show_about?: boolean | null;
  show_packages?: boolean | null;
  show_faqs?: boolean | null;
  show_spielplan?: boolean | null;
  spielplan?: Array<{
    date: string;
    session: string;
    matchup: string;
    round: string;
  }> | null;
  show_wissenswertes?: boolean | null;
  wissenswertes_title?: string | null;
  wissenswertes_text?: string | null;
  wissenswertes_accordion_title?: string | null;
  wissenswertes_accordion_text?: string | null;
  show_stadionplan?: boolean | null;
  stadionplan_title?: string | null;
  stadionplan_venue_name?: string | null;
  stadionplan_image?: string | null;
  stadionplan_description?: string | null;
  show_lageplan?: boolean | null;
  lageplan_pins?: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    icon_id: string;
    label?: string | null;
  }> | null;
  brevo_list_id?: string | null;
  show_leistungen?: boolean | null;
  leistungen_title?: string | null;
  leistungen_image?: string | null;
  leistungen_items?: string[] | null;
  show_ticket_categories?: boolean | null;
  ticket_categories_title?: string | null;
  ticket_categories_intro?: string | null;
  ticket_categories?: Array<{ name: string; items: string[]; note?: string | null }> | null;
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
  active?: boolean | null;
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

export interface EventPinRecord {
  id: string;
  name: string;
  lat: number;
  lng: number;
  icon_id: string;
  label?: string | null;
}

export interface EventPinIconRecord {
  id: string;
  name: string;
  image?: string | null;
}

export async function getPinsList(): Promise<EventPinRecord[]> {
  return (getPins() as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    icon_id: p.type ? `icon-${p.type}` : 'icon-other',
    label: p.label,
  })) || [];
}

export async function getPinIconsList(): Promise<EventPinIconRecord[]> {
  return (getPinIcons() as EventPinIconRecord[]) || [];
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
