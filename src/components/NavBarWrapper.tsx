'use client';

import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NavBar, { type NavItem } from './NavBar';

const EXCLUDED_PREFIXES = ['/admin', '/embed', '/wordpress-preview', '/shortcode-test', '/tippspiel'];

/**
 * Buchungsseite im Embed-Modus (?embed=1, gesetzt von den WordPress-
 * Shortcode-Links): kein Menüband — die Seite beginnt mit dem orangen
 * Zurück-Balken. Nur für /booking aktiv, alle anderen Seiten unverändert.
 */
function BookingNavGate({ menu }: { menu?: NavItem[] }) {
  const searchParams = useSearchParams();
  if (searchParams.get('embed') === '1') return null;
  return <NavBar menu={menu} />;
}

export default function NavBarWrapper({ menu }: { menu?: NavItem[] }) {
  const pathname = usePathname();
  if (EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;
  if (pathname?.startsWith('/booking')) {
    return (
      <Suspense fallback={null}>
        <BookingNavGate menu={menu} />
      </Suspense>
    );
  }
  return <NavBar menu={menu} />;
}
