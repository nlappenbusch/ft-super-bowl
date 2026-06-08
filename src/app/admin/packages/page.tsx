'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import AdminGalleryField from '@/components/admin/AdminGalleryField';

interface EventOption {
  id: string;
  title: string;
  slug: string;
}

interface PackageFormState {
  id?: string;
  event_id: string;
  slug: string;
  package_name: string;
  title: string;
  short_description: string;
  description: string;
  hotel: string;
  stars: string;
  nights: string;
  price: string;
  currency: string;
  single_supplement: string;
  popular: boolean;
  available_spots: string;
  rating: string;
  reviews: string;
  hotel_images: string;
  room_categories: string;
  distance_airport: string;
  distance_stadium: string;
  distance_downtown: string;
  extension_nights: string;
  badge_text: string;
  active: boolean;
}

const emptyForm: PackageFormState = {
  event_id: '',
  slug: '',
  package_name: '',
  title: '',
  short_description: '',
  description: '',
  hotel: '',
  stars: '',
  nights: '',
  price: '',
  currency: 'EUR',
  single_supplement: '',
  popular: false,
  available_spots: '',
  rating: '',
  reviews: '',
  hotel_images: '',
  room_categories: '',
  distance_airport: '',
  distance_stadium: '',
  distance_downtown: '',
  extension_nights: '',
  badge_text: '',
  active: true
};

function parseList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatList(list?: string[] | null) {
  return list && list.length > 0 ? list.join(', ') : '';
}

export default function AdminPackagesPage() {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [packages, setPackages] = useState<PackageFormState[]>([]);
  const [form, setForm] = useState<PackageFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadEvents = async () => {
    const response = await fetch('/api/admin/events');
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Laden');
      return;
    }

    const eventData = (result.data || []) as EventOption[];
    setEvents(eventData);
    if (!selectedEvent && eventData.length > 0) {
      setSelectedEvent(eventData[0].id);
      setForm((prev) => ({ ...prev, event_id: eventData[0].id }));
    }
  };

  const loadPackages = async (eventId: string) => {
    if (!eventId) return;
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/admin/packages?eventId=${encodeURIComponent(eventId)}`);
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Laden');
      setLoading(false);
      return;
    }

    const mapped = (result.data || []).map((row: any) => ({
      id: row.id,
      event_id: row.event_id,
      slug: row.slug || '',
      package_name: row.package_name || '',
      title: row.title || '',
      short_description: row.short_description || '',
      description: row.description || '',
      hotel: row.hotel || '',
      stars: row.stars?.toString() || '',
      nights: row.nights?.toString() || '',
      price: row.price?.toString() || '',
      currency: row.currency || 'EUR',
      single_supplement: row.single_supplement?.toString() || '',
      popular: Boolean(row.popular),
      available_spots: row.available_spots?.toString() || '',
      rating: row.rating?.toString() || '',
      reviews: row.reviews?.toString() || '',
      hotel_images: formatList(row.hotel_images),
      room_categories: formatList(row.room_categories),
      distance_airport: row.distances?.airport || '',
      distance_stadium: row.distances?.stadium || '',
      distance_downtown: row.distances?.downtown || '',
      extension_nights: row.extension_nights || '',
      badge_text: row.badge_text || '',
      active: row.active !== false
    }));

    setPackages(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    loadPackages(selectedEvent);
  }, [selectedEvent]);

  const resetForm = () => {
    setForm({ ...emptyForm, event_id: selectedEvent || '' });
  };

  const updateField = (field: keyof PackageFormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {

    if (!form.event_id || !form.slug.trim() || !form.title.trim()) {
      alert('Bitte Event, Slug und Titel ausfüllen.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      event_id: form.event_id,
      slug: form.slug.trim(),
      package_name: form.package_name.trim() || null,
      title: form.title.trim(),
      short_description: form.short_description || null,
      description: form.description || null,
      hotel: form.hotel || null,
      stars: form.stars ? Number(form.stars) : null,
      nights: form.nights ? Number(form.nights) : null,
      price: form.price ? Number(form.price) : null,
      currency: form.currency || 'EUR',
      single_supplement: form.single_supplement ? Number(form.single_supplement) : null,
      popular: form.popular,
      available_spots: form.available_spots ? Number(form.available_spots) : null,
      rating: form.rating ? Number(form.rating) : null,
      reviews: form.reviews ? Number(form.reviews) : null,
      hotel_images: parseList(form.hotel_images),
      room_categories: parseList(form.room_categories),
      distances: {
        airport: form.distance_airport || '',
        stadium: form.distance_stadium || '',
        downtown: form.distance_downtown || ''
      },
      extension_nights: form.extension_nights || null,
      badge_text: form.badge_text || null,
      active: form.active
    };

    const response = await fetch(`/api/admin/packages${form.id ? `/${form.id}` : ''}`, {
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

    await loadPackages(form.event_id);
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (packageId: string) => {
    if (!confirm('Package wirklich löschen?')) return;

    const response = await fetch(`/api/admin/packages/${packageId}`, { method: 'DELETE' });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Löschen');
      return;
    }

    await loadPackages(selectedEvent);
    resetForm();
  };

  const activeEventLabel = useMemo(() => {
    const event = events.find((item) => item.id === selectedEvent);
    return event ? `${event.title} (${event.slug})` : '';
  }, [events, selectedEvent]);

  const filteredPackages = useMemo(() => {
    if (!searchTerm.trim()) return packages;
    const term = searchTerm.toLowerCase();
    return packages.filter((pkg) =>
      [pkg.title, pkg.slug, pkg.package_name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [packages, searchTerm]);

  return (
    <AdminShell title="Packages verwalten">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex flex-col gap-4 mb-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">Event auswählen</label>
              <select
                value={selectedEvent}
                onChange={(event) => {
                  setSelectedEvent(event.target.value);
                  setForm((prev) => ({ ...prev, event_id: event.target.value }));
                }}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({event.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{activeEventLabel}</span>
              <span>{packages.length} Packages</span>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Suchen</label>
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Titel, Slug, Package Name"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {loading && <p className="text-gray-500">Lädt...</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="space-y-3">
            {filteredPackages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setForm({ ...pkg })}
                className={`w-full text-left p-4 border rounded-lg transition ${
                  form.id === pkg.id
                    ? 'border-blue-500 bg-blue-50'
                    : pkg.active === false
                    ? 'border-gray-100 bg-gray-50 opacity-60'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold ${pkg.active === false ? 'line-through text-gray-400' : 'text-gray-900'}`}>{pkg.title}</div>
                    <div className="text-xs text-gray-500 mt-1">{pkg.slug}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    {pkg.popular && (
                      <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">popular</span>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!pkg.id) return;
                        const res = await fetch(`/api/admin/packages/${pkg.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ active: pkg.active === false })
                        });
                        if (res.ok) await loadPackages(selectedEvent);
                      }}
                      title={pkg.active === false ? 'Aktivieren' : 'Deaktivieren'}
                      className={`w-12 h-6 rounded-full transition-all duration-200 relative shrink-0 ${
                        pkg.active === false ? 'bg-gray-300' : 'bg-green-500'
                      }`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                        pkg.active === false ? 'left-1' : 'left-7'
                      }`} />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600 mt-2">Preis: {pkg.price || 'n/a'} {pkg.currency}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {form.id ? 'Package bearbeiten' : 'Neues Package'}
            </h2>
            {form.id && (
              <button
                onClick={() => handleDelete(form.id as string)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Löschen
              </button>
            )}
          </div>

          <div className="grid gap-6">
            <section className="border border-gray-100 rounded-xl p-4 bg-gray-50/70">
              <h3 className="text-sm font-semibold text-gray-700">Basis</h3>
              <div className="mt-3 grid gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">Event</label>
                  <select
                    value={form.event_id}
                    onChange={(event) => updateField('event_id', event.target.value)}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title} ({event.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(event) => updateField('slug', event.target.value)}
                    placeholder="dream-hollywood"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Package Name</label>
                  <input
                    value={form.package_name}
                    onChange={(event) => updateField('package_name', event.target.value)}
                    placeholder="Ticket- & Hotel-Package"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Titel</label>
                  <input
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder="Dream Hollywood, by Hyatt"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Kurzbeschreibung</label>
                  <textarea
                    value={form.short_description}
                    onChange={(event) => updateField('short_description', event.target.value)}
                    rows={2}
                    placeholder="Kurzbeschreibung fuer Karten/Listen"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Beschreibung</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    rows={3}
                    placeholder="Lange Beschreibung fuer Details"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="border border-gray-100 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-700">Preis & Verfügbarkeit</h3>
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Naechte</label>
                    <input
                      value={form.nights}
                      onChange={(event) => updateField('nights', event.target.value)}
                      type="number"
                      min="0"
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Preis</label>
                    <input
                      value={form.price}
                      onChange={(event) => updateField('price', event.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Waehrung</label>
                    <input
                      value={form.currency}
                      onChange={(event) => updateField('currency', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Einzelzimmer Zuschlag</label>
                    <input
                      value={form.single_supplement}
                      onChange={(event) => updateField('single_supplement', event.target.value)}
                      type="number"
                      min="0"
                      step="0.01"
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Verfügbare Plätze</label>
                    <input
                      value={form.available_spots}
                      onChange={(event) => updateField('available_spots', event.target.value)}
                      type="number"
                      min="0"
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Rating</label>
                    <input
                      value={form.rating}
                      onChange={(event) => updateField('rating', event.target.value)}
                      type="number"
                      min="0"
                      step="0.1"
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Reviews</label>
                    <input
                      value={form.reviews}
                      onChange={(event) => updateField('reviews', event.target.value)}
                      type="number"
                      min="0"
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Popular</div>
                    <div className="text-xs text-gray-500">Badge im Package</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.popular}
                    onChange={(event) => updateField('popular', event.target.checked)}
                    className="h-4 w-4"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Badge Text</label>
                  <input
                    value={form.badge_text}
                    onChange={(event) => updateField('badge_text', event.target.value)}
                    placeholder="Offizielles Hospitality-Package"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="border border-gray-100 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-700">Hotel & Bilder</h3>
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Hotel</label>
                    <input
                      value={form.hotel}
                      onChange={(event) => updateField('hotel', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Sterne</label>
                    <input
                      value={form.stars}
                      onChange={(event) => updateField('stars', event.target.value)}
                      type="number"
                      min="0"
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <AdminGalleryField
                    label="Hotel Bilder"
                    value={form.hotel_images}
                    onChange={(value) => updateField('hotel_images', value)}
                    placeholder="https://.../bild1.jpg, https://.../bild2.jpg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Room Categories</label>
                  <input
                    value={form.room_categories}
                    onChange={(event) => updateField('room_categories', event.target.value)}
                    placeholder="Doppelzimmer, Einzelzimmer"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="border border-gray-100 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-700">Distanzen & Zusatz</h3>
              <div className="mt-3 grid gap-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Distanz Airport</label>
                    <input
                      value={form.distance_airport}
                      onChange={(event) => updateField('distance_airport', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Distanz Stadion</label>
                    <input
                      value={form.distance_stadium}
                      onChange={(event) => updateField('distance_stadium', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Distanz Downtown</label>
                    <input
                      value={form.distance_downtown}
                      onChange={(event) => updateField('distance_downtown', event.target.value)}
                      className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">Verlaengerungsnaechte</label>
                  <input
                    value={form.extension_nights}
                    onChange={(event) => updateField('extension_nights', event.target.value)}
                    placeholder="Verlaengerung auf Anfrage"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="border border-dashed border-orange-200 rounded-xl p-4 bg-orange-50">
              <h3 className="text-sm font-semibold text-orange-700">Live Vorschau</h3>
              <div className="mt-4 rounded-xl border bg-white overflow-hidden">
                {form.badge_text || form.popular ? (
                  <div className="bg-orange-500 text-white text-xs font-semibold px-4 py-2">
                    {form.badge_text || 'Offizielles Hospitality-Package'}
                  </div>
                ) : null}
                <div className="p-4">
                  <div className="text-lg font-semibold text-gray-900">
                    {form.title || 'Package Titel'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {form.hotel || 'Hotelname'} • {form.nights || '0'} Naechte
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-xs text-gray-500">ab</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {form.price || '0'} {form.currency || 'EUR'}
                      </div>
                    </div>
                    <span className="text-xs text-gray-500">{form.available_spots || '0'} Plaetze</span>
                  </div>
                </div>
                {form.hotel_images && (
                  <div className="grid grid-cols-3 gap-1 p-2 bg-gray-50">
                    {form.hotel_images.split(/[,\n]/).filter(Boolean).slice(0, 3).map((img, idx) => (
                      <div key={idx} className="text-[10px] text-gray-500 truncate">
                        {img.trim()}
                      </div>
                    ))}
                  </div>
                )}
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
              Zurücksetzen
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
