import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Trophy, Users, MapPin, ArrowRight, Ticket, ShieldCheck, Info } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { generateEventSchema, generateFaqPageSchema } from '@/lib/schema';
import {
  NL_LEAGUES, NL_MATCHDAYS, NL_META, NL_FLAG, nlFormatDate,
  type NLGroup, type NLFixture,
} from '@/lib/nationsLeague';

export const metadata: Metadata = {
  title: 'UEFA Nations League 2026/27 – Gruppen, Spielplan & Termine | Faltin Travel',
  description:
    'Alle Gruppen und Spielpaarungen der UEFA Nations League 2026/27 mit Terminen. Ligaphase 24. September – 17. November 2026, League A–D komplett. Reisepakete, Tickets & Hospitality von Faltin Travel.',
  keywords:
    'UEFA Nations League 2026/27, Nations League Gruppen, Nations League Spielplan, Nations League Termine, Nations League Tickets, Nations League Reise, Deutschland Nations League, Schweiz Nations League, Faltin Travel',
  alternates: { canonical: '/uefa-nations-league-2026-27' },
  openGraph: {
    title: 'UEFA Nations League 2026/27 – Gruppen & Spielplan',
    description:
      'Komplette Gruppen und Spielpaarungen mit Terminen (24.09.–17.11.2026). League A–D. Reisepakete & Hospitality von Faltin Travel.',
    url: '/uefa-nations-league-2026-27',
    type: 'website',
  },
};

const NAVY = '#143047';
const ACCENT = '#d9531e';
const BLUE_GLOW: React.CSSProperties = {
  background:
    'radial-gradient(60% 95% at 12% 12%, rgba(58,124,190,0.45), transparent 60%),' +
    'radial-gradient(55% 85% at 90% 22%, rgba(34,84,143,0.40), transparent 55%),' +
    'linear-gradient(180deg, #163e63 0%, #0e2842 55%, #0c2138 100%)',
};

const LEAGUE_TONE: Record<string, string> = { A: '#d9531e', B: '#2f6fb0', C: '#3f9e6a', D: '#8a7bd8' };

function Flag({ team, size = 20 }: { team: string; size?: number }) {
  const code = NL_FLAG[team] || 'un';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w${size === 20 ? 20 : 40}/${code}.png`}
      alt=""
      width={size}
      height={Math.round(size * 0.66)}
      loading="lazy"
      style={{ display: 'inline-block', borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}
    />
  );
}

function TeamPill({ team }: { team: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: NAVY }}>
      <Flag team={team} /> {team}
    </span>
  );
}

function GroupCard({ group, tone }: { group: NLGroup; tone: string }) {
  // Fixtures nach Spieltag gruppieren
  const byMd = new Map<number, NLFixture[]>();
  for (const fx of group.fixtures) {
    const arr = byMd.get(fx.md) || [];
    arr.push(fx);
    byMd.set(fx.md, arr);
  }
  return (
    <div className="overflow-hidden rounded-2xl bg-white" style={{ border: '1px solid #e5e8ed', boxShadow: '0 4px 20px rgba(20,48,71,0.06)' }}>
      <div className="flex items-center justify-between px-5 py-3" style={{ background: NAVY }}>
        <span className="text-sm font-extrabold tracking-wide text-white">Gruppe {group.id}</span>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: tone }}>{group.teams.length} Teams</span>
      </div>
      {/* Teams */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 py-3" style={{ background: '#f7f9fc', borderBottom: '1px solid #e5e8ed' }}>
        {group.teams.map((t) => <TeamPill key={t} team={t} />)}
      </div>
      {/* Fixtures nach Spieltag */}
      <div className="divide-y" style={{ borderColor: '#eef1f5' }}>
        {NL_MATCHDAYS.map(({ md, window }) => {
          const games = byMd.get(md);
          if (!games || games.length === 0) return null;
          return (
            <div key={md} className="px-5 py-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: '#eef3fb', color: '#18395a' }}>Spieltag {md}</span>
                <span className="text-[11px]" style={{ color: '#9ca3af' }}>{window}</span>
              </div>
              <div className="space-y-1.5">
                {games.map((g, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                    <span className="flex items-center justify-end gap-1.5 text-right font-semibold" style={{ color: NAVY }}>
                      <span className="truncate">{g.home}</span> <Flag team={g.home} />
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums" style={{ background: '#f5f7fa', color: '#6b7280' }} title={nlFormatDate(g.date)}>
                      {nlFormatDate(g.date).replace(' 2026', '')}
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold" style={{ color: NAVY }}>
                      <Flag team={g.away} /> <span className="truncate">{g.away}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const faqs = [
  {
    question: 'Wann findet die UEFA Nations League 2026/27 statt?',
    answer:
      'Die Ligaphase läuft vom 24. September bis 17. November 2026 an sechs Spieltagen. Die Viertelfinals (League A) und Auf-/Abstiegs-Play-offs folgen im März 2027, die Nations League Finals im Juni 2027.',
  },
  {
    question: 'Wie sind die Gruppen der Nations League 2026/27 ausgelost?',
    answer:
      'Die Auslosung fand am 12. Februar 2026 in Brüssel statt. League A, B und C bestehen aus je vier Vierergruppen, League D aus zwei Dreiergruppen. Deutschland spielt in Gruppe A2 gegen die Niederlande, Serbien und Griechenland; die Schweiz in Gruppe B1 gegen Schottland, Slowenien und Nordmazedonien.',
  },
  {
    question: 'Kann ich über Faltin Travel Tickets und Reisepakete für die Nations League buchen?',
    answer:
      'Ja. Faltin Travel stellt auf Wunsch individuelle Reisepakete inkl. Tickets/Hospitality, Hotel und Transfers für ausgewählte Nations-League-Spiele zusammen – mit Schweizer Reisegarantie. Kontaktieren Sie uns unverbindlich für ein passendes Angebot.',
  },
];

export default function NationsLeaguePage() {
  // JSON-LD: SportsEvent für die Topliga (League A) inkl. Einzelspiele als subEvents.
  const subEvents = NL_LEAGUES[0].groups.flatMap((g) =>
    g.fixtures.map((fx) => ({ name: `${fx.home} – ${fx.away}`, date: fx.date, round: `League A · Gruppe ${g.id} · Spieltag ${fx.md}` })),
  );
  const eventLd = generateEventSchema({
    name: 'UEFA Nations League 2026/27',
    description:
      'UEFA Nations League 2026/27 – Ligaphase (24. September – 17. November 2026) mit allen Gruppen und Spielpaarungen. Reisepakete & Hospitality von Faltin Travel.',
    startDate: '2026-09-24',
    endDate: '2026-11-17',
    organizerName: 'UEFA',
    organizerUrl: 'https://www.uefa.com',
    subEvents,
  });
  const faqLd = generateFaqPageSchema(faqs);

  const chips = [
    { icon: CalendarDays, label: 'Ligaphase', value: NL_META.leaguePhase },
    { icon: Users, label: 'Teams', value: `${NL_META.teams} Nationen · 4 Ligen` },
    { icon: Trophy, label: 'Titelverteidiger', value: NL_META.holders },
    { icon: MapPin, label: 'Auslosung', value: `${nlFormatDate(NL_META.drawDate)} · ${NL_META.drawCity}` },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(eventLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <Breadcrumbs items={[{ name: 'Start', href: '/' }, { name: 'UEFA Nations League 2026/27', href: '/uefa-nations-league-2026-27' }]} />

      {/* HERO */}
      <section className="px-4 py-14 text-white" style={BLUE_GLOW}>
        <div className="container mx-auto max-w-5xl text-center">
          <span className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            Saison {NL_META.season}
          </span>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-5xl" style={{ fontFamily: 'var(--font-display)' }}>
            UEFA Nations League 2026/27 – Gruppen &amp; Spielplan
          </h1>
          <div className="mx-auto my-4 h-1 w-16 rounded-full" style={{ background: ACCENT }} />
          <p className="mx-auto max-w-2xl leading-relaxed text-white/85">
            Alle Gruppen, Teams und Spielpaarungen der Ligaphase mit Terminen – von League A bis League D.
            Erleben Sie die Topspiele live: Faltin Travel stellt Ihnen auf Wunsch das passende Reisepaket zusammen.
          </p>
          <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {chips.map((c) => (
              <div key={c.label} className="rounded-xl px-4 py-3 text-left" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/55">
                  <c.icon className="h-3.5 w-3.5" /> {c.label}
                </div>
                <div className="mt-1 text-sm font-bold text-white">{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTRO / SEO */}
      <section className="px-4 py-12" style={{ background: '#fff' }}>
        <div className="container mx-auto max-w-3xl">
          <p className="text-[15px] leading-relaxed text-gray-700">
            Die <strong style={{ color: NAVY }}>UEFA Nations League 2026/27</strong> ist die fünfte Auflage des Wettbewerbs.
            Die Ligaphase wird vom <strong>24. September bis 17. November 2026</strong> an sechs Spieltagen ausgetragen.
            League A, B und C bestehen aus je vier Vierergruppen, League D aus zwei Dreiergruppen – jedes Team spielt
            innerhalb seiner Gruppe in Hin- und Rückspiel. Die Gruppensieger und -zweiten der League A ziehen ins
            Viertelfinale (März 2027) ein, das Finalturnier steigt im Juni 2027. <strong>Deutschland</strong> trifft in
            Gruppe A2 auf die Niederlande, Serbien und Griechenland, die <strong>Schweiz</strong> misst sich in
            Gruppe B1 mit Schottland, Slowenien und Nordmazedonien.
          </p>
          {/* Spieltag-Fenster */}
          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            {NL_MATCHDAYS.map(({ md, window }) => (
              <div key={md} className="rounded-xl px-4 py-3" style={{ background: '#f7f9fc', border: '1px solid #e5e8ed' }}>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Spieltag {md}</div>
                <div className="mt-0.5 text-sm font-semibold" style={{ color: NAVY }}>{window}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LEAGUES & GROUPS */}
      <section className="px-4 pb-4" style={{ background: '#f7f9fc' }}>
        <div className="container mx-auto max-w-6xl">
          {NL_LEAGUES.map((lg) => {
            const tone = LEAGUE_TONE[lg.id];
            return (
              <div key={lg.id} className="py-8">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-extrabold text-white" style={{ background: tone }}>{lg.id}</span>
                  <div>
                    <h2 className="text-2xl font-extrabold" style={{ color: NAVY }}>{lg.name}</h2>
                    <p className="text-sm text-gray-500">{lg.note}</p>
                  </div>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  {lg.groups.map((g) => <GroupCard key={g.id} group={g} tone={tone} />)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-14" style={{ background: '#fff' }}>
        <div className="container mx-auto max-w-4xl overflow-hidden rounded-3xl p-8 text-white md:p-12" style={BLUE_GLOW}>
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-extrabold md:text-3xl">Live dabei sein – mit Faltin Travel</h2>
              <p className="mt-2 max-w-xl text-white/85">
                Wir stellen Ihnen für ausgewählte Nations-League-Spiele individuelle Reisepakete inkl. Tickets/Hospitality,
                Hotel und Transfers zusammen – persönlich betreut und mit Schweizer Reisegarantie.
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-white/80">
                <span className="inline-flex items-center gap-1.5"><Ticket className="h-4 w-4" /> Offizielle Tickets &amp; Hospitality</span>
                <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Schweizer Reisegarantie</span>
              </div>
            </div>
            <Link href="/kontakt" className="inline-flex shrink-0 items-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold transition hover:opacity-90" style={{ background: ACCENT, color: '#fff', boxShadow: '0 8px 20px rgba(217,83,30,0.3)' }}>
              Unverbindlich anfragen <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-16" style={{ background: '#fff' }}>
        <div className="container mx-auto max-w-3xl">
          <h2 className="mb-6 text-2xl font-extrabold" style={{ color: NAVY }}>Häufige Fragen</h2>
          <div className="space-y-3">
            {faqs.map((f) => (
              <details key={f.question} className="group rounded-xl bg-white" style={{ border: '1px solid #e5e8ed' }}>
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-semibold" style={{ color: NAVY }}>
                  {f.question}
                </summary>
                <div className="px-5 pb-4 text-sm leading-relaxed text-gray-600">{f.answer}</div>
              </details>
            ))}
          </div>
          <p className="mt-8 flex items-start gap-2 rounded-xl px-4 py-3 text-xs text-gray-500" style={{ background: '#f7f9fc', border: '1px solid #e5e8ed' }}>
            <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#9ca3af' }} />
            Angaben zu Gruppen und Terminen gemäss offizieller UEFA-Auslosung vom 12. Februar 2026. Anstosszeiten und
            einzelne Spieldaten können durch die UEFA angepasst werden.
          </p>
        </div>
      </section>
    </>
  );
}
