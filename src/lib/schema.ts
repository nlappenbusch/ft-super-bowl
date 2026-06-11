import { siteConfig } from '@/lib/siteConfig';

// Domain-agnostisch: eigene URL aus NEXT_PUBLIC_SITE_URL (Fallback faltintravel.com)
const SITE = siteConfig.url.replace(/\/+$/, '');

export interface SubEventInput {
  /** Spielpaarung, z.B. "Schweiz – Kanada" */
  name?: string;
  /** Datum wie im Spielplan gepflegt (deutsche Formate erlaubt) */
  date?: string;
  /** Stadion/Ort (Session-Spalte des Spielplans) */
  venue?: string;
  /** Runde/Phase, z.B. "Gruppenphase" */
  round?: string;
}

export interface EventSchemaInput {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  venue?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
  organizerName?: string;
  organizerUrl?: string;
  /** Einzelne Paarungen/Termine (Spielplan-Modul) – werden als subEvent (SportsEvent) ausgegeben. */
  subEvents?: SubEventInput[];
}

export interface ProductSchemaInput {
  name?: string;
  description?: string;
  price?: number | string;
  priceCurrency?: string;
  url?: string;
  /** Echte Bewertungsdaten (z.B. aus dem Package). Ohne Werte wird KEIN aggregateRating ausgegeben. */
  ratingValue?: number;
  reviewCount?: number;
}

const MONTHS: Record<string, string> = {
  januar: '01', februar: '02', 'märz': '03', maerz: '03', april: '04', mai: '05', juni: '06',
  juli: '07', august: '08', september: '09', oktober: '10', november: '11', dezember: '12',
};

/**
 * Deutsche Datumsangaben nach ISO 8601 (für JSON-LD).
 * Unterstützt u.a.: "13.09.2025", "Sa. 13.06.2026, 21:00 MESZ", "Donnerstag, 11. Juni 2026", "Fr. 25.09.2026".
 * Uhrzeit wird nur übernommen, wenn eine Zeitzone (MESZ/MEZ) angegeben ist – sonst nur das Datum.
 * Nicht parsebare Angaben ergeben null (lieber kein Datum als ein falsches).
 */
export function parseGermanDateToIso(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  let day = '', month = '', year = '';
  let m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) {
    [, day, month, year] = m;
  } else {
    m = s.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s+(\d{4})/);
    if (!m) return null;
    const mo = MONTHS[m[2].toLowerCase()];
    if (!mo) return null;
    day = m[1]; month = mo; year = m[3];
  }
  const dd = day.padStart(2, '0');
  const mm = month.padStart(2, '0');
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  const t = s.match(/(\d{1,2}):(\d{2})\s*(MESZ|MEZ)/);
  if (t) {
    const offset = t[3] === 'MEZ' ? '+01:00' : '+02:00';
    return `${year}-${mm}-${dd}T${t[1].padStart(2, '0')}:${t[2]}:00${offset}`;
  }
  return `${year}-${mm}-${dd}`;
}

/** FAQPage-Strukturdaten (Rich Results) aus einer Frage/Antwort-Liste. */
export function generateFaqPageSchema(faqs: Array<{ question?: string; answer?: string }>) {
  const items = (faqs || [])
    .filter((f) => f && f.question && f.answer)
    .map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    }));
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items,
  };
}

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Faltin Travel',
    url: SITE,
    logo: `${SITE}/faltin-logo.svg`,
    description: 'Spezialist für Sportreisen und Event-Packages weltweit',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'CH'
    },
    sameAs: [
      // Hier Social Media Links einfügen
    ]
  }
}

/** Place nur mit tatsächlich vorhandenen Feldern bauen (keine Platzhalter). */
function buildPlace(venue?: string, address?: EventSchemaInput['address']) {
  const addr: Record<string, string> = {};
  if (address?.streetAddress) addr.streetAddress = address.streetAddress;
  if (address?.addressLocality) addr.addressLocality = address.addressLocality;
  if (address?.addressRegion) addr.addressRegion = address.addressRegion;
  if (address?.postalCode) addr.postalCode = address.postalCode;
  if (address?.addressCountry) addr.addressCountry = address.addressCountry;
  if (!venue && Object.keys(addr).length === 0) return undefined;
  return {
    '@type': 'Place',
    ...(venue ? { name: venue } : {}),
    ...(Object.keys(addr).length ? { address: { '@type': 'PostalAddress', ...addr } } : {}),
  };
}

/**
 * SportsEvent-Strukturdaten. Felder werden nur ausgegeben, wenn echte Daten vorliegen
 * (keine "heute"-Fallbacks, keine Platzhalter-Venues). Spielplan-Paarungen werden als
 * subEvent-Liste ausgegeben – nur zukünftige Termine mit parsebarem Datum.
 */
export function generateEventSchema(input: EventSchemaInput = {}) {
  const startIso = parseGermanDateToIso(input.startDate);
  const endIso = parseGermanDateToIso(input.endDate);
  const place = buildPlace(input.venue, input.address);

  const today = new Date().toISOString().slice(0, 10);
  const subEvents = (input.subEvents || [])
    .map((s) => {
      if (!s.name) return null;
      const iso = parseGermanDateToIso(s.date);
      if (!iso || iso.slice(0, 10) < today) return null; // nur zukünftige, sauber datierte Spiele
      return {
        '@type': 'SportsEvent',
        name: s.name,
        startDate: iso,
        ...(s.round ? { description: s.round } : {}),
        ...(s.venue ? { location: { '@type': 'Place', name: s.venue } } : {}),
      };
    })
    .filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: input.name || 'Sport-Event',
    description: input.description || 'Exklusives Sport-Event Erlebnis mit Faltin Travel',
    ...(startIso ? { startDate: startIso } : {}),
    ...(endIso ? { endDate: endIso } : {}),
    ...(place ? { location: place } : {}),
    organizer: {
      '@type': 'Organization',
      name: input.organizerName || 'Faltin Travel',
      url: input.organizerUrl || SITE
    },
    ...(subEvents.length ? { subEvent: subEvents } : {}),
  };
}

/**
 * Product-Strukturdaten. Offer nur mit echtem Preis, aggregateRating nur mit echten
 * Bewertungsdaten (Google-Richtlinien: keine erfundenen Ratings).
 */
export function generateProductSchema(input: ProductSchemaInput = {}) {
  const price = Number(input.price || 0);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name || 'Faltin Travel Sport-Package',
    description: input.description || 'Exklusives Reisepaket inkl. Tickets, Hotel & VIP-Services',
    brand: {
      '@type': 'Brand',
      name: 'Faltin Travel'
    },
    ...(price > 0
      ? {
          offers: {
            '@type': 'Offer',
            price: String(price),
            priceCurrency: input.priceCurrency || 'EUR',
            availability: 'https://schema.org/InStock',
            url: input.url || SITE,
            seller: { '@type': 'Organization', name: 'Faltin Travel' }
          }
        }
      : {}),
    ...(input.ratingValue && input.reviewCount
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: String(input.ratingValue),
            reviewCount: String(input.reviewCount),
            bestRating: '5',
            worstRating: '1'
          }
        }
      : {}),
  };
}
