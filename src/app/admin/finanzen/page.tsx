'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
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

const NAVY = '#143047';

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

/* ─── KPI Card ───────────────────────────────────────────────────────── */

function Kpi({ icon, label, value, sub, color, bg }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: bg, border: `1.5px solid ${color}20` }}>
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-extrabold" style={{ color: NAVY }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
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

  return (
    <AdminShell title="Finanzen & ERP">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={eventFilter}
          onChange={e => setEventFilter(e.target.value)}
          className="border rounded-xl px-4 py-2.5 text-sm focus:outline-none bg-white"
          style={{ borderColor: '#e5e8ed' }}
        >
          <option value="all">Alle Events</option>
          {eventSlugs.map(s => <option key={s} value={s}>{eventName(s)}</option>)}
        </select>
        <div className="flex-1" />
        <button onClick={exportInvoices} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition hover:bg-gray-50" style={{ borderColor: '#e5e8ed', color: NAVY }}>
          <Download className="w-4 h-4" /> Rechnungen CSV
        </button>
        <button onClick={exportExpenses} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition hover:bg-gray-50" style={{ borderColor: '#e5e8ed', color: NAVY }}>
          <Download className="w-4 h-4" /> Ausgaben CSV
        </button>
        <button onClick={loadData} className="p-2.5 rounded-xl border transition hover:bg-gray-50" style={{ borderColor: '#e5e8ed' }} title="Aktualisieren">
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <Kpi icon={<TrendingUp className="w-5 h-5" />} label="Gebuchter Umsatz" value={formatCurrency(bookedRevenue)} sub={`${fLeads.filter(l => l.status === 'booked').length} Buchungen`} color="#16a34a" bg="#f0fdf4" />
        <Kpi icon={<Receipt className="w-5 h-5" />} label="Fakturiert" value={formatCurrency(invoicedTotal)} sub={`${activeInvoices.length} Rechnungen`} color="#1a6fa8" bg="#f0f7ff" />
        <Kpi icon={<Banknote className="w-5 h-5" />} label="Zahlungseingänge" value={formatCurrency(paidTotal)} sub={`${activeInvoices.filter(i => i.status === 'paid').length} bezahlt`} color="#0d9488" bg="#f0fdfa" />
        <Kpi icon={<AlertCircle className="w-5 h-5" />} label="Offene Posten" value={formatCurrency(openAmount)} sub={`${openInvoices.length} offen`} color="#d9531e" bg="#fff8f5" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi icon={<AlertTriangle className="w-5 h-5" />} label="Überfällig" value={formatCurrency(overdueAmount)} sub={`${overdueList.length} Rechnungen`} color="#dc2626" bg="#fef2f2" />
        <Kpi icon={<Wallet className="w-5 h-5" />} label="Ausgaben" value={formatCurrency(expensesTotal)} sub={`${fExpenses.length} Posten`} color="#9333ea" bg="#faf5ff" />
        <Kpi icon={<PiggyBank className="w-5 h-5" />} label="Gewinn (kalk.)" value={formatCurrency(profit)} sub="Umsatz − Ausgaben" color={profit >= 0 ? '#16a34a' : '#dc2626'} bg={profit >= 0 ? '#f0fdf4' : '#fef2f2'} />
        <Kpi icon={<Percent className="w-5 h-5" />} label="Marge" value={`${margin}%`} sub="vom gebuchten Umsatz" color="#7c3aed" bg="#faf5ff" />
      </div>

      {/* Overdue banner */}
      {overdueList.length > 0 && (
        <div className="rounded-xl p-4 mb-8 flex items-start gap-3" style={{ background: '#fef2f2', border: '1.5px solid #dc262633' }}>
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#dc2626' }} />
          <div className="text-sm" style={{ color: '#7f1d1d' }}>
            <strong>{overdueList.length} überfällige Rechnung(en)</strong> mit insgesamt {formatCurrency(overdueAmount)} offen.
            <span className="ml-1">{overdueList.slice(0, 3).map(i => i.invoice_number).join(', ')}{overdueList.length > 3 ? ' …' : ''}</span>
          </div>
        </div>
      )}

      {/* Per-event breakdown */}
      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Auswertung pro Event</h2>
        <div className="overflow-x-auto rounded-2xl bg-white" style={{ border: '1.5px solid #e5e8ed' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500" style={{ background: '#f5f7fa' }}>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold text-right">Umsatz</th>
                <th className="px-4 py-3 font-semibold text-right">Bezahlt</th>
                <th className="px-4 py-3 font-semibold text-right">Offen</th>
                <th className="px-4 py-3 font-semibold text-right">Ausgaben</th>
                <th className="px-4 py-3 font-semibold text-right">Gewinn</th>
                <th className="px-4 py-3 font-semibold text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {perEvent.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Keine Daten</td></tr>
              )}
              {perEvent.map(r => (
                <tr key={r.slug} className="border-t" style={{ borderColor: '#eef1f4' }}>
                  <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>{r.name}<span className="text-xs text-gray-400 font-normal ml-2">{r.leads} Leads</span></td>
                  <td className="px-4 py-3 text-right">{formatCurrency(r.booked)}</td>
                  <td className="px-4 py-3 text-right text-teal-600">{formatCurrency(r.paid)}</td>
                  <td className="px-4 py-3 text-right" style={{ color: '#d9531e' }}>{formatCurrency(r.open)}</td>
                  <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(r.expenses)}</td>
                  <td className="px-4 py-3 text-right font-bold" style={{ color: r.profit >= 0 ? '#16a34a' : '#dc2626' }}>{formatCurrency(r.profit)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{r.margin}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invoices table */}
      <section className="mb-8">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">Alle Rechnungen</h2>
        <div className="overflow-x-auto rounded-2xl bg-white" style={{ border: '1.5px solid #e5e8ed' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500" style={{ background: '#f5f7fa' }}>
                <th className="px-4 py-3 font-semibold">Nummer</th>
                <th className="px-4 py-3 font-semibold">Kunde</th>
                <th className="px-4 py-3 font-semibold">Fällig</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Gesamt</th>
                <th className="px-4 py-3 font-semibold text-right">Offen</th>
                <th className="px-4 py-3 font-semibold text-center">PDF</th>
              </tr>
            </thead>
            <tbody>
              {activeInvoices.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Keine Rechnungen</td></tr>
              )}
              {activeInvoices.map(inv => {
                const overdue = isOverdue(inv);
                const open = inv.total_amount - (inv.paid_amount || 0);
                return (
                  <tr key={inv.id} className="border-t" style={{ borderColor: '#eef1f4', background: overdue ? '#fef2f2' : undefined }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: NAVY }}>{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-gray-700">{leadName(leadById[inv.booking_id])}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(inv.due_date)}
                      {overdue && <span className="ml-2 text-xs font-bold text-red-600">überfällig</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{
                        color: inv.status === 'paid' ? '#16a34a' : inv.status === 'partial' ? '#d97706' : '#d9531e',
                        background: inv.status === 'paid' ? '#f0fdf4' : inv.status === 'partial' ? '#fffbeb' : '#fff8f5',
                      }}>
                        {inv.status === 'paid' ? 'Bezahlt' : inv.status === 'partial' ? 'Teilbezahlt' : 'Offen'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-right" style={{ color: open > 0 ? '#d9531e' : '#9ca3af' }}>{open > 0 ? formatCurrency(open) : '–'}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')} className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="PDF">
                        <Download className="w-4 h-4 text-gray-500 inline" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Expenses */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Ausgaben</h2>
          <button onClick={() => setShowExpenseForm(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90" style={{ background: NAVY }}>
            <Plus className="w-4 h-4" /> Ausgabe erfassen
          </button>
        </div>

        {showExpenseForm && (
          <ExpenseForm
            eventSlugs={eventSlugs}
            eventName={eventName}
            onClose={() => setShowExpenseForm(false)}
            onSaved={() => { setShowExpenseForm(false); loadData(); }}
          />
        )}

        <div className="overflow-x-auto rounded-2xl bg-white" style={{ border: '1.5px solid #e5e8ed' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500" style={{ background: '#f5f7fa' }}>
                <th className="px-4 py-3 font-semibold">Datum</th>
                <th className="px-4 py-3 font-semibold">Kategorie</th>
                <th className="px-4 py-3 font-semibold">Beschreibung</th>
                <th className="px-4 py-3 font-semibold">Event</th>
                <th className="px-4 py-3 font-semibold text-right">Betrag</th>
                <th className="px-4 py-3 font-semibold text-center"></th>
              </tr>
            </thead>
            <tbody>
              {fExpenses.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Noch keine Ausgaben erfasst</td></tr>
              )}
              {fExpenses.map(e => (
                <tr key={e.id} className="border-t" style={{ borderColor: '#eef1f4' }}>
                  <td className="px-4 py-3 text-gray-600">{formatDate(e.expense_date)}</td>
                  <td className="px-4 py-3">{catLabel(e.category)}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {e.description}
                    {e.vendor && <span className="text-xs text-gray-400 ml-2">({e.vendor})</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{e.event_slug ? eventName(e.event_slug) : '–'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-purple-600">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={async () => {
                        if (!confirm('Ausgabe wirklich löschen?')) return;
                        await fetch(`/api/expenses/${e.id}`, { method: 'DELETE' });
                        loadData();
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {fExpenses.length > 0 && (
                <tr className="border-t font-bold" style={{ borderColor: '#e5e8ed', background: '#faf5ff' }}>
                  <td className="px-4 py-3" colSpan={4} style={{ color: NAVY }}>Summe</td>
                  <td className="px-4 py-3 text-right text-purple-700">{formatCurrency(expensesTotal)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
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
    <div className="rounded-2xl p-4 mb-4 space-y-3" style={{ background: '#faf5ff', border: '1.5px solid #9333ea20' }}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm" style={{ color: NAVY }}>Neue Ausgabe</span>
        <button onClick={onClose}><X className="w-4 h-4 text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Datum</label>
          <input type="date" value={form.expense_date} onChange={e => set('expense_date', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 mt-1 focus:outline-none bg-white" style={{ borderColor: '#e5e8ed' }} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Kategorie</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 mt-1 focus:outline-none bg-white" style={{ borderColor: '#e5e8ed' }}>
            {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500">Beschreibung *</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="z.B. Hotelkontingent 20 Zimmer" className="w-full text-sm border rounded-lg px-3 py-2 mt-1 focus:outline-none bg-white" style={{ borderColor: '#e5e8ed' }} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Lieferant</label>
          <input value={form.vendor} onChange={e => set('vendor', e.target.value)} placeholder="z.B. Hilton" className="w-full text-sm border rounded-lg px-3 py-2 mt-1 focus:outline-none bg-white" style={{ borderColor: '#e5e8ed' }} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Event</label>
          <select value={form.event_slug} onChange={e => set('event_slug', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 mt-1 focus:outline-none bg-white" style={{ borderColor: '#e5e8ed' }}>
            <option value="">– Kein Event –</option>
            {eventSlugs.map(s => <option key={s} value={s}>{eventName(s)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Betrag (€) *</label>
          <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} min="0" step="0.01" placeholder="0.00" className="w-full text-sm border rounded-lg px-3 py-2 mt-1 focus:outline-none bg-white" style={{ borderColor: '#e5e8ed' }} />
        </div>
        <div>
          <label className="text-xs text-gray-500">Notizen</label>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className="w-full text-sm border rounded-lg px-3 py-2 mt-1 focus:outline-none bg-white" style={{ borderColor: '#e5e8ed' }} />
        </div>
      </div>
      <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: NAVY }}>
        {saving ? 'Speichern…' : '💾 Ausgabe speichern'}
      </button>
    </div>
  );
}
