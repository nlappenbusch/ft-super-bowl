'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronDown,
  X,
  Menu,
  ArrowRight,
  CalendarDays,
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
type NavColumn = { title: string; iconKey: string; items: NavLink[] };

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

type CalPreview = { name: string; href: string; category: string; dateLabel: string; startISO: string };
interface CalendarItem {
  type: 'calendar';
  label: string;
  href: string;
  events: CalPreview[];
}

export type NavItem = MegaItem | LinkItem | CalendarItem;

/* iconKey → Lucide-Icon (Menü-Daten sind serialisierbar, kommen via Prop) */
const ICONS: Record<string, LucideIcon> = {
  tennis: CircleDot,
  gauge: Gauge,
  music: Music2,
  star: Star,
  trophy: Trophy,
};

/* ─── Navigation definition ──────────────────────────────────── */
/* Fallback, falls kein dynamisches Menü übergeben wird (Daten nicht ladbar). */
const FALLBACK_NAV: NavItem[] = [
  { type: 'link', label: 'Home', href: '/' },
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
export default function NavBar({ menu }: { menu?: NavItem[] }) {
  const NAV = menu && menu.length ? menu : FALLBACK_NAV;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setNow(Date.now()); }, []);

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
      if (window.innerWidth >= 960) setMobileOpen(false);
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
  const calendarItem = NAV.find((item): item is CalendarItem => item.type === 'calendar');

  const cd = (startISO: string): string => {
    if (now === null) return '';
    const d = new Date(`${startISO}T00:00:00`);
    if (isNaN(d.getTime())) return '';
    const days = Math.ceil((d.getTime() - now) / 86400000);
    if (days < 0) return 'läuft';
    if (days === 0) return 'heute';
    if (days === 1) return 'morgen';
    return `in ${days} Tagen`;
  };

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
        className={`fixed inset-0 z-100 min-[960px]:hidden transition-opacity duration-300 ${
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
                              {(() => { const Icon = ICONS[col.iconKey] || Trophy; return <Icon className="h-3.5 w-3.5 text-white/50" />; })()}
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

              if (item.type === 'calendar') {
                return (
                  <Link
                    key="calendar-m"
                    href={item.href}
                    className="flex items-center text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 py-3 px-3 rounded-xl transition"
                    onClick={() => setMobileOpen(false)}
                  >
                    {item.label}
                  </Link>
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
          background: 'linear-gradient(132deg, #112b44 0%, #163654 55%, #1f4c75 100%)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.24)',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        {/* Main nav bar */}
        <div className="container mx-auto px-4 py-3.5 relative">
          <div
            className="flex items-center rounded-2xl px-5 py-2.5 border border-white/20 bg-white/[0.08]"
            style={{
              backdropFilter: 'blur(3px)'
            }}
          >
            {/* Logo -> Startseite dieser Site */}
            <Link href="/" className="shrink-0 min-[960px]:mr-12">
              <Image
                src="/faltin-logo.svg"
                alt="Faltin Travel"
                width={120}
                height={38}
              />
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden min-[960px]:flex items-center justify-center gap-0.5 flex-1">
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
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[14px] font-semibold transition-all duration-150 ${
                          active
                            ? 'bg-white/22 text-white shadow-[0_6px_16px_rgba(0,0,0,0.2)]'
                            : 'text-white/92 hover:text-white hover:bg-white/16'
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

                if (item.type === 'calendar') {
                  const active = openMenu === 'calendar';
                  return (
                    <div key="calendar" onMouseEnter={() => openOnHover('calendar')} onMouseLeave={scheduleClose}>
                      <button
                        onClick={() => toggleMenu('calendar')}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-[14px] font-semibold transition-all duration-150 ${
                          active
                            ? 'bg-white/22 text-white shadow-[0_6px_16px_rgba(0,0,0,0.2)]'
                            : 'text-white/92 hover:text-white hover:bg-white/16'
                        }`}
                      >
                        {item.label}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${active ? '-rotate-180' : ''}`} />
                      </button>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="px-3 py-2 rounded-xl text-[14px] font-semibold text-white/92 hover:text-white hover:bg-white/16 transition-all duration-150"
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Right: trust badge */}
            <div className="hidden min-[960px]:flex items-center shrink-0 min-[960px]:ml-12">
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
              className="min-[960px]:hidden ml-auto text-white/70 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10"
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
                  className={`grid rounded-3xl overflow-hidden shadow-2xl ${
                    hasFeatured ? 'grid-cols-[1fr_300px]' : 'grid-cols-1'
                  }`}
                  style={{ border: '1px solid rgba(0,0,0,0.08)', background: '#ffffff' }}
                >
                  {/* Columns area */}
                  <div className="bg-white p-8">
                    <div className={`grid gap-10 ${innerColClass(item.columns.length)}`}>
                      {item.columns.map((col) => (
                        <div key={col.title}>
                          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                            {(() => { const Icon = ICONS[col.iconKey] || Trophy; return <Icon className="h-4 w-4 text-slate-600" />; })()}
                            <h3
                              className="text-[11px] font-bold uppercase tracking-[0.16em]"
                              style={{ color: '#184a7b' }}
                            >
                              {col.title}
                            </h3>
                          </div>
                          <ul className="space-y-1">
                            {col.items.map((link) => (
                              <li key={link.href}>
                                <Link
                                  href={link.href}
                                  onClick={() => setOpenMenu(null)}
                                  className="group flex flex-col rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors"
                                >
                                  <span className="text-[15px] font-semibold text-slate-800 group-hover:text-[#184a7b] transition-colors">
                                    {link.label}
                                  </span>
                                  {link.desc && (
                                    <span className="text-xs text-slate-500 mt-0.5">{link.desc}</span>
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

        {/* ── Kalender-Dropdown ── */}
        {calendarItem && (
          <div
            className="absolute left-0 right-0 z-50"
            style={{
              top: '100%',
              opacity: openMenu === 'calendar' ? 1 : 0,
              pointerEvents: openMenu === 'calendar' ? 'auto' : 'none',
              transform: openMenu === 'calendar' ? 'translateY(0)' : 'translateY(-4px)',
              transition: 'opacity 180ms ease, transform 180ms ease',
            }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <div className="container mx-auto px-4 pb-6">
              <div className="mx-auto max-w-xl overflow-hidden rounded-3xl shadow-2xl" style={{ border: '1px solid rgba(0,0,0,0.08)', background: '#fff' }}>
                <div className="flex items-center justify-between px-6 py-4" style={{ background: 'linear-gradient(135deg,#163e63,#0e2842)' }}>
                  <span className="flex items-center gap-2 font-bold text-white">
                    <CalendarDays className="h-5 w-5" style={{ color: '#f5c842' }} /> Nächste Events
                  </span>
                  <a href="/api/calendar/ics" className="rounded-lg px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90" style={{ background: '#d9531e' }}>Abonnieren</a>
                </div>
                {calendarItem.events.length === 0 ? (
                  <div className="px-6 py-8 text-center text-sm text-gray-400">Keine anstehenden Events.</div>
                ) : (
                  <div>
                    {calendarItem.events.map((ev) => (
                      <Link
                        key={ev.href}
                        href={ev.href}
                        onClick={() => setOpenMenu(null)}
                        className="flex items-center gap-3 border-b px-6 py-3 transition-colors hover:bg-slate-50"
                        style={{ borderColor: '#eef1f4' }}
                      >
                        <span className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold text-white" style={{ background: '#143047' }}>
                          {ev.dateLabel.slice(0, 5)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold" style={{ color: '#143047' }}>{ev.name}</span>
                          <span className="block text-xs text-gray-500">{ev.dateLabel} · {ev.category}</span>
                        </span>
                        {cd(ev.startISO) && (
                          <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: '#eef3fb', color: '#18395a' }}>{cd(ev.startISO)}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
                <Link
                  href="/kalender"
                  onClick={() => setOpenMenu(null)}
                  className="flex items-center justify-center gap-1.5 px-6 py-3.5 text-sm font-bold transition-colors hover:bg-slate-50"
                  style={{ color: '#d9531e' }}
                >
                  Alle Events im Kalender <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
