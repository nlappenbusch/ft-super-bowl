'use client';

import { usePathname } from 'next/navigation';
import NavBar from './NavBar';

const EXCLUDED_PREFIXES = ['/admin', '/embed', '/wordpress-preview', '/shortcode-test'];

export default function NavBarWrapper() {
  const pathname = usePathname();
  if (EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;
  return <NavBar />;
}
