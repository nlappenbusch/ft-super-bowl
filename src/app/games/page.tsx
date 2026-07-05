import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FT Arcade | Faltin Travel',
  robots: { index: false, follow: false },
};

const NAVY = '#143047';
const ORANGE = '#d9531e';

const GAMES = [
  {
    href: '/games/space',
    emoji: '🚀',
    title: 'Faltin One',
    subtitle: 'Space Shooter',
    desc: 'Steuere den FT-Raumgleiter durchs Event-Universum und schieße entgegenfliegende Footballs, Pokale und Koffer ab, bevor sie dich erwischen.',
    controls: 'Pfeiltasten/WASD oder Maus · Leertaste/Klick schießt',
  },
  {
    href: '/games/hostess',
    emoji: '🎯',
    title: 'Hospitality Hunt',
    subtitle: 'Moorhuhn-Style',
    desc: 'Das Promo-Team poppt überall im Stadion auf — triff so viele wie möglich in 60 Sekunden. Keine Sorge: Sie kommen alle wieder.',
    controls: 'Zielen & klicken (oder tippen)',
  },
];

export default function GamesPage() {
  return (
    <div className="min-h-screen px-4 py-14" style={{ background: `radial-gradient(1200px 600px at 50% -10%, #1d4468 0%, ${NAVY} 55%, #0c2138 100%)` }}>
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-xs font-bold uppercase tracking-[0.3em]" style={{ color: ORANGE }}>Inoffiziell · Feierabend-Modus</p>
        <h1 className="mt-2 text-center text-4xl font-black text-white md:text-5xl">
          FT <span style={{ color: ORANGE }}>Arcade</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed text-white/60">
          Zwei Minuten Pause zwischen zwei Buchungsanfragen? Highscores werden lokal gespeichert — der Flurfunk regelt den Rest.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {GAMES.map((g) => (
            <Link
              key={g.href}
              href={g.href}
              className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-all hover:-translate-y-1 hover:border-white/25 hover:bg-white/10"
            >
              <div className="text-5xl transition-transform group-hover:scale-110">{g.emoji}</div>
              <div className="mt-3 text-xs font-bold uppercase tracking-widest" style={{ color: ORANGE }}>{g.subtitle}</div>
              <div className="mt-1 text-2xl font-extrabold text-white">{g.title}</div>
              <p className="mt-2 text-sm leading-relaxed text-white/60">{g.desc}</p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-white/40">{g.controls}</p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: ORANGE }}>
                Spielen →
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-center text-[11px] text-white/30">
          Faltin Travel AG · streng geheime Abteilung für Produktivitätsforschung
        </p>
      </div>
    </div>
  );
}
