'use client';

import { Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Footer from './Footer';

const EXCLUDED_PREFIXES = ['/admin', '/embed', '/wordpress-preview', '/shortcode-test', '/tippspiel', '/games'];

/** Buchungsseite im Embed-Modus (?embed=1): ohne Site-Footer (reiner Funnel). */
function BookingFooterGate() {
  const searchParams = useSearchParams();
  if (searchParams.get('embed') === '1') return null;
  return <Footer />;
}

export default function FooterWrapper() {
  const pathname = usePathname();
  if (EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;
  if (pathname?.startsWith('/booking')) {
    return (
      <Suspense fallback={null}>
        <BookingFooterGate />
      </Suspense>
    );
  }
  return <Footer />;
}
