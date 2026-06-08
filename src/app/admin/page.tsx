'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, SectionCard, StatCard, Badge, Button, Spinner, EmptyState, COLORS,
} from '@/components/admin/ui';
import {
  TrendingUp, Banknote, AlertCircle, Target, Inbox, KanbanSquare,
  CalendarDays, Package, Mail, ArrowRight, Hash,
} from 'lucide-react';

interface Lead {
  id: string;
  email: string;
  request_number?: string | null;
  event_slug?: string;
  package_title?: string;
  total_price?: number;
  status: 'new' | 'in_progress' | 'booked' | 'rejected';
  created_at?: string;
  travelers?: string | Array<{ firstName?: string; lastName?: string; first_name?: string; last_name?: string }>;
}
interface Invoice {
  id: string;
  status: 'open' | 'partial' | 'paid' | 'cancelled';
  total_amount: number;
  paid_amount: number;
}

function leadName(l: Lead): string {
  if (!l.travelers) return l.email;
  try {
    const t = typeof l.travelers === 'string' ? JSON.parse(l.travelers) : l.travelers;
    const first = t?.[0]?.firstName || t?.[0]?.first_name || '';
    const last = t?.[0]?.lastName || t?.[0]?.last_name || '';
    return [first, last].filter(Boolean).join(' ') || l.email;
  } catch { return l.email; }
}
function money(n?: number) {
  if (!n) return '€0';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);
}
function when(s?: string) {
  if (!s) return '';
  try { return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return s; }
}

const STATUS: Record<Lead['status'], { label: string; tone: 'accent' | 'info' | 'ok' | 'muted' }> = {
  new: { label: 'Neu', tone: 'accent' },
  in_progress: { label: 'Kontaktiert', tone: 'info' },
  booked: { label: 'Gebucht', tone: 'ok' },
  rejected: { label: 'Verloren', tone: 'muted' },
};

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, i] = await Promise.all([fetch('/api/bookings'), fetch('/api/invoices')]);
      const ld = await l.json();
      const id = await i.json();
      if (ld.success) setLeads(ld.data || []);
      if (id.success) setInvoices(id.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const booked = leads.filter(l => l.status === 'booked');
  const totalRevenue = booked.reduce((s, l) => s + (l.total_price || 0), 0);
  const paidRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0);
  const openInvoices = invoices.filter(i => i.status === 'open' || i.status === 'partial');
  const openAmount = openInvoices.reduce((s, i) => s + (i.total_amount - (i.paid_amount || 0)), 0);
  const conversion = leads.length ? Math.round((booked.length / leads.length) * 100) : 0;
  const newLeads = leads.filter(l => l.status === 'new');
  const recent = [...leads].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);

  const quickLinks = [
    { href: '/admin/buchungen', label: 'Buchungen', icon: <Inbox className="h-5 w-5" /> },
    { href: '/admin/crm', label: 'CRM', icon: <KanbanSquare className="h-5 w-5" /> },
    { href: '/admin/events', label: 'Events', icon: <CalendarDays className="h-5 w-5" /> },
    { href: '/admin/packages', label: 'Packages', icon: <Package className="h-5 w-5" /> },
    { href: '/admin/mail', label: 'E-Mail / M365', icon: <Mail className="h-5 w-5" /> },
  ];

  return (
    <AdminShell title="Dashboard">
      <PageHeader
        title="Dashboard"
        description="Überblick über Anfragen, Umsatz und offene Aufgaben."
        actions={
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            {loading ? <Spinner className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />} Aktualisieren
          </Button>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<TrendingUp className="h-4 w-4" />} tone="ok" label="Gebuchter Umsatz" value={money(totalRevenue)} sub={`${booked.length} Buchungen`} />
        <StatCard icon={<Banknote className="h-4 w-4" />} tone="info" label="Zahlungseingang" value={money(paidRevenue)} sub={`${invoices.filter(i => i.status === 'paid').length} bezahlte RE`} />
        <StatCard icon={<AlertCircle className="h-4 w-4" />} tone="accent" label="Offene Posten" value={money(openAmount)} sub={`${openInvoices.length} offene RE`} />
        <StatCard icon={<Target className="h-4 w-4" />} tone="navy" label="Conversion" value={`${conversion}%`} sub={`${leads.length} Leads gesamt`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent leads */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Neueste Anfragen"
            icon={<Inbox className="h-5 w-5" />}
            actions={<Link href="/admin/crm"><Button variant="ghost" size="sm">Alle <ArrowRight className="h-3.5 w-3.5" /></Button></Link>}
          >
            {loading ? (
              <div className="py-10 text-center"><Spinner /></div>
            ) : recent.length === 0 ? (
              <EmptyState icon={<Inbox className="h-8 w-8" />} title="Noch keine Anfragen" />
            ) : (
              <div className="divide-y" style={{ borderColor: COLORS.stroke }}>
                {recent.map(l => {
                  const s = STATUS[l.status];
                  return (
                    <Link key={l.id} href="/admin/crm" className="flex items-center justify-between gap-3 py-3 transition hover:opacity-70">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-semibold text-sm" style={{ color: COLORS.navy }}>{leadName(l)}</span>
                          {l.request_number && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-bold" style={{ color: COLORS.textMuted }}>
                              <Hash className="h-3 w-3" />{l.request_number}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-xs" style={{ color: COLORS.textMuted }}>
                          {l.event_slug || '–'} · {when(l.created_at)}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {l.total_price ? <span className="text-sm font-bold" style={{ color: COLORS.navy }}>{money(l.total_price)}</span> : null}
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          {/* To-dos */}
          <SectionCard title="Zu erledigen" icon={<Target className="h-5 w-5" />}>
            <div className="space-y-3">
              <Link href="/admin/crm" className="flex items-center justify-between rounded-xl px-4 py-3 transition hover:opacity-80" style={{ background: '#fff1ea' }}>
                <span className="text-sm font-semibold" style={{ color: COLORS.accent }}>Neue Anfragen bearbeiten</span>
                <Badge tone="accent">{newLeads.length}</Badge>
              </Link>
              <Link href="/admin/finanzen" className="flex items-center justify-between rounded-xl px-4 py-3 transition hover:opacity-80" style={{ background: '#f0f7ff' }}>
                <span className="text-sm font-semibold" style={{ color: COLORS.info }}>Offene Rechnungen</span>
                <Badge tone="info">{openInvoices.length}</Badge>
              </Link>
            </div>
          </SectionCard>

          {/* Quick links */}
          <SectionCard title="Schnellzugriff">
            <div className="grid grid-cols-2 gap-3">
              {quickLinks.map(q => (
                <Link
                  key={q.href}
                  href={q.href}
                  className="flex flex-col items-center gap-2 rounded-xl px-3 py-4 text-center transition hover:-translate-y-0.5"
                  style={{ background: COLORS.surfaceMuted, color: COLORS.navy }}
                >
                  {q.icon}
                  <span className="text-xs font-semibold">{q.label}</span>
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </AdminShell>
  );
}
