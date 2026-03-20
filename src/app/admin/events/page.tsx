'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ImageIcon,
  LayoutTemplate,
  MapPin,
  PencilLine,
  Plus,
  Search
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import AdminImageField from '@/components/admin/AdminImageField';

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
  first_paragraph_heading: string;
  first_paragraph_text: string;
  first_paragraph_image_1: string;
  first_paragraph_image_2: string;
  first_paragraph_image_3: string;
  status: 'active' | 'draft' | 'archived';
}

interface SeriesOption {
  id: string;
  slug: string;
  title: string;
  category: string;
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
  first_paragraph_heading: '',
  first_paragraph_text: '',
  first_paragraph_image_1: '',
  first_paragraph_image_2: '',
  first_paragraph_image_3: '',
  status: 'active'
};

function normalizeEventFormState(event?: Partial<EventFormState> | null): EventFormState {
  return {
    ...emptyForm,
    ...event,
    id: event?.id,
    series_id: event?.series_id ?? '',
    slug: event?.slug ?? '',
    name: event?.name ?? '',
    title: event?.title ?? '',
    description: event?.description ?? '',
    start_date: event?.start_date ?? '',
    end_date: event?.end_date ?? '',
    venue: event?.venue ?? '',
    location_name: event?.location_name ?? '',
    location_city: event?.location_city ?? '',
    location_region: event?.location_region ?? '',
    location_country: event?.location_country ?? '',
    hero_image: event?.hero_image ?? '',
    ticket_image: event?.ticket_image ?? '',
    base_url: event?.base_url ?? '',
    first_paragraph_heading: event?.first_paragraph_heading ?? '',
    first_paragraph_text: event?.first_paragraph_text ?? '',
    first_paragraph_image_1: event?.first_paragraph_image_1 ?? '',
    first_paragraph_image_2: event?.first_paragraph_image_2 ?? '',
    first_paragraph_image_3: event?.first_paragraph_image_3 ?? '',
    status: event?.status ?? 'active'
  };
}

function parseFlexibleDate(value?: string | null): Date | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dotMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const day = Number(dotMatch[1]);
    const month = Number(dotMatch[2]);
    const year = Number(dotMatch[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatPreviewDate(value?: string | null) {
  if (!value) return '';
  const date = parseFlexibleDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat('de-CH', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function buildPreviewLocation(form: EventFormState) {
  return [
    form.location_city,
    form.location_name,
    form.venue,
    form.location_region,
    form.location_country
  ]
    .filter(Boolean)
    .join(', ');
}

function buildPreviewHeroSubline(form: EventFormState) {
  const parts = [form.name || 'Event'];
  const location = buildPreviewLocation(form);
  const from = formatPreviewDate(form.start_date);
  const to = formatPreviewDate(form.end_date);
  const dateRange = from && to ? `${from} - ${to}` : from || to;

  if (location) parts.push(`Ort: ${location}`);
  if (dateRange) parts.push(`Termin: ${dateRange}`);

  return parts.join(' | ');
}

function buildPreviewHeroIntro(form: EventFormState) {
  if (form.description.trim()) return form.description.trim();

  const baseName = form.name || form.title || 'dieses Event';
  return `Tickets sind heiß begehrt und dementsprechend schwer erhältlich. Als mehrfach ausgezeichneter Sportreisen-Spezialist bieten wir unseren Kunden die Möglichkeit, ${baseName} live zu erleben.`;
}

function buildPreviewFirstParagraphHeading(form: EventFormState) {
  if (form.first_paragraph_heading.trim()) return form.first_paragraph_heading.trim();
  return `Erleben Sie ${form.name || form.title || 'Ihr Event'} live!`;
}

function buildPreviewFirstParagraphText(form: EventFormState) {
  if (form.first_paragraph_text.trim()) return form.first_paragraph_text.trim();

  const baseName = form.name || form.title || 'das Event';
  return `Mit Faltin Travel erleben Sie ${baseName} mit sorgfältig zusammengestellten Tickets und passenden Reisebausteinen. Wir begleiten Sie von der Anfrage bis zur Rückreise.`;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
      <div className="mt-1 text-sm text-gray-600">{hint}</div>
    </div>
  );
}

function SectionIntro({
  icon,
  title,
  description
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function PreviewImage({ src, label }: { src: string; label: string }) {
  if (!src.trim()) {
    return (
      <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400">
        {label}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="aspect-4/3 w-full bg-gray-100">
        <img src={src} alt={label} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">{label}</div>
    </div>
  );
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

    setEvents((result.data || []).map((event: Partial<EventFormState>) => normalizeEventFormState(event)));
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
    setForm(normalizeEventFormState());
    setError(null);
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.name.trim() || !form.title.trim()) {
      alert('Bitte Slug, Name und Titel ausfüllen.');
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
      first_paragraph_heading: form.first_paragraph_heading || null,
      first_paragraph_text: form.first_paragraph_text || null,
      first_paragraph_image_1: form.first_paragraph_image_1 || null,
      first_paragraph_image_2: form.first_paragraph_image_2 || null,
      first_paragraph_image_3: form.first_paragraph_image_3 || null,
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
    if (!confirm('Event wirklich löschen?')) return;

    const response = await fetch(`/api/admin/events/${eventId}`, { method: 'DELETE' });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Löschen');
      return;
    }

    await loadEvents();
    resetForm();
  };

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      return [event.title, event.slug, event.venue]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [events, searchTerm]);

  const previewTitle = form.title.trim() || 'Event Titel';
  const previewHeroSubline = buildPreviewHeroSubline(form);
  const previewHeroIntro = buildPreviewHeroIntro(form);
  const previewFirstParagraphHeading = buildPreviewFirstParagraphHeading(form);
  const previewFirstParagraphText = buildPreviewFirstParagraphText(form);
  const previewCtaLabel = `Jetzt \"${form.name.trim() || form.title.trim() || 'Event'}\" Tickets anfragen`;
  const previewSeriesTitle = series.find((item) => item.id === form.series_id)?.title || 'Serie';
  const previewImages = [
    form.first_paragraph_image_1,
    form.first_paragraph_image_2,
    form.first_paragraph_image_3
  ];
  const requiredFieldCount = [form.slug, form.name, form.title].filter((value) => value.trim()).length;
  const contentFieldCount = [form.hero_image, form.first_paragraph_heading, form.first_paragraph_text]
    .filter((value) => value.trim()).length;
  const mediaFieldCount = previewImages.filter((value) => value.trim()).length;
  const selectedSeries = series.find((item) => item.id === form.series_id);

  return (
    <AdminShell title="Events verwalten">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Events" value={String(events.length)} hint="Alle vorhandenen Einträge im Backend" />
          <StatCard
            label="Bearbeitungsmodus"
            value={form.id ? 'Bestehend' : 'Neu'}
            hint={form.id ? 'Sie bearbeiten gerade ein bestehendes Event' : 'Sie erstellen gerade ein neues Event'}
          />
          <StatCard
            label="Content-Status"
            value={`${requiredFieldCount}/3 Pflichtfelder`}
            hint={`${contentFieldCount}/3 Inhaltsfelder, ${mediaFieldCount}/3 Modulbilder gepflegt`}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Event-Auswahl</h2>
                  <p className="mt-1 text-sm text-gray-500">Vorhandene Einträge durchsuchen oder direkt ein neues Event anlegen.</p>
                </div>
                <button
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  Neues Event
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Suchen</label>
              <div className="relative mt-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Titel, Slug oder Venue"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-blue-400 focus:bg-white"
                />
              </div>
              <div className="mt-3 text-xs text-gray-500">{filteredEvents.length} Treffer</div>
            </div>

            <div className="max-h-[calc(100vh-22rem)] space-y-3 overflow-y-auto px-5 pb-5">
              {loading && <p className="text-gray-500">Lädt...</p>}
              {!loading && filteredEvents.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  Keine passenden Events gefunden.
                </div>
              )}

              {filteredEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setForm(normalizeEventFormState(event))}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    form.id === event.id
                      ? 'border-blue-500 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-gray-900">{event.title}</div>
                      <div className="mt-1 text-xs text-gray-500">/{event.slug}</div>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                      {event.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                    {event.venue && <span className="rounded-full bg-gray-100 px-2 py-1">{event.venue}</span>}
                    {event.start_date && <span className="rounded-full bg-gray-100 px-2 py-1">{formatPreviewDate(event.start_date)}</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Editor</div>
                  <h2 className="mt-2 text-xl font-semibold text-gray-900">
                    {form.id ? 'Event bearbeiten' : 'Neues Event erstellen'}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Inhalte sind in logische Module getrennt und die Vorschau unten reagiert sofort auf Ihre Eingaben.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedSeries && (
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {selectedSeries.title}
                    </span>
                  )}
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {form.status || 'draft'}
                  </span>
                  <button
                    onClick={loadEvents}
                    className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Aktualisieren
                  </button>
                  {form.id && (
                    <button
                      onClick={() => handleDelete(form.id as string)}
                      className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pflichtfelder</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{requiredFieldCount}/3</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Content</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{contentFieldCount}/3</div>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Bilder</div>
                  <div className="mt-1 text-lg font-semibold text-gray-900">{mediaFieldCount}/3</div>
                </div>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

              <section className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
                <SectionIntro
                  icon={<PencilLine className="h-5 w-5" />}
                  title="Basisdaten"
                  description="Der Kern des Events: Zuordnung, Titel und Kurzbeschreibung fuer Listen und SEO."
                />
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Serie</label>
                    <select
                      value={form.series_id}
                      onChange={(event) => updateField('series_id', event.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Status</label>
                      <select
                        value={form.status}
                        onChange={(event) => updateField('status', event.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
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
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Titel</label>
                    <input
                      value={form.title}
                      onChange={(event) => updateField('title', event.target.value)}
                      placeholder="Super Bowl LXI 2027 Tickets & Packages"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Beschreibung</label>
                    <textarea
                      value={form.description}
                      onChange={(event) => updateField('description', event.target.value)}
                      rows={4}
                      placeholder="Kurzbeschreibung fuer SEO und Overview"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-gray-100 bg-white p-4">
                <SectionIntro
                  icon={<MapPin className="h-5 w-5" />}
                  title="Termin & Ort"
                  description="Alle Daten, die spaeter in Hero, Listen und Reiseinfos angezeigt werden."
                />
                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Startdatum</label>
                      <input
                        type="date"
                        value={form.start_date}
                        onChange={(event) => updateField('start_date', event.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Enddatum</label>
                      <input
                        type="date"
                        value={form.end_date}
                        onChange={(event) => updateField('end_date', event.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Venue</label>
                      <input
                        value={form.venue}
                        onChange={(event) => updateField('venue', event.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Location Name</label>
                      <input
                        value={form.location_name}
                        onChange={(event) => updateField('location_name', event.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Stadt</label>
                      <input
                        value={form.location_city}
                        onChange={(event) => updateField('location_city', event.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600">Region</label>
                      <input
                        value={form.location_region}
                        onChange={(event) => updateField('location_region', event.target.value)}
                        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Land</label>
                    <input
                      value={form.location_country}
                      onChange={(event) => updateField('location_country', event.target.value)}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-gray-100 bg-white p-4">
                <SectionIntro
                  icon={<LayoutTemplate className="h-5 w-5" />}
                  title="Hero Modul"
                  description="Visueller Einstieg mit Titelbild und dem automatisch erzeugten Anfrage-CTA."
                />
                <div className="grid gap-3">
                  <AdminImageField
                    label="Hero Bild"
                    value={form.hero_image}
                    onChange={(value) => updateField('hero_image', value)}
                    placeholder="https://.../hero.jpg"
                    previewLabel="Hero Bild Vorschau"
                  />

                  <AdminImageField
                    label="Ticket Bild"
                    value={form.ticket_image}
                    onChange={(value) => updateField('ticket_image', value)}
                    placeholder="https://.../ticket.jpg"
                    previewLabel="Ticket Bild Vorschau"
                  />

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Base URL</label>
                    <input
                      value={form.base_url}
                      onChange={(event) => updateField('base_url', event.target.value)}
                      placeholder="https://superbowl.faltintravel.com"
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-sm text-blue-900">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">CTA Vorschau</div>
                    <div className="mt-2 inline-flex rounded-full bg-[#f14624] px-4 py-2 font-semibold text-white">
                      {previewCtaLabel}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-gray-100 bg-white p-4">
                <SectionIntro
                  icon={<ImageIcon className="h-5 w-5" />}
                  title="Erster Absatz Modul"
                  description="Headline, Einleitungstext und die dreispaltige Bildreihe direkt im finalen Inhaltsblock pflegen."
                />
                <div className="grid gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Erster Absatz H2</label>
                    <input
                      value={form.first_paragraph_heading}
                      onChange={(event) => updateField('first_paragraph_heading', event.target.value)}
                      placeholder="Erleben Sie dank unseren Wimbledon Karten ..."
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">Erster Absatz Text</label>
                    <textarea
                      value={form.first_paragraph_text}
                      onChange={(event) => updateField('first_paragraph_text', event.target.value)}
                      rows={6}
                      placeholder="Das aelteste und prestigetraechtigste Tennisturnier ..."
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                    <AdminImageField
                      label="Erster Absatz Bild 1"
                      value={form.first_paragraph_image_1}
                      onChange={(value) => updateField('first_paragraph_image_1', value)}
                      placeholder="https://.../bild-1.jpg"
                      previewLabel="Bild 1"
                    />
                    <AdminImageField
                      label="Erster Absatz Bild 2"
                      value={form.first_paragraph_image_2}
                      onChange={(value) => updateField('first_paragraph_image_2', value)}
                      placeholder="https://.../bild-2.jpg"
                      previewLabel="Bild 2"
                    />
                    <AdminImageField
                      label="Erster Absatz Bild 3"
                      value={form.first_paragraph_image_3}
                      onChange={(value) => updateField('first_paragraph_image_3', value)}
                      placeholder="https://.../bild-3.jpg"
                      previewLabel="Bild 3"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-blue-700">Live Seitenvorschau</h3>
                    <p className="mt-1 text-xs text-blue-700/80">Nahe an der echten Event-Seite, damit Sie Textfluss und Bildwirkung direkt sehen.</p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                    {form.status || 'draft'}
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-sm">
                  <div
                    className="relative overflow-hidden px-5 py-10 text-white md:px-8 md:py-14"
                    style={{
                      backgroundImage: form.hero_image
                        ? `linear-gradient(202deg, rgba(24, 74, 123, 0.88) 0%, rgba(20, 48, 71, 0.9) 100%), url(${form.hero_image})`
                        : 'linear-gradient(202deg, #184a7b 0%, #143047 100%)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  >
                    <div className="mx-auto max-w-4xl text-center">
                      <div className="inline-flex rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/85">
                        {previewSeriesTitle}
                      </div>
                      <div className="mt-5 text-3xl font-bold md:text-5xl">{previewTitle}</div>
                      <div className="mx-auto mt-3 max-w-3xl text-sm opacity-90 md:text-base">{previewHeroSubline}</div>
                      <div className="mx-auto mt-5 max-w-3xl text-base opacity-95 md:text-lg">{previewHeroIntro}</div>
                      <div className="mt-7 inline-flex rounded-full bg-[#f14624] px-6 py-3 text-sm font-semibold text-white shadow-lg">
                        {previewCtaLabel}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 py-8 md:px-8 md:py-10">
                    <div className="mx-auto max-w-5xl">
                      <div className="text-center text-3xl font-bold text-gray-900 md:text-4xl">{previewFirstParagraphHeading}</div>
                      <div className="mx-auto mt-5 max-w-3xl whitespace-pre-line text-center text-base leading-7 text-gray-700 md:text-lg">
                        {previewFirstParagraphText}
                      </div>
                      <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {previewImages.map((imageUrl, index) => (
                          <PreviewImage key={`${index}-${imageUrl}`} src={imageUrl} label={`Modulbild ${index + 1}`} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {saving ? 'Speichern...' : 'Event speichern'}
                </button>
                <button
                  onClick={resetForm}
                  className="flex-1 rounded-xl bg-gray-100 py-3 text-sm font-semibold text-gray-800 transition hover:bg-gray-200"
                >
                  Formular zurücksetzen
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
