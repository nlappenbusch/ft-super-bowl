'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Inbox, KanbanSquare, Wallet,
  CalendarDays, Layers, Package, HelpCircle, Tag, MapPin,
  Mail, Settings, LogOut, Menu,
  Users, Timer, Plane, ListTodo, Trophy, Sparkles, Contact, Activity, Globe } from 'lucide-react';
import { COLORS } from './ui';

async function doLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  window.location.href = '/admin/login';
}

interface AdminShellProps {
  title: string;
  children: React.ReactNode;
}

interface NavItem { href: string; label: string; icon: React.ReactNode; exact?: boolean }
interface NavGroup { label?: string; items: NavItem[] }

const ICON = 'h-[18px] w-[18px]';

const NAV: NavGroup[] = [
  { items: [{ href: '/admin', label: 'Dashboard', icon: <LayoutDashboard className={ICON} />, exact: true }] },
  {
    label: 'Vertrieb',
    items: [
      { href: '/admin/buchungen', label: 'Buchungen', icon: <Inbox className={ICON} /> },
      { href: '/admin/crm', label: 'CRM', icon: <KanbanSquare className={ICON} /> },
      { href: '/admin/kunden', label: 'Kunden', icon: <Contact className={ICON} /> },
      { href: '/admin/finanzen', label: 'Finanzen', icon: <Wallet className={ICON} /> },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/events', label: 'Events', icon: <CalendarDays className={ICON} /> },
      { href: '/admin/series', label: 'Serien', icon: <Layers className={ICON} /> },
      { href: '/admin/packages', label: 'Packages', icon: <Package className={ICON} /> },
      { href: '/admin/faqs', label: 'FAQs', icon: <HelpCircle className={ICON} /> },
      { href: '/admin/categories', label: 'Kategorien SEO', icon: <Tag className={ICON} /> },
      { href: '/admin/pins', label: 'Lageplan-Icons', icon: <MapPin className={ICON} /> },
      { href: '/admin/tippspiel', label: 'WM-Tippspiel', icon: <Trophy className={ICON} /> },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/admin/team', label: 'Team & User', icon: <Users className={ICON} /> },
      { href: '/admin/zeit', label: 'Zeiterfassung', icon: <Timer className={ICON} /> },
      { href: '/admin/urlaub', label: 'Urlaub', icon: <Plane className={ICON} /> },
      { href: '/admin/aufgaben', label: 'Aufgaben', icon: <ListTodo className={ICON} /> },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/mail', label: 'E-Mail / M365', icon: <Mail className={ICON} /> },
      { href: '/admin/ai', label: 'KI-Redaktion', icon: <Sparkles className={ICON} /> },
      { href: '/admin/status', label: 'Status', icon: <Activity className={ICON} /> },
      { href: '/admin/seo', label: 'SEO & GEO', icon: <Globe className={ICON} /> },
      { href: '/admin/settings', label: 'Einstellungen', icon: <Settings className={ICON} /> },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

function SidebarContent({ pathname, onNavigate, user }: { pathname: string; onNavigate?: () => void; user: { name: string; src: string } | null }) {
  return (
    <div className="flex h-full flex-col" style={{ background: COLORS.navy }}>
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-6 py-6">
        <Image src="/faltin-logo.svg" alt="Faltin Travel" width={118} height={38} />
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60" style={{ background: 'rgba(255,255,255,0.08)' }}>
          Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV.map((group, gi) => (
          <div key={gi} className="mb-5">
            {group.label && (
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-white/35">{group.label}</div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                    style={{
                      background: active ? COLORS.accent : 'transparent',
                      color: active ? '#fff' : 'rgba(255,255,255,0.72)',
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="border-t px-3 py-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {user && (
          <div className="mb-2 px-3">
            <div className="truncate text-xs font-semibold text-white/90">{user.name}</div>
            <div className="text-[11px] text-white/40">{user.src === 'microsoft' ? 'Microsoft 365' : 'Lokaler Admin'}</div>
          </div>
        )}
        <button
          onClick={doLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/70 transition hover:bg-white/5"
        >
          <LogOut className={ICON} /> Abmelden
        </button>
      </div>
    </div>
  );
}

export default function AdminShell({ title, children }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; src: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((d) => { if (d?.user) setUser(d.user); }).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen" style={{ background: COLORS.surfaceMuted }}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent pathname={pathname} user={user} />
      </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64">
              <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} user={user} />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="lg:pl-64">
          {/* Topbar */}
          <header className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur" style={{ borderColor: COLORS.stroke }}>
            <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
              <button
                onClick={() => setMobileOpen(true)}
                className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 lg:hidden"
                aria-label="Menü"
              >
                <Menu className="h-5 w-5" />
              </button>
              <h1 className="text-sm font-bold" style={{ color: COLORS.navy }}>{title}</h1>
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
  );
}
