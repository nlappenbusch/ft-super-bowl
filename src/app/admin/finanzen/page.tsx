'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  COLORS, Card, SectionCard, PageHeader, Button, Badge, StatCard,
  EmptyState, Spinner, Field, SelectInput, InputField,
} from '@/components/admin/ui';
import {
  TrendingUp, Banknote, AlertCircle, AlertTriangle, Receipt,
  Wallet, PiggyBank, Percent, RefreshCw, Download, Plus, Trash2, X,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface Lead {
  id: string;
  email: string;
  package_title?: string;
  event_slug?: string;
  total_price?: number;
  status: 'new' | 'in_progress' | 'booked' | 'rejected';
  travelers?: string | Array<{ firstName?: string; lastName?: string; first_name?: string; last_name?: string }>;
}

interface Invoice {
  id: string;
  invoice_number: string;
  booking_id: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: 'open' | 'partial' | 'paid' | 'cancelled';
}

interface Expense {
  id: string;
  expense_date: string;
  event_slug: string;
  booking_id: string;
  category: string;
  description: string;
  vendor: string;
  amount: number;
  notes: string;
}

interface EventRec { slug: string; name?: string; title?: string }

/* ─── Constants ──────────────────────────────────────────────────────── */

const EXPENSE_CATEGORIES: { id: string; label: string }[] = [
  { id: 'hotel', label: '🏨 Hotel' },
  { id: 'tickets', label: '🎟 Tickets' },
  { id: 'transfer', label: '🚐 Transfer' },
  { id: 'flug', label: '✈️ Flug' },
  { id: 'catering', label: '🍽 Catering' },
  { id: 'personal', label: '👥 Personal' },
  { id: 'marketing', label: '📣 Marketing' },
  { id: 'gebuehren', label: '💳 Gebühren' },
  { id: 'sonstiges', label: '📦 Sonstiges' },
];

const NAVY = COLORS.navy;

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatCurrency(n?: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n || 0);
}
function formatDate(str?: string) {
  if (!str) return '–';
  try { return new Date(str).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return str; }
}
function isOverdue(inv: Invoice) {
  if (inv.status === 'paid' || inv.status === 'cancelled') return false;
  return new Date(inv.due_date).getTime() < Date.now();
}
function leadName(lead?: Lead): string {
  if (!lead) return '–';
  if (!lead.travelers) return lead.email;
  try {
    const t = typeof lead.travelers === 'string' ? JSON.parse(lead.travelers) : lead.travelers;
    if (!Array.isArray(t) || t.length === 0) return lead.email;
    const first = t[0]?.firstName || t[0]?.first_name || '';
    const last = t[0]?.lastName || t[0]?.last_name || '';
    return [first, last].filter(Boolean).join(' ') || lead.email;
  } catch { return lead.email; }
}
function catLabel(id: string) {
  return EXPENSE_CATEGORIES.find(c => c.id === id)?.label || id;
}
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = '﻿' + rows.map(r => r.map(escape).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function FinanzenPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [events, setEvents] = useState<EventRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('all');
  const [showExpenseForm, setShowExpenseForm] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [b, i, e, ev] = await Promise.all([
        fetch('/api/bookings').then(r => r.json()),
        fetch('/api/invoices').then(r => r.json()),
        fetch('/api/expenses').then(r => r.json()),
        fetch('/api/events').then(r => r.json()).catch(() => ({ data: [] })),
      ]);
      if (b.success) setLeads(b.data || []);
      if (i.success) setInvoices(i.data || []);
      if (e.success) setExpenses(e.data || []);
      setEvents(ev.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const leadById = useMemo(() => {
    const m: Record<string, Lead> = {};
    leads.forEach(l => { m[l.id] = l; });
    return m;
  }, [leads]);

  // Event slug list (from events config + anything referenced by bookings/expenses)
  const eventSlugs = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => e.slug && set.add(e.slug));
    leads.forEach(l => l.event_slug && set.add(l.event_slug));
    expenses.forEach(e => e.event_slug && set.add(e.event_slug));
    return Array.from(set);
  }, [events, leads, expenses]);

  const eventName = useCallback((slug: string) => {
    const e = events.find(ev => ev.slug === slug);
    return e?.name || e?.title || slug;
  }, [events]);

  // Apply event filter
  const matchEvent = useCallback((slug?: string) => eventFilter === 'all' || slug === eventFilter, [eventFilter]);

  const fLeads = useMemo(() => leads.filter(l => matchEvent(l.event_slug)), [leads, matchEvent]);
  const fExpenses = useMemo(() => expenses.filter(e => matchEvent(e.event_slug)), [expenses, matchEvent]);
  const fInvoices = useMemo(() => invoices.filter(inv => {
    if (eventFilter === 'all') return true;
    return leadById[inv.booking_id]?.event_slug === eventFilter;
  }), [invoices, eventFilter, leadById]);

  // KPIs
  const activeInvoices = fInvoices.filter(i => i.status !== 'cancelled');
  const bookedRevenue = fLeads.filter(l => l.status === 'booked').reduce((s, l) => s + (l.total_price || 0), 0);
  const invoicedTotal = activeInvoices.reduce((s, i) => s + i.total_amount, 0);
  const paidTotal = activeInvoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
  const openInvoices = activeInvoices.filter(i => i.status === 'open' || i.status === 'partial');
  const openAmount = openInvoices.reduce((s, i) => s + (i.total_amount - (i.paid_amount || 0)), 0);
  const overdueList = activeInvoices.filter(isOverdue);
  const overdueAmount = overdueList.reduce((s, i) => s + (i.total_amount - (i.paid_amount || 0)), 0);
  const expensesTotal = fExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const profit = bookedRevenue - expensesTotal;
  const margin = bookedRevenue > 0 ? Math.round((profit / bookedRevenue) * 100) : 0;

  // Per-event breakdown
  const perEvent = useMemo(() => {
    return eventSlugs.map(slug => {
      const evLeads = leads.filter(l => l.event_slug === slug);
      const evBooked = evLeads.filter(l => l.status === 'booked').reduce((s, l) => s + (l.total_price || 0), 0);
      const evInvoices = invoices.filter(i => i.status !== 'cancelled' && leadById[i.booking_id]?.event_slug === slug);
      const evPaid = evInvoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
      const evOpen = evInvoices.reduce((s, i) => s + (i.total_amount - (i.paid_amount || 0)), 0);
      const evExpenses = expenses.filter(e => e.event_slug === slug).reduce((s, e) => s + e.amount, 0);
      const evProfit = evBooked - evExpenses;
      const evMargin = evBooked > 0 ? Math.round((evProfit / evBooked) * 100) : 0;
      return { slug, name: eventName(slug), booked: evBooked, paid: evPaid, open: evOpen, expenses: evExpenses, profit: evProfit, margin: evMargin, leads: evLeads.length };
    }).filter(r => r.booked > 0 || r.paid > 0 || r.expenses > 0 || r.leads > 0)
      .sort((a, b) => b.booked - a.booked);
  }, [eventSlugs, leads, invoices, expenses, leadById, eventName]);

  /* ─── Exports ──────────────────────────────────────────────────────── */

  const exportInvoices = () => {
    const rows: (string | number)[][] = [
      ['Rechnungsnummer', 'Kunde', 'Event', 'Rechnungsdatum', 'Fälligkeit', 'Status', 'Gesamt', 'Bezahlt', 'Offen', 'Überfällig'],
    ];
    activeInvoices.forEach(i => {
      const l = leadById[i.booking_id];
      rows.push([
        i.invoice_number, leadName(l), eventName(l?.event_slug || ''),
        formatDate(i.invoice_date), formatDate(i.due_date), i.status,
        i.total_amount.toFixed(2), (i.paid_amount || 0).toFixed(2),
        (i.total_amount - (i.paid_amount || 0)).toFixed(2), isOverdue(i) ? 'JA' : '',
      ]);
    });
    downloadCsv(`rechnungen_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const exportExpenses = () => {
    const rows: (string | number)[][] = [
      ['Datum', 'Kategorie', 'Beschreibung', 'Lieferant', 'Event', 'Betrag', 'Notizen'],
    ];
    fExpenses.forEach(e => {
      rows.push([
        formatDate(e.expense_date), catLabel(e.category), e.description, e.vendor,
        eventName(e.event_slug), e.amount.toFixed(2), e.notes,
      ]);
    });
    downloadCsv(`ausgaben_${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  /* ─── Render ───────────────────────────────────────────────────────── */

  const TH = 'px-4 py-3 font-semibold text-xs uppercase tracking-wider';

  return (
    <AdminShell title="Finanzen & ERP">
      <PageHeader
        title="Finanzen & ERP"
        description="Umsätze, Rechnungen und Ausgaben im Überblick"
        actions={
          <>
            <Field className="min-w-[180px]">
              <SelectInput value={eventFilter} onChange={e => setEventFilter(e.target.value)}>
                <option value="all">Alle Events</option>
                {eventSlugs.map(s => <option key={s} value={s}>{eventName(s)}</option>)}
              </SelectInput>
            </Field>
            <Button variant="secondary" size="sm" onClick={exportInvoices}>
              <Download className="w-4 h-4" /> Rechnungen CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={exportExpenses}>
              <Download className="w-4 h-4" /> Ausgaben CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={loadData} title="Aktualisieren">
              {loading ? <Spinner className="h-4 w-4" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard tone="ok" icon={<TrendingUp className="w-4 h-4" />} label="Gebuchter Umsatz" value={formatCurrency(bookedRevenue)} sub={`${fLeads.filter(l => l.status === 'booked').length} Buchungen`} />
        <StatCard tone="info" icon={<Receipt className="w-4 h-4" />} label="Fakturiert" value={formatCurrency(invoicedTotal)} sub={`${activeInvoices.length} Rechnungen`} />
        <StatCard tone="ok" icon={<Banknote className="w-4 h-4" />} label="Zahlungseingänge" value={formatCurrency(paidTotal)} sub={`${activeInvoices.filter(i => i.status === 'paid').length} bezahlt`} />
        <StatCard tone="accent" icon={<AlertCircle className="w-4 h-4" />} label="Offene Posten" value={formatCurrency(openAmount)} sub={`${openInvoices.length} offen`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard tone="danger" icon={<AlertTriangle className="w-4 h-4" />} label="Überfällig" value={formatCurrency(overdueAmount)} sub={`${overdueList.length} Rechnungen`} />
        <StatCard tone="navy" icon={<Wallet className="w-4 h-4" />} label="Ausgaben" value={formatCurrency(expensesTotal)} sub={`${fExpenses.length} Posten`} />
        <StatCard tone={profit >= 0 ? 'ok' : 'danger'} icon={<PiggyBank className="w-4 h-4" />} label="Gewinn (kalk.)" value={formatCurrency(profit)} sub="Umsatz − Ausgaben" />
        <StatCard tone="navy" icon={<Percent className="w-4 h-4" />} label="Marge" value={`${margin}%`} sub="vom gebuchten Umsatz" />
      </div>

      {/* Overdue banner */}
      {overdueList.length > 0 && (
        <div className="rounded-2xl p-4 mb-8 flex items-start gap-3" style={{ background: '#fef2f2', border: '1.5px solid #dc262633' }}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: COLORS.danger }} />
          <div className="text-sm" style={{ color: '#7f1d1d' }}>
            <strong>{overdueList.length} überfällige Rechnung(en)</strong> mit insgesamt {formatCurrency(overdueAmount)} offen.
            <span className="ml-1">{overdueList.slice(0, 3).map(i => i.invoice_number).join(', ')}{overdueList.length > 3 ? ' …' : ''}</span>
          </div>
        </div>
      )}

      {/* Per-event breakdown */}
      <SectionCard title="Auswertung pro Event" icon={<TrendingUp className="w-5 h-5" />} className="mb-8">
        <div className="overflow-x-auto -mx-6 -mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: COLORS.surfaceMuted, color: COLORS.textMuted }}>
                <th className={TH}>Event</th>
                <th className={`${TH} text-right`}>Umsatz</th>
                <th className={`${TH} text-right`}>Bezahlt</th>
                <th className={`${TH} text-right`}>Offen</th>
                <th className={`${TH} text-right`}>Ausgaben</th>
                <th className={`${TH} text-right`}>Gewinn</th>
                <th className={`${TH} text-right`}>Marge</th>
              </tr>
            </thead>
            <tbody>
              {perEvent.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10">
                  <EmptyState icon={<TrendingUp className="w-8 h-8" />} title="Keine Daten" />
                </td></tr>
              )}
              {perEvent.map(r => (
                <tr key={r.slug} className="border-t" style={{ borderColor: '#eef1f4' }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>{r.name}<span className="text-xs text-gray-400 font-normal ml-2">{r.leads} Leads</span></td>
                  <td className="px-4 py-3 text-right">{formatCurrency(r.booked)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: COLORS.ok }}>{formatCurrency(r.paid)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: COLORS.accent }}>{formatCurrency(r.open)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: COLORS.textMuted }}>{formatCurrency(r.expenses)}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: r.profit >= 0 ? COLORS.ok : COLORS.danger }}>{formatCurrency(r.profit)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{r.margin}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Invoices table */}
      <SectionCard title="Alle Rechnungen" icon={<Receipt className="w-5 h-5" />} className="mb-8">
        <div className="overflow-x-auto -mx-6 -mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: COLORS.surfaceMuted, color: COLORS.textMuted }}>
                <th className={TH}>Nummer</th>
                <th className={TH}>Kunde</th>
                <th className={TH}>Fällig</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Gesamt</th>
                <th className={`${TH} text-right`}>Offen</th>
                <th className={`${TH} text-center`}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {activeInvoices.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10">
                  <EmptyState icon={<Receipt className="w-8 h-8" />} title="Keine Rechnungen" />
                </td></tr>
              )}
              {activeInvoices.map(inv => {
                const overdue = isOverdue(inv);
                const open = inv.total_amount - (inv.paid_amount || 0);
                return (
                  <tr key={inv.id} className="border-t" style={{ borderColor: '#eef1f4', background: overdue ? '#fef2f2' : undefined }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>{inv.invoice_number}</td>
                    <td className="px-4 py-3" style={{ color: '#374151' }}>{leadName(leadById[inv.booking_id])}</td>
                    <td className="px-4 py-3" style={{ color: COLORS.textMuted }}>
                      {formatDate(inv.due_date)}
                      {overdue && <span className="ml-2 text-xs font-bold" style={{ color: COLORS.danger }}>überfällig</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={inv.status === 'paid' ? 'ok' : inv.status === 'partial' ? 'warn' : 'accent'}>
                        {inv.status === 'paid' ? 'Bezahlt' : inv.status === 'partial' ? 'Teilbezahlt' : 'Offen'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: open > 0 ? COLORS.accent : '#9ca3af' }}>{open > 0 ? formatCurrency(open) : '–'}</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')} title="PDF">
                        <Download className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Expenses */}
      <SectionCard
        title="Ausgaben"
        icon={<Wallet className="w-5 h-5" />}
        actions={
          <Button variant="primary" size="sm" onClick={() => setShowExpenseForm(v => !v)}>
            <Plus className="w-4 h-4" /> Ausgabe erfassen
          </Button>
        }
        className="mb-8"
      >
        {showExpenseForm && (
          <ExpenseForm
            eventSlugs={eventSlugs}
            eventName={eventName}
            onClose={() => setShowExpenseForm(false)}
            onSaved={() => { setShowExpenseForm(false); loadData(); }}
          />
        )}

        <div className="overflow-x-auto -mx-6 -mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: COLORS.surfaceMuted, color: COLORS.textMuted }}>
                <th className={TH}>Datum</th>
                <th className={TH}>Kategorie</th>
                <th className={TH}>Beschreibung</th>
                <th className={TH}>Event</th>
                <th className={`${TH} text-right`}>Betrag</th>
                <th className={`${TH} text-center`}></th>
              </tr>
            </thead>
            <tbody>
              {fExpenses.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10">
                  <EmptyState icon={<Wallet className="w-8 h-8" />} title="Noch keine Ausgaben erfasst" />
                </td></tr>
              )}
              {fExpenses.map(e => (
                <tr key={e.id} className="border-t" style={{ borderColor: '#eef1f4' }}>
                  <td className="px-4 py-3" style={{ color: COLORS.textMuted }}>{formatDate(e.expense_date)}</td>
                  <td className="px-4 py-3">{catLabel(e.category)}</td>
                  <td className="px-4 py-3" style={{ color: '#374151' }}>
                    {e.description}
                    {e.vendor && <span className="text-xs text-gray-400 ml-2">({e.vendor})</span>}
                  </td>
                  <td className="px-4 py-3" style={{ color: COLORS.textMuted }}>{e.event_slug ? eventName(e.event_slug) : '–'}</td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: NAVY }}>{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!confirm('Ausgabe wirklich löschen?')) return;
                        await fetch(`/api/expenses/${e.id}`, { method: 'DELETE' });
                        loadData();
                      }}
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {fExpenses.length > 0 && (
                <tr className="border-t font-bold" style={{ borderColor: COLORS.stroke, background: COLORS.surfaceMuted }}>
                  <td className="px-4 py-3" colSpan={4} style={{ color: NAVY }}>Summe</td>
                  <td className="px-4 py-3 text-right" style={{ color: NAVY }}>{formatCurrency(expensesTotal)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </AdminShell>
  );
}

/* ─── Expense Form ───────────────────────────────────────────────────── */

function ExpenseForm({ eventSlugs, eventName, onClose, onSaved }: {
  eventSlugs: string[];
  eventName: (slug: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().slice(0, 10),
    category: 'hotel',
    description: '',
    vendor: '',
    event_slug: '',
    amount: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!form.description.trim() || !(parseFloat(form.amount) > 0)) {
      alert('Bitte Beschreibung und gültigen Betrag angeben.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          expense_date: new Date(form.expense_date).toISOString(),
          amount: parseFloat(form.amount),
        }),
      });
      const data = await res.json();
      if (data.success) onSaved();
      else alert('Fehler: ' + data.error);
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Card className="mb-4">
      <div className="flex items-center justify-between mb-4">
        <span className="font-bold text-sm" style={{ color: NAVY }}>Neue Ausgabe</span>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Schließen">
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InputField label="Datum" type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} />
        <Field label="Kategorie">
          <SelectInput value={form.category} onChange={e => set('category', e.target.value)}>
            {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </SelectInput>
        </Field>
        <InputField className="md:col-span-2" label="Beschreibung" required value={form.description} onChange={e => set('description', e.target.value)} placeholder="z.B. Hotelkontingent 20 Zimmer" />
        <InputField label="Lieferant" value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="z.B. Hilton" />
        <Field label="Event">
          <SelectInput value={form.event_slug} onChange={e => set('event_slug', e.target.value)}>
            <option value="">– Kein Event –</option>
            {eventSlugs.map(s => <option key={s} value={s}>{eventName(s)}</option>)}
          </SelectInput>
        </Field>
        <InputField label="Betrag (€)" required type="number" value={form.amount} onChange={e => set('amount', e.target.value)} min="0" step="0.01" placeholder="0.00" />
        <InputField label="Notizen" value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <Button variant="primary" onClick={submit} disabled={saving} className="w-full mt-4">
        {saving ? <><Spinner className="h-4 w-4" /> Speichern…</> : '💾 Ausgabe speichern'}
      </Button>
    </Card>
  );
}
