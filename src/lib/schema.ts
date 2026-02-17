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

export function generateEventSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: 'Super Bowl LXI',
    description: 'NFL Super Bowl LXI 2027 in Los Angeles',
    startDate: '2027-02-07',
    endDate: '2027-02-07',
    location: {
      '@type': 'Place',
      name: 'SoFi Stadium',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '1001 Stadium Dr',
        addressLocality: 'Inglewood',
        addressRegion: 'CA',
        postalCode: '90301',
        addressCountry: 'US'
      }
    },
    organizer: {
      '@type': 'Organization',
      name: 'NFL',
      url: 'https://www.nfl.com'
    }
  }
}

export function generateProductSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Super Bowl LXI 2027 Package - Dream Hollywood',
    description: '4 Nächte im Dream Hollywood Hotel + Super Bowl LXI Hospitality-Ticket + VIP-Services',
    brand: {
      '@type': 'Brand',
      name: 'Faltin Travel'
    },
    offers: {
      '@type': 'Offer',
      price: '8950',
      priceCurrency: 'CHF',
      availability: 'https://schema.org/InStock',
      url: 'https://faltintravel.com/booking',
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
