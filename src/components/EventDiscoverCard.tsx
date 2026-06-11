import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';

export interface EventDiscoverCardData {
  id: string;
  title: string;
  description: string;
  image: string;
  category: string;
  categorySlug: string;
  dateLabel: string;
  location: string;
  href: string;
  fromPrice: number | null;
  currency: string;
}

interface EventDiscoverCardProps {
  event: EventDiscoverCardData;
}

const categoryBadgeStyles: Record<string, string> = {
  sport: 'bg-orange-500/90 text-orange-50',
  sportevents: 'bg-orange-500/90 text-orange-50',
  festival: 'bg-teal-400/90 text-teal-950',
  festivals: 'bg-teal-400/90 text-teal-950',
  vip: 'bg-rose-500/90 text-rose-50',
  hospitality: 'bg-rose-500/90 text-rose-50',
  business: 'bg-amber-400/90 text-amber-950'
};

function formatFromPrice(value: number | null, currency: string) {
  if (value === null) return null;

  const formatted = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 0
  }).format(value);

  return `${currency} ${formatted}`;
}

function getCategoryBadgeClass(slug: string) {
  for (const [key, className] of Object.entries(categoryBadgeStyles)) {
    if (slug.includes(key)) return className;
  }

  return 'bg-blue-500/90 text-blue-50';
}

export default function EventDiscoverCard({ event }: EventDiscoverCardProps) {
  const formattedPrice = formatFromPrice(event.fromPrice, event.currency);

  return (
    <Link
      href={event.href}
      aria-label={`${event.title} ansehen`}
      className="group block h-full overflow-hidden rounded-[28px] border border-white/12 bg-[#081b33] shadow-[0_18px_42px_rgba(2,8,23,0.3)] transition hover:-translate-y-0.5 hover:border-white/25"
    >
      <article className="flex h-full flex-col">
        <div
          className="h-56"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(7,21,40,0.08) 0%, rgba(7,21,40,0.8) 100%), url('${event.image}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          <div className="p-4">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.08em] ${getCategoryBadgeClass(event.categorySlug)}`}>
              {event.category}
            </span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-5 flex flex-1 flex-col">
          <h3
            className="text-3xl leading-tight text-white font-semibold line-clamp-2 min-h-[4.5rem]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {event.title}
          </h3>

          <p className="text-blue-100/80 text-lg leading-relaxed mt-3 line-clamp-2 min-h-[3.6rem]">
            {event.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-blue-100/90 min-h-[2.5rem]">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <MapPin className="h-4 w-4" />
              {event.location}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <CalendarDays className="h-4 w-4" />
              {event.dateLabel}
            </span>
          </div>

          <div className="mt-auto flex items-end justify-between gap-4 pt-4">
            {formattedPrice ? (
              <p className="text-blue-100/80 leading-none">
                <span className="mr-1 text-sm font-medium">ab</span>
                <span className="text-2xl font-semibold text-white">{formattedPrice}</span>
                <span className="ml-1 text-sm">/ Pers.</span>
              </p>
            ) : (
              <p className="text-base font-medium text-blue-100/90">Preis auf Anfrage</p>
            )}
            <span className="inline-flex items-center justify-center rounded-full bg-[#f36a2a] px-5 py-2.5 text-base font-semibold text-white transition group-hover:bg-[#f57d43]">
              Anfragen
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
