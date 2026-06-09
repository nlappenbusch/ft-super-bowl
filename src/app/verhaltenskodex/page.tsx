import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck, ScrollText, Scale, Eye, Ticket, Lock, HeartHandshake,
  Leaf, MessageSquareWarning, CheckCircle2,
} from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { generateOrganizationSchema } from '@/lib/schema';

export const metadata: Metadata = {
  title: 'Verhaltenskodex (Code of Conduct) | Faltin Travel AG',
  description:
    'Unser Verhaltenskodex: Transparenz, faire Preise, ausschliesslich offizielle Tickets, Datenschutz, Kundenschutz mit Schweizer Reisegarantie und gesellschaftliches Engagement. So arbeitet die Faltin Travel AG seriös und verantwortungsvoll.',
  keywords:
    'Verhaltenskodex, Code of Conduct, Faltin Travel seriös, faire Preise, offizielle Tickets, Reisegarantie, Compliance, Datenschutz',
  alternates: { canonical: '/verhaltenskodex' },
  openGraph: {
    title: 'Verhaltenskodex (Code of Conduct) | Faltin Travel AG',
    description:
      'Unsere Selbstverpflichtung zu Integrität, Transparenz und Kundenschutz im Sport- & Event-Travel.',
    url: '/verhaltenskodex',
    type: 'website',
  },
};

const BLUE_GLOW: React.CSSProperties = {
  background:
    'radial-gradient(60% 95% at 12% 12%, rgba(58,124,190,0.45), transparent 60%),' +
    'radial-gradient(55% 85% at 90% 22%, rgba(34,84,143,0.40), transparent 55%),' +
    'linear-gradient(180deg, #163e63 0%, #0e2842 55%, #0c2138 100%)',
};

const principles = [
  {
    icon: Eye,
    title: 'Transparenz & Ehrlichkeit',
    desc: 'Wir kommunizieren Leistungen, Konditionen und Preise klar und nachvollziehbar. Keine versteckten Kosten, keine leeren Versprechen – Sie wissen genau, was Sie buchen.',
  },
  {
    icon: Ticket,
    title: 'Ausschliesslich offizielle Tickets',
    desc: 'Wir vermitteln offizielle und autorisierte Tickets bzw. Hospitality. Grau- und Schwarzmarkt lehnen wir konsequent ab – für gültigen Einlass und faire Bedingungen.',
  },
  {
    icon: Scale,
    title: 'Faire Preise',
    desc: 'Unsere Preise stehen in einem fairen Verhältnis zur Leistung. Wir nutzen weder Knappheit noch Drucksituationen aus, um überhöhte Preise durchzusetzen.',
  },
  {
    icon: HeartHandshake,
    title: 'Kundenschutz & Reisegarantie',
    desc: 'Als Teilnehmerin am Schweizer Garantiefonds der Reisebranche sind Ihre Zahlungen und Ihre Rückreise abgesichert. Ihr Schutz hat oberste Priorität.',
  },
  {
    icon: Lock,
    title: 'Datenschutz',
    desc: 'Ihre Daten behandeln wir vertraulich und verwenden sie ausschliesslich zur Abwicklung Ihrer Reise. Wir geben sie nicht zu Werbezwecken an Dritte weiter.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance & Integrität',
    desc: 'Wir handeln gesetzeskonform und integer. Korruption, Bestechung und unlautere Geschäftspraktiken haben bei uns keinen Platz.',
  },
  {
    icon: Leaf,
    title: 'Verantwortung & Engagement',
    desc: 'Wir engagieren uns gesellschaftlich – unter anderem als Unterstützer von Special Olympics Switzerland – und achten auf einen respektvollen, nachhaltigen Umgang mit Menschen und Ressourcen.',
  },
  {
    icon: MessageSquareWarning,
    title: 'Beschwerden ernst nehmen',
    desc: 'Kritik ist eine Chance. Wir nehmen Anliegen und Beschwerden ernst, bearbeiten sie zügig und suchen gemeinsam mit Ihnen nach einer fairen Lösung.',
  },
];

const commitments = [
  'Wir beraten ehrlich – auch wenn das bedeutet, von einer Buchung abzuraten.',
  'Wir nennen Preise und Leistungen vollständig, bevor Sie sich entscheiden.',
  'Wir vermitteln keine Tickets aus unsicheren oder unautorisierten Quellen.',
  'Wir halten Zusagen ein und informieren proaktiv bei Änderungen.',
  'Wir schützen Ihre Daten und Ihre Zahlungen.',
  'Wir stehen für Rückfragen persönlich zur Verfügung – vor, während und nach der Reise.',
];

export default function VerhaltenskodexPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(generateOrganizationSchema()) }} />

      <Breadcrumbs
        items={[
          { name: 'Start', href: '/' },
          { name: 'Über uns', href: '/ueber-uns' },
          { name: 'Verhaltenskodex', href: '/verhaltenskodex' },
        ]}
      />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden px-4 py-16 text-white" style={BLUE_GLOW}>
        <div className="container mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-[#0f2742]/60 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100">
            <ScrollText className="h-3.5 w-3.5" style={{ color: '#f5c842' }} />
            Code of Conduct
          </span>
          <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-display)' }}>
            Unser Verhaltenskodex
          </h1>
          <div className="mx-auto my-5 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-blue-100/90">
            Sport- und Event-Travel ist ein sensibles Geschäft. Vertrauen verdient man sich – jeden Tag aufs Neue.
            Dieser Kodex hält fest, wofür die Faltin Travel AG steht und woran Sie uns messen dürfen.
          </p>
        </div>
      </section>

      {/* ── INTRO ── */}
      <section className="bg-white px-4 py-14">
        <div className="container mx-auto max-w-3xl">
          <div className="space-y-4 text-base leading-relaxed text-gray-700">
            <p>
              Seit über zwei Jahrzehnten organisieren wir Reisen zu den weltgrössten Sport- und Kultur-Ereignissen.
              In einer Branche, in der es leider auch unseriöse Anbieter gibt, ist es uns wichtig, klar Stellung zu
              beziehen: Wir arbeiten transparent, fair und verantwortungsvoll.
            </p>
            <p>
              Die folgenden Grundsätze sind keine Marketingfloskeln, sondern unsere tägliche Arbeitsgrundlage – für
              jeden Mitarbeitenden, jede Anfrage und jede Buchung.
            </p>
          </div>
        </div>
      </section>

      {/* ── PRINZIPIEN ── */}
      <section className="px-4 py-16" style={{ background: '#f3f7fc' }}>
        <div className="container mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-extrabold md:text-4xl" style={{ color: '#143047', fontFamily: 'var(--font-display)' }}>
              Unsere Grundsätze
            </h2>
            <div className="mx-auto my-4 h-1 w-16 rounded-full" style={{ background: '#d9531e' }} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {principles.map((p, i) => (
              <div key={p.title} className="flex gap-4 rounded-2xl bg-white p-6" style={{ border: '1px solid #e5e8ed', boxShadow: '0 6px 18px rgba(20,48,71,0.05)' }}>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-lg" style={{ background: 'linear-gradient(135deg,#143047,#1f4c75)' }}>
                  <p.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold" style={{ color: '#143047' }}>
                    <span className="text-sm font-extrabold text-gray-300">{`0${i + 1}`}</span>
                    {p.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SELBSTVERPFLICHTUNG ── */}
      <section className="bg-white px-4 py-16">
        <div className="container mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold leading-tight md:text-4xl" style={{ color: '#143047', fontFamily: 'var(--font-display)' }}>
              Unser Versprechen an Sie
            </h2>
            <div className="my-4 h-1 w-14 rounded-full" style={{ background: '#d9531e' }} />
            <ul className="mt-5 space-y-3">
              {commitments.map((c) => (
                <li key={c} className="flex items-start gap-3 text-gray-700">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#16a34a' }} />
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl p-8 text-white" style={BLUE_GLOW}>
            <ShieldCheck className="mb-4 h-10 w-10" style={{ color: '#f5c842' }} />
            <p className="text-lg leading-relaxed text-blue-100/90">
              „Wir verkaufen keine Tickets – wir schaffen Erlebnisse, für die man wiederkommt. Das gelingt nur mit
              Vertrauen, Ehrlichkeit und Verlässlichkeit."
            </p>
            <p className="mt-5 font-bold text-white">Stefan Faltin</p>
            <p className="text-sm text-blue-100/70">Inhaber & Geschäftsführer, Faltin Travel AG</p>
          </div>
        </div>
      </section>

      {/* ── KONTAKT/HINWEIS ── */}
      <section className="px-4 py-14 text-center text-white" style={{ background: '#143047' }}>
        <h2 className="mx-auto mb-4 max-w-2xl text-2xl font-extrabold leading-tight md:text-3xl">
          Fragen zu unserem Verhaltenskodex?
        </h2>
        <p className="mx-auto mb-6 max-w-2xl text-white/80">
          Sie haben Anregungen, Kritik oder ein Anliegen? Wir freuen uns über Ihre Nachricht – und nehmen jedes
          Feedback ernst.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/kontakt" className="rounded-sm px-8 py-4 text-base font-bold text-white shadow-lg transition hover:opacity-90" style={{ background: '#d9531e' }}>
            Kontakt aufnehmen
          </Link>
          <Link href="/ueber-uns" className="inline-flex items-center gap-2 rounded-sm px-8 py-4 text-base font-bold text-white transition hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,0.3)' }}>
            Mehr über uns
          </Link>
        </div>
      </section>
    </>
  );
}
