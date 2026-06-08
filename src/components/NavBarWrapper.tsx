'use client';

import { usePathname } from 'next/navigation';
import NavBar, { type NavItem } from './NavBar';

const EXCLUDED_PREFIXES = ['/admin', '/embed', '/wordpress-preview', '/shortcode-test'];

export default function NavBarWrapper({ menu }: { menu?: NavItem[] }) {
  const pathname = usePathname();
  if (EXCLUDED_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) return null;
  return <NavBar menu={menu} />;
}
