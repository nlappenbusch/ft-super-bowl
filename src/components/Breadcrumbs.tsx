import Link from 'next/link';
import { siteConfig } from '@/lib/siteConfig';

export interface Crumb {
  name: string;
  href: string;
}

/**
 * Sichtbare Breadcrumbs + BreadcrumbList-JSON-LD (Rich Results).
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
      <nav aria-label="Breadcrumb" className="border-b bg-white" style={{ borderColor: '#e5e8ed' }}>
        <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${c.href}-${i}`} className="flex items-center gap-2">
                {i > 0 && <span className="text-gray-300" aria-hidden>/</span>}
                {last ? (
                  <span aria-current="page" className="font-semibold" style={{ color: '#143047' }}>{c.name}</span>
                ) : (
                  <Link href={c.href} className="text-gray-500 transition hover:text-[#d9531e]">{c.name}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
