'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SectionCard, Badge, Spinner, EmptyState, COLORS } from './ui';
import { Inbox, ListTodo, Hash, Clock } from 'lucide-react';

interface Booking {
  id: string;
  email: string;
  request_number?: string | null;
  package_title?: string;
  total_price?: number;
  status: 'new' | 'in_progress' | 'offer' | 'booked' | 'rejected';
  assigned_to?: string | null;
  travelers?: string | Array<{ firstName?: string; lastName?: string; first_name?: string; last_name?: string }>;
}
interface Task {
  id: string;
  title: string;
  status: 'offen' | 'in_arbeit' | 'erledigt';
  due_date?: string | null;
}
interface Emp { id: string; email?: string; name: string }

const OPEN_BOOKING = new Set(['new', 'in_progress', 'offer']);

function bName(b: Booking): string {
  if (!b.travelers) return b.email;
  try {
    const t = typeof b.travelers === 'string' ? JSON.parse(b.travelers) : b.travelers;
    const f = t?.[0]?.firstName || t?.[0]?.first_name || '';
    const l = t?.[0]?.lastName || t?.[0]?.last_name || '';
    return [f, l].filter(Boolean).join(' ') || b.email;
  } catch { return b.email; }
}
function money(n?: number) {
  if (!n) return '';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);
}
function dueLabel(s?: string | null): { text: string; overdue: boolean } | null {
  if (!s) return null;
  try {
    const d = new Date(s); d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return { text: `${Math.abs(diff)} Tage überfällig`, overdue: true };
    if (diff === 0) return { text: 'heute fällig', overdue: true };
    if (diff === 1) return { text: 'morgen fällig', overdue: false };
    return { text: `in ${diff} Tagen`, overdue: false };
  } catch { return null; }
}

const BSTATUS: Record<string, { label: string; tone: 'accent' | 'info' | 'muted' }> = {
  new: { label: 'Neu', tone: 'accent' },
  in_progress: { label: 'Kontaktiert', tone: 'info' },
  offer: { label: 'Angebot', tone: 'info' },
};
const TSTATUS: Record<string, { label: string; tone: 'accent' | 'info' | 'muted' }> = {
  offen: { label: 'Offen', tone: 'accent' },
  in_arbeit: { label: 'In Arbeit', tone: 'info' },
  warten_requester: { label: 'Wartet auf Rückmeldung', tone: 'muted' },
  warten_dritte: { label: 'Wartet auf Extern', tone: 'muted' },
};

export default function MyWork() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Emp | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [noMatch, setNoMatch] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const sess = await fetch('/api/auth/session').then((r) => r.json()).catch(() => null);
        const email = (sess?.user?.email || '').toLowerCase();
        const team = await fetch('/api/admin/team').then((r) => r.json()).catch(() => ({}));
        const emp = (team?.data as Emp[] | undefined)?.find((e) => (e.email || '').toLowerCase() === email && !!email);
        if (!emp) { setNoMatch(true); return; }
        setMe(emp);
        const [bk, tk] = await Promise.all([
          fetch('/api/bookings').then((r) => r.json()).catch(() => ({})),
          fetch(`/api/admin/tasks?assignee=${encodeURIComponent(emp.id)}`).then((r) => r.json()).catch(() => ({})),
        ]);
        setBookings(((bk?.data as Booking[]) || []).filter((b) => b.assigned_to === emp.id && OPEN_BOOKING.has(b.status)));
        setTasks(((tk?.data as Task[]) || []).filter((t) => t.status !== 'erledigt'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-2xl border py-10 text-center" style={{ borderColor: COLORS.stroke }}><Spinner /></div>
        ))}
      </div>
    );
  }
  // Lokaler Admin ohne Mitarbeiter-Match → Sektion ausblenden
  if (noMatch) return null;

  const firstName = me?.name?.split(' ')[0] || '';

  return (
    <div className="mb-6 grid gap-6 lg:grid-cols-2">
      <SectionCard
        title={firstName ? `Meine Vorgänge · ${firstName}` : 'Meine Vorgänge'}
        icon={<Inbox className="h-5 w-5" />}
        actions={<Badge tone="accent">{bookings.length}</Badge>}
      >
        {bookings.length === 0 ? (
          <EmptyState icon={<Inbox className="h-7 w-7" />} title="Keine offenen Vorgänge" />
        ) : (
          <div className="divide-y" style={{ borderColor: COLORS.stroke }}>
            {bookings.slice(0, 8).map((b) => {
              const s = BSTATUS[b.status] || { label: b.status, tone: 'muted' as const };
              return (
                <Link key={b.id} href="/admin/crm" className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold" style={{ color: COLORS.navy }}>{bName(b)}</span>
                      {b.request_number && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] font-bold" style={{ color: COLORS.textMuted }}>
                          <Hash className="h-3 w-3" />{b.request_number}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs" style={{ color: COLORS.textMuted }}>{b.package_title || '–'}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {b.total_price ? <span className="text-sm font-bold" style={{ color: COLORS.navy }}>{money(b.total_price)}</span> : null}
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Meine Aufgaben"
        icon={<ListTodo className="h-5 w-5" />}
        actions={<Link href="/admin/aufgaben"><Badge tone="info">{tasks.length}</Badge></Link>}
      >
        {tasks.length === 0 ? (
          <EmptyState icon={<ListTodo className="h-7 w-7" />} title="Keine offenen Aufgaben" />
        ) : (
          <div className="divide-y" style={{ borderColor: COLORS.stroke }}>
            {tasks.slice(0, 8).map((t) => {
              const s = TSTATUS[t.status] || { label: t.status, tone: 'muted' as const };
              const due = dueLabel(t.due_date);
              return (
                <Link key={t.id} href="/admin/aufgaben" className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-70">
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-semibold" style={{ color: COLORS.navy }}>{t.title}</span>
                    {due && (
                      <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: due.overdue ? COLORS.danger : COLORS.textMuted }}>
                        <Clock className="h-3 w-3" />{due.text}
                      </span>
                    )}
                  </div>
                  <Badge tone={s.tone}>{s.label}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
