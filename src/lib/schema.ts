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

export function generateOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Faltin Travel',
    url: 'https://faltintravel.com',
    logo: 'https://faltintravel.com/faltin-logo.svg',
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
    name: input.name || 'Super Bowl LXI',
    description: input.description || 'NFL Super Bowl LXI 2027 in Los Angeles',
    startDate: input.startDate || '2027-02-07',
    endDate: input.endDate || '2027-02-07',
    location: {
      '@type': 'Place',
      name: input.venue || 'SoFi Stadium',
      address: {
        '@type': 'PostalAddress',
        streetAddress: input.address?.streetAddress || '1001 Stadium Dr',
        addressLocality: input.address?.addressLocality || 'Inglewood',
        addressRegion: input.address?.addressRegion || 'CA',
        postalCode: input.address?.postalCode || '90301',
        addressCountry: input.address?.addressCountry || 'US'
      }
    },
    organizer: {
      '@type': 'Organization',
      name: input.organizerName || 'NFL',
      url: input.organizerUrl || 'https://www.nfl.com'
    }
  }
}

export function generateProductSchema(input: ProductSchemaInput = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name || 'Super Bowl LXI 2027 Package - Dream Hollywood',
    description: input.description || '4 Nächte im Dream Hollywood Hotel + Super Bowl LXI Hospitality-Ticket + VIP-Services',
    brand: {
      '@type': 'Brand',
      name: 'Faltin Travel'
    },
    offers: {
      '@type': 'Offer',
      price: input.price || '8950',
      priceCurrency: input.priceCurrency || 'CHF',
      availability: 'https://schema.org/InStock',
      url: input.url || 'https://faltintravel.com/booking',
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
