import { ShieldCheck, Trophy, Clock, HeadphonesIcon } from 'lucide-react';

const USPS = [
  { icon: ShieldCheck, title: 'Schweizer Reisegarantie', text: 'Abgesichert über den Garantiefonds der Reisebranche.' },
  { icon: Trophy, title: 'Zugang zu Top-Events', text: 'Offizielle Hospitality-Tickets für die grössten Highlights.' },
  { icon: Clock, title: '20+ Jahre Erfahrung', text: 'Mehrfach ausgezeichneter Event- & Incentive-Spezialist.' },
  { icon: HeadphonesIcon, title: 'Persönliche Betreuung', text: 'Direkte Ansprechpartner von der Anfrage bis zur Rückreise.' },
];

export default function UspStrip() {
  return (
    <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {USPS.map((u) => (
        <div
          key={u.title}
          className="flex items-start gap-3 rounded-2xl border border-white/12 bg-white/[0.06] p-4 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.1]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f36a2a]/20">
            <u.icon className="h-5 w-5 text-[#f5a07a]" />
          </span>
          <div>
            <p className="text-sm font-bold text-white leading-snug">{u.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-blue-100/80">{u.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
