'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Inbox, KanbanSquare, Wallet,
  CalendarDays, Layers, Package, HelpCircle, Tag, MapPin,
  Mail, Settings, LogOut, Menu, Bell, AtSign, MessageSquare, StickyNote, UserPlus, Check,
  Users, Timer, Plane, ListTodo, Trophy, Sparkles, Contact, Activity, Globe, Code2, Wand2, KeyRound } from 'lucide-react';
import { COLORS } from './ui';

async function doLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  window.location.href = '/admin/login';
}

interface AdminShellProps {
  title: string;
  children: React.ReactNode;
  /** Volle Content-Breite (z.B. für Board-Ansichten) statt max-w-7xl. */
  wide?: boolean;
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
      { href: '/admin/incentive', label: 'Incentive Builder', icon: <Wand2 className={ICON} /> },
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
      { href: '/admin/shortcodes', label: 'WP-Shortcodes', icon: <Code2 className={ICON} /> },
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
      { href: '/admin/api-keys', label: 'API-Keys', icon: <KeyRound className={ICON} /> },
      { href: '/admin/settings', label: 'Einstellungen', icon: <Settings className={ICON} /> },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

// ==================== Benachrichtigungs-Center (Glocke) ====================

interface Notif {
  id: string;
  type: 'task_assigned' | 'task_message' | 'task_note' | 'mention' | 'info';
  task_id: string | null;
  title: string;
  body: string;
  is_read: number;
  created_at: string;
}

const NOTIF_ICON: Record<Notif['type'], React.ReactNode> = {
  task_assigned: <UserPlus className="h-3.5 w-3.5" />,
  task_message: <MessageSquare className="h-3.5 w-3.5" />,
  task_note: <StickyNote className="h-3.5 w-3.5" />,
  mention: <AtSign className="h-3.5 w-3.5" />,
  info: <Bell className="h-3.5 w-3.5" />,
};

function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch('/api/admin/notifications?limit=15').then((x) => x.json());
      if (r?.success) { setItems(r.data || []); setUnread(r.unread || 0); }
    } catch { /* Netzwerkfehler still ignorieren */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, []);

  /** Klick auf eine Benachrichtigung: aufklappen (voller Text) + als gelesen markieren. */
  const toggleItem = async (n: Notif) => {
    setExpandedId((cur) => (cur === n.id ? null : n.id));
    if (!n.is_read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
      setUnread((u) => Math.max(0, u - 1));
      try {
        await fetch('/api/admin/notifications', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [n.id] }),
        });
      } catch { /* ignore */ }
    }
  };

  const markAll = async () => {
    try {
      await fetch('/api/admin/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    } catch { /* ignore */ }
    load();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-gray-600 transition hover:bg-gray-100"
        aria-label="Benachrichtigungen"
        title="Benachrichtigungen"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ background: COLORS.danger }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-white shadow-xl" style={{ borderColor: COLORS.stroke }}>
            <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: COLORS.stroke }}>
              <span className="text-xs font-bold" style={{ color: COLORS.navy }}>Benachrichtigungen</span>
              {unread > 0 && (
                <button onClick={markAll} className="flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: COLORS.accent }}>
                  <Check className="h-3 w-3" /> Alle als gelesen
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-3 py-6 text-center text-xs" style={{ color: 'rgba(20,48,71,0.55)' }}>Keine Benachrichtigungen.</p>
              )}
              {items.map((n) => {
                const expanded = expandedId === n.id;
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleItem(n)}
                    onKeyDown={(e) => { if (e.key === 'Enter') toggleItem(n); }}
                    className="block w-full cursor-pointer border-b px-3 py-2.5 text-left transition hover:bg-gray-50"
                    style={{ borderColor: COLORS.stroke, background: n.is_read ? '#fff' : 'rgba(233,90,12,0.05)' }}
                  >
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgba(20,48,71,0.55)' }}>
                      {NOTIF_ICON[n.type] || NOTIF_ICON.info}
                      <span className="ml-auto tabular-nums">{(n.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                    </div>
                    <div className="mt-0.5 text-xs font-semibold" style={{ color: COLORS.navy }}>{n.title}</div>
                    {n.body && (
                      <div className={`mt-0.5 text-[11px] ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`} style={{ color: 'rgba(20,48,71,0.6)' }}>
                        {n.body}
                      </div>
                    )}
                    {expanded && n.task_id && (
                      <span
                        onClick={(e) => { e.stopPropagation(); setOpen(false); window.location.href = `/admin/aufgaben?task=${n.task_id}`; }}
                        className="mt-1.5 inline-block text-[11px] font-semibold hover:underline"
                        style={{ color: COLORS.accent }}
                      >
                        Ticket öffnen →
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
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

export default function AdminShell({ title, children, wide }: AdminShellProps) {
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
              <div className="ml-auto"><NotificationBell /></div>
            </div>
          </header>

          <main className={`mx-auto ${wide ? 'max-w-none' : 'max-w-7xl'} px-4 py-6 sm:px-6 lg:px-8`}>{children}</main>
        </div>
      </div>
  );
}
