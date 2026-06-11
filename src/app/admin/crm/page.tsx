'use client';

import { useEffect, useState, useCallback } from 'react';
import InvoiceEditor, { type InvoiceLead } from '@/components/admin/InvoiceEditor';
import AdminShell from '@/components/admin/AdminShell';
import {
  User, Mail, Phone, Calendar, Package, Euro,
  ChevronRight, X, FileText, RefreshCw, Receipt,
  Plus, Trash2, Download, CheckCircle, Clock, AlertCircle,
  TrendingUp, Banknote, BarChart3, Target,
  MessageSquare, Send, Hash, CornerDownRight
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

type CrmStatus = 'new' | 'in_progress' | 'booked' | 'rejected';

interface Lead {
  id: string;
  email: string;
  phone?: string;
  request_number?: string | null;
  package_title?: string;
  event_slug?: string;
  number_of_persons?: number;
  total_price?: number;
  status: CrmStatus;
  notes?: string;
  message?: string;
  created_at?: string;
  travelers?: string | Array<{ firstName?: string; lastName?: string; first_name?: string; last_name?: string }>;
}

interface Message {
  id: string;
  booking_id: string;
  created_at?: string;
  direction: 'out' | 'in';
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
}

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
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
  notes?: string;
  items?: InvoiceItem[];
}

/* ─── Constants ──────────────────────────────────────────────────────── */

const COLUMNS: { id: CrmStatus; label: string; color: string; bg: string }[] = [
  { id: 'new',         label: '🆕 Neu',        color: '#d9531e', bg: '#fff8f5' },
  { id: 'in_progress', label: '📞 Kontaktiert', color: '#1a6fa8', bg: '#f0f7ff' },
  { id: 'booked',      label: '✅ Gebucht',     color: '#16a34a', bg: '#f0fdf4' },
  { id: 'rejected',    label: '❌ Verloren',    color: '#6b7280', bg: '#f9fafb' },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */

function getLeadName(lead: Lead): string {
  if (!lead.travelers) return lead.email;
  try {
    const travelers = typeof lead.travelers === 'string' ? JSON.parse(lead.travelers) : lead.travelers;
    if (!Array.isArray(travelers) || travelers.length === 0) return lead.email;
    const t = travelers[0];
    const first = t?.firstName || t?.first_name || '';
    const last = t?.lastName || t?.last_name || '';
    return [first, last].filter(Boolean).join(' ') || lead.email;
  } catch { return lead.email; }
}

function formatDate(str?: string) {
  if (!str) return '–';
  try {
    return new Date(str).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return str; }
}

function formatCurrency(n?: number) {
  if (!n) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);
}

/* ─── ERP Stats Widget ───────────────────────────────────────────────── */

function ErpStats({ leads, invoices }: { leads: Lead[]; invoices: Invoice[] }) {
  const booked = leads.filter(l => l.status === 'booked');
  const totalRevenue = booked.reduce((s, l) => s + (l.total_price || 0), 0);
  const openInvoices = invoices.filter(i => i.status === 'open' || i.status === 'partial');
  const openAmount = openInvoices.reduce((s, i) => s + (i.total_amount - (i.paid_amount || 0)), 0);
  const conversionRate = leads.length > 0 ? Math.round((booked.length / leads.length) * 100) : 0;
  const paidRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {[
        { icon: <TrendingUp className="w-5 h-5" />, label: 'Gebuchter Umsatz', value: formatCurrency(totalRevenue), sub: `${booked.length} Buchungen`, color: '#16a34a', bg: '#f0fdf4' },
        { icon: <Banknote className="w-5 h-5" />, label: 'Eingegangene Zahlungen', value: formatCurrency(paidRevenue), sub: `${invoices.filter(i => i.status === 'paid').length} bezahlte RE`, color: '#1a6fa8', bg: '#f0f7ff' },
        { icon: <AlertCircle className="w-5 h-5" />, label: 'Offene Posten', value: formatCurrency(openAmount), sub: `${openInvoices.length} offene Rechnungen`, color: '#d9531e', bg: '#fff8f5' },
        { icon: <Target className="w-5 h-5" />, label: 'Conversion Rate', value: `${conversionRate}%`, sub: `${leads.length} Leads gesamt`, color: '#7c3aed', bg: '#faf5ff' },
      ].map(s => (
        <div key={s.label} className="rounded-2xl p-4" style={{ background: s.bg, border: `1.5px solid ${s.color}20` }}>
          <div className="flex items-center gap-2 mb-2" style={{ color: s.color }}>
            {s.icon}
            <span className="text-xs font-semibold uppercase tracking-wider">{s.label}</span>
          </div>
          <div className="text-2xl font-extrabold" style={{ color: '#143047' }}>{s.value}</div>
          <div className="text-xs text-gray-500 mt-0.5">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Lead Card ──────────────────────────────────────────────────────── */

function LeadCard({ lead, hasInvoice, onClick }: { lead: Lead; hasInvoice: boolean; onClick: () => void }) {
  const col = COLUMNS.find(c => c.id === lead.status) || COLUMNS[0];
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl bg-white transition-all hover:-translate-y-0.5 hover:shadow-md group"
      style={{ border: '1.5px solid #e5e8ed', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="font-bold text-sm truncate" style={{ color: '#143047' }}>
          {getLeadName(lead)}
        </div>
        <ChevronRight className="w-4 h-4 shrink-0 text-gray-400 group-hover:text-gray-600 transition mt-0.5" />
      </div>

      {lead.request_number && (
        <div className="inline-flex items-center gap-1 text-[11px] font-bold mb-2 px-1.5 py-0.5 rounded-md" style={{ color: '#143047', background: '#eef2f7' }}>
          <Hash className="w-3 h-3" /> {lead.request_number}
        </div>
      )}

      {lead.package_title && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-1 truncate">
          <Package className="w-3 h-3 shrink-0" />
          <span className="truncate">{lead.package_title}</span>
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
        <Calendar className="w-3 h-3 shrink-0" />
        {formatDate(lead.created_at)}
      </div>

      <div className="flex items-center justify-between">
        {lead.total_price && lead.total_price > 0 ? (
          <span className="text-xs font-bold" style={{ color: col.color }}>
            {formatCurrency(lead.total_price)}
          </span>
        ) : (
          <span className="text-xs text-gray-300">Anfrage</span>
        )}
        {hasInvoice && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            <Receipt className="w-3 h-3" /> RE
          </span>
        )}
      </div>
    </button>
  );
}

/* ─── Invoice Tab ────────────────────────────────────────────────────── */

function InvoiceTab({ lead }: { lead: Lead }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [payInput, setPayInput] = useState<Record<string, string>>({});

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices?bookingId=${lead.id}`);
      const data = await res.json();
      if (data.success) setInvoices(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [lead.id]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const handlePayment = async (invoiceId: string) => {
    const amount = parseFloat(payInput[invoiceId] || '0');
    if (amount <= 0) return;
    await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment: amount }),
    });
    setPayInput(p => ({ ...p, [invoiceId]: '' }));
    loadInvoices();
  };

  const statusBadge = (s: Invoice['status']) => {
    const map = {
      open: { label: 'Offen', color: '#d9531e', bg: '#fff8f5' },
      partial: { label: 'Teilbezahlt', color: '#d97706', bg: '#fffbeb' },
      paid: { label: '✅ Bezahlt', color: '#16a34a', bg: '#f0fdf4' },
      cancelled: { label: 'Storniert', color: '#6b7280', bg: '#f9fafb' },
    };
    const m = map[s] || map.open;
    return (
      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: m.color, background: m.bg }}>
        {m.label}
      </span>
    );
  };

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Lädt…</div>;

  return (
    <div className="space-y-4">
      {/* Existing invoices */}
      {invoices.length === 0 && !showCreate && (
        <div className="py-8 text-center text-sm text-gray-400 rounded-xl" style={{ border: '1.5px dashed #e5e8ed' }}>
          Noch keine Rechnung vorhanden
        </div>
      )}

      {invoices.map(inv => (
        <div key={inv.id} className="rounded-xl p-4" style={{ border: '1.5px solid #e5e8ed' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-bold text-sm" style={{ color: '#143047' }}>{inv.invoice_number}</div>
              <div className="text-xs text-gray-500">Fällig: {formatDate(inv.due_date)}</div>
            </div>
            <div className="flex items-center gap-2">
              {statusBadge(inv.status)}
              <button
                onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                title="PDF herunterladen"
              >
                <Download className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm mb-3">
            <span className="text-gray-600">Gesamt</span>
            <span className="font-bold" style={{ color: '#143047' }}>{formatCurrency(inv.total_amount)}</span>
          </div>

          {inv.paid_amount > 0 && (
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-600">Bezahlt</span>
              <span className="font-semibold text-green-600">{formatCurrency(inv.paid_amount)}</span>
            </div>
          )}

          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                placeholder="Betrag (€)"
                value={payInput[inv.id] || ''}
                onChange={e => setPayInput(p => ({ ...p, [inv.id]: e.target.value }))}
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                style={{ borderColor: '#e5e8ed' }}
                min="0"
                step="0.01"
              />
              <button
                onClick={() => handlePayment(inv.id)}
                className="px-3 py-1.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90"
                style={{ background: '#16a34a' }}
              >
                <CheckCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Create form */}
      {showCreate && (
        <InvoiceEditor
          lead={lead as unknown as InvoiceLead}
          onCreated={() => { setShowCreate(false); loadInvoices(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {!showCreate && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-2.5 rounded-lg text-sm font-bold transition hover:opacity-90 flex items-center justify-center gap-2"
          style={{ background: '#143047', color: 'white' }}
        >
          <Plus className="w-4 h-4" /> Neue Rechnung erstellen
        </button>
      )}
    </div>
  );
}

/* ─── Conversation Tab ───────────────────────────────────────────────── */

function ConversationTab({ lead }: { lead: Lead }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${lead.id}/messages`);
      const data = await res.json();
      if (data.success) setMessages(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [lead.id]);

  useEffect(() => { load(); }, [load]);

  // Live: offene Konversation alle 20s neu laden (neue Kundenantworten erscheinen automatisch)
  useEffect(() => {
    const id = setInterval(() => { load(); }, 20000);
    return () => clearInterval(id);
  }, [load]);

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${lead.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply }),
      });
      const data = await res.json();
      if (data.success) {
        setReply('');
        await load();
      } else {
        setError(data.error || 'Versand fehlgeschlagen.');
      }
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Thread */}
      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400">Lädt…</div>
      ) : messages.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 rounded-xl" style={{ border: '1.5px dashed #e5e8ed' }}>
          Noch keine Nachrichten. Schreibe unten die erste Antwort.
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => {
            const isOut = m.direction === 'out';
            return (
              <div key={m.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[85%] rounded-2xl px-4 py-3 text-sm"
                  style={{
                    background: isOut ? '#143047' : '#f5f7fa',
                    color: isOut ? 'white' : '#374151',
                    border: isOut ? 'none' : '1px solid #e5e8ed',
                    borderBottomRightRadius: isOut ? 4 : 16,
                    borderBottomLeftRadius: isOut ? 16 : 4,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold" style={{ opacity: isOut ? 0.7 : 1, color: isOut ? 'white' : '#9ca3af' }}>
                    {isOut ? <CornerDownRight className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                    {isOut ? 'Wir' : (m.from_email || 'Kunde')} · {formatDate(m.created_at)}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {isOut ? m.body : stripHtml(m.body)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply composer */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: '#f0f7ff', border: '1.5px solid #1a6fa820' }}>
        <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#143047' }}>
          <MessageSquare className="w-3.5 h-3.5" /> Antwort an {lead.email}
          {lead.request_number && <span className="text-gray-400">· Betreff trägt {lead.request_number}</span>}
        </div>
        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          rows={4}
          placeholder="Antwort an den Kunden schreiben…"
          className="w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none resize-none"
          style={{ borderColor: '#e5e8ed' }}
        />
        {error && <p className="text-red-600 text-xs">{error}</p>}
        <button
          onClick={handleSend}
          disabled={sending || !reply.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ background: '#d9531e' }}
        >
          <Send className="w-4 h-4" /> {sending ? 'Wird gesendet…' : 'Antwort senden'}
        </button>
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  if (!html) return '';
  // sehr einfache Bereinigung für die Anzeige eingehender HTML-Mails
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ─── Detail Drawer ──────────────────────────────────────────────────── */

type DrawerTab = 'info' | 'conversation' | 'invoice' | 'notes';

function DetailDrawer({
  lead,
  onClose,
  onUpdate,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, updates: { status?: CrmStatus; notes?: string }) => Promise<void>;
}) {
  const [notes, setNotes] = useState(lead.notes || '');
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('info');
  const name = getLeadName(lead);

  const handleStatusChange = async (status: CrmStatus) => {
    setSaving(true);
    await onUpdate(lead.id, { status });
    setSaving(false);
  };

  const handleSaveNotes = async () => {
    setSaving(true);
    await onUpdate(lead.id, { notes });
    setSaving(false);
  };

  const tabs: { id: DrawerTab; label: string; icon: React.ReactNode }[] = [
    { id: 'info', label: 'Übersicht', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'conversation', label: 'Konversation', icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: 'invoice', label: 'Rechnung', icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: 'notes', label: 'Notizen', icon: <FileText className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(20,48,71,0.4)' }} onClick={onClose}>
      <div
        className="h-full w-full max-w-lg bg-white shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-0 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-extrabold" style={{ color: '#143047' }}>{name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {lead.request_number && (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md" style={{ color: '#143047', background: '#eef2f7' }}>
                    <Hash className="w-3 h-3" /> {lead.request_number}
                  </span>
                )}
                <span className="text-sm text-gray-500">{lead.event_slug || '–'}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Status row */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {COLUMNS.map(col => (
              <button
                key={col.id}
                onClick={() => handleStatusChange(col.id)}
                disabled={saving}
                className="px-3 py-1 rounded-full text-xs font-bold transition border-2"
                style={{
                  background: lead.status === col.id ? col.color : 'white',
                  borderColor: col.color,
                  color: lead.status === col.id ? 'white' : col.color,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {col.label}
              </button>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border-b" style={{ borderColor: '#e5e8ed' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px"
                style={{
                  borderBottomColor: tab === t.id ? '#143047' : 'transparent',
                  color: tab === t.id ? '#143047' : '#6b7280',
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'info' && (
            <div className="space-y-4">
              <div className="rounded-xl p-4 space-y-3" style={{ background: '#f5f7fa', border: '1px solid #e5e8ed' }}>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a href={`tel:${lead.phone}`} className="text-gray-700">{lead.phone}</a>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{lead.number_of_persons || 1} Person(en)</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{formatDate(lead.created_at)}</span>
                </div>
                {lead.package_title && (
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{lead.package_title}</span>
                  </div>
                )}
                {lead.total_price && lead.total_price > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Euro className="w-4 h-4 text-gray-400" />
                    <span className="font-bold" style={{ color: '#143047' }}>{formatCurrency(lead.total_price)}</span>
                  </div>
                )}
              </div>

              {lead.message && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nachricht</h3>
                  <div className="rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap" style={{ background: '#f5f7fa', border: '1px solid #e5e8ed' }}>
                    {lead.message}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <a
                  href={`mailto:${lead.email}`}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold text-white"
                  style={{ background: '#d9531e' }}
                >
                  <Mail className="w-4 h-4" /> E-Mail
                </a>
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold"
                    style={{ background: '#f5f7fa', border: '1.5px solid #e5e8ed', color: '#143047' }}
                  >
                    <Phone className="w-4 h-4" /> Anrufen
                  </a>
                )}
              </div>
            </div>
          )}

          {tab === 'conversation' && <ConversationTab lead={lead} />}

          {tab === 'invoice' && <InvoiceTab lead={lead} />}

          {tab === 'notes' && (
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">Interne Notizen</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={8}
                placeholder="Notizen zu diesem Lead, Vereinbarungen, nächste Schritte…"
                className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
                style={{ borderColor: '#e5e8ed' }}
              />
              <button
                onClick={handleSaveNotes}
                disabled={saving}
                className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ background: '#143047' }}
              >
                {saving ? 'Speichern…' : 'Notizen speichern'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function CrmPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadsRes, invoicesRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/invoices'),
      ]);
      const leadsData = await leadsRes.json();
      const invoicesData = await invoicesRes.json();
      if (leadsData.success) setLeads(leadsData.data || []);
      if (invoicesData.success) setInvoices(invoicesData.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Live: Posteingang automatisch abrufen (beim Öffnen + alle 20s), solange das CRM offen ist.
  // Holt Kundenantworten aus request@… und ordnet sie per RQ-Nummer zu – ohne Klick/Cron.
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try { await fetch('/api/admin/mail/poll', { method: 'POST' }); } catch { /* still / non-fatal */ }
      if (active) loadData();
    };
    poll();
    const id = setInterval(poll, 20000);
    return () => { active = false; clearInterval(id); };
  }, [loadData]);

  const handleUpdate = async (id: string, updates: { status?: CrmStatus; notes?: string }) => {
    await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await loadData();
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const invoicesByBooking = invoices.reduce<Record<string, Invoice[]>>((acc, inv) => {
    if (!acc[inv.booking_id]) acc[inv.booking_id] = [];
    acc[inv.booking_id].push(inv);
    return acc;
  }, {});

  const filtered = leads.filter(l => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      getLeadName(l).toLowerCase().includes(q) ||
      (l.email || '').toLowerCase().includes(q) ||
      (l.event_slug || '').toLowerCase().includes(q) ||
      (l.package_title || '').toLowerCase().includes(q)
    );
  });

  return (
    <AdminShell title="CRM & ERP">
      {/* ERP Stats */}
      <ErpStats leads={leads} invoices={invoices} />

      {/* Search + Refresh */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Name, E-Mail, Event, Package suchen…"
          className="flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          style={{ borderColor: '#e5e8ed' }}
        />
        <button
          onClick={loadData}
          className="p-2.5 rounded-xl border transition hover:bg-gray-50"
          style={{ borderColor: '#e5e8ed' }}
          title="Aktualisieren"
        >
          <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 pb-8">
        {COLUMNS.map(col => {
          const colLeads = filtered.filter(l => l.status === col.id);
          const colRevenue = colLeads.reduce((s, l) => s + (l.total_price || 0), 0);
          return (
            <div key={col.id} className="flex flex-col gap-3">
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: col.bg, border: `1.5px solid ${col.color}20` }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm" style={{ color: col.color }}>{col.label}</span>
                  <span
                    className="text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center text-white"
                    style={{ background: col.color }}
                  >
                    {colLeads.length}
                  </span>
                </div>
                {colRevenue > 0 && (
                  <div className="text-xs font-semibold" style={{ color: col.color, opacity: 0.8 }}>
                    {formatCurrency(colRevenue)}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2.5 min-h-[100px]">
                {!loading && colLeads.length === 0 && (
                  <div className="rounded-xl p-6 text-center text-xs text-gray-400" style={{ border: '1.5px dashed #e5e8ed' }}>
                    Keine Einträge
                  </div>
                )}
                {colLeads.map(lead => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    hasInvoice={!!invoicesByBooking[lead.id]?.length}
                    onClick={() => setSelected(lead)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <DetailDrawer
          lead={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
        />
      )}
    </AdminShell>
  );
}
