import type { Metadata } from 'next';
import { MapPin, Phone, Printer, Mail, Clock, Building2, ShieldCheck } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import EventContactForm from '@/components/EventContactForm';
import { getEventsList } from '@/lib/eventData';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Kontakt – Faltin Travel AG | Regensdorf (ZH)',
  description: 'Kontaktieren Sie Faltin Travel: Riedthofstrasse 172, 8105 Regensdorf. Tel. +41 44 700 22 77, info@faltintravel.com. Anfrage zu Events oder allgemein.',
  alternates: { canonical: '/kontakt' },
  openGraph: { title: 'Kontakt – Faltin Travel AG', description: 'Persönlich für Sie da – Mo–Fr 08:00–18:00 Uhr.', url: '/kontakt' },
};

const BLUE_GLOW: React.CSSProperties = {
  background:
    'radial-gradient(60% 95% at 12% 12%, rgba(58,124,190,0.45), transparent 60%),' +
    'radial-gradient(55% 85% at 90% 22%, rgba(34,84,143,0.40), transparent 55%),' +
    'linear-gradient(180deg, #163e63 0%, #0e2842 55%, #0c2138 100%)',
};

const MAP_QUERY = 'Riedthofstrasse 172, 8105 Regensdorf, Schweiz';

export default async function KontaktPage() {
  let eventChoices: { slug: string; name: string }[] = [];
  try {
    const events = await getEventsList();
    eventChoices = events
      .filter((e) => (e as { status?: string }).status !== 'archived')
      .map((e) => ({ slug: e.slug, name: e.name || e.title || e.slug }));
  } catch {
    eventChoices = [];
  }
  const formEvents = [{ slug: 'allgemein', name: 'Allgemeine Anfrage' }, ...eventChoices];

  const contactJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: 'Faltin Travel AG',
    telephone: '+41447002277',
    faxNumber: '+41447403327',
    email: 'info@faltintravel.com',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Riedthofstrasse 172',
      postalCode: '8105',
      addressLocality: 'Regensdorf',
      addressRegion: 'ZH',
      addressCountry: 'CH',
    },
    openingHours: 'Mo-Fr 08:00-18:00',
  };

  const legal = [
    ['Inhaber', 'Stefan Faltin'],
    ['Geschäftsführer', 'Stefan Faltin'],
    ['Sitz & Gerichtsstand', 'Regensdorf'],
    ['USt-ID', 'CHE-267.347.685 MWST'],
    ['HrID', 'CH-020.3.037.547-2'],
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactJsonLd) }} />
      <Breadcrumbs items={[{ name: 'Start', href: '/' }, { name: 'Kontakt', href: '/kontakt' }]} />

      {/* HERO */}
      <section className="px-4 py-14 text-center text-white" style={BLUE_GLOW}>
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>Kontakt</h1>
          <div className="mx-auto my-4 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
          <p className="mx-auto max-w-xl text-white/85 leading-relaxed">
            Persönlich für Sie da – ob konkrete Event-Anfrage oder allgemeine Beratung. Wir melden uns in der Regel innerhalb von 24 Stunden.
          </p>
        </div>
      </section>

      {/* MAIN */}
      <section className="px-4 py-14" style={{ background: '#f7f9fc' }}>
        <div className="container mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">

          {/* Linke Spalte: Infos + Karte */}
          <div className="space-y-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm" style={{ border: '1px solid #e5e8ed' }}>
              <h2 className="mb-5 text-xl font-extrabold" style={{ color: '#143047' }}>Faltin Travel AG</h2>
              <ul className="space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#eef3fb' }}><MapPin className="h-5 w-5" style={{ color: '#18395a' }} /></span>
                  <span className="text-gray-700"><span className="font-semibold text-gray-900">Riedthofstrasse 172</span><br />8105 Regensdorf (ZH), Schweiz</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#eef3fb' }}><Phone className="h-5 w-5" style={{ color: '#18395a' }} /></span>
                  <a href="tel:+41447002277" className="font-semibold text-gray-900 hover:text-[#d9531e] transition">+41 44 700 22 77</a>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#eef3fb' }}><Printer className="h-5 w-5" style={{ color: '#18395a' }} /></span>
                  <span className="text-gray-700">Fax: +41 44 740 33 27</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#eef3fb' }}><Mail className="h-5 w-5" style={{ color: '#18395a' }} /></span>
                  <a href="mailto:info@faltintravel.com" className="font-semibold text-gray-900 hover:text-[#d9531e] transition">info@faltintravel.com</a>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: '#fff2ea' }}><Clock className="h-5 w-5" style={{ color: '#d9531e' }} /></span>
                  <span className="text-gray-700"><span className="font-semibold text-gray-900">Öffnungszeiten</span><br />Mo – Fr 08.00 – 18.00 Uhr</span>
                </li>
              </ul>
            </div>

            {/* Karte */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: '1px solid #e5e8ed' }}>
              <iframe
                title="Standort Faltin Travel AG"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&z=15&hl=de&output=embed`}
                width="100%"
                height="280"
                style={{ border: 0, display: 'block' }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition hover:bg-slate-50"
                style={{ color: '#18395a', borderTop: '1px solid #e5e8ed' }}
              >
                <MapPin className="h-4 w-4" /> In Google Maps öffnen / Route planen
              </a>
            </div>

            {/* Rechtliches */}
            <div className="rounded-2xl bg-white p-6 shadow-sm" style={{ border: '1px solid #e5e8ed' }}>
              <div className="mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5" style={{ color: '#18395a' }} />
                <h3 className="text-base font-bold" style={{ color: '#143047' }}>Unternehmen</h3>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {legal.map(([k, v]) => (
                  <div key={k} className="flex flex-col">
                    <dt className="text-xs uppercase tracking-wide text-gray-400">{k}</dt>
                    <dd className="font-semibold text-gray-800">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-xs text-gray-600" style={{ background: '#f3f7fc' }}>
                <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: '#18395a' }} /> Teilnehmer am Schweizer Garantiefonds der Reisebranche.
              </div>
            </div>
          </div>

          {/* Rechte Spalte: Formular */}
          <div>
            <EventContactForm
              eventSlug="allgemein"
              eventName="Allgemeine Anfrage"
              events={formEvents}
              title="Schreiben Sie uns"
              intro={'Wählen Sie ein Event oder „Allgemeine Anfrage" – wir melden uns persönlich und unverbindlich bei Ihnen.'}
            />
          </div>
        </div>
      </section>
    </>
  );
}
