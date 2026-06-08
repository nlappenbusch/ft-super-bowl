'use client';

import { useState, useEffect } from 'react';
import { BookingRequest } from '@/lib/supabase';
import {
  Download, Search, Mail, Phone, Users, Bed, DollarSign, Eye, Plus, Receipt, X, Inbox,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import {
  Card,
  SectionCard,
  PageHeader,
  Button,
  Field,
  TextInput,
  TextArea,
  SelectInput,
  InputField,
  TextAreaField,
  Badge,
  StatCard,
  EmptyState,
  Spinner,
} from '@/components/admin/ui';

interface Invoice {
  id: string;
  invoice_number: string;
  booking_id: string;
  created_at: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  status: 'open' | 'partial' | 'paid' | 'cancelled';
  notes: string;
  items?: InvoiceItem[];
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

type BadgeTone = 'navy' | 'accent' | 'ok' | 'warn' | 'danger' | 'info' | 'muted';

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'new' | 'in_progress' | 'booked' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceBookingId, setInvoiceBookingId] = useState<string | null>(null);
  const [bookingInvoices, setBookingInvoices] = useState<Invoice[]>([]);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [showCreateInvoiceForm, setShowCreateInvoiceForm] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<Array<{description: string; quantity: number; unit_price: number}>>([]);
  const [invoiceDueDays, setInvoiceDueDays] = useState(14);
  const [invoicePdfMeta, setInvoicePdfMeta] = useState({
    event_name: '',
    destination: '',
    hotel_description: '',
    ticket_details: [
      'Inkl. Zutritt zum VIP-Bereich mit Catering & Getränken',
      'Inkl. Faltin Travel Lanyard',
      'Inkl. detaillierte Reiseinformation & Schweizer Reisegarantie',
    ].join('\n'),
    thank_you_text: '',
  });

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bookings');
      const result = await response.json();

      if (result.success) {
        setBookings(result.data || []);
      } else {
        console.error('Error fetching bookings:', result.error);
        alert('Fehler beim Laden der Buchungen: ' + result.error);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      alert('Fehler beim Laden der Buchungen: ' + (error as Error).message);
    }
    setLoading(false);
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const result = await response.json();
      if (!result.success) {
        alert('Fehler beim Update: ' + result.error);
      } else {
        fetchBookings();
      }
    } catch (error) {
      alert('Fehler beim Update: ' + (error as Error).message);
    }
  };

  const updateNotes = async (id: string, notes: string) => {
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });

      const result = await response.json();
      if (!result.success) {
        alert('Fehler beim Speichern: ' + result.error);
      } else {
        fetchBookings();
      }
    } catch (error) {
      alert('Fehler beim Speichern: ' + (error as Error).message);
    }
  };

  const openInvoiceModal = async (bookingId: string) => {
    setInvoiceBookingId(bookingId);
    setIsLoadingInvoices(true);
    setShowInvoiceModal(true);
    setShowCreateInvoiceForm(false);

    // Initialize default invoice items from booking
    const booking = bookings.find(b => b.id === bookingId);
    if (booking) {
      setInvoiceItems([
        {
          description: `${booking.event_slug ? booking.event_slug + ' - ' : ''}${booking.package_title}\n${booking.number_of_persons} Personen, ${booking.double_rooms} DZ, ${booking.single_rooms} EZ`,
          quantity: 1,
          unit_price: booking.total_price
        }
      ]);
      // Pre-fill PDF meta from booking data
      setInvoicePdfMeta(prev => ({
        ...prev,
        event_name: booking.event_slug || '',
        hotel_description: booking.package_title || '',
      }));
    }

    // Fetch existing invoices
    try {
      const response = await fetch(`/api/invoices?bookingId=${bookingId}`);
      const result = await response.json();
      if (result.success) {
        setBookingInvoices(result.data || []);
      } else {
        console.error('Error fetching invoices:', result.error);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setIsLoadingInvoices(false);
    }
  };

  const createInvoice = async () => {
    if (!invoiceBookingId) return;

    // Validate items
    if (invoiceItems.length === 0) {
      alert('⚠️ Bitte mindestens eine Position hinzufügen!');
      return;
    }

    const hasEmptyDescription = invoiceItems.some(item => !item.description.trim());
    if (hasEmptyDescription) {
      alert('⚠️ Alle Positionen müssen eine Beschreibung haben!');
      return;
    }

    const hasInvalidPrice = invoiceItems.some(item => item.unit_price <= 0 || item.quantity <= 0);
    if (hasInvalidPrice) {
      alert('⚠️ Preis und Anzahl müssen größer als 0 sein!');
      return;
    }

    setIsCreatingInvoice(true);

    const items = invoiceItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price
    }));

    // Build notes JSON with PDF meta fields
    const notesJson = JSON.stringify({
      event_name: invoicePdfMeta.event_name,
      destination: invoicePdfMeta.destination,
      hotel_description: invoicePdfMeta.hotel_description,
      ticket_details: invoicePdfMeta.ticket_details,
      thank_you_text: invoicePdfMeta.thank_you_text,
    });

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: invoiceBookingId,
          items,
          dueInDays: invoiceDueDays,
          notes: notesJson,
        })
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Rechnung erfolgreich erstellt!');
        setShowCreateInvoiceForm(false);
        openInvoiceModal(invoiceBookingId); // Refresh invoices
      } else {
        alert('❌ Fehler: ' + result.error);
      }
    } catch (error) {
      alert('❌ Fehler beim Erstellen: ' + (error as Error).message);
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const addInvoiceItem = () => {
    setInvoiceItems([...invoiceItems, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const addExtraNight = (position: 'before' | 'after') => {
    const timing = position === 'before' ? 'VORAB' : 'VERLÄNGERUNG';
    const existingIndex = invoiceItems.findIndex(item =>
      item.description.toLowerCase().includes('zusatznacht') &&
      item.description.toLowerCase().includes(timing.toLowerCase())
    );
    if (existingIndex !== -1) {
      const updated = [...invoiceItems];
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: updated[existingIndex].quantity + 1,
      };
      setInvoiceItems(updated);
    } else {
      setInvoiceItems([...invoiceItems, {
        description: `Zusatznacht ${timing}\nDoppelzimmer mit Frühstück`,
        quantity: 1,
        unit_price: 0
      }]);
    }
  };

  const removeInvoiceItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    const updated = [...invoiceItems];
    updated[index] = { ...updated[index], [field]: value };
    setInvoiceItems(updated);
  };

  const downloadInvoicePDF = (invoiceId: string, invoiceNumber: string) => {
    window.open(`/api/invoices/${invoiceId}/pdf`, '_blank');
  };

  const recordInvoicePayment = async (invoiceId: string, amount: number) => {
    if (amount <= 0) {
      alert('⚠️ Betrag muss größer als 0 sein!');
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment: amount })
      });

      const result = await response.json();
      if (result.success) {
        alert(`✅ Zahlung von CHF ${amount.toFixed(2)} erfolgreich verbucht!`);
        if (invoiceBookingId) {
          openInvoiceModal(invoiceBookingId); // Refresh
        }
      } else {
        alert('❌ Fehler: ' + result.error);
      }
    } catch (error) {
      alert('❌ Fehler: ' + (error as Error).message);
    }
  };

  const cancelInvoice = async (invoiceId: string) => {
    if (!confirm('Rechnung wirklich stornieren?')) return;

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Rechnung storniert!');
        if (invoiceBookingId) {
          openInvoiceModal(invoiceBookingId);
        }
      } else {
        alert('❌ Fehler: ' + result.error);
      }
    } catch (error) {
      alert('❌ Fehler: ' + (error as Error).message);
    }
  };

  const exportToCSV = () => {
    const headers = ['Datum', 'Name', 'Email', 'Telefon', 'Personen', 'DZ', 'EZ', 'Preis', 'Status'];
    const rows = filteredBookings.map(b => [
      new Date(b.created_at).toLocaleDateString('de-DE'),
      b.travelers[0]?.firstName + ' ' + b.travelers[0]?.lastName,
      b.email,
      b.phone,
      b.number_of_persons,
      b.double_rooms,
      b.single_rooms,
      b.total_price + ' €',
      b.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `buchungen_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredBookings = bookings.filter(b => {
    const matchesFilter = filter === 'all' || b.status === filter;
    const matchesSearch = searchTerm === '' ||
      b.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.phone.includes(searchTerm) ||
      b.travelers.some(t =>
        t.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.lastName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    return matchesFilter && matchesSearch;
  });

  const getStatusTone = (status: string): BadgeTone => {
    switch (status) {
      case 'new': return 'info';
      case 'in_progress': return 'warn';
      case 'booked': return 'ok';
      case 'rejected': return 'danger';
      default: return 'muted';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new': return 'Neu';
      case 'in_progress': return 'In Bearbeitung';
      case 'booked': return 'Gebucht';
      case 'rejected': return 'Abgelehnt';
      default: return status;
    }
  };

  const getInvoiceTone = (status: Invoice['status']): BadgeTone => {
    switch (status) {
      case 'paid': return 'ok';
      case 'partial': return 'warn';
      case 'cancelled': return 'danger';
      default: return 'info';
    }
  };

  const getInvoiceLabel = (status: Invoice['status']) => {
    switch (status) {
      case 'paid': return 'Bezahlt';
      case 'partial': return 'Teilweise bezahlt';
      case 'cancelled': return 'Storniert';
      default: return 'Offen';
    }
  };

  const stats = {
    total: bookings.length,
    new: bookings.filter(b => b.status === 'new').length,
    in_progress: bookings.filter(b => b.status === 'in_progress').length,
    booked: bookings.filter(b => b.status === 'booked').length,
  };

  const invoiceTotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  return (
    <AdminShell title="Buchungsverwaltung">
      <PageHeader
        title="Buchungsverwaltung"
        description={`${filteredBookings.length} Anfragen`}
        actions={
          <Button variant="accent" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
            CSV Export
          </Button>
        }
      />

      {loading ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Spinner className="h-10 w-10" />
          <p className="mt-4 text-sm text-gray-500">Lade Buchungen...</p>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={<Inbox className="h-4 w-4" />} label="Gesamt" value={stats.total} tone="navy" />
            <StatCard icon={<Plus className="h-4 w-4" />} label="Neu" value={stats.new} tone="info" />
            <StatCard icon={<Users className="h-4 w-4" />} label="In Bearbeitung" value={stats.in_progress} tone="warn" />
            <StatCard icon={<Receipt className="h-4 w-4" />} label="Gebucht" value={stats.booked} tone="ok" />
          </div>

          {/* Filters */}
          <SectionCard className="mb-6">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <TextInput
                  type="text"
                  placeholder="Suche nach Name, Email oder Telefon..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'new', 'in_progress', 'booked', 'rejected'] as const).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={filter === status ? 'primary' : 'secondary'}
                    onClick={() => setFilter(status)}
                  >
                    {status === 'all' ? 'Alle' : getStatusLabel(status)}
                  </Button>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Bookings Table */}
          {filteredBookings.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-10 w-10" />}
              title="Keine Buchungen gefunden"
              description="Passe Suche oder Filter an, um Ergebnisse zu sehen."
            />
          ) : (
            <Card padded={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead style={{ background: '#f5f7fa' }}>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Datum</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Kontakt</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Personen</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Zimmer</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Preis</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {new Date(booking.created_at).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-semibold text-gray-900">
                              {booking.travelers[0]?.firstName} {booking.travelers[0]?.lastName}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-gray-500">
                              <Mail className="h-3 w-3" />
                              {booking.email}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-gray-500">
                              <Phone className="h-3 w-3" />
                              {booking.phone}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-gray-400" />
                            {booking.number_of_persons}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          <div className="flex flex-col gap-1">
                            {booking.double_rooms > 0 && (
                              <span className="flex items-center gap-1">
                                <Bed className="h-3.5 w-3.5 text-gray-400" />
                                {booking.double_rooms} DZ
                              </span>
                            )}
                            {booking.single_rooms > 0 && (
                              <span className="flex items-center gap-1">
                                <Bed className="h-3.5 w-3.5 text-gray-400" />
                                {booking.single_rooms} EZ
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-gray-900">
                          {parseFloat(booking.total_price.toString()).toLocaleString('de-DE')} €
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Badge tone={getStatusTone(booking.status)}>{getStatusLabel(booking.status)}</Badge>
                            <SelectInput
                              value={booking.status}
                              onChange={(e) => updateStatus(booking.id, e.target.value)}
                              className="w-auto py-1.5 text-xs"
                            >
                              <option value="new">Neu</option>
                              <option value="in_progress">In Bearbeitung</option>
                              <option value="booked">Gebucht</option>
                              <option value="rejected">Abgelehnt</option>
                            </SelectInput>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm">
                          <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={() => setSelectedBooking(booking)}>
                              <Eye className="h-4 w-4" />
                              Details
                            </Button>
                            <Button size="sm" variant="primary" onClick={() => openInvoiceModal(booking.id)}>
                              <Receipt className="h-4 w-4" />
                              Rechnung
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedBooking(null)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <h2 className="text-xl font-extrabold" style={{ color: '#143047' }}>Buchungsdetails</h2>
              <Button size="sm" variant="ghost" onClick={() => setSelectedBooking(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-6 p-6">
              <div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">Event</h3>
                <p className="text-gray-800">{selectedBooking.event_slug || 'n/a'}</p>
                <p className="text-gray-800">{selectedBooking.package_title}</p>
              </div>

              {/* Travelers */}
              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500">Reisende ({selectedBooking.number_of_persons})</h3>
                <div className="space-y-3">
                  {selectedBooking.travelers.map((traveler, idx) => (
                    <div key={idx} className="rounded-xl bg-gray-50 p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-gray-500">Name:</span>
                          <p className="font-semibold text-gray-900">{traveler.salutation} {traveler.firstName} {traveler.lastName}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500">Geburtsdatum:</span>
                          <p className="font-semibold text-gray-900">{traveler.birthDate}</p>
                        </div>
                        {traveler.passportNumber && (
                          <div>
                            <span className="text-xs text-gray-500">Passnummer:</span>
                            <p className="font-semibold text-gray-900">{traveler.passportNumber}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message */}
              {selectedBooking.message && (
                <div>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-gray-500">Nachricht</h3>
                  <p className="rounded-xl bg-gray-50 p-4 text-gray-800">{selectedBooking.message}</p>
                </div>
              )}

              {/* Notes */}
              <TextAreaField
                label="Notizen (intern)"
                value={selectedBooking.notes || ''}
                onChange={(e) => {
                  const updated = { ...selectedBooking, notes: e.target.value };
                  setSelectedBooking(updated);
                }}
                onBlur={(e) => updateNotes(selectedBooking.id, e.target.value)}
                rows={4}
                placeholder="Interne Notizen..."
              />
            </div>

            <div className="flex justify-end border-t border-gray-100 p-6">
              <Button variant="secondary" onClick={() => setSelectedBooking(null)}>
                Schließen
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && invoiceBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInvoiceModal(false)}>
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
              <h2 className="text-xl font-extrabold" style={{ color: '#143047' }}>Rechnungsverwaltung</h2>
              <Button size="sm" variant="ghost" onClick={() => setShowInvoiceModal(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="space-y-6 p-6">
              {/* Create Invoice Button or Form */}
              {!showCreateInvoiceForm ? (
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold" style={{ color: '#143047' }}>Rechnungen für diese Buchung</h3>
                  <Button variant="primary" onClick={() => setShowCreateInvoiceForm(true)}>
                    <Plus className="h-4 w-4" />
                    Neue Rechnung erstellen
                  </Button>
                </div>
              ) : (
                <SectionCard
                  title="Neue Rechnung erstellen"
                  actions={
                    <Button size="sm" variant="ghost" onClick={() => setShowCreateInvoiceForm(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  }
                >
                  {/* Invoice Items */}
                  <div className="mb-4 space-y-3">
                    <Field label="Rechnungspositionen">
                      <div className="space-y-3">
                        {invoiceItems.map((item, index) => (
                          <div key={index} className="grid grid-cols-12 items-start gap-2 rounded-xl border border-gray-200 p-3">
                            <div className="col-span-6">
                              <TextArea
                                value={item.description}
                                onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                                placeholder="Beschreibung (z.B. Eventticket Package)"
                                rows={2}
                              />
                            </div>
                            <div className="col-span-2">
                              <TextInput
                                type="number"
                                value={item.quantity}
                                onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                placeholder="Anzahl"
                                min="1"
                              />
                            </div>
                            <div className="col-span-3">
                              <TextInput
                                type="number"
                                value={item.unit_price}
                                onChange={(e) => updateInvoiceItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                placeholder="Preis (CHF)"
                                min="0"
                                step="0.01"
                              />
                            </div>
                            <div className="col-span-1 flex items-center justify-center">
                              {invoiceItems.length > 1 && (
                                <Button size="sm" variant="danger" onClick={() => removeInvoiceItem(index)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                            <div className="col-span-12 text-right text-sm font-semibold text-gray-700">
                              Gesamt: CHF {(item.quantity * item.unit_price).toFixed(2)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Field>

                    <div className="grid grid-cols-3 gap-3">
                      <Button variant="secondary" size="sm" onClick={() => addExtraNight('before')}>
                        🏨 ← Nacht DAVOR
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => addExtraNight('after')}>
                        🏨 Nacht DANACH →
                      </Button>
                      <Button variant="secondary" size="sm" onClick={addInvoiceItem}>
                        <Plus className="h-4 w-4" />
                        Andere Position
                      </Button>
                    </div>
                  </div>

                  {/* Due Date */}
                  <Field label="Fälligkeitsfrist (Tage)" className="mb-4">
                    <SelectInput
                      value={invoiceDueDays}
                      onChange={(e) => setInvoiceDueDays(parseInt(e.target.value))}
                    >
                      <option value="7">7 Tage</option>
                      <option value="14">14 Tage (Standard)</option>
                      <option value="21">21 Tage</option>
                      <option value="30">30 Tage</option>
                    </SelectInput>
                  </Field>

                  {/* PDF Meta Fields */}
                  <details className="mb-4 overflow-hidden rounded-xl border border-gray-200">
                    <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-semibold" style={{ color: '#143047' }}>
                      📄 PDF-Felder bearbeiten <span className="font-normal text-gray-500">(Veranstaltung, Destination, Details…)</span>
                    </summary>
                    <div className="space-y-3 border-t border-gray-200 px-4 pb-4 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <InputField
                          label="Veranstaltung"
                          value={invoicePdfMeta.event_name}
                          onChange={e => setInvoicePdfMeta(p => ({ ...p, event_name: e.target.value }))}
                          placeholder="z.B. French Open 2027"
                        />
                        <InputField
                          label="Destination"
                          value={invoicePdfMeta.destination}
                          onChange={e => setInvoicePdfMeta(p => ({ ...p, destination: e.target.value }))}
                          placeholder="z.B. Frankreich – Paris"
                        />
                      </div>
                      <InputField
                        label="Hotel / Package-Beschreibung"
                        value={invoicePdfMeta.hotel_description}
                        onChange={e => setInvoicePdfMeta(p => ({ ...p, hotel_description: e.target.value }))}
                        placeholder="z.B. 5* Hotel Roland Garros"
                      />
                      <TextAreaField
                        label="Leistungen / Inklusivleistungen (eine pro Zeile)"
                        hint="Diese Punkte erscheinen als Liste auf der Rechnung"
                        value={invoicePdfMeta.ticket_details}
                        onChange={e => setInvoicePdfMeta(p => ({ ...p, ticket_details: e.target.value }))}
                        rows={5}
                        placeholder="Inkl. VIP-Zugang&#10;Inkl. Catering & Getränke&#10;Inkl. Reiseinformation"
                        className="font-mono"
                      />
                      <InputField
                        label="Dankes-Text (Seite 2)"
                        value={invoicePdfMeta.thank_you_text}
                        onChange={e => setInvoicePdfMeta(p => ({ ...p, thank_you_text: e.target.value }))}
                        placeholder="Leer = Standard-Text aus Einstellungen"
                      />
                    </div>
                  </details>

                  {/* Total Preview */}
                  <div className="mb-4 rounded-xl border-2 p-4" style={{ borderColor: '#143047' }}>
                    <div className="flex justify-between text-lg font-bold">
                      <span style={{ color: '#143047' }}>Gesamtbetrag:</span>
                      <span style={{ color: '#d9531e' }}>
                        CHF {invoiceTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => setShowCreateInvoiceForm(false)}
                      disabled={isCreatingInvoice}
                      className="flex-1"
                    >
                      Abbrechen
                    </Button>
                    <Button
                      variant="primary"
                      onClick={createInvoice}
                      disabled={isCreatingInvoice}
                      className="flex-1"
                    >
                      {isCreatingInvoice ? (
                        <>
                          <Spinner className="h-4 w-4" />
                          Erstelle Rechnung...
                        </>
                      ) : 'Rechnung erstellen'}
                    </Button>
                  </div>
                </SectionCard>
              )}

              {/* Loading State */}
              {isLoadingInvoices && (
                <div className="flex flex-col items-center py-8">
                  <Spinner className="h-10 w-10" />
                  <p className="mt-2 text-sm text-gray-500">Lade Rechnungen...</p>
                </div>
              )}

              {/* Invoices List */}
              {!isLoadingInvoices && bookingInvoices.length === 0 && !showCreateInvoiceForm && (
                <EmptyState
                  icon={<Receipt className="h-10 w-10" />}
                  title="Noch keine Rechnungen vorhanden"
                  description="Erstelle die erste Rechnung für diese Buchung"
                />
              )}

              {!isLoadingInvoices && bookingInvoices.length > 0 && (
                <div className="space-y-4">
                  {bookingInvoices.map((invoice) => (
                    <Card key={invoice.id}>
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h4 className="text-lg font-bold" style={{ color: '#143047' }}>{invoice.invoice_number}</h4>
                          <p className="text-sm text-gray-500">
                            Erstellt: {new Date(invoice.invoice_date).toLocaleDateString('de-DE')}
                          </p>
                          <p className="text-sm text-gray-500">
                            Fällig: {new Date(invoice.due_date).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-extrabold" style={{ color: '#143047' }}>
                            CHF {invoice.total_amount.toFixed(2)}
                          </div>
                          <div className="mt-2">
                            <Badge tone={getInvoiceTone(invoice.status)}>{getInvoiceLabel(invoice.status)}</Badge>
                          </div>
                        </div>
                      </div>

                      {invoice.paid_amount > 0 && (
                        <div className="mb-3 rounded-xl bg-gray-50 p-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Bereits bezahlt:</span>
                            <span className="font-semibold text-gray-900">CHF {invoice.paid_amount.toFixed(2)}</span>
                          </div>
                          <div className="mt-1 flex justify-between text-sm font-bold">
                            <span className="text-gray-600">Noch offen:</span>
                            <span style={{ color: '#dc2626' }}>CHF {(invoice.total_amount - invoice.paid_amount).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          onClick={() => downloadInvoicePDF(invoice.id, invoice.invoice_number)}
                          title="PDF herunterladen"
                        >
                          <Download className="h-4 w-4" />
                          <span className="hidden sm:inline">PDF</span>
                        </Button>

                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                          <>
                            <Button
                              variant="accent"
                              onClick={() => {
                                const remainingAmount = (invoice.total_amount - invoice.paid_amount).toFixed(2);
                                const amount = prompt(
                                  `Zahlbetrag eingeben:\n\nOffener Betrag: CHF ${remainingAmount}\n\nBetrag:`,
                                  remainingAmount
                                );
                                if (amount && !isNaN(parseFloat(amount))) {
                                  const parsedAmount = parseFloat(amount);
                                  if (parsedAmount > 0) {
                                    recordInvoicePayment(invoice.id, parsedAmount);
                                  } else {
                                    alert('⚠️ Betrag muss größer als 0 sein!');
                                  }
                                }
                              }}
                              title="Zahlung verbuchen"
                            >
                              <DollarSign className="h-4 w-4" />
                              <span className="hidden sm:inline">Zahlung</span>
                            </Button>

                            <Button
                              variant="danger"
                              onClick={() => cancelInvoice(invoice.id)}
                              title="Rechnung stornieren"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-gray-100 p-6">
              <Button variant="secondary" onClick={() => setShowInvoiceModal(false)}>
                Schließen
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
