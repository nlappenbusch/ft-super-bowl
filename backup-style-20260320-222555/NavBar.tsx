'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronDown,
  X,
  Menu,
  ArrowRight,
  Phone,
  Trophy,
  CircleDot,
  Gauge,
  Star,
  Music2,
  type LucideIcon,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────── */
type NavLink = { label: string; href: string; desc?: string };
type NavColumn = { title: string; icon: LucideIcon; items: NavLink[] };

interface MegaItem {
  type: 'mega';
  label: string;
  key: string;
  columns: NavColumn[];
  featured?: { title: string; desc: string; href: string; image: string };
}

interface LinkItem {
  type: 'link';
  label: string;
  href: string;
  external?: boolean;
}

type NavItem = MegaItem | LinkItem;

/* ─── Navigation definition ──────────────────────────────────── */
const NAV: NavItem[] = [
  { type: 'link', label: 'Home', href: 'https://faltintravel.com' },
  {
    type: 'mega',
    label: 'Sportevents',
    key: 'sport',
    columns: [
      {
        title: 'Fussball',
        icon: Trophy,
        items: [
          { label: 'Champions League Finale', href: 'https://faltintravel.com/champions-league-finale-tickets/', desc: 'Das Finale der Könige' },
          { label: 'Premier League', href: 'https://faltintravel.com/premier-league-tickets/', desc: 'Englands Top-Liga live' },
        ],
      },
      {
        title: 'Tennis',
        icon: CircleDot,
        items: [
          { label: 'Wimbledon 2026', href: 'https://faltintravel.com/wimbledon-tickets/', desc: 'Das prestigeträchtigste Turnier' },
          { label: 'French Open 2026', href: 'https://faltintravel.com/french-open-tickets/', desc: 'Roland Garros, Paris' },
        ],
      },
      {
        title: 'Motorsport',
        icon: Gauge,
        items: [
          { label: 'Formel 1 2025', href: 'https://faltintravel.com/formel-1-tickets/', desc: 'Races weltweit' },
          { label: 'Monaco Grand Prix', href: 'https://faltintravel.com/monaco-grand-prix-tickets/', desc: 'Glamour in Monte Carlo' },
        ],
      },
      {
        title: 'American Sports',
        icon: Star,
        items: [
          { label: 'Super Bowl 2027', href: 'https://faltintravel.com/super-bowl-2027-tickets/', desc: 'LA, 14. Februar 2027' },
          { label: 'Olympia 2028', href: 'https://faltintravel.com/olympia-2028-tickets/', desc: 'Los Angeles 2028' },
        ],
      },
    ],
    featured: {
      title: 'Super Bowl LXI 2027',
      desc: 'Das grösste Sportevent der Welt. VIP-Pakete mit 4★ Hotel, Premium-Tickets & exklusivem Zugang.',
      href: '/',
      image: '/Super-Bowl-LXI-Tickets-Packages.webp',
    },
  },
  {
    type: 'mega',
    label: 'Kulturevents',
    key: 'kultur',
    columns: [
      {
        title: 'Klassik & Oper',
        icon: Music2,
        items: [
          { label: 'Neujahrskonzert 2027', href: 'https://faltintravel.com/neujahrskonzert-tickets/', desc: 'Wien, Musikverein' },
          { label: 'Wiener Opernball', href: 'https://faltintravel.com/wiener-opernball-tickets/', desc: 'Der Ball der Bälle' },
        ],
      },
    ],
  },
  { type: 'link', label: 'Incentive', href: 'https://incentive-agentur.ch/', external: true },
  { type: 'link', label: 'Über uns', href: 'https://faltintravel.com/wir-ueber-uns/' },
  { type: 'link', label: 'Kontakt', href: 'https://faltintravel.com/kontakt/' },
];

function innerColClass(count: number): string {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  return 'grid-cols-4';
}

/* ─── Component ──────────────────────────────────────────────── */
export default function NavBar() {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1280) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const toggleMenu = useCallback((key: string) => {
    setOpenMenu(prev => (prev === key ? null : key));
  }, []);

  const openOnHover = useCallback((key: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenMenu(key);
  }, []);

  const scheduleClose = useCallback(() => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const megaItems = NAV.filter((item): item is MegaItem => item.type === 'mega');

  return (
    <>
      {/* Dimmed backdrop behind mega menus */}
      {openMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          style={{ backdropFilter: 'blur(2px)' }}
          onClick={() => setOpenMenu(null)}
        />
      )}

      {/* ── Mobile Drawer ── */}
      <div
        className={`fixed inset-0 z-100 xl:hidden transition-opacity duration-300 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
        <div
          className={`absolute top-0 right-0 h-full w-80 max-w-full flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
          style={{ background: 'linear-gradient(180deg, #0d1f35 0%, #142d4a 100%)' }}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <Image src="/faltin-logo.svg" alt="Faltin Travel" width={110} height={34} />
            <button
              onClick={() => setMobileOpen(false)}
              className="text-white/60 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10"
              aria-label="Menü schliessen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Phone strip */}
          <div className="flex items-center gap-2 px-5 py-2.5 text-xs text-white/50 border-b border-white/10">
            <Phone className="w-3 h-3" />
            <a href="tel:+41447002277" className="hover:text-white transition">+41 44 700 22 77</a>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map((item) => {
              if (item.type === 'mega') {
                const expanded = mobileExpanded === item.key;
                return (
                  <div key={item.key}>
                    <button
                      onClick={() => setMobileExpanded(expanded ? null : item.key)}
                      className="w-full flex items-center justify-between text-white text-sm font-semibold py-3 px-3 rounded-xl hover:bg-white/10 transition"
                    >
                      {item.label}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${expanded ? '-rotate-180' : ''}`}
                      />
                    </button>
                    {expanded && (
                      <div className="ml-2 mt-1 mb-2 space-y-3 border-l border-white/10 pl-3">
                        {item.columns.map((col) => (
                          <div key={col.title}>
                            <div className="flex items-center gap-1.5 px-2 py-1">
                              <col.icon className="h-3.5 w-3.5 text-white/50" />
                              <span className="text-[10px] uppercase tracking-widest font-bold text-white/40">
                                {col.title}
                              </span>
                            </div>
                            {col.items.map((link) => (
                              <Link
                                key={link.href}
                                href={link.href}
                                className="block text-sm text-white/75 hover:text-white hover:bg-white/10 rounded-lg px-2 py-2 transition"
                                onClick={() => setMobileOpen(false)}
                              >
                                {link.label}
                              </Link>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="flex items-center text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 py-3 px-3 rounded-xl transition"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ── Main Header ── */}
      <header
        ref={headerRef}
        className="sticky top-0 z-50"
        style={{
          background: 'linear-gradient(132deg, #0f2640 0%, #143047 45%, #1c4f80 100%)',
          boxShadow: '0 10px 34px rgba(5, 14, 24, 0.35)',
          borderBottom: '1px solid rgba(255,255,255,0.09)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 12% 8%, rgba(255,255,255,0.12), transparent 35%), radial-gradient(circle at 85% 12%, rgba(241,70,36,0.18), transparent 28%)'
          }}
        />

        {/* Main nav bar */}
        <div className="container mx-auto px-4 py-3.5 relative">
          <div
            className="flex items-center rounded-2xl px-4 py-2"
            style={{
              background: 'linear-gradient(140deg, rgba(255,255,255,0.11), rgba(255,255,255,0.04))',
              border: '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(8px)'
            }}
          >
            {/* Logo */}
            <Link href="https://faltintravel.com" className="shrink-0 xl:mr-12">
              <Image
                src="/faltin-logo.svg"
                alt="Faltin Travel"
                width={120}
                height={38}
              />
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden xl:flex items-center justify-center gap-1 flex-1">
              {NAV.map((item) => {
                if (item.type === 'mega') {
                  const active = openMenu === item.key;
                  return (
                    <div
                      key={item.key}
                      onMouseEnter={() => openOnHover(item.key)}
                      onMouseLeave={scheduleClose}
                    >
                      <button
                        onClick={() => toggleMenu(item.key)}
                        className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-[13px] tracking-[0.015em] font-semibold transition-all duration-150 ${
                          active
                            ? 'bg-white/18 text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]'
                            : 'text-white/85 bg-white/[0.045] hover:text-white hover:bg-white/14'
                        }`}
                      >
                        {item.label}
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${active ? '-rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="px-3.5 py-2 rounded-lg text-[13px] tracking-[0.015em] font-semibold text-white/85 bg-white/[0.045] hover:text-white hover:bg-white/14 transition-all duration-150"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right: trust badge */}
            <div className="hidden xl:flex items-center shrink-0 xl:ml-12">
              <a
                href="https://www.garantiefonds.ch/teilnehmer/teilnehmer-am-garantiefonds"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-85 transition"
              >
                <Image
                  src="/Schweizer-Reisegarantie-300x120-1.webp"
                  alt="Schweizer Reisegarantie"
                  width={96}
                  height={38}
                  className="opacity-95"
                />
              </a>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="xl:hidden ml-auto text-white/70 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10"
              aria-label="Menü öffnen"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* ── Mega Menu Panels ── */}
        {megaItems.map((item) => {
          const isOpen = openMenu === item.key;
          const hasFeatured = !!item.featured;

          return (
            <div
              key={item.key}
              className="absolute left-0 right-0 z-50"
              style={{
                top: '100%',
                opacity: isOpen ? 1 : 0,
                pointerEvents: isOpen ? 'auto' : 'none',
                transform: isOpen ? 'translateY(0)' : 'translateY(-4px)',
                transition: 'opacity 180ms ease, transform 180ms ease',
              }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <div className="container mx-auto px-4 pt-0 pb-6">
                <div
                  className={`grid rounded-2xl overflow-hidden shadow-2xl ${
                    hasFeatured ? 'grid-cols-[1fr_260px]' : 'grid-cols-1'
                  }`}
                  style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                >
                  {/* Columns area */}
                  <div className="bg-white p-7">
                    <div className={`grid gap-8 ${innerColClass(item.columns.length)}`}>
                      {item.columns.map((col) => (
                        <div key={col.title}>
                          <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-gray-100">
                            <col.icon className="h-4 w-4 text-slate-500" />
                            <h3
                              className="text-[10px] font-bold uppercase tracking-[0.2em]"
                              style={{ color: '#184a7b' }}
                            >
                              {col.title}
                            </h3>
                          </div>
                          <ul className="space-y-0.5">
                            {col.items.map((link) => (
                              <li key={link.href}>
                                <Link
                                  href={link.href}
                                  onClick={() => setOpenMenu(null)}
                                  className="group flex flex-col rounded-lg px-2 py-2 hover:bg-blue-50 transition-colors"
                                >
                                  <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-700 transition-colors">
                                    {link.label}
                                  </span>
                                  {link.desc && (
                                    <span className="text-xs text-gray-400 mt-0.5">{link.desc}</span>
                                  )}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Featured spotlight card */}
                  {item.featured && (
                    <Link
                      href={item.featured.href}
                      onClick={() => setOpenMenu(null)}
                      className="relative group overflow-hidden block min-h-[200px]"
                      style={{ background: 'linear-gradient(160deg, #0d1f35, #184a7b)' }}
                    >
                      {/* Background image */}
                      <div className="absolute inset-0 opacity-25 group-hover:opacity-40 transition-opacity duration-500">
                        <Image
                          src={item.featured.image}
                          alt={item.featured.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      {/* Bottom gradient */}
                      <div
                        className="absolute inset-0"
                        style={{ background: 'linear-gradient(to top, rgba(10,24,42,0.97) 0%, rgba(10,24,42,0.2) 60%)' }}
                      />
                      {/* Content */}
                      <div className="relative h-full flex flex-col justify-end p-6">
                        <div className="text-[10px] uppercase tracking-[0.25em] font-bold mb-2" style={{ color: '#f97316' }}>
                          ★ Featured
                        </div>
                        <h3 className="text-white font-bold text-lg leading-tight mb-2">
                          {item.featured.title}
                        </h3>
                        <p className="text-white/60 text-xs leading-relaxed mb-4">
                          {item.featured.desc}
                        </p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold group-hover:gap-2.5 transition-all duration-200" style={{ color: '#fb923c' }}>
                          Mehr erfahren
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </header>
    </>
  );
}
