/**
 * hotelLookup.ts — Hoteldaten aus einer Booking.com-URL (TASK-00117).
 * ─────────────────────────────────────────────────────────────────────────────
 * Booking.com blockt Server-Scrapes (Bot-Challenge), daher zweistufig:
 *   1. Versuch: Seite laden und JSON-LD (schema.org Hotel) parsen.
 *   2. Fallback (Regelfall): Hotelname + Land aus dem URL-Slug ableiten und
 *      über Nominatim (OpenStreetMap) Adresse/Ort auflösen.
 * Nur serverseitig verwenden (API-Route).
 */

export interface HotelInfo {
  /** Offizieller/aufgelöster Hotelname. */
  name: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  /** Ursprüngliche Booking-URL. */
  url: string;
  /** Datenquelle: 'booking' (JSON-LD) oder 'nominatim' (OSM) oder 'slug'. */
  source: string;
}

/** "fairmont-miramar-santa-monica" → "Fairmont Miramar Santa Monica". */
function slugToName(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toUpperCase()))
    .join(' ');
}

/** Booking-Hotel-URL zerlegen: /hotel/<cc>/<slug>[.<lang>].html */
export function parseBookingUrl(raw: string): { countryCode: string; slug: string; nameGuess: string } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)booking\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/\/hotel\/([a-z]{2})\/([a-z0-9-]+?)(?:\.[a-z]{2}(?:-[a-z]{2})?)?\.html/i);
  if (!m) return null;
  return { countryCode: m[1].toLowerCase(), slug: m[2], nameGuess: slugToName(m[2]) };
}

interface JsonLdHotel {
  '@type'?: string;
  name?: string;
  address?: { streetAddress?: string; postalCode?: string; addressLocality?: string; addressCountry?: string };
}

/** Versuch 1: Booking-Seite direkt (klappt nur, wenn kein Bot-Block greift). */
async function tryBookingJsonLd(url: string): Promise<HotelInfo | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
    });
    if (!res.ok) return null; // Booking liefert bei Bot-Challenge 202/403
    const html = await res.text();
    const matches = html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g);
    for (const m of matches) {
      try {
        const d = JSON.parse(m[1]) as JsonLdHotel;
        if (d && typeof d === 'object' && /hotel|lodging|resort/i.test(String(d['@type'] || '')) && d.name) {
          const a = d.address || {};
          return {
            name: d.name,
            street: a.streetAddress || '',
            zip: a.postalCode || '',
            city: a.addressLocality || '',
            country: typeof a.addressCountry === 'string' ? a.addressCountry : '',
            url,
            source: 'booking',
          };
        }
      } catch { /* nächstes JSON-LD probieren */ }
    }
    return null;
  } catch {
    return null;
  }
}

interface NominatimHit {
  name?: string;
  display_name?: string;
  address?: {
    tourism?: string; road?: string; house_number?: string; postcode?: string;
    city?: string; town?: string; village?: string; country?: string;
  };
}

/** Versuch 2: Nominatim (OpenStreetMap) — Name aus Slug + Ländereinschränkung. */
async function tryNominatim(nameGuess: string, countryCode: string, url: string): Promise<HotelInfo | null> {
  try {
    const q = new URLSearchParams({
      q: nameGuess, format: 'jsonv2', addressdetails: '1', limit: '1', countrycodes: countryCode,
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${q.toString()}`, {
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
      headers: { 'User-Agent': 'FaltinTravel-Admin/1.0 (request@faltintravel.com)' },
    });
    if (!res.ok) return null;
    const hits = (await res.json()) as NominatimHit[];
    const h = hits?.[0];
    if (!h) return null;
    const a = h.address || {};
    const street = [a.road, a.house_number].filter(Boolean).join(' ');
    return {
      name: a.tourism || h.name || nameGuess,
      street,
      zip: a.postcode || '',
      city: a.city || a.town || a.village || '',
      country: (a.country || '').split('/')[0],
      url,
      source: 'nominatim',
    };
  } catch {
    return null;
  }
}

/**
 * Hoteldaten zu einer Booking.com-URL auflösen.
 * Liefert im schlechtesten Fall den aus dem Slug geratenen Namen (source 'slug').
 */
export async function lookupHotel(rawUrl: string): Promise<HotelInfo | null> {
  const parsed = parseBookingUrl(rawUrl);
  if (!parsed) return null;
  const fromBooking = await tryBookingJsonLd(rawUrl);
  if (fromBooking) return fromBooking;
  const fromOsm = await tryNominatim(parsed.nameGuess, parsed.countryCode, rawUrl);
  if (fromOsm) return fromOsm;
  return { name: parsed.nameGuess, street: '', zip: '', city: '', country: parsed.countryCode.toUpperCase(), url: rawUrl, source: 'slug' };
}

/** Kompakte Anzeige: "Fairmont Miramar — 101 Wilshire Blvd, 90401 Santa Monica, United States". */
export function hotelInfoLine(h: HotelInfo): string {
  const addr = [h.street, [h.zip, h.city].filter(Boolean).join(' '), h.country].filter(Boolean).join(', ');
  return addr ? `${h.name} — ${addr}` : h.name;
}
