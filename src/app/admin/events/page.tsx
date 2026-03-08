'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

interface EventFormState {
  id?: string;
  series_id: string;
  slug: string;
  name: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  venue: string;
  location_name: string;
  location_city: string;
  location_region: string;
  location_country: string;
  hero_image: string;
  ticket_image: string;
  base_url: string;
  status: 'active' | 'draft' | 'archived';
}

const emptyForm: EventFormState = {
  series_id: '',
  slug: '',
  name: '',
  title: '',
  description: '',
  start_date: '',
  end_date: '',
  venue: '',
  location_name: '',
  location_city: '',
  location_region: '',
  location_country: '',
  hero_image: '',
  ticket_image: '',
  base_url: '',
  status: 'active'
};

interface SeriesOption {
  id: string;
  slug: string;
  title: string;
  category: string;
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventFormState[]>([]);
  const [series, setSeries] = useState<SeriesOption[]>([]);
  const [form, setForm] = useState<EventFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadEvents = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch('/api/admin/events');
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Laden');
      setLoading(false);
      return;
    }

    setEvents(result.data || []);
    setLoading(false);
  };

  const loadSeries = async () => {
    const response = await fetch('/api/admin/series');
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Laden');
      return;
    }

    setSeries(result.data || []);
  };

  useEffect(() => {
    loadEvents();
    loadSeries();
  }, []);

  const updateField = (field: keyof EventFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleSave = async () => {

    if (!form.slug.trim() || !form.name.trim() || !form.title.trim()) {
      alert('Bitte Slug, Name und Titel ausfuellen.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      series_id: form.series_id || null,
      slug: form.slug.trim(),
      name: form.name.trim(),
      title: form.title.trim(),
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      venue: form.venue || null,
      location_name: form.location_name || null,
      location_city: form.location_city || null,
      location_region: form.location_region || null,
      location_country: form.location_country || null,
      hero_image: form.hero_image || null,
      ticket_image: form.ticket_image || null,
      base_url: form.base_url || null,
      status: form.status
    };

    const response = await fetch(`/api/admin/events${form.id ? `/${form.id}` : ''}`, {
      method: form.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Speichern');
      setSaving(false);
      return;
    }

    await loadEvents();
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Event wirklich loeschen?')) return;

    const response = await fetch(`/api/admin/events/${eventId}`, { method: 'DELETE' });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Loeschen');
      return;
    }

    await loadEvents();
    resetForm();
  };

  return (
    <AdminShell title="Events verwalten">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Events</h2>
            <button
              onClick={loadEvents}
              className="px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              Aktualisieren
            </button>
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-600">Suchen</label>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Titel, Slug, Venue"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {loading && <p className="text-gray-500">Laedt...</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="space-y-3">
            {events
              .filter((event) => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return [event.title, event.slug, event.venue]
                  .filter(Boolean)
                  .some((value) => value.toLowerCase().includes(term));
              })
              .map((event) => (
              <button
                key={event.id}
                onClick={() => setForm({ ...event })}
                className={`w-full text-left p-4 border rounded-lg transition ${
                  form.id === event.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-gray-900">{event.title}</div>
                    <div className="text-xs text-gray-500 mt-1">/{event.slug}</div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {event.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-2">{event.venue}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {form.id ? 'Event bearbeiten' : 'Neues Event'}
            </h2>
            {form.id && (
              <button
                onClick={() => handleDelete(form.id as string)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Loeschen
              </button>
            )}
          </div>

          <div className="grid gap-6">
            <section className="border border-gray-100 rounded-xl p-4 bg-gray-50/70">
              <h3 className="text-sm font-semibold text-gray-700">Basis</h3>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Serie</label>
                  <select
                    value={form.series_id}
                    onChange={(event) => updateField('series_id', event.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Keine Serie</option>
                    {series.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({item.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Slug</label>
                <input
                  value={form.slug}
                  onChange={(event) => updateField('slug', event.target.value)}
                      placeholder="super-bowl-2027"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="active">active</option>
                  <option value="draft">draft</option>
                  <option value="archived">archived</option>
                </select>
              </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Name</label>
                <input
                  value={form.name}
                  onChange={(event) => updateField('name', event.target.value)}
                  placeholder="Super Bowl LXI"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Titel</label>
                <input
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  placeholder="Super Bowl LXI 2027 Tickets & Packages"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600">Beschreibung</label>
                <textarea
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                  rows={3}
                  placeholder="Kurzbeschreibung fuer SEO und Overview"
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            </section>

            <section className="border border-gray-100 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-700">Termin & Ort</h3>
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Startdatum</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(event) => updateField('start_date', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Enddatum</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(event) => updateField('end_date', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Venue</label>
                    <input
                      value={form.venue}
                      onChange={(event) => updateField('venue', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Location Name</label>
                    <input
                      value={form.location_name}
                      onChange={(event) => updateField('location_name', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Stadt</label>
                    <input
                      value={form.location_city}
                      onChange={(event) => updateField('location_city', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Region</label>
                    <input
                      value={form.location_region}
                      onChange={(event) => updateField('location_region', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Land</label>
                  <input
                    value={form.location_country}
                    onChange={(event) => updateField('location_country', event.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="border border-gray-100 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-700">Medien</h3>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Hero Bild URL</label>
                  <input
                    value={form.hero_image}
                    onChange={(event) => updateField('hero_image', event.target.value)}
                    placeholder="https://.../hero.jpg"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Ticket Bild URL</label>
                  <input
                    value={form.ticket_image}
                    onChange={(event) => updateField('ticket_image', event.target.value)}
                    placeholder="https://.../ticket.jpg"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Base URL</label>
                  <input
                    value={form.base_url}
                    onChange={(event) => updateField('base_url', event.target.value)}
                    placeholder="https://superbowl.faltintravel.com"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="border border-dashed border-blue-200 rounded-xl p-4 bg-blue-50">
              <h3 className="text-sm font-semibold text-blue-700">Live Vorschau</h3>
              <div className="mt-3 rounded-xl overflow-hidden border bg-white">
                <div className="p-4" style={{ backgroundImage: form.hero_image ? `url(${form.hero_image})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                  <div className="backdrop-blur-sm bg-black/50 text-white p-4 rounded-lg">
                    <div className="text-lg font-semibold">{form.title || 'Event Titel'}</div>
                    <div className="text-sm opacity-80">{form.start_date || 'Datum'} • {form.venue || 'Venue'}</div>
                  </div>
                </div>
                <div className="p-4 text-sm text-gray-600">
                  {form.description || 'Beschreibung fuer die Event-Seite'}
                </div>
              </div>
            </section>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
            <button
              onClick={resetForm}
              className="flex-1 bg-gray-100 py-2 rounded-lg hover:bg-gray-200"
            >
              Zuruecksetzen
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
