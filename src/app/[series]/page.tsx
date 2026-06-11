import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Calendar, MapPin, ArrowRight, Ticket, CheckCircle2, ShieldCheck, Award, Headset } from 'lucide-react';
import { getEventsBySeriesSlug, getSeriesBySlug, getPackagesByEventSlug } from '@/lib/eventData';
import Breadcrumbs from '@/components/Breadcrumbs';
import SeriesPackages, { type SeriesPackageGroup } from '@/components/SeriesPackages';
import EventContactForm from '@/components/EventContactForm';
import EkomiWidget from '@/components/EkomiWidget';
import { siteConfig } from '@/lib/siteConfig';
import { toCategorySlug } from '@/lib/category';
import { generateFaqPageSchema } from '@/lib/schema';

interface SeriesPageProps {
  params: Promise<{ series: string }>;
}

const reservedSlugs = new Set([
  'admin', 'booking', 'events', 'embed', 'agb',
  'shortcode-test', 'wordpress-preview', 'api', 'kategorie',
  'sitemap.xml', 'robots.txt', 'manifest.webmanifest',
]);

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function formatDateRange(start?: string | null, end?: string | null) {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  const ok = (d: Date | null) => !!d && !Number.isNaN(d.getTime());
  if (ok(s) && ok(e)) {
    const sameMonth = s!.getMonth() === e!.getMonth() && s!.getFullYear() === e!.getFullYear();
    if (sameMonth) {
      const my = new Intl.DateTimeFormat('de-CH', { month: 'long', year: 'numeric' }).format(s!);
      return `${String(s!.getDate()).padStart(2, '0')}.–${String(e!.getDate()).padStart(2, '0')}. ${my}`;
    }
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  return formatDate(start || end);
}

export async function generateMetadata({ params }: SeriesPageProps): Promise<Metadata> {
  const { series } = await params;
  if (reservedSlugs.has(series)) return {};
  const seriesData = await getSeriesBySlug(series);
  if (!seriesData) return {};
  const title = `${seriesData.title} Tickets & Hospitality`;
  const canonical = `${(siteConfig.url || '').replace(/\/$/, '')}/${series}`;
  return {
    title,
    description: seriesData.description || `${seriesData.title}: Tickets, Hospitality & Reisepakete von Faltin Travel – persönliche Beratung & Schweizer Reisegarantie.`,
    alternates: { canonical },
    openGraph: {
      title,
      description: seriesData.description || undefined,
      url: canonical,
      images: seriesData.hero_image ? [{ url: seriesData.hero_image }] : undefined,
    },
  };
}

export default async function SeriesPage({ params }: SeriesPageProps) {
  const { series } = await params;
  if (reservedSlugs.has(series)) return notFound();

  const seriesData = await getSeriesBySlug(series);
  if (!seriesData) return notFound();

  const events = await getEventsBySeriesSlug(series);
  const upcoming = [...events].sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''));
  const highlights = (seriesData.highlights || []).filter(Boolean);
  const seriesFaqs = (seriesData.faqs || []).filter((f) => f && f.question);
  const guideSections = (seriesData.guide_sections || []).filter((g) => g && (g.title || g.text));

  // Packages aller Events der Serie laden
  const packagesByEvent = await Promise.all(upcoming.map((e) => getPackagesByEventSlug(e.slug)));
  const packageGroups: SeriesPackageGroup[] = upcoming
    .map((e, i) => ({
      eventSegment: e.url_segment || e.slug,
      eventName: e.title || e.name || e.slug,
      packages: (packagesByEvent[i] || []).map((p) => ({
        id: p.id,
        slug: p.slug || p.id,
        title: p.title || '',
        price: Number(p.price || 0),
        currency: p.currency || undefined,
        popular: Boolean(p.popular),
        shortDescription: p.short_description || '',
        availableSpots: p.available_spots ?? null,
      })),
    }))
    .filter((g) => g.packages.length > 0);
  const totalPackages = packageGroups.reduce((s, g) => s + g.packages.length, 0);
  const eventOptions = upcoming.map((e) => ({ slug: e.slug, name: e.title || e.name || e.slug }));

  const crumbs = [
    { name: 'Start', href: '/' },
    { name: seriesData.category || 'Events', href: `/kategorie/${toCategorySlug(seriesData.category || 'sonstiges')}` },
    { name: seriesData.title, href: `/${series}` },
  ];

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Montserrat','Open Sans',system-ui,sans-serif" }}>
      {seriesFaqs.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFaqPageSchema(seriesFaqs)) }} />
      )}
      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: 360 }}>
        {seriesData.hero_image ? (
          <div className="absolute inset-0">
            <Image src={seriesData.hero_image} alt={seriesData.title} fill className="object-cover object-center" priority />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(20,48,71,0.86), rgba(15,39,66,0.92))' }} />
          </div>
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg,#18395a 0%,#143047 100%)' }} />
        )}

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-20">
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-white"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}
          >
            {seriesData.category}
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-extrabold leading-tight text-white">{seriesData.title}</h1>
          {seriesData.description && (
            <p className="mt-5 max-w-3xl text-lg md:text-xl leading-relaxed text-white/85">{seriesData.description}</p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-white/80">
            <span className="inline-flex items-center gap-1.5"><Ticket className="h-4 w-4" style={{ color: '#f5c842' }} /> {events.length} {events.length === 1 ? 'Event' : 'Events'}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" style={{ color: '#f5c842' }} /> Hospitality & Reisepakete</span>
          </div>
          <div className="mt-7">
            <a
              href="#anfrage"
              className="inline-flex items-center gap-2 rounded-sm px-7 py-3.5 text-base font-bold text-white shadow-lg transition-all hover:opacity-90 hover:scale-[1.02]"
              style={{ background: '#d9531e' }}
            >
              Unverbindlich anfragen <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </div>
      </section>

      {/* ── TRUST-BAND ───────────────────────────────────────────────────── */}
      <section className="px-4 py-5" style={{ background: '#0f2742' }}>
        <div className="mx-auto flex max-w-6xl flex-col flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-semibold text-white/85 sm:flex-row">
          <span className="inline-flex items-center gap-2"><ShieldCheck className="h-5 w-5" style={{ color: '#f5c842' }} /> Schweizer Reisegarantie</span>
          <span className="inline-flex items-center gap-2"><Award className="h-5 w-5" style={{ color: '#f5c842' }} /> Offizielle Hospitality-Tickets</span>
          <span className="inline-flex items-center gap-2"><Headset className="h-5 w-5" style={{ color: '#f5c842' }} /> Persönliche Beratung · 20+ Jahre Erfahrung</span>
        </div>
      </section>

      <Breadcrumbs items={crumbs} />

      {/* ── INTRO / HIGHLIGHTS (Evergreen-Hub) ───────────────────────────── */}
      <section className="bg-white px-4 pt-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-9 text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold leading-tight" style={{ color: '#143047' }}>
              {seriesData.title} Tickets, Hospitality &amp; Reisepakete
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-gray-600">
              Offizielle Tickets, erstklassige Hospitality und sorgenfreie Reisepakete – persönlich für Sie zusammengestellt.
            </p>
          </div>
          {(seriesData.intro_text || highlights.length > 0) && (
            <div className="grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-start">
              {seriesData.intro_text && (
                <div className="whitespace-pre-line text-base md:text-lg leading-relaxed text-gray-700">
                  {seriesData.intro_text}
                </div>
              )}
              {highlights.length > 0 && (
                <div className="rounded-2xl p-6" style={{ background: '#f5f7fa', border: '1px solid #e5e8ed' }}>
                  <div className="mb-4 text-sm font-bold uppercase tracking-wider" style={{ color: '#143047' }}>Das erwartet Sie</div>
                  <ul className="space-y-2.5">
                    {highlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-gray-700">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#d9531e' }} />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          </div>
        </section>

      {/* ── WARUM FALTIN TRAVEL ──────────────────────────────────────────── */}
      <section className="bg-white px-4 pb-4 pt-10">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-8 text-center text-2xl md:text-3xl font-extrabold" style={{ color: '#143047' }}>Warum {seriesData.title} mit Faltin Travel?</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Award className="h-6 w-6" />, title: 'Offizielle Hospitality-Tickets', text: 'Verbindliche Kategorie-1-Plätze & Hospitality-Zugang aus offiziellen Kontingenten.' },
              { icon: <ShieldCheck className="h-6 w-6" />, title: 'Schweizer Reisegarantie', text: 'Abgesicherte Buchung nach Schweizer Standard – Ihr Geld ist geschützt.' },
              { icon: <Headset className="h-6 w-6" />, title: 'Persönliche Beratung', text: 'Ein fester Ansprechpartner plant Ihre Reise von der Anfrage bis zur Rückkehr.' },
              { icon: <Ticket className="h-6 w-6" />, title: 'Alles aus einer Hand', text: 'Tickets, Hotel, Transfers & VIP-Service als sorgenfreies Komplettpaket.' },
            ].map((b) => (
              <div key={b.title} className="rounded-2xl p-6" style={{ background: '#f5f7fa', border: '1px solid #e5e8ed' }}>
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: '#143047', color: '#f5c842' }}>{b.icon}</div>
                <div className="font-bold" style={{ color: '#143047' }}>{b.title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── EVENTS ───────────────────────────────────────────────────────── */}
      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Eventauswahl</div>
              <h2 className="mt-2 text-3xl md:text-4xl font-extrabold" style={{ color: '#143047' }}>Events in dieser Serie</h2>
              <p className="mt-2 text-gray-600">Wählen Sie ein Event und entdecken Sie Tickets, Hospitality-Kategorien und Packages.</p>
            </div>
          </div>

          {upcoming.length === 0 ? (
            <div className="rounded-2xl border border-dashed py-16 text-center text-gray-500" style={{ borderColor: '#e5e8ed' }}>
              Aktuell sind keine Events hinterlegt – melden Sie sich für eine individuelle Anfrage.
            </div>
          ) : (
            <div className={`grid gap-7 ${upcoming.length === 1 ? 'max-w-xl sm:grid-cols-1' : upcoming.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
              {upcoming.map((event) => {
                const dateLabel = formatDateRange(event.start_date, event.end_date);
                const locationLabel = [event.location_city, event.location_region, event.location_country].filter(Boolean).join(', ');
                const img = event.hero_image || event.ticket_image || seriesData.hero_image || '';
                const seg = event.url_segment || event.slug;
                const grp = packageGroups.find((g) => g.eventSegment === seg);
                const prices = grp ? grp.packages.map((p) => p.price).filter((p) => p > 0) : [];
                const minPrice = prices.length ? Math.min(...prices) : 0;
                const catCount = (event.ticket_categories || []).length;
                const leistCount = (event.leistungen_items || []).length;
                return (
                  <Link
                    key={event.id}
                    href={`/${series}/${seg}`}
                    className="group flex flex-col overflow-hidden rounded-2xl bg-white transition-all hover:-translate-y-1 hover:shadow-xl"
                    style={{ border: '1px solid #e5e8ed', boxShadow: '0 2px 10px rgba(20,48,71,0.06)' }}
                  >
                    <div className="relative h-52 w-full overflow-hidden bg-gray-100">
                      {img ? (
                        <Image src={img} alt={event.title || event.name || 'Event'} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="h-full w-full" style={{ background: 'linear-gradient(135deg,#18395a,#143047)' }} />
                      )}
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(20,48,71,0.55))' }} />
                      {dateLabel && (
                        <span className="absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: '#d9531e' }}>
                          {dateLabel}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <div className="text-xl font-extrabold leading-snug" style={{ color: '#143047' }}>{event.title || event.name}</div>
                      {event.description && (
                        <p className="mt-2 text-sm leading-relaxed text-gray-600 line-clamp-2">{event.description}</p>
                      )}
                      <div className="mt-4 space-y-2 text-sm text-gray-600">
                        <div className="flex items-center gap-2"><Calendar className="h-4 w-4 shrink-0" style={{ color: '#18395a' }} /> {dateLabel || 'Termin folgt'}</div>
                        <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#d9531e' }} /> {[event.venue, locationLabel].filter(Boolean).join(' · ') || 'Ort folgt'}</div>
                      </div>
                      {(minPrice > 0 || catCount > 0 || leistCount > 0) && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {minPrice > 0 && (
                            <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: '#fff1ea', color: '#d9531e' }}>ab CHF {minPrice.toLocaleString('de-CH')}</span>
                          )}
                          {catCount > 0 && (
                            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#eef2f7', color: '#143047' }}>{catCount} Ticket-Kategorien</span>
                          )}
                          {leistCount > 0 && (
                            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#eef2f7', color: '#143047' }}>{leistCount} Leistungen</span>
                          )}
                        </div>
                      )}
                      <div className="mt-auto pt-5 inline-flex items-center gap-2 text-sm font-bold" style={{ color: '#d9531e' }}>
                        Zum Event <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* SEO / Info text */}
          {(seriesData.seo_text || seriesData.description) && (
            <div className="mt-16 rounded-2xl p-8" style={{ background: '#f5f7fa', border: '1px solid #e5e8ed' }}>
              <h3 className="text-xl font-extrabold" style={{ color: '#143047' }}>Über {seriesData.title}</h3>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-gray-700">{seriesData.seo_text || seriesData.description}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── PACKAGES DER SERIE ───────────────────────────────────────────── */}
      {totalPackages > 0 && (
        <section className="px-4 py-16" style={{ background: '#f5f7fa', borderTop: '1px solid #e5e8ed' }}>
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 text-center">
              <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: '#143047' }}>Alle Packages der Serie</h2>
              <p className="mx-auto mt-2 max-w-2xl text-gray-600">Filtern Sie nach Event – jedes Package ist klar zugeordnet. Ein Klick führt direkt zu Details &amp; Buchung.</p>
            </div>
            <SeriesPackages seriesSlug={series} groups={packageGroups} />
          </div>
        </section>
      )}

      {/* ── REDAKTIONELLER GUIDE ─────────────────────────────────────────── */}
      {guideSections.length > 0 && (
        <section className="bg-white px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-10 text-center text-3xl md:text-4xl font-extrabold" style={{ color: '#143047' }}>{seriesData.title} – Guide &amp; Tipps</h2>
            <div className="space-y-10">
              {guideSections.map((g, i) => (
                <div key={i} className="border-l-4 pl-6" style={{ borderColor: '#d9531e' }}>
                  <h3 className="text-xl md:text-2xl font-extrabold" style={{ color: '#143047' }}>{g.title}</h3>
                  <div className="mt-3 whitespace-pre-line text-base leading-relaxed text-gray-700">{g.text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ (Serie) ──────────────────────────────────────────────────── */}
      {seriesFaqs.length > 0 && (
        <section className="px-4 py-16" style={{ background: 'radial-gradient(60% 95% at 12% 12%, rgba(58,124,190,0.45), transparent 60%), radial-gradient(55% 85% at 90% 22%, rgba(34,84,143,0.40), transparent 55%), linear-gradient(180deg,#163e63 0%,#0c2138 100%)' }}>
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-3xl md:text-4xl font-extrabold leading-tight text-white">Häufige Fragen zu {seriesData.title}</h2>
            <div className="space-y-3">
              {seriesFaqs.map((faq, idx) => (
                <details key={idx} className="group overflow-hidden rounded-xl [&_summary::-webkit-details-marker]:hidden" style={{ border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)' }}>
                  <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 font-semibold text-base md:text-lg text-white select-none transition hover:bg-white/5">
                    <span className="leading-snug">{faq.question}</span>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 group-open:rotate-180" style={{ borderColor: 'rgba(255,255,255,0.45)', color: '#fff' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="h-4 w-4"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                    </div>
                  </summary>
                  <div className="whitespace-pre-line px-5 pb-5 pt-1 text-sm md:text-base leading-relaxed text-white/80">{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── KUNDENSTIMMEN (eKomi) ────────────────────────────────────────── */}
      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 text-center text-3xl md:text-4xl font-extrabold" style={{ color: '#143047' }}>Das sagen unsere Kunden</h2>
          <p className="mb-8 text-center text-gray-600">Ausgezeichnet durch das eKomi Gold-Siegel.</p>
          <EkomiWidget token="sf1193616993086c0b0e7" className="min-h-[120px]" />
        </div>
      </section>

      {/* ── ANFRAGE (mit Event-Auswahl) ──────────────────────────────────── */}
      <section id="anfrage" className="scroll-mt-28 px-4 py-16" style={{ background: 'radial-gradient(70% 100% at 50% 0%, rgba(58,124,190,0.30), transparent 60%), linear-gradient(180deg,#143e63,#0c2138)' }}>
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white/80">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#d9531e' }} /> Unverbindlich &amp; kostenlos
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold leading-tight text-white">
              Bereit für Ihr {seriesData.title}-Erlebnis?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">
              Sagen Sie uns Ihr Wunsch-Event und Ihre Vorstellungen – wir erstellen Ihnen ein massgeschneidertes Angebot. Antwort in der Regel innerhalb von 24 Stunden.
            </p>
          </div>
          <EventContactForm
            eventSlug={eventOptions[0]?.slug || series}
            eventName={seriesData.title}
            events={eventOptions.length > 0 ? eventOptions : undefined}
            title={totalPackages > 0 ? 'Individuelle Anfrage' : `Anfrage für ${seriesData.title}`}
            intro={
              totalPackages > 0
                ? 'Nichts Passendes dabei oder offene Fragen? Wählen Sie Ihr Event – wir erstellen Ihnen ein massgeschneidertes Angebot.'
                : 'Stellen Sie unverbindlich Ihre Anfrage. Wählen Sie Ihr Wunsch-Event und wir melden uns mit einem individuellen Angebot.'
            }
          />
        </div>
      </section>
    </div>
  );
}
