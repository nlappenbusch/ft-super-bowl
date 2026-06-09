'use client';

import { useState, useEffect } from 'react';
import { BookingRequest } from '@/lib/supabase';
import {
  Download, Search, Mail, Phone, Users, Bed, DollarSign, Eye, Plus, Receipt, X, Inbox,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import InvoiceEditor, { InvoiceLead } from '@/components/admin/InvoiceEditor';
import {
  Card,
  SectionCard,
  PageHeader,
  Button,
  TextInput,
  SelectInput,
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
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);
  const [showCreateInvoiceForm, setShowCreateInvoiceForm] = useState(false);

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

  const invoiceBooking = bookings.find((b) => b.id === invoiceBookingId);

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
                invoiceBooking && (
                  <InvoiceEditor
                    lead={invoiceBooking as unknown as InvoiceLead}
                    onCreated={() => { setShowCreateInvoiceForm(false); if (invoiceBookingId) openInvoiceModal(invoiceBookingId); }}
                    onCancel={() => setShowCreateInvoiceForm(false)}
                  />
                )
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
