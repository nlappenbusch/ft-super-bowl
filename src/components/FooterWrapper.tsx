'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

const EXCLUDED_PREFIXES = ['/admin', '/embed', '/wordpress-preview', '/shortcode-test'];

export default function FooterWrapper() {
  const pathname = usePathname();
  if (EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;
  return <Footer />;
}
