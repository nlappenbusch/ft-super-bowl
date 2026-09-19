'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  LogOut, Menu, Bell, AtSign, MessageSquare, StickyNote, UserPlus, Check,
  Sparkles, Search, ChevronRight,
} from 'lucide-react';
import { COLORS } from './ui';
import { ADMIN_NAV, AI_WORKSPACE_HREF, activeNavGroupId, isNavItemActive, type AdminNavGroup } from './adminNav';
import AdminCommandPalette from './AdminCommandPalette';

async function doLogout() {
  try { await fetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  window.location.href = '/admin/login';
}

interface AdminShellProps {
  title: string;
  children: React.ReactNode;
  /** Volle Content-Breite (z.B. für Board-Ansichten) statt max-w-7xl. */
  wide?: boolean;
  /**
   * Randlos: `<main>` ohne Padding/Max-Breite, exakt so hoch wie der Viewport unter der
   * Topbar und ohne eigenen Scroll — für Seiten mit eigenem, intern scrollendem
   * Vollhöhen-Layout (z.B. Chat).
   */
  fullBleed?: boolean;
}

const ICON = 'h-[18px] w-[18px]';

/** Höhe der Topbar; `fullBleed`-Seiten ziehen genau diese Höhe vom Viewport ab. */
const TOPBAR_HEIGHT_CLASS = 'h-16';
const FULL_BLEED_MAIN_CLASS = 'h-[calc(100dvh-4rem)] overflow-hidden';

// ==================== Auf-/Zu-Zustand der Nav-Gruppen (localStorage) ====================
// Als externer Store (useSyncExternalStore): Server/Hydration sehen die Defaults, danach
// gilt der gespeicherte Zustand. Sidebar und Mobile-Drawer teilen ihn. Ohne Storage
// (privater Modus, gesperrt) funktioniert das Auf-/Zuklappen trotzdem, nur ohne Gedächtnis.

const NAV_STATE_KEY = 'ft-admin-nav-groups';
type NavOpenState = Record<string, boolean>;

let navStateRaw: string | null = null;
const navStateListeners = new Set<() => void>();

function readNavStateRaw(): string {
  if (navStateRaw === null) {
    try { navStateRaw = window.localStorage.getItem(NAV_STATE_KEY) ?? ''; } catch { navStateRaw = ''; }
  }
  return navStateRaw;
}

function subscribeNavState(onChange: () => void): () => void {
  navStateListeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== NAV_STATE_KEY) return;
    navStateRaw = e.newValue ?? '';
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    navStateListeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function parseNavState(raw: string): NavOpenState {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: NavOpenState = {};
    for (const [k, val] of Object.entries(v)) if (typeof val === 'boolean') out[k] = val;
    return out;
  } catch {
    return {};
  }
}

function writeNavState(next: NavOpenState) {
  navStateRaw = JSON.stringify(next);
  try { window.localStorage.setItem(NAV_STATE_KEY, navStateRaw); } catch { /* ohne Storage: nur im Speicher */ }
  navStateListeners.forEach((l) => l());
}

function useNavGroupState() {
  const raw = useSyncExternalStore(subscribeNavState, readNavStateRaw, () => '');
  const stored = useMemo(() => parseNavState(raw), [raw]);
  const setOpen = useCallback((groupId: string, open: boolean) => {
    writeNavState({ ...parseNavState(readNavStateRaw()), [groupId]: open });
  }, []);
  return { stored, setOpen };
}

// Tastenkürzel-Hinweis passend zur Plattform (Server/Hydration: ⌘K).
const noopSubscribe = () => () => {};
function useShortcutHint(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Strg K'),
    () => '⌘K',
  );
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

function NavGroupSection({
  group, pathname, activeGroup, stored, setOpen, onNavigate,
}: {
  group: AdminNavGroup;
  pathname: string;
  activeGroup: string | null;
  stored: Record<string, boolean>;
  setOpen: (groupId: string, open: boolean) => void;
  onNavigate?: () => void;
}) {
  const listId = useId();
  const collapsible = !!group.label;
  const forced = group.id === activeGroup;
  const open = !collapsible || forced || (stored[group.id] ?? !!group.defaultOpen);

  return (
    <div className={collapsible ? 'mb-1.5' : 'mb-4'}>
      {collapsible && (
        <button
          type="button"
          onClick={() => { if (!forced) setOpen(group.id, !open); }}
          aria-expanded={open}
          aria-controls={listId}
          aria-disabled={forced || undefined}
          title={forced ? 'Enthält die aktuelle Seite' : open ? 'Einklappen' : 'Aufklappen'}
          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition ${
            forced ? 'cursor-default text-white/45' : 'text-white/35 hover:bg-white/5 hover:text-white/70'
          }`}
        >
          <span>{group.label}</span>
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? 'rotate-90' : ''} ${forced ? 'opacity-40' : ''}`}
            aria-hidden="true"
          />
        </button>
      )}
      <div id={listId} hidden={!open} className="space-y-0.5 pb-1">
        {group.items.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                active ? 'text-white' : 'text-white/[0.72] hover:bg-white/5 hover:text-white'
              }`}
              style={active ? { background: COLORS.accent } : undefined}
            >
              <Icon className={`${ICON} shrink-0`} aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SidebarContent({
  pathname, onNavigate, onOpenSearch, user,
}: {
  pathname: string;
  onNavigate?: () => void;
  onOpenSearch: () => void;
  user: { name: string; src: string } | null;
}) {
  const { stored, setOpen } = useNavGroupState();
  const shortcut = useShortcutHint();
  const activeGroup = activeNavGroupId(pathname);
  const navRef = useRef<HTMLElement>(null);

  // Aktiven Eintrag in der (eigenständig scrollenden) Nav sichtbar machen.
  useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
  }, [pathname]);

  return (
    <div className="flex h-full flex-col" style={{ background: COLORS.navy }}>
      {/* Brand */}
      <div className="flex shrink-0 items-center gap-2.5 px-6 pb-4 pt-6">
        <Image src="/faltin-logo.svg" alt="Faltin Travel" width={118} height={38} />
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60" style={{ background: 'rgba(255,255,255,0.08)' }}>
          Admin
        </span>
      </div>

      {/* Schnellsuche */}
      <div className="shrink-0 px-3 pb-4">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-haspopup="dialog"
          aria-keyshortcuts="Meta+K Control+K"
          className="flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-sm text-white/55 transition hover:bg-white/10 hover:text-white/85"
          style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)' }}
        >
          <Search className={`${ICON} shrink-0`} aria-hidden="true" />
          <span className="flex-1 text-left">Suchen …</span>
          <kbd
            className="rounded-md px-1.5 py-0.5 font-sans text-[10px] font-semibold text-white/50"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            {shortcut}
          </kbd>
        </button>
      </div>

      {/* Nav (scrollt eigenständig) */}
      <nav ref={navRef} aria-label="Admin-Navigation" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        {ADMIN_NAV.map((group) => (
          <NavGroupSection
            key={group.id}
            group={group}
            pathname={pathname}
            activeGroup={activeGroup}
            stored={stored}
            setOpen={setOpen}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {/* User + Logout */}
      <div className="shrink-0 border-t px-3 py-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
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

export default function AdminShell({ title, children, fullBleed = false }: AdminShellProps) {
  const pathname = usePathname() ?? '';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; src: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/session').then((r) => r.json()).then((d) => { if (d?.user) setUser(d.user); }).catch(() => {});
  }, []);

  // Cmd+K / Strg+K öffnet (bzw. schliesst) die Schnellsuche auf jeder Admin-Seite.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.shiftKey) return;
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return;
      e.preventDefault();
      setMobileOpen(false);
      setPaletteOpen((o) => !o);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openSearch = () => { setMobileOpen(false); setPaletteOpen(true); };
  const closeSearch = useCallback(() => setPaletteOpen(false), []);
  const onAiWorkspace = pathname === AI_WORKSPACE_HREF || pathname.startsWith(AI_WORKSPACE_HREF + '/');

  return (
    <div className="min-h-screen" style={{ background: COLORS.surfaceMuted }}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <SidebarContent pathname={pathname} user={user} onOpenSearch={openSearch} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} onOpenSearch={openSearch} user={user} />
          </div>
        </div>
      )}

      {/* Schnellsuche (Cmd+K) */}
      {paletteOpen && <AdminCommandPalette pathname={pathname} onClose={closeSearch} />}

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Topbar (feste Höhe, siehe TOPBAR_HEIGHT_CLASS) */}
        <header className={`sticky top-0 z-20 ${TOPBAR_HEIGHT_CLASS} border-b bg-white/80 backdrop-blur`} style={{ borderColor: COLORS.stroke }}>
          <div className="flex h-full items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-gray-600 transition hover:bg-gray-100 lg:hidden"
              aria-label="Menü"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="min-w-0 truncate text-sm font-bold" style={{ color: COLORS.navy }}>{title}</h1>
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {!onAiWorkspace && (
                <Link
                  href={AI_WORKSPACE_HREF}
                  title="Faltin-KI – KI-Arbeitsplatz öffnen"
                  className="flex items-center gap-1.5 rounded-lg border p-2 text-sm font-semibold transition hover:bg-orange-50 sm:px-3 sm:py-1.5"
                  style={{ color: COLORS.accent, borderColor: 'rgba(217,83,30,0.3)' }}
                >
                  <Sparkles className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">Faltin-KI</span>
                </Link>
              )}
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Einheitlich volle Content-Breite auf allen Admin-Seiten (TASK-00083);
            `wide` bleibt als Prop für Abwärtskompatibilität, hat aber keine Wirkung mehr.
            `fullBleed`: randlos, genau Viewport minus Topbar, Seite scrollt selbst. */}
        {fullBleed ? (
          <main className={FULL_BLEED_MAIN_CLASS}>{children}</main>
        ) : (
          <main className="mx-auto max-w-none px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        )}
      </div>
    </div>
  );
}
