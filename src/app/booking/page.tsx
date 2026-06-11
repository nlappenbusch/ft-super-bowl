import { Suspense } from 'react';
import BookingForm from '@/components/BookingForm';
import EkomiScripts from '@/components/EkomiScripts';
import type { Metadata } from 'next';
import { siteConfig } from '@/lib/siteConfig';

const SITE = siteConfig.url.replace(/\/+$/, '');

export const metadata: Metadata = {
  title: 'Super Bowl LXI 2027 Buchung | Faltin Travel',
  description: 'Buchen Sie jetzt Ihr exklusives Super Bowl LXI 2027 Hospitality-Package. Dream Hollywood Hotel + Premium Tickets + VIP-Zugang. Schweizer Reisegarantie.',
  keywords: 'Super Bowl 2027 buchen, Super Bowl Tickets kaufen, Hospitality Package, VIP Tickets, Dream Hollywood',
  openGraph: {
    title: 'Super Bowl LXI 2027 Buchung | Faltin Travel',
    description: 'Exklusives Super Bowl Hospitality-Package buchen - Dream Hollywood + Premium Tickets',
    url: '/booking',
    siteName: 'Faltin Travel',
    images: [
      {
        url: 'https://faltintravel.com/wp-content/uploads/2025/01/Super-Bowl-LXI-Tickets.webp',
        width: 1200,
        height: 630,
        alt: 'Super Bowl LXI 2027 Tickets'
      }
    ],
    locale: 'de_DE',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/booking'
  }
};

export default function BookingPage() {
  const bookingSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    "name": "Super Bowl LXI 2027 Hospitality Package",
    "description": "Exklusives Super Bowl LXI 2027 Erlebnis mit Dream Hollywood Hotel, Premium Tickets und VIP-Zugang",
    "provider": {
      "@type": "TravelAgency",
      "name": "Faltin Travel",
      "url": "https://faltintravel.com",
      "telephone": "+41447002277",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "CH"
      }
    },
    "serviceType": "Travel Package",
    "areaServed": {
      "@type": "Country",
      "name": "Switzerland"
    },
    "offers": {
      "@type": "Offer",
      "priceCurrency": "EUR",
      "price": "8950",
      "availability": "https://schema.org/InStock",
      "validFrom": "2026-02-18",
      "url": `${SITE}/booking`
    }
  };

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(bookingSchema) }}
      />
      
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Lädt...</p>
          </div>
        </div>
      }>
        <BookingForm />
      </Suspense>
      <EkomiScripts />
    </>
  );
}
