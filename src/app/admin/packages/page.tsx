'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import AdminGalleryField from '@/components/admin/AdminGalleryField';
import {
  COLORS,
  cn,
  SectionCard,
  Button,
  Field,
  TextInput,
  SelectInput,
  InputField,
  TextAreaField,
  Badge,
  EmptyState,
  Toggle,
  Spinner
} from '@/components/admin/ui';
import {
  Package as PackageIcon,
  Search,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  Tag,
  BedDouble,
  Euro,
  MapPin,
  Eye
} from 'lucide-react';

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
  travel_period: string;
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
  travel_period: '',
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
      travel_period: row.travel_period || '',
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
      travel_period: form.travel_period || null,
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
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 items-start">
        {/* ─── Liste ─────────────────────────────────────────────── */}
        <SectionCard
          title="Packages"
          description={activeEventLabel || undefined}
          icon={<PackageIcon size={20} />}
          actions={<Badge tone="navy">{packages.length} Packages</Badge>}
        >
          <div className="flex flex-col gap-4 mb-4">
            <Field label="Event auswählen">
              <SelectInput
                value={selectedEvent}
                onChange={(event) => {
                  setSelectedEvent(event.target.value);
                  setForm((prev) => ({ ...prev, event_id: event.target.value }));
                }}
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title} ({event.slug})
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Suchen">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: COLORS.textMuted }}
                />
                <TextInput
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Titel, Slug, Package Name"
                  className="pl-9"
                />
              </div>
            </Field>
          </div>

          {loading && (
            <div className="flex items-center gap-2 py-4" style={{ color: COLORS.textMuted }}>
              <Spinner className="h-4 w-4" /> <span className="text-sm">Lädt...</span>
            </div>
          )}
          {error && (
            <p className="text-sm" style={{ color: COLORS.danger }}>{error}</p>
          )}

          {!loading && filteredPackages.length === 0 ? (
            <EmptyState
              icon={<PackageIcon size={28} />}
              title="Keine Packages"
              description="Für dieses Event wurden noch keine Packages angelegt."
            />
          ) : (
            <div className="space-y-3">
              {filteredPackages.map((pkg) => {
                const isSelected = form.id === pkg.id;
                const isInactive = pkg.active === false;
                return (
                  <button
                    key={pkg.id}
                    onClick={() => setForm({ ...pkg })}
                    className={cn(
                      'w-full text-left rounded-xl border p-4 transition',
                      isInactive && 'opacity-60'
                    )}
                    style={{
                      borderColor: isSelected ? COLORS.accent : COLORS.stroke,
                      background: isSelected ? '#fff1ea' : isInactive ? COLORS.surfaceMuted : '#fff'
                    }}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn('font-semibold', isInactive && 'line-through')}
                          style={{ color: isInactive ? '#9ca3af' : COLORS.navy }}
                        >
                          {pkg.title}
                        </div>
                        <div className="text-xs mt-1" style={{ color: COLORS.textMuted }}>{pkg.slug}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pkg.popular && <Badge tone="accent">popular</Badge>}
                        <Toggle
                          checked={pkg.active !== false}
                          onChange={async () => {
                            if (!pkg.id) return;
                            const res = await fetch(`/api/admin/packages/${pkg.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ active: pkg.active === false })
                            });
                            if (res.ok) await loadPackages(selectedEvent);
                          }}
                        />
                      </div>
                    </div>
                    <div className="text-sm mt-2 flex items-center gap-1" style={{ color: COLORS.textMuted }}>
                      <Euro size={14} /> Preis: {pkg.price || 'n/a'} {pkg.currency}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ─── Editor ────────────────────────────────────────────── */}
        <div className="grid gap-6">
          <SectionCard
            title={form.id ? 'Package bearbeiten' : 'Neues Package'}
            icon={form.id ? <PackageIcon size={20} /> : <Plus size={20} />}
            actions={
              form.id ? (
                <Button variant="danger" size="sm" onClick={() => handleDelete(form.id as string)}>
                  <Trash2 size={14} /> Löschen
                </Button>
              ) : undefined
            }
          >
            <div className="grid gap-6">
              {/* Stammdaten */}
              <SectionCard title="Stammdaten" icon={<Tag size={18} />}>
                <div className="grid gap-4">
                  <Field label="Event">
                    <SelectInput
                      value={form.event_id}
                      onChange={(event) => updateField('event_id', event.target.value)}
                    >
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title} ({event.slug})
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <InputField
                    label="Slug"
                    required
                    value={form.slug}
                    onChange={(event) => updateField('slug', event.target.value)}
                    placeholder="dream-hollywood"
                  />
                  <InputField
                    label="Package Name"
                    value={form.package_name}
                    onChange={(event) => updateField('package_name', event.target.value)}
                    placeholder="Ticket- & Hotel-Package"
                  />
                  <InputField
                    label="Titel"
                    required
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder="Dream Hollywood, by Hyatt"
                  />
                  <TextAreaField
                    label="Kurzbeschreibung"
                    rows={2}
                    value={form.short_description}
                    onChange={(event) => updateField('short_description', event.target.value)}
                    placeholder="Kurzbeschreibung fuer Karten/Listen"
                  />
                  <TextAreaField
                    label="Beschreibung"
                    rows={3}
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    placeholder="Lange Beschreibung fuer Details"
                  />
                </div>
              </SectionCard>

              {/* Preise */}
              <SectionCard title="Preise & Verfügbarkeit" icon={<Euro size={18} />}>
                <div className="grid gap-4">
                  <div className="grid grid-cols-3 gap-3">
                    <InputField
                      label="Naechte"
                      type="number"
                      min="0"
                      value={form.nights}
                      onChange={(event) => updateField('nights', event.target.value)}
                    />
                    <InputField
                      label="Preis"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(event) => updateField('price', event.target.value)}
                    />
                    <InputField
                      label="Waehrung"
                      value={form.currency}
                      onChange={(event) => updateField('currency', event.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField
                      label="Einzelzimmer Zuschlag"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.single_supplement}
                      onChange={(event) => updateField('single_supplement', event.target.value)}
                    />
                    <InputField
                      label="Kontingent (0 = ausgebucht, wird weiter angezeigt)"
                      type="number"
                      min="0"
                      value={form.available_spots}
                      onChange={(event) => updateField('available_spots', event.target.value)}
                    />
                  </div>
                  <InputField
                    label="Reisezeitraum (Anzeige)"
                    value={form.travel_period}
                    onChange={(event) => updateField('travel_period', event.target.value)}
                    placeholder="Do. 11.02. – Mo. 15.02.2027"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <InputField
                      label="Rating"
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.rating}
                      onChange={(event) => updateField('rating', event.target.value)}
                    />
                    <InputField
                      label="Reviews"
                      type="number"
                      min="0"
                      value={form.reviews}
                      onChange={(event) => updateField('reviews', event.target.value)}
                    />
                  </div>
                  <InputField
                    label="Badge Text"
                    value={form.badge_text}
                    onChange={(event) => updateField('badge_text', event.target.value)}
                    placeholder="Offizielles Hospitality-Package"
                  />
                </div>
              </SectionCard>

              {/* Hotel & Bilder */}
              <SectionCard title="Hotel & Bilder" icon={<BedDouble size={18} />}>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <InputField
                      label="Hotel"
                      value={form.hotel}
                      onChange={(event) => updateField('hotel', event.target.value)}
                    />
                    <InputField
                      label="Sterne"
                      type="number"
                      min="0"
                      value={form.stars}
                      onChange={(event) => updateField('stars', event.target.value)}
                    />
                  </div>
                  <AdminGalleryField
                    label="Hotel Bilder"
                    value={form.hotel_images}
                    onChange={(value) => updateField('hotel_images', value)}
                    placeholder="https://.../bild1.jpg, https://.../bild2.jpg"
                  />
                  <InputField
                    label="Room Categories"
                    value={form.room_categories}
                    onChange={(event) => updateField('room_categories', event.target.value)}
                    placeholder="Doppelzimmer, Einzelzimmer"
                  />
                </div>
              </SectionCard>

              {/* Distanzen & Zusatz */}
              <SectionCard title="Distanzen & Zusatz" icon={<MapPin size={18} />}>
                <div className="grid gap-4">
                  <div className="grid grid-cols-3 gap-3">
                    <InputField
                      label="Distanz Airport"
                      value={form.distance_airport}
                      onChange={(event) => updateField('distance_airport', event.target.value)}
                    />
                    <InputField
                      label="Distanz Stadion"
                      value={form.distance_stadium}
                      onChange={(event) => updateField('distance_stadium', event.target.value)}
                    />
                    <InputField
                      label="Distanz Downtown"
                      value={form.distance_downtown}
                      onChange={(event) => updateField('distance_downtown', event.target.value)}
                    />
                  </div>
                  <InputField
                    label="Verlaengerungsnaechte"
                    value={form.extension_nights}
                    onChange={(event) => updateField('extension_nights', event.target.value)}
                    placeholder="Verlaengerung auf Anfrage"
                  />
                </div>
              </SectionCard>

              {/* Flags */}
              <SectionCard title="Flags" icon={<Tag size={18} />}>
                <div className="grid gap-3">
                  <div
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: COLORS.surfaceMuted }}
                  >
                    <div>
                      <div className="text-sm font-semibold" style={{ color: COLORS.navy }}>Popular</div>
                      <div className="text-xs" style={{ color: COLORS.textMuted }}>Badge im Package</div>
                    </div>
                    <Toggle
                      checked={form.popular}
                      onChange={(value) => updateField('popular', value)}
                    />
                  </div>
                  <div
                    className="flex items-center justify-between rounded-xl px-4 py-3"
                    style={{ background: COLORS.surfaceMuted }}
                  >
                    <div>
                      <div className="text-sm font-semibold" style={{ color: COLORS.navy }}>Aktiv</div>
                      <div className="text-xs" style={{ color: COLORS.textMuted }}>Package ist sichtbar</div>
                    </div>
                    <Toggle
                      checked={form.active}
                      onChange={(value) => updateField('active', value)}
                    />
                  </div>
                </div>
              </SectionCard>

              {/* Live Vorschau */}
              <SectionCard title="Live Vorschau" icon={<Eye size={18} />}>
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${COLORS.stroke}` }}>
                  {form.badge_text || form.popular ? (
                    <div
                      className="text-white text-xs font-semibold px-4 py-2"
                      style={{ background: COLORS.accent }}
                    >
                      {form.badge_text || 'Offizielles Hospitality-Package'}
                    </div>
                  ) : null}
                  <div className="p-4">
                    <div className="text-lg font-semibold" style={{ color: COLORS.navy }}>
                      {form.title || 'Package Titel'}
                    </div>
                    <div className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
                      {form.hotel || 'Hotelname'} • {form.nights || '0'} Naechte
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <div className="text-xs" style={{ color: COLORS.textMuted }}>ab</div>
                        <div className="text-2xl font-bold" style={{ color: COLORS.navy }}>
                          {form.price || '0'} {form.currency || 'EUR'}
                        </div>
                      </div>
                      <span className="text-xs" style={{ color: COLORS.textMuted }}>{form.available_spots || '0'} Plaetze</span>
                    </div>
                  </div>
                  {form.hotel_images && (
                    <div className="grid grid-cols-3 gap-1 p-2" style={{ background: COLORS.surfaceMuted }}>
                      {form.hotel_images.split(/[,\n]/).filter(Boolean).slice(0, 3).map((img, idx) => (
                        <div key={idx} className="text-[10px] truncate" style={{ color: COLORS.textMuted }}>
                          {img.trim()}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            <div className="mt-6 flex gap-3">
              <Button variant="accent" className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? <Spinner className="h-4 w-4" /> : <Save size={16} />}
                {saving ? 'Speichern...' : 'Speichern'}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={resetForm}>
                <RotateCcw size={16} /> Zurücksetzen
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </AdminShell>
  );
}
