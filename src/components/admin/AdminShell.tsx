'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Inbox, KanbanSquare, Wallet,
  CalendarDays, Layers, Package, HelpCircle, Tag, MapPin,
  Mail, Settings, LogOut, Menu,
} from 'lucide-react';
import AdminGate from './AdminGate';
import { COLORS } from './ui';

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
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/mail', label: 'E-Mail / M365', icon: <Mail className={ICON} /> },
      { href: '/admin/settings', label: 'Einstellungen', icon: <Settings className={ICON} /> },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col" style={{ background: COLORS.navy }}>
      {/* Brand */}
      <div className="flex items-center gap-2 px-6 py-6">
        <span className="text-lg font-extrabold tracking-wide text-white">Faltin</span>
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

      {/* Logout */}
      <div className="border-t px-3 py-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <button
          onClick={() => {
            sessionStorage.removeItem('admin_authenticated');
            window.location.href = '/admin';
          }}
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

  return (
    <AdminGate title={title}>
      <div className="min-h-screen" style={{ background: COLORS.surfaceMuted }}>
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64">
              <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
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
    </AdminGate>
  );
}
