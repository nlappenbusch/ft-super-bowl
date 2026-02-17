'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Users, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import PackageCard from '@/components/PackageCard';
import FAQ from '@/components/FAQ';
import CTAButton from '@/components/CTAButton';
import EkomiScripts from '@/components/EkomiScripts';
import { generateOrganizationSchema, generateEventSchema, generateProductSchema } from '@/lib/schema';

export default function Home() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);

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
    <div className="min-h-screen">
      {/* SEO: Structured Data (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateEventSchema()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateProductSchema()) }}
      />
      
      {/* Backdrop when menu is open */}
      {openMenu && (
        <div 
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setOpenMenu(null)}
        />
      )}
      
      {/* Sticky Header */}
      <header style={{ backgroundImage: 'linear-gradient(202deg, #184a7b 0%, #143047 100%)' }} className="text-white sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="https://faltintravel.com" className="flex items-center">
              <Image src='/faltin-logo.svg' alt='Faltin Travel - Tickets zu Sportreisen' width={120} height={38} />
            </Link>
            <div className="hidden xl:flex gap-5 text-sm font-semibold items-center">
              <Link href="https://faltintravel.com" className="hover:opacity-80 transition">Home</Link>
              
              {/* Sportevents Mega Menu */}
              <div className="relative">
                <button 
                  onClick={() => setOpenMenu(openMenu === 'sport' ? null : 'sport')}
                  className="hover:opacity-80 transition flex items-center gap-1"
                >
                  Sportevents
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              {/* Kulturevents Mega Menu */}
              <div className="relative">
                <button 
                  onClick={() => setOpenMenu(openMenu === 'kultur' ? null : 'kultur')}
                  className="hover:opacity-80 transition flex items-center gap-1"
                >
                  Kulturevents
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              
              <Link href="https://incentive-agentur.ch/" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition">Incentive</Link>
              <Link href="https://faltintravel.com/wir-ueber-uns/" className="hover:opacity-80 transition">Über uns</Link>
              <Link href="https://faltintravel.com/kontakt/" className="hover:opacity-80 transition">Kontakt</Link>
              <Link href="https://www.garantiefonds.ch/teilnehmer/teilnehmer-am-garantiefonds" target="_blank" rel="noopener noreferrer" className="ml-2">
                <Image src="/reisegarantielogo-de-768x258.webp" alt="Schweizer Reisegarantie" width={60} height={24} className="opacity-90 hover:opacity-100 transition" />
              </Link>
              <span className="text-gray-300">|</span>
              <Link href="/booking" className="px-4 py-2 rounded-lg transition font-bold" style={{ backgroundColor: '#f14624', color: 'white' }}>
                Jetzt buchen
              </Link>
            </div>
            
            {/* Mobile Menu Button */}
            <button className="xl:hidden flex flex-col gap-1.5" aria-label="Menu">
              <span className="w-6 h-0.5 bg-white"></span>
              <span className="w-6 h-0.5 bg-white"></span>
              <span className="w-6 h-0.5 bg-white"></span>
            </button>
          </div>
        </div>
      </header>

      {/* Mega Menu Dropdowns */}
      {openMenu === 'sport' && (
        <div className="fixed left-0 right-0 z-40" style={{ top: '64px' }}>
          <div className="container mx-auto px-4 pt-2">
            <div className="bg-white text-gray-800 rounded-lg shadow-2xl p-6 max-w-5xl">
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <h3 className="font-bold mb-3" style={{ color: '#184a7b' }}>Fussball</h3>
                  <Link href="https://faltintravel.com/champions-league-finale-tickets/" className="block py-1.5 text-xs hover:text-orange-600 transition">Champions League Finale</Link>
                  <Link href="https://faltintravel.com/premier-league-tickets/" className="block py-1.5 text-xs hover:text-orange-600 transition">Premier League</Link>
                </div>
                <div>
                  <h3 className="font-bold mb-3" style={{ color: '#184a7b' }}>Tennis</h3>
                  <Link href="https://faltintravel.com/wimbledon-tickets/" className="block py-1.5 text-xs hover:text-orange-600 transition">Wimbledon 2026</Link>
                  <Link href="https://faltintravel.com/french-open-tickets/" className="block py-1.5 text-xs hover:text-orange-600 transition">French Open 2026</Link>
                </div>
                <div>
                  <h3 className="font-bold mb-3" style={{ color: '#184a7b' }}>Motorsport</h3>
                  <Link href="https://faltintravel.com/formel-1-tickets/" className="block py-1.5 text-xs hover:text-orange-600 transition">Formel 1 2025</Link>
                  <Link href="https://faltintravel.com/monaco-grand-prix-tickets/" className="block py-1.5 text-xs hover:text-orange-600 transition">Monaco Grand Prix</Link>
                </div>
                <div>
                  <h3 className="font-bold mb-3" style={{ color: '#184a7b' }}>Weitere</h3>
                  <Link href="https://faltintravel.com/super-bowl-2027-tickets/" className="block py-1.5 text-xs hover:text-orange-600 transition font-bold">Super Bowl 2027</Link>
                  <Link href="https://faltintravel.com/olympia-2028-tickets/" className="block py-1.5 text-xs hover:text-orange-600 transition">Olympia 2028</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {openMenu === 'kultur' && (
        <div className="fixed left-0 right-0 z-40" style={{ top: '64px' }}>
          <div className="container mx-auto px-4 pt-2">
            <div className="bg-white text-gray-800 rounded-lg shadow-2xl p-4 max-w-xs">
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold mb-2 text-sm" style={{ color: '#184a7b' }}>Klassik</h3>
                  <Link href="https://faltintravel.com/neujahrskonzert-tickets/" className="block py-1 text-xs hover:text-orange-600 transition">Neujahrskonzert 2027</Link>
                  <Link href="https://faltintravel.com/wiener-opernball-tickets/" className="block py-1 text-xs hover:text-orange-600 transition">Wiener Opernball</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section style={{ backgroundImage: 'linear-gradient(202deg, #184a7b 0%, #143047 100%)' }} className="relative text-white py-12 px-4">
        <div className="container mx-auto relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-3">
              Super Bowl LXI 2027
            </h1>
            <p className="text-lg md:text-xl mb-2 opacity-90">
              14. Februar 2027 • SoFi Stadium, Inglewood / Los Angeles
            </p>
            <p className="text-base mb-6 opacity-80 max-w-2xl mx-auto">
              Erleben Sie das größte Sportevent der Welt live mit exklusiven Paketen, 
              Top-Sitzplätzen und VIP-Service.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-6 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>14. Februar 2027</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>Inglewood, LA</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>70.000+ Zuschauer</span>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <CTAButton href="/booking">
                Jetzt buchen
              </CTAButton>
              <Link href="#pakete" className="inline-block px-8 py-3 bg-white text-gray-900 rounded-lg font-semibold hover:bg-gray-100 transition">
                Paket ansehen
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section id="pakete" className="py-12 px-4 bg-gray-50">
        <div className="container mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold mb-3 text-gray-900">
              Unser Reisepaket
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Exklusives Super Bowl Erlebnis mit Hospitality-Package
            </p>
          </div>
          
          <div className="max-w-2xl mx-auto">
            {packages.map((pkg) => (
              <PackageCard key={pkg.id} {...pkg} />
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="leistungen" className="py-12 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 text-gray-900">
            Eingeschlossene Leistungen
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {services.map((service, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                <span className="text-gray-700">{service}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-16 px-4 bg-gray-50">
        <div className="container mx-auto max-w-4xl">
          <h3 className="text-4xl font-bold text-center mb-4 text-gray-900">
            Häufig gestellte Fragen
          </h3>
          <FAQ />
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: '#143047' }} className="text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-white font-bold mb-4">Faltin Travel AG</h4>
              <p className="text-sm">Riedthofstrasse 172</p>
              <p className="text-sm">8105 Regensdorf, Schweiz</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Kontakt</h4>
              <p className="text-sm">TEL: +41 44 700 22 77</p>
              <p className="text-sm">info@faltintravel.com</p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Rechtliches</h4>
              <ul className="text-sm space-y-2">
                <li><Link href="/impressum" className="hover:opacity-80 transition">Impressum</Link></li>
                <li><Link href="/datenschutz" className="hover:opacity-80 transition">Datenschutz</Link></li>
                <li><Link href="/agb" className="hover:opacity-80 transition">AGB</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Geschäftsführung</h4>
              <p className="text-sm">Inhaber: Stefan Faltin</p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm">
            <p>© 2026 Faltin Travel AG. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
      
      <EkomiScripts />
    </div>
  );
}
