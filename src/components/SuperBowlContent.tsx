'use client';

import Image from 'next/image';
import { Calendar, MapPin, Users, CheckCircle2 } from 'lucide-react';
import PackageCard from '@/components/PackageCard';
import FAQ from '@/components/FAQ';
import CTAButton from '@/components/CTAButton';
import { generateEventSchema, generateProductSchema } from '@/lib/schema';

export default function SuperBowlContent() {
  const packages = [
    {
      id: 'dream_hollywood',
      stars: 4,
      nights: 4,
      price: 8950,
      title: 'Dream Hollywood, by Hyatt',
      description: 'Boutique-Hotel im Herzen von Hollywood mit Rooftop-Pool und Blick auf das Hollywood Sign',
      hotel: 'Dream Hollywood, by Hyatt',
      popular: true
    }
  ];

  const services = [
    '4x Übernachtung im Dream Hollywood, by Hyatt Hotel (12.-16. Februar 2027)',
    'Hospitality-Ticket für den Super Bowl LXI im 500er Level',
    'Offizieller Zugang zur Pregame-Party mit Catering & Getränken',
    'Separater VIP-Eingang zum Stadion',
    'Live-Entertainment im Hospitality-Bereich',
    'Los Angeles Reiseführer mit Stadtplan',
    'Personalisiertes Super Bowl Präsent',
    'Ticket-Lanyard, Tickettasche, Reisebeutel & Kofferanhänger',
    'Detaillierte Reiseinformation',
    'Schweizer Reisegarantie'
  ];

  return (
    <>
      {/* SEO: Structured Data (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateEventSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateProductSchema()) }}
      />

      {/* Hero Section */}
      <section className="relative min-h-125 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <Image 
            src="/header-neu1260-1.webp" 
            alt="Super Bowl LXI 2027 - SoFi Stadium Los Angeles" 
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-linear-to-r from-black/70 to-black/40"></div>
        </div>
        
        <div className="relative z-10 container mx-auto px-4 text-white text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Super Bowl LXI 2027 Tickets & Packages
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto">
            Erleben Sie das größte Sportevent der Welt live im SoFi Stadium, Los Angeles
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm md:text-base">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
              <Calendar className="w-5 h-5" />
              <span>7. Februar 2027</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
              <MapPin className="w-5 h-5" />
              <span>SoFi Stadium, Los Angeles</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
              <Users className="w-5 h-5" />
              <span>Inkl. Hotel & VIP-Access</span>
            </div>
          </div>
        </div>
      </section>

      {/* Package Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#184a7b' }}>
              Unser Super Bowl Package
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Komplettpaket mit Hotel, Tickets und exklusiven VIP-Services
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            {packages.map(pkg => (
              <PackageCard key={pkg.id} {...pkg} />
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#184a7b' }}>
              Im Package enthalten
            </h2>
            <p className="text-lg text-gray-600">
              Vollständiges Rundum-Sorglos-Paket für Ihr Super Bowl Erlebnis
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
            {services.map((service, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
                <span className="text-gray-700">{service}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hotel Images Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center" style={{ color: '#184a7b' }}>
            Dream Hollywood Hotel
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {['540997872.jpg', '540998091.jpg', '568783347.jpg', '568783397.jpg', '59733df7.webp', 'Inter.png'].map((img, idx) => (
              <div key={idx} className="relative aspect-video rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition">
                <Image
                  src={`/bilder-hotel/${img}`}
                  alt={`Dream Hollywood Hotel - Impression ${idx + 1}`}
                  fill
                  className="object-cover hover:scale-105 transition duration-300"
                  sizes="(max-width: 768px) 50vw, 33vw"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ticket Categories Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center" style={{ color: '#184a7b' }}>
            Ticket-Kategorien & Stadionplan
          </h2>
          <div className="max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-lg overflow-hidden shadow-xl mb-8">
              <Image
                src="/Super-Bowl-2027-Ticketkategorien-SoFi-Stadium.webp"
                alt="Super Bowl 2027 Ticket-Kategorien im SoFi Stadium"
                fill
                className="object-contain bg-gray-100"
                sizes="(max-width: 1024px) 100vw, 1024px"
              />
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-600 p-6 rounded">
              <h3 className="font-bold text-lg mb-2" style={{ color: '#184a7b' }}>Unser Package beinhaltet:</h3>
              <p className="text-gray-700">
                <strong>Hospitality-Ticket im 500er Level</strong> mit exklusivem Zugang zur Pregame-Party, 
                VIP-Eingang, Premium-Catering und Live-Entertainment im Hospitality-Bereich.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <FAQ />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#184a7b' }}>
              Jetzt Super Bowl Package sichern
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Limitierte Verfügbarkeit - Buchen Sie jetzt Ihr unvergessliches Super Bowl Erlebnis
            </p>
            <CTAButton href="/booking">
              Jetzt Super Bowl Package buchen
            </CTAButton>
            
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color: '#184a7b' }}>4.8/5</div>
                <div className="text-sm text-gray-600">Kundenbewertung</div>
              </div>
              <div className="hidden sm:block w-px h-12 bg-gray-300"></div>
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ color: '#184a7b' }}>15+</div>
                <div className="text-sm text-gray-600">Jahre Erfahrung</div>
              </div>
              <div className="hidden sm:block w-px h-12 bg-gray-300"></div>
              <div className="text-center">
                <Image 
                  src="/Schweizer-Reisegarantie-300x120-1.webp" 
                  alt="Schweizer Reisegarantie" 
                  width={90} 
                  height={36}
                  className="mx-auto"
                />
                <div className="text-sm text-gray-600 mt-1">Geschützt</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
