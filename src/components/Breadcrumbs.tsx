import Link from 'next/link';
import { Home, ChevronRight } from 'lucide-react';
import { siteConfig } from '@/lib/siteConfig';

export interface Crumb {
  name: string;
  href: string;
}

/**
 * Sichtbare Breadcrumbs (FT-Design, dunkel) + BreadcrumbList-JSON-LD.
 * Erwartet die vollständige Kette inkl. aktueller Seite (letztes Element = aktiv).
 */
export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items || items.length === 0) return null;
  const base = (siteConfig.url || '').replace(/\/$/, '');
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${base}${c.href}`,
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav
        aria-label="Breadcrumb"
        style={{ background: 'linear-gradient(180deg,#18395a 0%,#102538 100%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-1.5 gap-y-1 px-4 py-3 text-sm">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${c.href}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} aria-hidden />}
                {last ? (
                  <span aria-current="page" className="font-bold text-white">{c.name}</span>
                ) : (
                  <Link
                    href={c.href}
                    className="inline-flex items-center gap-1.5 font-medium transition-colors"
                    style={{ color: 'rgba(255,255,255,0.62)' }}
                  >
                    {i === 0 && <Home className="h-3.5 w-3.5" />}
                    <span className="hover:text-[#f5c842]">{c.name}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
