import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Compass, Target, Handshake, ShieldCheck, Award, Users, Globe2, CalendarDays } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import EkomiWidget from '@/components/EkomiWidget';
import { generateOrganizationSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Über uns – Faltin Travel AG | Event- & Incentive-Spezialist',
  description:
    'Faltin Travel AG: über 20 Jahre Erfahrung, persönliche Beratung und Zugang zu den weltgrößten Sport- und Kultur-Events. Mit Schweizer Reisegarantie.',
  alternates: { canonical: '/ueber-uns' },
  openGraph: {
    title: 'Über uns – Faltin Travel AG',
    description: 'Event- & Incentive-Spezialist mit über 20 Jahren Erfahrung. Mit Sicherheit ein gutes Gefühl.',
    url: '/ueber-uns',
  },
};

const BLUE_GLOW: React.CSSProperties = {
  background:
    'radial-gradient(60% 95% at 12% 12%, rgba(58,124,190,0.45), transparent 60%),' +
    'radial-gradient(55% 85% at 90% 22%, rgba(34,84,143,0.40), transparent 55%),' +
    'linear-gradient(180deg, #163e63 0%, #0e2842 55%, #0c2138 100%)',
};

const strengths = [
  { icon: Compass, title: 'Über 20 Jahre Erfahrung', desc: 'Langjähriges Know-how als Event- und Incentive-Spezialist mit hoher Umsetzungssicherheit.' },
  { icon: Target, title: 'Zugang zu Top-Events', desc: 'Optimale Zugänge zu nationalen und internationalen Sport-, Kultur- und Entertainment-Highlights.' },
  { icon: Handshake, title: 'Persönliche Betreuung', desc: 'Von der Anfrage bis zur Nachbetreuung: direkte Ansprechpartner und verbindlicher Service.' },
  { icon: ShieldCheck, title: 'Verlässliche Sicherheit', desc: 'Ausgewähltes Netzwerk und Absicherung über den Schweizer Garantiefonds der Reisebranche.' },
];

const stats = [
  { icon: Award, value: '20+', label: 'Jahre Erfahrung' },
  { icon: Globe2, value: 'Weltweit', label: 'Partnernetzwerk' },
  { icon: Users, value: 'Persönlich', label: 'Beratung auf Augenhöhe' },
  { icon: ShieldCheck, value: 'Gold', label: 'eKomi-Auszeichnung' },
];

export default function UeberUnsPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationSchema()) }} />
      <Breadcrumbs items={[{ name: 'Start', href: '/' }, { name: 'Über uns', href: '/ueber-uns' }]} />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-4 py-16 text-white" style={BLUE_GLOW}>
        <div className="container mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Faltin Travel AG: Mit Sicherheit ein gutes Gefühl
            </h1>
            <div className="my-5 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
            <p className="max-w-xl text-lg leading-relaxed text-blue-100/90">
              Als mehrfach ausgezeichneter Event- und Incentive-Spezialist mit über 20 Jahren Erfahrung verbinden wir
              exklusive Tickets, beste Hotels und durchdachte Reiselogistik – persönlich betreut, von der ersten
              Anfrage bis zur Rückreise.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/kontakt" className="rounded-sm px-7 py-3.5 text-base font-bold text-white shadow-lg transition hover:opacity-90" style={{ background: '#d9531e' }}>
                Jetzt Kontakt aufnehmen
              </Link>
              <Link href="/kalender" className="inline-flex items-center gap-2 rounded-sm px-7 py-3.5 text-base font-bold text-white transition hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,0.3)' }}>
                <CalendarDays className="h-5 w-5" /> Events entdecken
              </Link>
            </div>
          </div>
          <div className="relative h-64 overflow-hidden rounded-2xl md:h-80" style={{ boxShadow: '0 24px 60px rgba(3,10,26,0.45)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <Image src="/Faltin-Travel-Ihr-serioeser-Partner-fuer-Events-Incentives.webp" alt="Faltin Travel – Ihr seriöser Partner für Events und Incentives" fill className="object-cover" priority />
          </div>
        </div>
      </section>

      {/* ── STATS-BAND ── */}
      <section className="px-4 py-10" style={{ background: '#0c2138' }}>
        <div className="container mx-auto grid max-w-5xl grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center text-white">
              <s.icon className="mx-auto mb-2 h-7 w-7" style={{ color: '#f5c842' }} />
              <div className="text-2xl md:text-3xl font-extrabold">{s.value}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-blue-100/70">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── STORY ── */}
      <section className="bg-white px-4 py-16">
        <div className="container mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold leading-tight" style={{ color: '#143047', fontFamily: 'var(--font-display)' }}>
              Erlebnisse, die in Erinnerung bleiben
            </h2>
            <div className="my-4 h-1 w-14 rounded-full" style={{ background: '#d9531e' }} />
            <div className="space-y-4 text-base leading-relaxed text-gray-700">
              <p>
                Seit über zwei Jahrzehnten organisiert die Faltin Travel AG Reisen zu den weltgrößten Sport- und
                Kultur-Ereignissen. Ob Super Bowl, Grand-Slam-Tennis oder Formel 1 – wir kombinieren offizielle
                Hospitality-Tickets mit handverlesenen Hotels und reibungsloser Logistik.
              </p>
              <p>
                Was uns ausmacht: feste Ansprechpartner, ehrliche Beratung und ein Netzwerk, das echte Zugänge schafft.
                Als Teilnehmer am Schweizer Garantiefonds der Reisebranche sind Ihre Zahlungen und Ihre Rückreise
                abgesichert – damit Sie sich ganz auf das Erlebnis konzentrieren können.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {['20+ Jahre Erfahrung', 'Internationales Partnernetzwerk', 'Schweizer Reisegarantie'].map((f) => (
                <span key={f} className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: '#e5e8ed', color: '#18395a', background: '#f3f7fc' }}>{f}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-2xl sm:col-span-2" style={{ border: '1px solid #e5e8ed' }}>
              <Image src="/Faltin-TRAVEL-AG-Team.webp" alt="Das Team der Faltin Travel AG" width={1200} height={680} className="h-52 w-full object-cover" />
            </div>
            <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid #e5e8ed' }}>
              <Image src="/Stefan-Faltin-Geschaeftsfuehrer-Faltin-Travel-AG.webp" alt="Stefan Faltin – Geschäftsführer Faltin Travel AG" width={760} height={760} className="h-40 w-full object-cover" />
            </div>
            <div className="flex flex-col justify-center rounded-2xl p-4 text-sm" style={{ background: '#f3f7fc', border: '1px solid #e5e8ed' }}>
              <div className="font-bold" style={{ color: '#143047' }}>Stefan Faltin</div>
              <div className="text-gray-500">Inhaber & Geschäftsführer</div>
              <p className="mt-2 leading-relaxed text-gray-600">„Wir verkaufen keine Tickets – wir schaffen Erlebnisse, für die man wiederkommt."</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STÄRKEN ── */}
      <section className="px-4 py-16" style={BLUE_GLOW}>
        <div className="container mx-auto max-w-6xl">
          <div className="mb-10 text-center text-white">
            <h2 className="text-3xl md:text-4xl font-extrabold" style={{ fontFamily: 'var(--font-display)' }}>Warum Faltin Travel</h2>
            <div className="mx-auto my-4 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
            <p className="mx-auto max-w-2xl text-blue-100/85">Vier Gründe, warum unsere Gäste uns vertrauen.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {strengths.map((p, i) => (
              <div
                key={p.title}
                className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5"
                style={{
                  background: 'linear-gradient(160deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035))',
                  border: '1px solid rgba(255,255,255,0.14)',
                  boxShadow: '0 12px 34px rgba(3,10,26,0.28)',
                }}
              >
                <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" style={{ background: 'linear-gradient(90deg,#d9531e,#f5c842)' }} />
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110" style={{ background: 'linear-gradient(135deg,#d9531e,#f5972a)' }}>
                    <p.icon className="h-6 w-6" />
                  </div>
                  <span className="text-4xl font-extrabold leading-none tracking-tight text-white/12">{`0${i + 1}`}</span>
                </div>
                <h3 className="text-lg font-bold text-white">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-blue-100/85">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── KUNDENSTIMMEN ── */}
      <section className="bg-white px-4 py-16">
        <div className="container mx-auto max-w-5xl text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold" style={{ color: '#143047', fontFamily: 'var(--font-display)' }}>Das sagen unsere Kunden</h2>
          <div className="mx-auto my-4 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
          <p className="mx-auto mb-8 max-w-2xl text-gray-500">Unabhängig erhoben und ausgezeichnet mit dem eKomi Gold-Siegel.</p>
          <EkomiWidget token="sf1193615db15cb28a8dd" draftMode language="de" className="w-full overflow-hidden" />
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-4 py-14 text-center text-white" style={{ background: '#143047' }}>
        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/70">Bereit für Ihr nächstes Erlebnis?</p>
        <h2 className="mx-auto mb-6 max-w-2xl text-2xl md:text-3xl font-extrabold leading-tight">Lassen Sie uns Ihre Eventreise gemeinsam planen.</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/kontakt" className="rounded-sm px-8 py-4 text-base font-bold text-white shadow-lg transition hover:opacity-90" style={{ background: '#d9531e' }}>Kontakt aufnehmen</Link>
          <Link href="/kalender" className="inline-flex items-center gap-2 rounded-sm px-8 py-4 text-base font-bold text-white transition hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,0.3)' }}>
            <CalendarDays className="h-5 w-5" /> Zum Event-Kalender
          </Link>
        </div>
      </section>
    </>
  );
}
