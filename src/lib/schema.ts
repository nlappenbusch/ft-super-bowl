import { siteConfig } from '@/lib/siteConfig';

// Domain-agnostisch: eigene URL aus NEXT_PUBLIC_SITE_URL (Fallback faltintravel.com)
const SITE = siteConfig.url.replace(/\/+$/, '');

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
}

export interface ProductSchemaInput {
  name?: string;
  description?: string;
  price?: number | string;
  priceCurrency?: string;
  url?: string;
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

export function generateEventSchema(input: EventSchemaInput = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: input.name || 'Sport-Event',
    description: input.description || 'Exklusives Sport-Event Erlebnis mit Faltin Travel',
    startDate: input.startDate || new Date().toISOString().split('T')[0],
    endDate: input.endDate || new Date().toISOString().split('T')[0],
    location: {
      '@type': 'Place',
      name: input.venue || 'Venue',
      address: {
        '@type': 'PostalAddress',
        streetAddress: input.address?.streetAddress || '',
        addressLocality: input.address?.addressLocality || '',
        addressRegion: input.address?.addressRegion || '',
        postalCode: input.address?.postalCode || '',
        addressCountry: input.address?.addressCountry || ''
      }
    },
    organizer: {
      '@type': 'Organization',
      name: input.organizerName || 'Veranstalter',
      url: input.organizerUrl || SITE
    }
  }
}

export function generateProductSchema(input: ProductSchemaInput = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name || 'Faltin Travel Sport-Package',
    description: input.description || 'Exklusives Reisepaket inkl. Tickets, Hotel & VIP-Services',
    brand: {
      '@type': 'Brand',
      name: 'Faltin Travel'
    },
    offers: {
      '@type': 'Offer',
      price: input.price || '0',
      priceCurrency: input.priceCurrency || 'EUR',
      availability: 'https://schema.org/InStock',
      url: input.url || SITE,
      seller: {
        '@type': 'Organization',
        name: 'Faltin Travel'
      }
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '150',
      bestRating: '5',
      worstRating: '1'
    }
  }
}
