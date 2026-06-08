'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ImageIcon,
  LayoutTemplate,
  MapPin,
  PencilLine,
  Plus,
  Search,
  Layers,
  Trash2,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import AdminImageField from '@/components/admin/AdminImageField';
import {
  COLORS,
  SectionCard,
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
  Toggle
} from '@/components/admin/ui';

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
  show_about: boolean;
  show_packages: boolean;
  show_faqs: boolean;
  show_spielplan: boolean;
  spielplan: Array<{
    date: string;
    session: string;
    matchup: string;
    round: string;
  }>;
  show_wissenswertes: boolean;
  wissenswertes_title: string;
  wissenswertes_text: string;
  wissenswertes_accordion_title: string;
  wissenswertes_accordion_text: string;
  show_stadionplan: boolean;
  stadionplan_title: string;
  stadionplan_venue_name: string;
  stadionplan_image: string;
  stadionplan_description: string;
  show_lageplan: boolean;
  lageplan_pins: Array<{
    id: string;
    name: string;
    lat: string;
    lng: string;
    icon_id: string;
    label: string;
  }>;
  faqs: Array<{
    id?: string;
    event_id?: string;
    question: string;
    answer: string;
    sort_order?: number;
  }>;
  brevo_list_id: string;
}

interface PinIconOption {
  id: string;
  name: string;
  image?: string | null;
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
  status: 'active',
  show_about: true,
  show_packages: true,
  show_faqs: true,
  show_spielplan: false,
  spielplan: [],
  show_wissenswertes: false,
  wissenswertes_title: '',
  wissenswertes_text: '',
  wissenswertes_accordion_title: '',
  wissenswertes_accordion_text: '',
  show_stadionplan: false,
  stadionplan_title: '',
  stadionplan_venue_name: '',
  stadionplan_image: '',
  stadionplan_description: '',
  show_lageplan: false,
  lageplan_pins: [],
  faqs: [],
  brevo_list_id: ''
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
    status: event?.status ?? 'active',
    show_about: event?.show_about ?? true,
    show_packages: event?.show_packages ?? true,
    show_faqs: event?.show_faqs ?? true,
    show_spielplan: event?.show_spielplan ?? false,
    spielplan: event?.spielplan ?? [],
    show_wissenswertes: event?.show_wissenswertes ?? false,
    wissenswertes_title: event?.wissenswertes_title ?? '',
    wissenswertes_text: event?.wissenswertes_text ?? '',
    wissenswertes_accordion_title: event?.wissenswertes_accordion_title ?? '',
    wissenswertes_accordion_text: event?.wissenswertes_accordion_text ?? '',
    show_stadionplan: event?.show_stadionplan ?? false,
    stadionplan_title: event?.stadionplan_title ?? '',
    stadionplan_venue_name: event?.stadionplan_venue_name ?? '',
    stadionplan_image: event?.stadionplan_image ?? '',
    stadionplan_description: event?.stadionplan_description ?? '',
    show_lageplan: event?.show_lageplan ?? false,
    lageplan_pins: (event?.lageplan_pins as any[] ?? []).map((p: any) => ({
      id: p.id ?? crypto.randomUUID?.() ?? String(Date.now()),
      name: p.name ?? '',
      lat: String(p.lat ?? ''),
      lng: String(p.lng ?? ''),
      icon_id: p.icon_id ?? '',
      label: p.label ?? '',
    })),
    faqs: event?.faqs ?? [],
    brevo_list_id: (event as any)?.brevo_list_id ?? ''
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
  const [pinIcons, setPinIcons] = useState<PinIconOption[]>([]);

  const loadPinIcons = async () => {
    try {
      const response = await fetch('/api/admin/pin-icons');
      const result = await response.json();
      if (result.success) {
        setPinIcons(result.data || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Pin-Icons:', err);
    }
  };

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
    loadPinIcons();
  }, []);

  const updateField = <K extends keyof EventFormState>(field: K, value: EventFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(normalizeEventFormState());
    setError(null);
  };

  const handleSelectEvent = async (event: EventFormState) => {
    setForm(normalizeEventFormState(event));
    if (event.id) {
      try {
        const response = await fetch(`/api/admin/faqs?eventId=${event.id}`);
        const result = await response.json();
        if (result.success) {
          setForm((prev) => {
            // Check if we are still editing the same event
            if (prev.id !== event.id) return prev;
            return {
              ...prev,
              faqs: result.data || []
            };
          });
        }
      } catch (err) {
        console.error('Fehler beim Laden der FAQs:', err);
      }
    }
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
      status: form.status,
      show_about: form.show_about,
      show_packages: form.show_packages,
      show_faqs: form.show_faqs,
      show_spielplan: form.show_spielplan,
      spielplan: form.spielplan,
      show_wissenswertes: form.show_wissenswertes,
      wissenswertes_title: form.wissenswertes_title || null,
      wissenswertes_text: form.wissenswertes_text || null,
      wissenswertes_accordion_title: form.wissenswertes_accordion_title || null,
      wissenswertes_accordion_text: form.wissenswertes_accordion_text || null,
      show_stadionplan: form.show_stadionplan,
      stadionplan_title: form.stadionplan_title || null,
      stadionplan_venue_name: form.stadionplan_venue_name || null,
      stadionplan_image: form.stadionplan_image || null,
      stadionplan_description: form.stadionplan_description || null,
      show_lageplan: form.show_lageplan,
      lageplan_pins: form.lageplan_pins.map((p) => ({
        id: p.id,
        name: p.name.trim(),
        lat: Number(p.lat),
        lng: Number(p.lng),
        icon_id: p.icon_id,
        label: p.label.trim() || null,
      })),
      faqs: form.faqs,
      brevo_list_id: form.brevo_list_id || null
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
          <StatCard
            icon={<CalendarDays className="h-4 w-4" />}
            label="Events"
            value={String(events.length)}
            sub="Alle vorhandenen Einträge im Backend"
          />
          <StatCard
            icon={<PencilLine className="h-4 w-4" />}
            label="Bearbeitungsmodus"
            value={form.id ? 'Bestehend' : 'Neu'}
            sub={form.id ? 'Sie bearbeiten gerade ein bestehendes Event' : 'Sie erstellen gerade ein neues Event'}
            tone="accent"
          />
          <StatCard
            icon={<Layers className="h-4 w-4" />}
            label="Content-Status"
            value={`${requiredFieldCount}/3 Pflichtfelder`}
            sub={`${contentFieldCount}/3 Inhaltsfelder, ${mediaFieldCount}/3 Modulbilder gepflegt`}
            tone="info"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <SectionCard
            title="Event-Auswahl"
            description="Vorhandene Einträge durchsuchen oder direkt ein neues Event anlegen."
            actions={
              <Button variant="accent" size="sm" onClick={resetForm}>
                <Plus className="h-4 w-4" />
                Neues Event
              </Button>
            }
          >
            <Field label="Suchen">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <TextInput
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Titel, Slug oder Venue"
                  className="pl-9"
                />
              </div>
            </Field>
            <div className="mt-2 mb-3 text-xs" style={{ color: COLORS.textMuted }}>{filteredEvents.length} Treffer</div>

            <div className="max-h-[calc(100vh-24rem)] space-y-3 overflow-y-auto">
              {loading && <p style={{ color: COLORS.textMuted }}>Lädt...</p>}
              {!loading && filteredEvents.length === 0 && (
                <EmptyState
                  icon={<CalendarDays className="h-6 w-6" />}
                  title="Keine passenden Events gefunden."
                  description="Passen Sie die Suche an oder legen Sie ein neues Event an."
                />
              )}

              {filteredEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => handleSelectEvent(event)}
                  className="w-full rounded-2xl border p-4 text-left transition hover:opacity-90"
                  style={{
                    borderColor: form.id === event.id ? COLORS.accent : COLORS.stroke,
                    background: form.id === event.id ? '#fff1ea' : '#fff'
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold" style={{ color: COLORS.navy }}>{event.title}</div>
                      <div className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>/{event.slug}</div>
                    </div>
                    <Badge tone={event.status === 'active' ? 'ok' : event.status === 'archived' ? 'muted' : 'warn'}>
                      {event.status}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {event.venue && <Badge tone="navy">{event.venue}</Badge>}
                    {event.start_date && <Badge tone="info">{formatPreviewDate(event.start_date)}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>

          <div className="space-y-6">
            <SectionCard>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: COLORS.accent }}>Editor</div>
                  <h2 className="mt-2 text-xl font-bold" style={{ color: COLORS.navy }}>
                    {form.id ? 'Event bearbeiten' : 'Neues Event erstellen'}
                  </h2>
                  <p className="mt-1 text-sm" style={{ color: COLORS.textMuted }}>
                    Inhalte sind in logische Module getrennt und die Vorschau unten reagiert sofort auf Ihre Eingaben.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedSeries && <Badge tone="accent">{selectedSeries.title}</Badge>}
                  <Badge tone="navy">{form.status || 'draft'}</Badge>
                  <Button variant="secondary" size="sm" onClick={loadEvents}>
                    Aktualisieren
                  </Button>
                  {form.id && (
                    <Button variant="danger" size="sm" onClick={() => handleDelete(form.id as string)}>
                      <Trash2 className="h-4 w-4" />
                      Löschen
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl px-4 py-3" style={{ background: COLORS.surfaceMuted }}>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Pflichtfelder</div>
                  <div className="mt-1 text-lg font-bold" style={{ color: COLORS.navy }}>{requiredFieldCount}/3</div>
                </div>
                <div className="rounded-xl px-4 py-3" style={{ background: COLORS.surfaceMuted }}>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Content</div>
                  <div className="mt-1 text-lg font-bold" style={{ color: COLORS.navy }}>{contentFieldCount}/3</div>
                </div>
                <div className="rounded-xl px-4 py-3" style={{ background: COLORS.surfaceMuted }}>
                  <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>Bilder</div>
                  <div className="mt-1 text-lg font-bold" style={{ color: COLORS.navy }}>{mediaFieldCount}/3</div>
                </div>
              </div>
            </SectionCard>

            <div className="space-y-6">
              {error && (
                <div className="rounded-xl border px-4 py-3 text-sm" style={{ borderColor: '#fecaca', background: '#fef2f2', color: COLORS.danger }}>{error}</div>
              )}

              <SectionCard
                icon={<PencilLine className="h-5 w-5" />}
                title="Basisdaten"
                description="Der Kern des Events: Zuordnung, Titel und Kurzbeschreibung fuer Listen und SEO."
              >
                <div className="grid gap-4">
                  <Field label="Serie">
                    <SelectInput
                      value={form.series_id}
                      onChange={(event) => updateField('series_id', event.target.value)}
                    >
                      <option value="">Keine Serie</option>
                      {series.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.title} ({item.category})
                        </option>
                      ))}
                    </SelectInput>
                  </Field>

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Slug"
                      required
                      value={form.slug}
                      onChange={(event) => updateField('slug', event.target.value)}
                      placeholder="super-bowl-2027"
                    />
                    <Field label="Status">
                      <SelectInput
                        value={form.status}
                        onChange={(event) => updateField('status', event.target.value as 'active' | 'draft' | 'archived')}
                      >
                        <option value="active">active</option>
                        <option value="draft">draft</option>
                        <option value="archived">archived</option>
                      </SelectInput>
                    </Field>
                  </div>

                  <InputField
                    label="Name"
                    required
                    value={form.name}
                    onChange={(event) => updateField('name', event.target.value)}
                    placeholder="Super Bowl LXI"
                  />

                  <InputField
                    label="Titel"
                    required
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder="Super Bowl LXI 2027 Tickets & Packages"
                  />

                  <TextAreaField
                    label="Beschreibung"
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    rows={4}
                    placeholder="Kurzbeschreibung fuer SEO und Overview"
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon={<MapPin className="h-5 w-5" />}
                title="Termin & Ort"
                description="Alle Daten, die spaeter in Hero, Listen und Reiseinfos angezeigt werden."
              >
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Startdatum"
                      type="date"
                      value={form.start_date}
                      onChange={(event) => updateField('start_date', event.target.value)}
                    />
                    <InputField
                      label="Enddatum"
                      type="date"
                      value={form.end_date}
                      onChange={(event) => updateField('end_date', event.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Venue"
                      value={form.venue}
                      onChange={(event) => updateField('venue', event.target.value)}
                    />
                    <InputField
                      label="Location Name"
                      value={form.location_name}
                      onChange={(event) => updateField('location_name', event.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Stadt"
                      value={form.location_city}
                      onChange={(event) => updateField('location_city', event.target.value)}
                    />
                    <InputField
                      label="Region"
                      value={form.location_region}
                      onChange={(event) => updateField('location_region', event.target.value)}
                    />
                  </div>

                  <InputField
                    label="Land"
                    value={form.location_country}
                    onChange={(event) => updateField('location_country', event.target.value)}
                  />
                </div>
              </SectionCard>

              <SectionCard
                icon={<LayoutTemplate className="h-5 w-5" />}
                title="Hero Modul"
                description="Visueller Einstieg mit Titelbild und dem automatisch erzeugten Anfrage-CTA."
              >
                <div className="grid gap-4">
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

                  <InputField
                    label="Base URL"
                    value={form.base_url}
                    onChange={(event) => updateField('base_url', event.target.value)}
                    placeholder="https://superbowl.faltintravel.com"
                  />

                  <InputField
                    label="🔗 Brevo Listen-ID"
                    value={form.brevo_list_id}
                    onChange={(event) => updateField('brevo_list_id', event.target.value)}
                    placeholder="z.B. 12"
                    hint="Neue Kontaktanfragen werden automatisch dieser Brevo-Liste zugewiesen. Numerische ID aus Brevo → Contacts → Listen."
                  />

                  <div className="rounded-xl border px-3 py-3 text-sm" style={{ borderColor: '#fff1ea', background: '#fff7f3' }}>
                    <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.accent }}>CTA Vorschau</div>
                    <div className="mt-2 inline-flex rounded-full px-4 py-2 font-semibold text-white" style={{ background: COLORS.accent }}>
                      {previewCtaLabel}
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                icon={<ImageIcon className="h-5 w-5" />}
                title="Erster Absatz Modul"
                description="Headline, Einleitungstext und die dreispaltige Bildreihe direkt im finalen Inhaltsblock pflegen."
              >
                <div className="grid gap-4">
                  <InputField
                    label="Erster Absatz H2"
                    value={form.first_paragraph_heading}
                    onChange={(event) => updateField('first_paragraph_heading', event.target.value)}
                    placeholder="Erleben Sie dank unseren Wimbledon Karten ..."
                  />

                  <TextAreaField
                    label="Erster Absatz Text"
                    value={form.first_paragraph_text}
                    onChange={(event) => updateField('first_paragraph_text', event.target.value)}
                    rows={6}
                    placeholder="Das aelteste und prestigetraechtigste Tennisturnier ..."
                  />

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
              </SectionCard>

              <SectionCard
                icon={<Layers className="h-5 w-5" />}
                title="Aktivierte Module"
                description="Wählen Sie aus, welche Module auf der Event-Detailseite geladen und angezeigt werden sollen."
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {([
                    { key: 'show_about', value: form.show_about, title: 'Über das Event', desc: 'Erster Absatz / Intro' },
                    { key: 'show_packages', value: form.show_packages, title: 'Packages', desc: 'Reisepakete & Hotel' },
                    { key: 'show_faqs', value: form.show_faqs, title: 'FAQs', desc: 'Häufige Fragen' },
                    { key: 'show_spielplan', value: form.show_spielplan, title: 'Spielplan', desc: 'Match Schedule Tabelle' },
                    { key: 'show_wissenswertes', value: form.show_wissenswertes, title: 'Wissenswertes', desc: 'Fakten & Akkordeon' },
                    { key: 'show_stadionplan', value: form.show_stadionplan, title: 'Stadionplan', desc: 'Stadion- / Hallenplan' },
                    { key: 'show_lageplan', value: form.show_lageplan, title: 'Lageplan', desc: 'Interaktive Karte (Pins)' }
                  ] as const).map((mod) => (
                    <div
                      key={mod.key}
                      className="flex items-center justify-between gap-3 rounded-xl border p-4"
                      style={{ borderColor: mod.value ? COLORS.navy : COLORS.stroke, background: mod.value ? '#f7fafc' : '#fff' }}
                    >
                      <div>
                        <div className="text-sm font-semibold" style={{ color: COLORS.navy }}>{mod.title}</div>
                        <div className="text-xs" style={{ color: COLORS.textMuted }}>{mod.desc}</div>
                      </div>
                      <Toggle
                        checked={mod.value}
                        onChange={(v) => updateField(mod.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </SectionCard>

              {form.show_spielplan && (
                <SectionCard
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Spielplan Einträge"
                  description="Verwalten Sie die Zeilen der Spielplan-Tabelle. Alle Änderungen werden erst beim Klick auf 'Event speichern' dauerhaft übernommen."
                >
                  <div className="overflow-x-auto rounded-lg border" style={{ borderColor: COLORS.stroke }}>
                    <table className="w-full border-collapse text-left text-xs text-gray-600">
                      <thead className="bg-gray-50 text-gray-700 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="px-3 py-3 w-1/4">Datum</th>
                          <th className="px-3 py-3 w-1/4">Session</th>
                          <th className="px-3 py-3 w-1/3">Spielpaarung / Details</th>
                          <th className="px-3 py-3 w-1/6">Runde</th>
                          <th className="px-3 py-3 w-28 text-right">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {form.spielplan.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-gray-400 bg-gray-50/30">
                              Keine Spielplaneinträge vorhanden. Klicken Sie unten auf "Eintrag hinzufügen".
                            </td>
                          </tr>
                        ) : (
                          form.spielplan.map((item, index) => {
                            const updateRow = (field: 'date' | 'session' | 'matchup' | 'round', value: string) => {
                              const updated = [...form.spielplan];
                              updated[index] = { ...updated[index], [field]: value };
                              updateField('spielplan', updated);
                            };

                            const deleteRow = () => {
                              updateField('spielplan', form.spielplan.filter((_, i) => i !== index));
                            };

                            const moveRow = (direction: 'up' | 'down') => {
                              if (direction === 'up' && index === 0) return;
                              if (direction === 'down' && index === form.spielplan.length - 1) return;
                              const updated = [...form.spielplan];
                              const swapWith = direction === 'up' ? index - 1 : index + 1;
                              const temp = updated[index];
                              updated[index] = updated[swapWith];
                              updated[swapWith] = temp;
                              updateField('spielplan', updated);
                            };

                            return (
                              <tr key={index} className="hover:bg-gray-50/50">
                                <td className="p-2">
                                  <TextInput
                                    type="text"
                                    value={item.date}
                                    onChange={(e) => updateRow('date', e.target.value)}
                                    placeholder="z.B. So. 23. Mai 2027"
                                    className="text-xs"
                                  />
                                </td>
                                <td className="p-2">
                                  <TextInput
                                    type="text"
                                    value={item.session}
                                    onChange={(e) => updateRow('session', e.target.value)}
                                    placeholder="z.B. Day (11:00 Uhr)"
                                    className="text-xs"
                                  />
                                </td>
                                <td className="p-2">
                                  <TextArea
                                    value={item.matchup}
                                    onChange={(e) => updateRow('matchup', e.target.value)}
                                    placeholder="z.B. Herren- & Damen Einzel"
                                    rows={1}
                                    className="text-xs min-h-[36px]"
                                  />
                                </td>
                                <td className="p-2">
                                  <TextInput
                                    type="text"
                                    value={item.round}
                                    onChange={(e) => updateRow('round', e.target.value)}
                                    placeholder="z.B. 1. Runde"
                                    className="text-xs"
                                  />
                                </td>
                                <td className="p-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => moveRow('up')}
                                      disabled={index === 0}
                                      title="Nach oben verschieben"
                                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-20 transition"
                                    >
                                      <ArrowUp className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => moveRow('down')}
                                      disabled={index === form.spielplan.length - 1}
                                      title="Nach unten verschieben"
                                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-20 transition"
                                    >
                                      <ArrowDown className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={deleteRow}
                                      title="Zeile löschen"
                                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      updateField('spielplan', [
                        ...form.spielplan,
                        { date: '', session: '', matchup: '', round: '' }
                      ]);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Eintrag hinzufügen
                  </Button>
                </SectionCard>
              )}

              {form.show_wissenswertes && (
                <SectionCard
                  icon={<Layers className="h-5 w-5" />}
                  title="Wissenswertes Modul"
                  description="Pflegen Sie hier die allgemeinen Fakten und den anklappbaren Textbereich (Akkordeon) für das Event."
                >
                  <div className="grid gap-4">
                    <InputField
                      label="Überschrift"
                      type="text"
                      value={form.wissenswertes_title}
                      onChange={(e) => updateField('wissenswertes_title', e.target.value)}
                      placeholder="z.B. Wissenswertes zu den French Open"
                    />

                    <TextAreaField
                      label="Einleitungstext (Absatz)"
                      value={form.wissenswertes_text}
                      onChange={(e) => updateField('wissenswertes_text', e.target.value)}
                      rows={4}
                      placeholder="Einleitender Absatz zum Thema..."
                    />

                    <div className="border-t my-1 pt-3" style={{ borderColor: COLORS.stroke }}>
                      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.accent }}>Akkordeon-Bereich</label>
                    </div>

                    <InputField
                      label="Akkordeon Titel"
                      type="text"
                      value={form.wissenswertes_accordion_title}
                      onChange={(e) => updateField('wissenswertes_accordion_title', e.target.value)}
                      placeholder="z.B. Weitere Infos zu den French Open"
                    />

                    <TextAreaField
                      label="Akkordeon Inhalt (Mehrere Absätze mit Leerzeile trennen)"
                      value={form.wissenswertes_accordion_text}
                      onChange={(e) => updateField('wissenswertes_accordion_text', e.target.value)}
                      rows={8}
                      placeholder="Ausführlicher Inhalt des Akkordeons..."
                    />
                  </div>
                </SectionCard>
              )}

              {form.show_stadionplan && (
                <SectionCard
                  icon={<Layers className="h-5 w-5" />}
                  title="Stadion-/Hallenplan Modul"
                  description="Pflegen Sie hier die Überschriften, das Übersichts-Bild und die Beschreibung für den Stadion- oder Hallenplan."
                >
                  <div className="grid gap-4">
                    <InputField
                      label="Überschrift des Moduls (z.B. Stadionplan / Hallenplan)"
                      type="text"
                      value={form.stadionplan_title}
                      onChange={(e) => updateField('stadionplan_title', e.target.value)}
                      placeholder="z.B. Stadionplan"
                    />

                    <InputField
                      label="Bereich / Name der Arena (z.B. Philippe Chatrier)"
                      type="text"
                      value={form.stadionplan_venue_name}
                      onChange={(e) => updateField('stadionplan_venue_name', e.target.value)}
                      placeholder="z.B. Philippe Chatrier"
                    />

                    <AdminImageField
                      label="Stadionplan Bild URL"
                      value={form.stadionplan_image}
                      onChange={(value) => updateField('stadionplan_image', value)}
                      placeholder="/uploads/media/stadium-plan.png"
                      previewLabel="Stadionplan Bild Vorschau"
                    />

                    <TextAreaField
                      label="Beschreibung (Mehrere Absätze mit Leerzeile trennen)"
                      value={form.stadionplan_description}
                      onChange={(e) => updateField('stadionplan_description', e.target.value)}
                      rows={8}
                      placeholder="Ausführliche Beschreibung des Stadions, der Tribünen oder der Sitzplatz-Kategorien..."
                    />
                  </div>
                </SectionCard>
              )}

              {form.show_lageplan && (
                <SectionCard
                  icon={<MapPin className="h-5 w-5" />}
                  title="Lageplan Pins"
                  description="Verwalten Sie die Kartenmarkierungen direkt für dieses Event. Icons werden zentral in 'Lageplan-Icons' verwaltet."
                >
                  <div className="mb-4 flex items-center justify-between gap-3 rounded-xl p-3 border text-xs" style={{ background: '#fff7f3', borderColor: '#fff1ea', color: COLORS.navy }}>
                    <span>Icons (PNG) zentral verwalten:</span>
                    <a href="/admin/pins" target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 text-white font-semibold rounded-lg transition inline-flex items-center gap-1 shrink-0 hover:opacity-90" style={{ background: COLORS.accent }}>
                      Lageplan-Icons verwalten ↗
                    </a>
                  </div>

                  <div className="space-y-4">
                    {form.lageplan_pins.length === 0 ? (
                      <EmptyState
                        icon={<MapPin className="h-6 w-6" />}
                        title="Noch keine Pins vorhanden."
                        description="Klicken Sie auf „Pin hinzufügen“."
                      />
                    ) : (
                      form.lageplan_pins.map((pin, index) => {
                        const updatePin = (field: string, value: string) => {
                          const updated = [...form.lageplan_pins];
                          updated[index] = { ...updated[index], [field]: value };
                          updateField('lageplan_pins', updated);
                        };
                        const deletePin = () => updateField('lageplan_pins', form.lageplan_pins.filter((_, i) => i !== index));
                        const movePin = (dir: 'up' | 'down') => {
                          if (dir === 'up' && index === 0) return;
                          if (dir === 'down' && index === form.lageplan_pins.length - 1) return;
                          const updated = [...form.lageplan_pins];
                          const swap = dir === 'up' ? index - 1 : index + 1;
                          [updated[index], updated[swap]] = [updated[swap], updated[index]];
                          updateField('lageplan_pins', updated);
                        };

                        return (
                          <div key={pin.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition relative">
                            <div className="absolute top-3 right-3 flex gap-1">
                              <button type="button" onClick={() => movePin('up')} disabled={index === 0} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition"><ArrowUp className="h-3.5 w-3.5 text-gray-500" /></button>
                              <button type="button" onClick={() => movePin('down')} disabled={index === form.lageplan_pins.length - 1} className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-30 transition"><ArrowDown className="h-3.5 w-3.5 text-gray-500" /></button>
                              <button type="button" onClick={deletePin} className="p-1.5 rounded-lg hover:bg-red-100 transition"><Trash2 className="h-3.5 w-3.5 text-red-500" /></button>
                            </div>

                            <div className="grid gap-3 pr-24">
                              <div className="grid grid-cols-2 gap-3">
                                <InputField label="Bezeichnung" type="text" value={pin.name} onChange={(e) => updatePin('name', e.target.value)} placeholder="z.B. Stade Roland Garros" />
                                <InputField label="Karten-Label" type="text" value={pin.label} onChange={(e) => updatePin('label', e.target.value)} placeholder="z.B. Roland Garros" />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <InputField label="Breitengrad (Latitude)" type="number" step="any" value={pin.lat} onChange={(e) => updatePin('lat', e.target.value)} placeholder="z.B. 48.8471" className="font-mono" />
                                <InputField label="Längengrad (Longitude)" type="number" step="any" value={pin.lng} onChange={(e) => updatePin('lng', e.target.value)} placeholder="z.B. 2.2492" className="font-mono" />
                              </div>
                              <Field label="Icon">
                                {pinIcons.length === 0 ? (
                                  <p className="text-xs italic" style={{ color: COLORS.textMuted }}>Keine Icons vorhanden – bitte zuerst in „Lageplan-Icons" hochladen.</p>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {pinIcons.map((ic) => (
                                      <button key={ic.id} type="button" onClick={() => updatePin('icon_id', ic.id)}
                                        className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition hover:opacity-90"
                                        style={{
                                          borderColor: pin.icon_id === ic.id ? COLORS.accent : COLORS.stroke,
                                          background: pin.icon_id === ic.id ? '#fff1ea' : '#fff',
                                          color: pin.icon_id === ic.id ? COLORS.accent : COLORS.navy
                                        }}>
                                        {ic.image ? <img src={ic.image} alt={ic.name} className="w-5 h-5 object-contain" /> : <span className="text-base">📍</span>}
                                        {ic.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </Field>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button type="button"
                    onClick={() => updateField('lageplan_pins', [...form.lageplan_pins, { id: `pin-${Date.now()}`, name: '', lat: '', lng: '', icon_id: pinIcons[0]?.id || '', label: '' }])}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-sm font-semibold transition hover:opacity-90"
                    style={{ borderColor: COLORS.accent, background: '#fff7f3', color: COLORS.accent }}>
                    <Plus className="h-4 w-4" /> Pin hinzufügen
                  </button>
                </SectionCard>
              )}

              {form.show_faqs && (
                <SectionCard
                  icon={<Layers className="h-5 w-5" />}
                  title="FAQ Einträge"
                  description="Verwalten Sie die häufigen Fragen (FAQs) für dieses Event direkt in-place. Alle Änderungen werden erst beim Klick auf 'Event speichern' dauerhaft übernommen."
                >
                  <div className="space-y-4">
                    {form.faqs.length === 0 ? (
                      <EmptyState
                        icon={<Layers className="h-6 w-6" />}
                        title="Keine FAQs vorhanden."
                        description='Klicken Sie unten auf "FAQ hinzufügen".'
                      />
                    ) : (
                      form.faqs.map((faq, index) => {
                        const updateRow = (field: 'question' | 'answer', value: string) => {
                          const updated = [...form.faqs];
                          updated[index] = { ...updated[index], [field]: value };
                          updateField('faqs', updated);
                        };

                        const deleteRow = () => {
                          updateField('faqs', form.faqs.filter((_, i) => i !== index));
                        };

                        const moveRow = (direction: 'up' | 'down') => {
                          if (direction === 'up' && index === 0) return;
                          if (direction === 'down' && index === form.faqs.length - 1) return;
                          const updated = [...form.faqs];
                          const swapWith = direction === 'up' ? index - 1 : index + 1;
                          const temp = updated[index];
                          updated[index] = updated[swapWith];
                          updated[swapWith] = temp;
                          updateField('faqs', updated);
                        };

                        return (
                          <div key={index} className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition relative">
                            <div className="absolute top-4 right-4 flex gap-1">
                              <button
                                type="button"
                                onClick={() => moveRow('up')}
                                disabled={index === 0}
                                title="Nach oben verschieben"
                                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-20 transition"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveRow('down')}
                                disabled={index === form.faqs.length - 1}
                                title="Nach unten verschieben"
                                className="rounded-lg p-1 text-gray-400 hover:bg-gray-150 hover:text-gray-700 disabled:opacity-20 transition"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={deleteRow}
                                title="FAQ löschen"
                                className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600 transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            
                            <div className="grid gap-3 w-[calc(100%-80px)]">
                              <InputField
                                label={`Frage #${index + 1}`}
                                type="text"
                                value={faq.question}
                                onChange={(e) => updateRow('question', e.target.value)}
                                placeholder="z.B. Wie viel kosten die Tickets?"
                                className="text-xs"
                              />
                              <TextAreaField
                                label={`Antwort #${index + 1}`}
                                value={faq.answer}
                                onChange={(e) => updateRow('answer', e.target.value)}
                                placeholder="Ausführliche Antwort..."
                                rows={2}
                                className="text-xs resize-y"
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={() => {
                      updateField('faqs', [
                        ...form.faqs,
                        { question: '', answer: '' }
                      ]);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    FAQ hinzufügen
                  </Button>
                </SectionCard>
              )}

              <SectionCard className="border-dashed">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-sm" style={{ background: COLORS.surfaceMuted, color: COLORS.navy }}>
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-bold" style={{ color: COLORS.navy }}>Live Seitenvorschau</h3>
                    <p className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>Nahe an der echten Event-Seite, damit Sie Textfluss und Bildwirkung direkt sehen.</p>
                  </div>
                  <Badge tone="navy">{form.status || 'draft'}</Badge>
                </div>

                <div className="mt-4 overflow-hidden rounded-[28px] border bg-white shadow-sm" style={{ borderColor: COLORS.stroke }}>
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
              </SectionCard>

              <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-2xl border bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row" style={{ borderColor: COLORS.stroke }}>
                <Button
                  variant="accent"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3"
                >
                  {saving ? 'Speichern...' : 'Event speichern'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={resetForm}
                  className="flex-1 py-3"
                >
                  Formular zurücksetzen
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
