import type { Metadata } from 'next';
import Breadcrumbs from '@/components/Breadcrumbs';
import EventCalendar, { type CalEvent } from '@/components/EventCalendar';
import { getEventsList, getSeriesList } from '@/lib/eventData';
import { siteConfig } from '@/lib/siteConfig';

export const revalidate = 3600;

const SITE = siteConfig.url.replace(/\/+$/, '');
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function parseDate(s?: string | null): Date | null {
  const t = (s || '').trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(`${t.slice(0, 10)}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const g = new Date(t);
  return isNaN(g.getTime()) ? null : g;
}
const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const metadata: Metadata = {
  title: 'Event-Kalender – kommende Sport- & Eventreisen',
  description: 'Alle kommenden Events auf einen Blick: Termine, Countdown und Reisepakete von Faltin Travel – übersichtlich im Zeitstrahl.',
  alternates: { canonical: '/kalender' },
  openGraph: { title: 'Event-Kalender | Faltin Travel', description: 'Kommende Events mit Terminen & Countdown im Überblick.', url: '/kalender' },
};

async function buildCalendar(): Promise<CalEvent[]> {
  const [events, series] = await Promise.all([getEventsList(), getSeriesList()]);
  const seriesById = new Map(series.map((s) => [s.id, s]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cal: CalEvent[] = [];
  for (const e of events) {
    const status = (e as { status?: string }).status;
    if (status === 'archived' || status === 'draft') continue;
    const start = parseDate(e.start_date);
    if (!start) continue;
    const end = parseDate(e.end_date) || start;
    if (end.getTime() < today.getTime()) continue; // vergangene Events raus

    const s = e.series_id ? seriesById.get(e.series_id) : null;
    const seg = e.url_segment || e.slug;
    const sameDay = iso(start) === iso(end);
    cal.push({
      href: s ? `/${s.slug}/${seg}` : `/events/${e.slug}`,
      name: e.name || e.title || 'Event',
      category: s?.category || 'Event',
      seriesTitle: s?.title || null,
      dateLabel: sameDay ? fmt(start) : `${fmt(start)} – ${fmt(end)}`,
      startISO: iso(start),
      location: [e.location_city, e.location_country].filter(Boolean).join(', ') || e.venue || e.location_name || null,
      image: e.hero_image || null,
      featured: !!(e as { featured?: boolean }).featured,
      monthLabel: `${MONTHS[start.getMonth()]} ${start.getFullYear()}`,
    });
  }
  cal.sort((a, b) => a.startISO.localeCompare(b.startISO));
  return cal;
}

export default async function KalenderPage() {
  const cal = await buildCalendar();

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Event-Kalender Faltin Travel',
    itemListElement: cal.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name: e.name,
        startDate: e.startISO,
        ...(e.location ? { location: { '@type': 'Place', name: e.location } } : {}),
        url: `${SITE}${e.href}`,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <Breadcrumbs items={[{ name: 'Start', href: '/' }, { name: 'Event-Kalender', href: '/kalender' }]} />

      {/* Header */}
      <section className="px-4 py-14 text-center text-white" style={{ background: 'linear-gradient(135deg,#163e63 0%,#0e2842 60%,#0c2138 100%)' }}>
        <div className="container mx-auto max-w-3xl">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#d9531e' }} /> Event-Kalender
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">Kommende Events im Überblick</h1>
          <div className="mx-auto my-4 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
          <p className="mx-auto max-w-2xl text-white/85 leading-relaxed">
            Alle anstehenden Sport- und Event-Reisen mit Terminen und Countdown – chronologisch im Zeitstrahl. Jetzt frühzeitig sichern.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <a href={`webcal://${SITE.replace(/^https?:\/\//, '')}/api/calendar/ics`} className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90" style={{ background: '#d9531e' }}>
              📅 Kalender abonnieren
            </a>
            <a href="/api/calendar/ics" className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/20" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}>
              .ics herunterladen
            </a>
          </div>
          <p className="mx-auto mt-3 max-w-2xl text-xs text-white/55">
            „Abonnieren" fügt den Kalender in Apple/Google/Outlook hinzu und hält ihn automatisch aktuell.
          </p>
        </div>
      </section>

      {/* Kalender */}
      <section className="px-4 py-14" style={{ background: '#f7f9fc' }}>
        <div className="container mx-auto max-w-4xl">
          {cal.length === 0 ? (
            <p className="py-16 text-center text-gray-400">Aktuell sind keine kommenden Events eingetragen.</p>
          ) : (
            <EventCalendar events={cal} />
          )}
        </div>
      </section>
    </>
  );
}
