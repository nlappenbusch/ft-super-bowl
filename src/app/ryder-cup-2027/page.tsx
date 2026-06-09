import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  ShieldCheck, BadgeCheck, Ticket, Hotel, Plane, Handshake, Award, Lock,
  CheckCircle2, CalendarDays, MapPin, ArrowRight, Sparkles,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { generateOrganizationSchema, generateFaqPageSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Ryder Cup 2027 – Authorized Distributor | Faltin Travel AG',
  description:
    'Faltin Travel AG ist Authorized Distributor und offizieller Vertriebspartner für Ryder Cup 2027 Reisepakete. Offizielle Hospitality-Tickets, ausgewählte Hotels und Schweizer Reisegarantie – aus einer Hand.',
  keywords:
    'Ryder Cup 2027, Authorized Distributor, offizieller Vertriebspartner, Ryder Cup Reisepakete, Ryder Cup Hospitality, Adare Manor, Faltin Travel',
  alternates: { canonical: '/ryder-cup-2027' },
  openGraph: {
    title: 'Ryder Cup 2027 – Authorized Distributor | Faltin Travel AG',
    description:
      'Offizieller Vertriebspartner für Ryder Cup 2027 Reisepakete. Offizielle Hospitality, ausgewählte Hotels & Schweizer Reisegarantie.',
    url: '/ryder-cup-2027',
    type: 'website',
  },
};

const BLUE_GLOW: React.CSSProperties = {
  background:
    'radial-gradient(60% 95% at 12% 12%, rgba(58,124,190,0.45), transparent 60%),' +
    'radial-gradient(55% 85% at 90% 22%, rgba(34,84,143,0.40), transparent 55%),' +
    'linear-gradient(180deg, #163e63 0%, #0e2842 55%, #0c2138 100%)',
};

const trustPoints = [
  {
    icon: BadgeCheck,
    title: 'Authorized Distributor',
    desc: 'Als autorisierter Vertriebspartner vermitteln wir ausschliesslich offizielle Pakete – kein Grau- oder Schwarzmarkt, keine Risiken am Einlass.',
  },
  {
    icon: ShieldCheck,
    title: 'Schweizer Reisegarantie',
    desc: 'Ihre An- und Zahlungen sowie Ihre Rückreise sind über den Schweizer Garantiefonds der Reisebranche abgesichert.',
  },
  {
    icon: Award,
    title: 'Über 20 Jahre Erfahrung',
    desc: 'Mehrfach ausgezeichneter Event- & Incentive-Spezialist mit eKomi Gold-Bewertung und einem belastbaren internationalen Netzwerk.',
  },
  {
    icon: Handshake,
    title: 'Persönliche Betreuung',
    desc: 'Ein fester Ansprechpartner – von der ersten Anfrage über die Reiseplanung bis zur Betreuung vor Ort und der Rückreise.',
  },
];

const included = [
  { icon: Ticket, title: 'Offizielle Hospitality & Tickets', desc: 'Zugang zu offiziellen Ticket- und Hospitality-Kategorien für die Turniertage.' },
  { icon: Hotel, title: 'Handverlesene Hotels', desc: 'Sorgfältig ausgewählte Unterkünfte in guter Lage – passend zu Ihrem Komfortanspruch.' },
  { icon: Plane, title: 'Durchdachte Reiselogistik', desc: 'Transfers, Anreise-Optionen und Ablaufplanung – reibungslos organisiert.' },
  { icon: Sparkles, title: 'Individuelle Zusatzleistungen', desc: 'Verlängerungsnächte, Golf-Erlebnisse oder Rahmenprogramm – auf Wunsch massgeschneidert.' },
];

const faqs = [
  {
    question: 'Ist Faltin Travel ein offizieller Vertriebspartner für den Ryder Cup 2027?',
    answer:
      'Ja. Die Faltin Travel AG ist Authorized Distributor und damit offizieller Vertriebspartner für Ryder Cup 2027 Reisepakete. Wir vermitteln ausschliesslich offizielle, autorisierte Pakete.',
  },
  {
    question: 'Sind die Tickets offiziell und gültig?',
    answer:
      'Unsere Pakete basieren auf offiziellen Ticket- und Hospitality-Kontingenten. Sie erhalten keine Tickets aus dem Grau- oder Schwarzmarkt – damit ist Ihr Einlass sichergestellt.',
  },
  {
    question: 'Wo und wann findet der Ryder Cup 2027 statt?',
    answer:
      'Der Ryder Cup 2027 wird im September 2027 in Adare Manor, County Limerick, Irland ausgetragen – Team Europa gegen Team USA.',
  },
  {
    question: 'Was ist in einem Reisepaket enthalten?',
    answer:
      'Je nach Paket kombinieren wir offizielle Hospitality bzw. Tickets mit ausgewählten Hotels, Transfers und Reiselogistik. Zusatzleistungen wie Verlängerungsnächte oder Rahmenprogramm sind auf Wunsch möglich.',
  },
  {
    question: 'Wie ist meine Zahlung abgesichert?',
    answer:
      'Die Faltin Travel AG ist Teilnehmerin am Schweizer Garantiefonds der Reisebranche. Ihre Zahlungen und Ihre Rückreise sind dadurch abgesichert.',
  },
  {
    question: 'Wie erhalte ich ein individuelles Angebot?',
    answer:
      'Senden Sie uns eine unverbindliche Anfrage über das Kontaktformular oder rufen Sie uns an. Wir melden uns in der Regel innerhalb von 24 Stunden mit einem passenden Vorschlag.',
  },
];

export default function RyderCup2027Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationSchema()) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateFaqPageSchema(faqs)) }} />

      <Breadcrumbs
        items={[
          { name: 'Start', href: '/' },
          { name: 'Über uns', href: '/ueber-uns' },
          { name: 'Ryder Cup 2027', href: '/ryder-cup-2027' },
        ]}
      />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-4 py-16 text-white" style={BLUE_GLOW}>
        <div className="container mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-[#0f2742]/60 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">
              <BadgeCheck className="h-3.5 w-3.5" style={{ color: '#f5c842' }} />
              Authorized Distributor
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-display)' }}>
              Ryder Cup 2027 – offizieller Vertriebspartner
            </h1>
            <div className="my-5 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
            <p className="max-w-xl text-lg leading-relaxed text-blue-100/90">
              Die Faltin Travel AG ist stolz, als <strong className="text-white">Authorized Distributor</strong> offizieller
              Vertriebspartner für Ryder Cup 2027 Reisepakete zu sein. Offizielle Hospitality, handverlesene Hotels und
              durchdachte Logistik – mit Schweizer Reisegarantie, aus einer Hand.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-blue-100/85">
              <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" style={{ color: '#f5c842' }} /> September 2027</span>
              <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" style={{ color: '#f5c842' }} /> Adare Manor, Irland</span>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/kontakt" className="rounded-sm px-7 py-3.5 text-base font-bold text-white shadow-lg transition hover:opacity-90" style={{ background: '#d9531e' }}>
                Unverbindlich anfragen
              </Link>
              <Link href="/ueber-uns" className="inline-flex items-center gap-2 rounded-sm px-7 py-3.5 text-base font-bold text-white transition hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,0.3)' }}>
                Über Faltin Travel
              </Link>
            </div>
          </div>

          {/* Shield card */}
          <div className="flex justify-center md:justify-end">
            <div className="relative flex flex-col items-center gap-5 rounded-3xl p-8 text-center" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 24px 60px rgba(3,10,26,0.45)' }}>
              <div className="rounded-2xl bg-white p-5 shadow-xl">
                <Image src="/RC_MatchShield_2027_RGB (1).svg" alt="Ryder Cup 2027 Match Shield" width={150} height={150} priority />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-100/80">Offizieller Status</p>
                <p className="mt-1 text-lg font-bold text-white">Authorized Distributor</p>
                <p className="text-sm text-blue-100/75">Ryder Cup 2027 Reisepakete</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST-BAND ── */}
      <section className="px-4 py-16 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold md:text-4xl" style={{ color: '#143047', fontFamily: 'var(--font-display)' }}>
              Warum Sie Ihre Ryder-Cup-Reise bei uns buchen
            </h2>
            <div className="mx-auto my-4 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
            <p className="mx-auto max-w-2xl text-gray-500">
              Bei einem Highlight wie dem Ryder Cup zählt Sicherheit. Als autorisierter Partner garantieren wir
              offizielle Pakete und einen abgesicherten Ablauf.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {trustPoints.map((p) => (
              <div key={p.title} className="rounded-2xl p-6 transition hover:-translate-y-1" style={{ border: '1px solid #e5e8ed', background: '#f8fafc', boxShadow: '0 6px 18px rgba(20,48,71,0.05)' }}>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#143047,#1f4c75)' }}>
                  <p.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold" style={{ color: '#143047' }}>{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WAS HEISST AUTHORIZED DISTRIBUTOR ── */}
      <section className="px-4 py-16" style={{ background: '#f3f7fc' }}>
        <div className="container mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold leading-tight md:text-4xl" style={{ color: '#143047', fontFamily: 'var(--font-display)' }}>
              Was bedeutet „Authorized Distributor"?
            </h2>
            <div className="my-4 h-1 w-14 rounded-full" style={{ background: '#d9531e' }} />
            <div className="space-y-4 text-base leading-relaxed text-gray-700">
              <p>
                Als <strong>Authorized Distributor</strong> sind wir ein autorisierter, offizieller Vertriebspartner
                für Ryder Cup 2027 Reisepakete. Das heisst für Sie: Sie buchen über einen legitimierten Kanal – nicht
                über anonyme Wiederverkäufer.
              </p>
              <p>
                Gerade im Premium-Ticketing gibt es viele unseriöse Angebote. Offizielle Pakete schützen Sie vor
                ungültigen Tickets, Einlassverweigerung und überteuerten Schwarzmarktpreisen.
              </p>
            </div>
            <ul className="mt-6 space-y-3">
              {[
                'Offizielle, autorisierte Ticket- & Hospitality-Pakete',
                'Kein Grau- oder Schwarzmarkt, keine Einlassrisiken',
                'Transparente Konditionen und faire Preisgestaltung',
                'Abgesichert über die Schweizer Reisegarantie',
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-gray-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#16a34a' }} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4">
            <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid #e5e8ed' }}>
              <Image src="/Faltin-Travel-Ihr-serioeser-Partner-fuer-Events-Incentives.webp" alt="Faltin Travel – Ihr seriöser Partner für Events" width={1200} height={680} className="h-60 w-full object-cover" />
            </div>
            <div className="flex items-center gap-4 rounded-2xl bg-white p-5" style={{ border: '1px solid #e5e8ed' }}>
              <a href="https://www.garantiefonds.ch/teilnehmer/teilnehmer-am-garantiefonds" target="_blank" rel="noopener noreferrer" className="shrink-0">
                <Image src="/Schweizer-Reisegarantie-300x120-1.webp" alt="Schweizer Reisegarantie" width={120} height={48} className="h-auto" />
              </a>
              <p className="text-sm leading-relaxed text-gray-600">
                Teilnehmer am Schweizer Garantiefonds der Reisebranche – Ihre Zahlungen und Ihre Rückreise sind abgesichert.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── LEISTUNGEN ── */}
      <section className="px-4 py-16 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold md:text-4xl" style={{ color: '#143047', fontFamily: 'var(--font-display)' }}>
              Was wir für Sie organisieren
            </h2>
            <div className="mx-auto my-4 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
            <p className="mx-auto max-w-2xl text-gray-500">
              Wir stellen Ihr Ryder-Cup-Erlebnis als durchdachtes Gesamtpaket zusammen – individuell auf Ihre Wünsche abgestimmt.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {included.map((it) => (
              <div key={it.title} className="rounded-2xl p-6" style={{ border: '1px solid #e5e8ed' }}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#d9531e,#f5972a)' }}>
                  <it.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold" style={{ color: '#143047' }}>{it.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{it.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-4 py-16" style={{ background: '#f3f7fc' }}>
        <div className="container mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-extrabold md:text-4xl" style={{ color: '#143047', fontFamily: 'var(--font-display)' }}>
              Häufige Fragen
            </h2>
            <div className="mx-auto my-4 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
          </div>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.question} className="group overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid #e5e8ed' }}>
                <summary className="flex cursor-pointer select-none items-center justify-between gap-4 px-5 py-4 text-base font-semibold" style={{ color: '#143047' }}>
                  {f.question}
                  <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" style={{ color: '#d9531e' }} />
                </summary>
                <div className="border-t px-5 py-4 text-sm leading-relaxed text-gray-600" style={{ borderColor: '#eef1f4' }}>
                  {f.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-4 py-14 text-center text-white" style={{ background: '#143047' }}>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2">
          <Image src="/RC_MatchShield_2027_RGB (1).svg" alt="Ryder Cup 2027" width={48} height={48} />
        </div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-white/70">Ryder Cup 2027 · Authorized Distributor</p>
        <h2 className="mx-auto mb-6 max-w-2xl text-2xl font-extrabold leading-tight md:text-3xl">
          Sichern Sie sich frühzeitig Ihr offizielles Ryder-Cup-Paket.
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/kontakt" className="rounded-sm px-8 py-4 text-base font-bold text-white shadow-lg transition hover:opacity-90" style={{ background: '#d9531e' }}>
            Jetzt anfragen
          </Link>
          <a href="tel:+41447002277" className="inline-flex items-center gap-2 rounded-sm px-8 py-4 text-base font-bold text-white transition hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,0.3)' }}>
            <Lock className="h-5 w-5" /> +41 44 700 22 77
          </a>
        </div>
      </section>
    </>
  );
}
