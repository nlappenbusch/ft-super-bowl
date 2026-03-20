'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CheckCircle2, Compass, Handshake, ShieldCheck, Target } from 'lucide-react';
import EkomiWidget from '@/components/EkomiWidget';
import CategoryTile from '@/components/CategoryTile';
import EventDiscoverCard, { type EventDiscoverCardData } from '@/components/EventDiscoverCard';
import { generateOrganizationSchema } from '@/lib/schema';
import { toCategorySlug } from '@/lib/category';
import { getCategoryTileStyle } from '@/lib/categoryTileConfig';

export default function Home() {
  const socialLinks = [
    {
      href: 'https://www.facebook.com/FaltinTravel/',
      src: 'https://faltintravel.com/wp-content/uploads/2020/10/Facebook_1.png',
      alt: 'Facebook'
    },
    {
      href: 'http://instagram.com/faltin_travel/?hl=de',
      src: 'https://faltintravel.com/wp-content/uploads/2020/10/Instagram_1.png',
      alt: 'Instagram'
    },
    {
      href: 'https://ch.linkedin.com/in/stefan-faltin-727a5352',
      src: 'https://faltintravel.com/wp-content/uploads/2020/10/Linkedin_1.png',
      alt: 'LinkedIn'
    },
    {
      href: 'https://faltintravel.tumblr.com',
      src: 'https://faltintravel.com/wp-content/uploads/2020/10/Tumblr_1.png',
      alt: 'Tumblr'
    },
    {
      href: 'https://twitter.com/faltintravel',
      src: 'https://faltintravel.com/wp-content/uploads/2020/10/Twitter_1.png',
      alt: 'Twitter'
    },
    {
      href: 'https://www.youtube.com/channel/UCETTVQNuO08Nww4Cldv_OJQ',
      src: 'https://faltintravel.com/wp-content/uploads/2020/10/Youtube_1.png',
      alt: 'YouTube'
    }
  ];

  const incentiveHighlights = [
    {
      title: 'Maßgeschneiderte Konzeption',
      description: 'Individuelle Reisen statt Standardprogramm.'
    },
    {
      title: 'Präzise Budgetplanung',
      description: 'Passend zu Zielgruppe, Zielen und Budgetrahmen.'
    },
    {
      title: 'Motivations-Architektur',
      description: 'Zwischenimpulse für messbar höhere Beteiligung.'
    },
    {
      title: 'Full-Service Umsetzung',
      description: 'Konzeption, Organisation und Betreuung aus einer Hand.'
    }
  ];

  const incentiveSteps = [
    {
      title: 'Analyse & Zielbild',
      description: 'Ziele, Teilnehmerprofil und Wirkung definieren.'
    },
    {
      title: 'Konzept & Destination',
      description: 'Destination, Ablauf und Budgetrahmen ausarbeiten.'
    },
    {
      title: 'Aktivierung & Dramaturgie',
      description: 'Motivationsimpulse entlang der Reise planen.'
    },
    {
      title: 'Durchführung & Wirkung',
      description: 'Umsetzung mit Nachbereitung und Erfolgsauswertung.'
    }
  ];

  const aboutStrengths = [
    {
      icon: Compass,
      title: 'Über 20 Jahre Erfahrung',
      description: 'Langjähriges Know-how als Event- und Incentive-Spezialist mit hoher Umsetzungssicherheit.'
    },
    {
      icon: Target,
      title: 'Zugang zu Top-Events',
      description: 'Optimale Zugänge zu nationalen und internationalen Sport-, Kultur- und Entertainment-Highlights.'
    },
    {
      icon: Handshake,
      title: 'Persönliche Betreuung',
      description: 'Von der Anfrage bis zur Nachbetreuung: direkte Ansprechpartner und verbindlicher Service.'
    },
    {
      icon: ShieldCheck,
      title: 'Verlässliche Sicherheit',
      description: 'Ausgewähltes Netzwerk und Absicherung über den Schweizer Garantiefonds der Reisebranche.'
    }
  ];

  const aboutFacts = [
    '20+ Jahre Erfahrung',
    'Internationales Partnernetzwerk',
    'Persönliche Beratung auf Augenhöhe'
  ];

  const [series, setSeries] = useState<
    Array<{
      id: string;
      slug: string;
      title: string;
      description?: string | null;
      category: string;
      hero_image?: string | null;
      status?: string | null;
    }>
  >([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [discoverEvents, setDiscoverEvents] = useState<EventDiscoverCardData[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [activeDiscoverFilter, setActiveDiscoverFilter] = useState('alle');

  useEffect(() => {
    const loadSeries = async () => {
      setSeriesLoading(true);
      try {
        const response = await fetch('/api/series');
        const result = await response.json();
        if (result?.success) {
          setSeries(result.data || []);
        }
      } catch (error) {
        console.error('Series load error:', error);
      } finally {
        setSeriesLoading(false);
      }
    };

    loadSeries();
  }, []);

  useEffect(() => {
    const loadDiscover = async () => {
      setDiscoverLoading(true);
      try {
        const response = await fetch('/api/discover');
        const result = await response.json();
        if (result?.success) {
          setDiscoverEvents(result.data || []);
        }
      } catch (error) {
        console.error('Discover load error:', error);
      } finally {
        setDiscoverLoading(false);
      }
    };

    loadDiscover();
  }, []);

  const activeSeries = series.filter((item) => item.status !== 'archived');
  const groupedSeries = Object.entries(
    activeSeries.reduce((groups: Record<string, typeof series>, item) => {
      const key = item.category || 'Sonstiges';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {})
  );

  const categoryTiles = groupedSeries.map(([category]) => {
    const slug = toCategorySlug(category);
    const style = getCategoryTileStyle(category);

    return {
      href: `/kategorie/${slug}`,
      title: style.title,
      description: style.description,
      image: style.image,
      panelColor: style.panelColor
    };
  });

  const discoverFilters = [
    { key: 'alle', label: 'Alle' },
    ...Array.from(
      new Map(discoverEvents.map((item) => [item.categorySlug, item.category])).entries()
    ).map(([key, label]) => ({ key, label }))
  ];

  const filteredDiscoverEvents = discoverEvents.filter((item) => {
    if (activeDiscoverFilter === 'alle') return true;
    return item.categorySlug === activeDiscoverFilter;
  });

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationSchema()) }}
      />

      <section className="py-16 px-4 relative overflow-hidden" style={{ backgroundImage: 'linear-gradient(202deg, #184a7b 0%, #143047 100%)' }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.22), transparent 55%), radial-gradient(circle at 80% 10%, rgba(241, 70, 36, 0.2), transparent 50%)'
          }}
        />
        <div className="container mx-auto relative">
          <div className="text-center mb-10">
            <div className="text-xs uppercase tracking-[0.3em] text-blue-100/80">Faltin Travel</div>
            <h1
              className="text-4xl md:text-5xl font-bold mt-3 text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Unsere Eventreise Kategorien
            </h1>
            <p className="text-blue-100/85 max-w-2xl mx-auto mt-3">
              Wählen Sie eine Kategorie und entdecken Sie passende Serien und Events.
            </p>
          </div>

          {seriesLoading && (
            <p className="text-center text-blue-100/80">Serien werden geladen...</p>
          )}

          {!seriesLoading && series.length === 0 && (
            <p className="text-center text-blue-100/80">Aktuell sind keine Serien hinterlegt.</p>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {categoryTiles.map((tile, index) => (
              <div
                key={tile.href}
                className={`ft-category-column fluent-hover h-full et_pb_column et_pb_column_1_3 et_pb_css_mix_blend_mode_passthrough${index === categoryTiles.length - 1 ? ' et_pb_column_4 et-last-child' : ''}`}
              >
                <CategoryTile
                  href={tile.href}
                  title={tile.title}
                  description={tile.description}
                  image={tile.image}
                  panelColor={tile.panelColor}
                />
              </div>
            ))}
          </div>

          <div className="mt-14">
            <div className="text-center mb-6">
              <div className="text-xs uppercase tracking-[0.3em] text-blue-100/80">Faltin Travel</div>
              <h2 className="text-3xl md:text-4xl text-white font-bold mt-3" style={{ fontFamily: 'var(--font-display)' }}>
                Events entdecken
              </h2>
              <p className="text-blue-100/85 mt-3 max-w-2xl mx-auto">
                Nach Kategorie filtern und direkt zum passenden Event gehen.
              </p>
            </div>

            <div className="flex flex-wrap gap-3 mb-7 justify-center">
              {discoverFilters.map((filter) => {
                const isActive = activeDiscoverFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveDiscoverFilter(filter.key)}
                    className={`rounded-full border px-5 py-2 text-base font-semibold transition ${
                      isActive
                        ? 'border-[#f36a2a] bg-[#f36a2a] text-white'
                        : 'border-white/15 bg-[#0f2a46]/70 text-blue-100 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            {discoverLoading && (
              <p className="text-blue-100/80">Events werden geladen...</p>
            )}

            {!discoverLoading && filteredDiscoverEvents.length === 0 && (
              <p className="text-blue-100/80">Keine Events in dieser Kategorie gefunden.</p>
            )}

            {!discoverLoading && filteredDiscoverEvents.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredDiscoverEvents.slice(0, 9).map((item) => (
                  <EventDiscoverCard key={item.id} event={item} />
                ))}
              </div>
            )}
          </div>

          <div className="mt-14 rounded-3xl border border-white/18 bg-gradient-to-br from-[#102b48] via-[#123657] to-[#184a76] p-5 sm:p-6 lg:p-7 shadow-[0_18px_42px_rgba(3,10,26,0.3)]">
            <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
              <div>
                <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-blue-100">
                  Wir über uns
                </p>
                <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  Faltin Travel AG: Mit Sicherheit ein gutes Gefühl
                </h2>
                <p className="mt-3 text-blue-100/90 leading-relaxed">
                  Als mehrfach ausgezeichneter Event- und Incentive-Spezialist mit über 20 Jahren Erfahrung profitieren
                  Sie von fundiertem Know-how, persönlicher Beratung und präziser Umsetzung. Ob Tickets, Hotels,
                  Anreise oder Programmdesign: Wir setzen auf messbare Qualität, verbindlichen Service und Erlebnisse,
                  die in Erinnerung bleiben.
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  {aboutFacts.map((fact) => (
                    <span
                      key={fact}
                      className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-blue-50"
                    >
                      {fact}
                    </span>
                  ))}
                </div>

                <div className="mt-5 border-t border-white/12 pt-4">
                  <a
                    href="https://faltintravel.com/wir-ueber-uns/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/12 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(7,18,33,0.28)] transition hover:-translate-y-0.5 hover:bg-white/18"
                  >
                    Mehr über Faltin Travel
                  </a>
                </div>

              </div>

              <div className="grid gap-3 sm:grid-cols-2 sm:grid-rows-[auto_auto]">
                <div className="sm:col-span-2 overflow-hidden rounded-2xl border border-white/12 bg-slate-900/60">
                  <Image
                    src="/Faltin-Travel-Ihr-serioeser-Partner-fuer-Events-Incentives.webp"
                    alt="Faltin Travel - Ihr seriöser Partner für Events und Incentives"
                    width={1200}
                    height={680}
                    className="h-40 w-full object-cover"
                  />
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/12 bg-slate-900/60">
                  <Image
                    src="/Faltin-TRAVEL-AG-Team.webp"
                    alt="Faltin Travel Team"
                    width={760}
                    height={760}
                    className="h-32 w-full object-cover"
                  />
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/12 bg-slate-900/60">
                  <Image
                    src="/Stefan-Faltin-Geschaeftsfuehrer-Faltin-Travel-AG.webp"
                    alt="Stefan Faltin - Geschäftsführer Faltin Travel AG"
                    width={760}
                    height={760}
                    className="h-32 w-full object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {aboutStrengths.map((point) => (
                <div key={point.title} className="rounded-2xl border border-white/12 bg-white/5 p-3">
                  <div className="flex items-start gap-2.5">
                    <point.icon className="mt-0.5 h-4.5 w-4.5 text-blue-200" />
                    <div>
                      <p className="text-sm font-semibold text-white">{point.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-blue-100/85">{point.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-gradient-to-br from-[#102b48]/78 to-[#143a5d]/72 p-5 sm:p-6">
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
              <div>
                <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-blue-100">
                  Incentive Reisen
                </p>
                <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  Motivation, die Ziele messbar erreichbar macht
                </h2>
                <p className="mt-2.5 max-w-2xl text-blue-100/85 leading-relaxed">
                  Maßgeschneiderte Incentive-Reisen mit Fokus auf Motivation, Beteiligung und messbare Wirkung.
                </p>
              </div>

              <div className="relative h-[170px] sm:h-[190px] lg:h-[210px] -mb-px z-10 pointer-events-none flex justify-start sm:ml-1 lg:ml-4">
                <Image
                  src="/Faltin-Incentives-Header.png"
                  alt="Faltin Incentive Reisen"
                  fill
                  className="object-contain object-left-bottom drop-shadow-[0_12px_24px_rgba(0,0,0,0.24)]"
                  sizes="(max-width: 1024px) 100vw, 42vw"
                />
              </div>
            </div>

            <div className="mt-0 rounded-xl border border-white/10 bg-[#0b2037]/52 p-4">
              <p className="text-sm font-semibold text-white">So läuft die Incentive-Planung ab</p>
              <ol className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-2">
                {incentiveSteps.map((step, index) => (
                  <li key={step.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-blue-100/85">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f36a2a] text-white text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-blue-100/90">
                        {incentiveHighlights[index]?.title}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white">{step.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-blue-100/75">{step.description}</p>
                    <p className="mt-1 text-xs leading-relaxed text-blue-100/65">{incentiveHighlights[index]?.description}</p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4">
              <a
                href="https://incentive-agentur.ch/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/12 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/18"
              >
                Incentive-Beratung starten
              </a>
            </div>
          </div>

        </div>
      </section>

      <footer style={{ backgroundColor: '#143047' }} className="text-gray-300 py-12 px-4">
        <div className="container mx-auto">
          <div className="mb-10 rounded-2xl border border-white/16 bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-white/[0.08] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
              <div className="shrink-0 rounded-xl bg-white p-2 border border-slate-200 shadow-[0_4px_14px_rgba(0,0,0,0.22)]">
                <Image
                  src="/RC_MatchShield_2027_RGB (1).svg"
                  alt="Ryder Cup 2027 Match Shield"
                  width={74}
                  height={74}
                  className="shrink-0"
                />
              </div>
              <div className="text-center sm:text-left">
                <p className="inline-flex items-center rounded-full border border-white/25 bg-[#0f2742]/60 px-3 py-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-blue-100">
                  Ryder Cup 2027 | Authorized Distributor
                </p>
                <p className="text-base sm:text-lg font-semibold text-white mt-2">
                  Offizieller Vertriebspartner für Ryder Cup 2027 Reisepakete
                </p>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                  Faltin Travel ist stolz darauf, als Authorized Distributor offizieller Vertriebspartner für den Ryder Cup 2027 zu sein.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-10 -mx-4 sm:-mx-6 lg:-mx-8 bg-white py-8 sm:py-10">
            <div className="px-4 sm:px-6 lg:px-8">
              <EkomiWidget
                token="sf1193615db15cb28a8dd"
                draftMode={true}
                language="de"
                className="w-full overflow-hidden"
              />
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <div>
              <h4 className="text-white font-bold mb-4">Faltin Travel AG</h4>
              <p className="text-sm">Riedthofstrasse 172</p>
              <p className="text-sm">8105 Regensdorf, Schweiz</p>
              <div className="mt-4 space-y-1 text-sm">
                <p>Tel.: <a href="tel:0041447002277" className="hover:opacity-80 transition">+41 44 700 22 77</a></p>
                <p>Fax: +41 44 740 33 27</p>
                <p>Mail: <a href="mailto:info@faltintravel.com" className="hover:opacity-80 transition">info@faltintravel.com</a></p>
              </div>
              <div className="mt-5 flex items-center gap-2.5">
                {socialLinks.map((social) => (
                  <a
                    key={social.href}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-90 hover:opacity-100 transition"
                    aria-label={social.alt}
                  >
                    <Image src={social.src} alt={social.alt} width={36} height={36} />
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Unternehmen</h4>
              <div className="text-sm space-y-1">
                <p>Inhaber: Stefan Faltin</p>
                <p>Geschäftsführer: Stefan Faltin</p>
                <p className="pt-2">Sitz und Gerichtsstand: Regensdorf</p>
                <p>USt-ID: CHE-267.347.685 MWST</p>
                <p>HrID: CH-020.3.037.547-2</p>
              </div>
              <p className="text-sm mt-4">
                <a href="https://faltintravel.com/impressum/" className="hover:opacity-80 transition">Impressum</a>
                <span className="mx-1.5 text-gray-500">|</span>
                <a href="https://faltintravel.com/allgemeine-geschaeftsbedingungen/" className="hover:opacity-80 transition">AGB</a>
                <span className="mx-1.5 text-gray-500">|</span>
                <a href="https://faltintravel.com/datenschutzerklaerung/" className="hover:opacity-80 transition">Datenschutzerklärung</a>
              </p>
            </div>
            <div className="lg:items-end lg:text-right flex flex-col gap-3">
              <Image
                src="/Schweizer-Reisegarantie-300x120-1.webp"
                alt="Schweizer Reisegarantie"
                width={240}
                height={96}
                className="h-auto"
              />
              <a href="https://specialolympics.ch/" target="_blank" rel="noopener noreferrer">
                <Image
                  src="https://faltintravel.com/wp-content/uploads/2020/11/Special-Olympics-Switzerland.png"
                  alt="Special Olympics Switzerland"
                  width={240}
                  height={73}
                  className="h-auto"
                />
              </a>
              <a href="https://www.ekomi.de/bewertungen-faltintravelcom.html" className="text-sm italic font-semibold text-gray-200 hover:text-white transition">
                Ausgezeichnet durch das eKomi Siegel Gold!
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-sm">
            <p>© 2026 Faltin Travel AG. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
