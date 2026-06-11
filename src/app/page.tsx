'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { CheckCircle2, Compass, Handshake, ShieldCheck, Target } from 'lucide-react';
import CategoryTile from '@/components/CategoryTile';
import EventDiscoverCard, { type EventDiscoverCardData } from '@/components/EventDiscoverCard';
import { generateOrganizationSchema } from '@/lib/schema';
import { toCategorySlug } from '@/lib/category';
import { getCategoryTileStyle } from '@/lib/categoryTileConfig';

export default function Home() {
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

  const incentiveSteps = ['Analyse & Zielbild', 'Konzept & Destination', 'Aktivierung & Dramaturgie', 'Durchführung & Wirkung'];

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

      {/* Hero Banner – hinter die Navbar gezogen */}
      <section className="relative w-full overflow-hidden bg-[#0d1f33]">
        <Image
          src="/Faltin Travel Header.jpg"
          alt="Faltin Travel – Tickets & Reisepakete für Sport- und Kulturevents"
          width={1920}
          height={600}
          priority
          className="w-full h-auto block"
        />
        {/* Gradient der nahtlos in die nächste Section übergeht */}
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-[#143047] via-[#143047]/60 to-transparent pointer-events-none" />
        {/* Scroll-Chevron */}
        <button
          type="button"
          onClick={() => document.getElementById('kategorien')?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 group cursor-pointer z-10"
          aria-label="Zu den Kategorien scrollen"
        >
          <svg className="w-8 h-8 text-[#f36a2a] group-hover:text-[#f57d43] transition-colors duration-200 animate-[float_1.8s_ease-in-out_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </section>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(5px); }
        }
      `}</style>

      <section id="kategorien" className="pt-12 pb-16 px-4 relative overflow-hidden" style={{ backgroundImage: 'linear-gradient(180deg, #143047 0%, #184a7b 100%)' }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgba(59, 130, 246, 0.22), transparent 55%), radial-gradient(circle at 80% 10%, rgba(241, 70, 36, 0.2), transparent 50%)'
          }}
        />
        <div className="container mx-auto relative">
          <div className="text-center mb-10">
            <h1
              className="text-4xl md:text-5xl font-bold text-white text-balance"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Sportreisen, Event-Tickets & Hospitality-Pakete
            </h1>
            <p className="text-blue-100/85 max-w-3xl mx-auto mt-4 text-lg text-pretty">
              Von Super Bowl über die French Open bis zum Champions-League-Finale: offizielle Tickets samt Hotel,
              Anreise und persönlicher Betreuung – aus einer Hand und abgesichert über den Schweizer Garantiefonds.
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
              <h2 className="text-3xl md:text-4xl text-white font-bold text-balance" style={{ fontFamily: 'var(--font-display)' }}>
                Ihr nächstes Live-Erlebnis
              </h2>
              <p className="text-blue-100/85 mt-3 max-w-2xl mx-auto text-lg text-pretty">
                Offizielle Tickets, limitierte Kontingente und faire Preise – filtern Sie nach Kategorie und
                fragen Sie Ihr Wunsch-Event unverbindlich an.
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

          {/* ── Wir über uns ── */}
          <div className="mt-14 overflow-hidden rounded-3xl bg-[#0e2a47] border border-white/10" style={{ borderTop: '4px solid #f36a2a' }}>
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[#f5a07a]">Wir über uns</p>
                <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white text-balance" style={{ fontFamily: 'var(--font-display)' }}>
                  Faltin Travel AG: Mit Sicherheit ein gutes Gefühl
                </h2>
                <p className="mt-4 text-blue-100/90 leading-relaxed text-lg text-pretty">
                  Als mehrfach ausgezeichneter Event- und Incentive-Spezialist mit über 20 Jahren Erfahrung profitieren
                  Sie von fundiertem Know-how, persönlicher Beratung und präziser Umsetzung – von Tickets über Hotel
                  und Anreise bis zum kompletten Programmdesign.
                </p>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  {aboutFacts.map((fact) => (
                    <span
                      key={fact}
                      className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-blue-50"
                    >
                      {fact}
                    </span>
                  ))}
                </div>

                <div className="mt-6">
                  <Link
                    href="/ueber-uns"
                    className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/20"
                  >
                    Mehr über Faltin Travel
                  </Link>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl">
                <Image
                  src="/Faltin-Travel-Ihr-serioeser-Partner-fuer-Events-Incentives.webp"
                  alt="Faltin Travel – Ihr seriöser Partner für Events und Incentives"
                  width={1200}
                  height={760}
                  className="h-64 lg:h-full w-full object-cover"
                />
              </div>
            </div>

            <div className="grid gap-x-6 gap-y-6 border-t border-white/10 px-6 py-7 sm:px-8 sm:grid-cols-2 lg:grid-cols-4">
              {aboutStrengths.map((point) => (
                <div key={point.title} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f36a2a]/15">
                    <point.icon className="h-5 w-5 text-[#f5a07a]" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{point.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-blue-100/80 text-pretty">{point.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Incentive Reisen ── */}
          <div className="mt-10 overflow-hidden rounded-3xl bg-[#11324f] border border-white/10" style={{ borderLeft: '5px solid #f36a2a' }}>
            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] font-semibold text-[#f5a07a]">Incentive Reisen</p>
                <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white text-balance" style={{ fontFamily: 'var(--font-display)' }}>
                  Motivation, die Ziele messbar erreichbar macht
                </h2>
                <p className="mt-3 max-w-2xl text-blue-100/90 leading-relaxed text-lg text-pretty">
                  Maßgeschneiderte Incentive-Reisen mit Fokus auf Motivation, Beteiligung und messbare Wirkung –
                  Konzeption, Organisation und Betreuung aus einer Hand.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-blue-100/80">
                  <span className="font-semibold text-white">So läuft es ab:</span>
                  {incentiveSteps.map((step, i) => (
                    <span key={step} className="inline-flex items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#f36a2a] text-white text-[10px] font-bold">{i + 1}</span>
                      {step}
                    </span>
                  ))}
                </div>

                <div className="mt-6">
                  <a
                    href="https://incentive-agentur.ch/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-full bg-[#f36a2a] px-6 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(243,106,42,0.35)] transition hover:-translate-y-0.5 hover:bg-[#f57d43]"
                  >
                    Incentive-Beratung starten
                  </a>
                </div>
              </div>

              <div className="relative h-[180px] sm:h-[210px] lg:h-[240px] pointer-events-none flex justify-center">
                <Image
                  src="/Faltin-Incentives-Header.png"
                  alt="Faltin Incentive Reisen"
                  fill
                  className="object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.24)]"
                  sizes="(max-width: 1024px) 100vw, 42vw"
                />
              </div>
            </div>

            <div className="grid gap-4 border-t border-white/10 px-6 py-7 sm:px-8 sm:grid-cols-2 lg:grid-cols-4">
              {incentiveHighlights.map((h) => (
                <div key={h.title} className="rounded-xl bg-white/[0.06] p-4" style={{ borderLeft: '2px solid #f36a2a' }}>
                  <CheckCircle2 className="h-5 w-5 text-[#f5a07a]" />
                  <p className="mt-2 text-sm font-semibold text-white text-balance">{h.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-blue-100/80 text-pretty">{h.description}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
