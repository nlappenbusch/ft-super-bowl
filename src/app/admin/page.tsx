'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BookingRequest } from '@/lib/supabase';
import { Download, Search, Filter, ChevronDown, UserCircle, Mail, Phone, Calendar, Users, Bed, DollarSign, MessageSquare, Eye, FileText, Plus, Receipt } from 'lucide-react';

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

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
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
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'super-bowl-2027-admin';

  useEffect(() => {
    // Check if already authenticated
    const auth = sessionStorage.getItem('admin_authenticated');
    if (auth === 'true') {
      setIsAuthenticated(true);
      fetchBookings();
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple password check (in production use proper auth)
    if (password === adminPassword) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      fetchBookings();
    } else {
      alert('Falsches Passwort!');
    }
  };

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

    try {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: invoiceBookingId,
          items,
          dueInDays: invoiceDueDays
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
    const booking = bookings.find(b => b.id === invoiceBookingId);
    const hotelName = booking ? `Hotel ${booking.package_title.includes('Beverly') ? 'Beverly Wilshire' : 'Loews Santa Monica'}` : 'Hotel';
    
    const timing = position === 'before' ? 'VORAB' : 'VERLÄNGERUNG';
    
    // Prüfen ob bereits eine Zusatznacht dieser Art existiert
    const existingIndex = invoiceItems.findIndex(item => 
      item.description.toLowerCase().includes('zusatznacht') &&
      item.description.toLowerCase().includes(timing.toLowerCase())
    );
    
    if (existingIndex !== -1) {
      // Erhöhe die Quantity der existierenden Position
      const updated = [...invoiceItems];
      const newQuantity = updated[existingIndex].quantity + 1;
      
      // Update description mit neuer Datumsrange
      const startDate = new Date('2027-02-09'); // Fr. 09.02.2027
      let dateInfo = '';
      
      if (position === 'before') {
        const firstNight = new Date(startDate);
        firstNight.setDate(firstNight.getDate() - newQuantity);
        const lastNight = new Date(startDate);
        lastNight.setDate(lastNight.getDate() - 1);
        
        const formatShort = (d: Date) => {
          const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
          return `${days[d.getDay()]}. ${d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }).slice(0, 5)}`;
        };
        
        dateInfo = `(${formatShort(firstNight)} - ${formatShort(lastNight)}.2027)`;
      } else {
        const firstNight = new Date('2027-02-11'); // Mo. 11.02.2027
        const lastNight = new Date(firstNight);
        lastNight.setDate(lastNight.getDate() + newQuantity);
        
        const formatShort = (d: Date) => {
          const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
          return `${days[d.getDay()]}. ${d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }).slice(0, 5)}`;
        };
        
        dateInfo = `(${formatShort(firstNight)} - ${formatShort(lastNight)}.2027)`;
      }
      
      updated[existingIndex] = { 
        ...updated[existingIndex], 
        quantity: newQuantity,
        description: `Zusatznacht ${timing} ${hotelName} ${dateInfo}\nDoppelzimmer mit Frühstück`
      };
      setInvoiceItems(updated);
    } else {
      // Erstelle neue Position (1 Nacht)
      const dateInfo = position === 'before' 
        ? '(Do. 08.02. - Fr. 09.02.2027)' 
        : '(Mo. 11.02. - Di. 12.02.2027)';
      
      setInvoiceItems([...invoiceItems, { 
        description: `Zusatznacht ${timing} ${hotelName} ${dateInfo}\nDoppelzimmer mit Frühstück`, 
        quantity: 1, 
        unit_price: 500 
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'booked': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-900 via-blue-800 to-blue-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">Super Bowl LXI Buchungsverwaltung</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Passwort</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Admin-Passwort eingeben"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Anmelden
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Lade Buchungen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Buchungsverwaltung</h1>
              <p className="text-gray-600 mt-1">Super Bowl LXI - {filteredBookings.length} Anfragen</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Link
                  href="/admin"
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 text-white"
                >
                  Buchungen
                </Link>
                <Link
                  href="/admin/events"
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Events
                </Link>
                <Link
                  href="/admin/packages"
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Packages
                </Link>
                <Link
                  href="/admin/faqs"
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  FAQs
                </Link>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                <Download className="w-4 h-4" />
                CSV Export
              </button>
              <button
                onClick={() => {
                  sessionStorage.removeItem('admin_authenticated');
                  setIsAuthenticated(false);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Suche nach Name, Email oder Telefon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {['all', 'new', 'in_progress', 'booked', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status as any)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    filter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? 'Alle' : getStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kontakt</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Personen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zimmer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preis</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aktionen</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
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
                        <div className="font-medium text-gray-900">
                          {booking.travelers[0]?.firstName} {booking.travelers[0]?.lastName}
                        </div>
                        <div className="text-gray-500 flex items-center gap-1 mt-1">
                          <Mail className="w-3 h-3" />
                          {booking.email}
                        </div>
                        <div className="text-gray-500 flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3" />
                          {booking.phone}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {booking.number_of_persons}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex flex-col gap-1">
                        {booking.double_rooms > 0 && <span>{booking.double_rooms} DZ</span>}
                        {booking.single_rooms > 0 && <span>{booking.single_rooms} EZ</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {parseFloat(booking.total_price.toString()).toLocaleString('de-DE')} €
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={booking.status}
                        onChange={(e) => updateStatus(booking.id, e.target.value)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}
                      >
                        <option value="new">Neu</option>
                        <option value="in_progress">In Bearbeitung</option>
                        <option value="booked">Gebucht</option>
                        <option value="rejected">Abgelehnt</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          Details
                        </button>
                        <button
                          onClick={() => openInvoiceModal(booking.id)}
                          className="text-green-600 hover:text-green-900 flex items-center gap-1"
                        >
                          <Receipt className="w-4 h-4" />
                          Rechnung
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Buchungsdetails</h2>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Event</h3>
                <p className="text-gray-700">{selectedBooking.event_slug || 'n/a'}</p>
                <p className="text-gray-700">{selectedBooking.package_title}</p>
              </div>
              {/* Travelers */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Reisende ({selectedBooking.number_of_persons})</h3>
                <div className="space-y-3">
                  {selectedBooking.travelers.map((traveler, idx) => (
                    <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-sm text-gray-600">Name:</span>
                          <p className="font-semibold">{traveler.salutation} {traveler.firstName} {traveler.lastName}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Geburtsdatum:</span>
                          <p className="font-semibold">{traveler.birthDate}</p>
                        </div>
                        {traveler.passportNumber && (
                          <div>
                            <span className="text-sm text-gray-600">Passnummer:</span>
                            <p className="font-semibold">{traveler.passportNumber}</p>
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
                  <h3 className="text-lg font-semibold mb-2">Nachricht</h3>
                  <p className="bg-gray-50 p-4 rounded-lg">{selectedBooking.message}</p>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className="text-lg font-semibold mb-2">Notizen (intern)</h3>
                <textarea
                  value={selectedBooking.notes || ''}
                  onChange={(e) => {
                    const updated = { ...selectedBooking, notes: e.target.value };
                    setSelectedBooking(updated);
                  }}
                  onBlur={(e) => updateNotes(selectedBooking.id, e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Interne Notizen..."
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setSelectedBooking(null)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && invoiceBookingId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowInvoiceModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Rechnungsverwaltung</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Create Invoice Button or Form */}
              {!showCreateInvoiceForm ? (
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Rechnungen für diese Buchung</h3>
                  <button
                    onClick={() => setShowCreateInvoiceForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Plus className="w-4 h-4" />
                    Neue Rechnung erstellen
                  </button>
                </div>
              ) : (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-blue-900">Neue Rechnung erstellen</h3>
                    <button
                      onClick={() => setShowCreateInvoiceForm(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Invoice Items */}
                  <div className="space-y-3 mb-4">
                    <label className="block text-sm font-semibold text-gray-700">Rechnungspositionen:</label>
                    {invoiceItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-start bg-white p-3 rounded-lg border">
                        <div className="col-span-6">
                          <textarea
                            value={item.description}
                            onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                            placeholder="Beschreibung (z.B. Super Bowl Package)"
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                            rows={2}
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            placeholder="Anzahl"
                            min="1"
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => updateInvoiceItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            placeholder="Preis (CHF)"
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                          />
                        </div>
                        <div className="col-span-1 flex items-center justify-center">
                          {invoiceItems.length > 1 && (
                            <button
                              onClick={() => removeInvoiceItem(index)}
                              className="text-red-600 hover:text-red-800 font-bold"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="col-span-12 text-right text-sm font-semibold text-gray-700">
                          Gesamt: CHF {(item.quantity * item.unit_price).toFixed(2)}
                        </div>
                      </div>
                    ))}
                    
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => addExtraNight('before')}
                        className="px-3 py-2 border-2 border-dashed border-purple-400 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition font-medium text-sm"
                      >
                        🏨 ← Nacht DAVOR
                      </button>
                      <button
                        onClick={() => addExtraNight('after')}
                        className="px-3 py-2 border-2 border-dashed border-green-400 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium text-sm"
                      >
                        🏨 Nacht DANACH →
                      </button>
                      <button
                        onClick={addInvoiceItem}
                        className="px-3 py-2 border-2 border-dashed border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50 transition text-sm"
                      >
                        + Andere Position
                      </button>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Fälligkeitsfrist (Tage):
                    </label>
                    <select
                      value={invoiceDueDays}
                      onChange={(e) => setInvoiceDueDays(parseInt(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="7">7 Tage</option>
                      <option value="14">14 Tage (Standard)</option>
                      <option value="21">21 Tage</option>
                      <option value="30">30 Tage</option>
                    </select>
                  </div>

                  {/* Total Preview */}
                  <div className="bg-white p-4 rounded-lg border-2 border-blue-300 mb-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Gesamtbetrag:</span>
                      <span className="text-blue-600">
                        CHF {invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCreateInvoiceForm(false)}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      disabled={isCreatingInvoice}
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={createInvoice}
                      disabled={isCreatingInvoice}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isCreatingInvoice ? 'Erstelle Rechnung...' : 'Rechnung erstellen'}
                    </button>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isLoadingInvoices && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Lade Rechnungen...</p>
                </div>
              )}

              {/* Invoices List */}
              {!isLoadingInvoices && bookingInvoices.length === 0 && !showCreateInvoiceForm && (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Receipt className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Noch keine Rechnungen vorhanden</p>
                  <p className="text-sm text-gray-500 mt-1">Erstelle die erste Rechnung für diese Buchung</p>
                </div>
              )}
              
              {!isLoadingInvoices && bookingInvoices.length > 0 && (
                <div className="space-y-4">
                  {bookingInvoices.map((invoice) => (
                    <div key={invoice.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-lg">{invoice.invoice_number}</h4>
                          <p className="text-sm text-gray-600">
                            Erstellt: {new Date(invoice.invoice_date).toLocaleDateString('de-DE')}
                          </p>
                          <p className="text-sm text-gray-600">
                            Fällig: {new Date(invoice.due_date).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">
                            CHF {invoice.total_amount.toFixed(2)}
                          </div>
                          <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-2 ${
                            invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                            invoice.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            invoice.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {invoice.status === 'paid' ? 'Bezahlt' :
                             invoice.status === 'partial' ? 'Teilweise bezahlt' :
                             invoice.status === 'cancelled' ? 'Storniert' :
                             'Offen'}
                          </div>
                        </div>
                      </div>

                      {invoice.paid_amount > 0 && (
                        <div className="bg-gray-50 p-3 rounded mb-3">
                          <div className="flex justify-between text-sm">
                            <span>Bereits bezahlt:</span>
                            <span className="font-semibold">CHF {invoice.paid_amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold mt-1">
                            <span>Noch offen:</span>
                            <span className="text-red-600">CHF {(invoice.total_amount - invoice.paid_amount).toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadInvoicePDF(invoice.id, invoice.invoice_number)}
                          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                          title="PDF herunterladen"
                        >
                          <Download className="w-4 h-4" />
                          <span className="hidden sm:inline">PDF</span>
                        </button>
                        
                        {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                          <>
                            <button
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
                              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                              title="Zahlung verbuchen"
                            >
                              <DollarSign className="w-4 h-4" />
                              <span className="hidden sm:inline">Zahlung</span>
                            </button>
                            
                            <button
                              onClick={() => cancelInvoice(invoice.id)}
                              className="flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                              title="Rechnung stornieren"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
