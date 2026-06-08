'use client';

import { useEffect, useState } from 'react';
import { Layers, RefreshCw, Search, Trash2, Plus } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import AdminImageField from '@/components/admin/AdminImageField';
import {
  COLORS,
  Card,
  SectionCard,
  PageHeader,
  Button,
  InputField,
  TextAreaField,
  Field,
  TextInput,
  SelectInput,
  Badge,
  EmptyState,
  Spinner,
} from '@/components/admin/ui';

interface SeriesFormState {
  id?: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  category_seo_text: string;
  hero_image: string;
  status: 'active' | 'draft' | 'archived';
}

const emptyForm: SeriesFormState = {
  slug: '',
  title: '',
  category: '',
  description: '',
  category_seo_text: '',
  hero_image: '',
  status: 'active'
};

const STATUS_TONE: Record<SeriesFormState['status'], 'ok' | 'warn' | 'muted'> = {
  active: 'ok',
  draft: 'warn',
  archived: 'muted'
};

export default function AdminSeriesPage() {
  const [series, setSeries] = useState<SeriesFormState[]>([]);
  const [form, setForm] = useState<SeriesFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadSeries = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch('/api/admin/series');
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Laden');
      setLoading(false);
      return;
    }

    setSeries(result.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadSeries();
  }, []);

  const updateField = (field: keyof SeriesFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.title.trim() || !form.category.trim()) {
      alert('Bitte Slug, Titel und Kategorie ausfüllen.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      category: form.category.trim(),
      description: form.description || null,
      category_seo_text: form.category_seo_text || null,
      hero_image: form.hero_image || null,
      status: form.status
    };

    const response = await fetch(`/api/admin/series${form.id ? `/${form.id}` : ''}` , {
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

    await loadSeries();
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (seriesId: string) => {
    if (!confirm('Serie wirklich löschen? Die Events werden ohne Serie weitergeführt.')) return;

    const response = await fetch(`/api/admin/series/${seriesId}`, { method: 'DELETE' });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Löschen');
      return;
    }

    await loadSeries();
    resetForm();
  };

  const filteredSeries = series.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return [item.title, item.slug, item.category]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(term));
  });

  return (
    <AdminShell title="Serien verwalten">
      <PageHeader
        title="Serien verwalten"
        description="Serien anlegen, Kategorie-Texte pflegen und Status steuern."
        actions={
          <Button variant="secondary" size="md" onClick={resetForm}>
            <Plus className="h-4 w-4" />
            Neue Serie
          </Button>
        }
      />

      {error && (
        <div
          className="mb-6 rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: '#fef2f2', color: COLORS.danger, border: '1px solid #fecaca' }}
        >
          {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <SectionCard
          title="Serien"
          icon={<Layers className="h-5 w-5" />}
          actions={
            <Button variant="secondary" size="sm" onClick={loadSeries}>
              <RefreshCw className="h-3.5 w-3.5" />
              Aktualisieren
            </Button>
          }
        >
          <Field label="Suchen" className="mb-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                style={{ color: COLORS.textMuted }}
              />
              <TextInput
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Titel, Slug, Kategorie"
                className="pl-9"
              />
            </div>
          </Field>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm" style={{ color: COLORS.textMuted }}>
              <Spinner className="h-4 w-4" />
              Lädt...
            </div>
          ) : filteredSeries.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-8 w-8" />}
              title={searchTerm.trim() ? 'Keine Treffer' : 'Noch keine Serien'}
              description={
                searchTerm.trim()
                  ? 'Passe deine Suche an, um Serien zu finden.'
                  : 'Lege deine erste Serie an, um Kategorien zu strukturieren.'
              }
            />
          ) : (
            <div className="space-y-3">
              {filteredSeries.map((item) => {
                const isActive = form.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setForm({ ...item })}
                    className="w-full rounded-xl p-4 text-left transition"
                    style={{
                      border: `1.5px solid ${isActive ? COLORS.accent : COLORS.stroke}`,
                      background: isActive ? '#fff7f3' : '#fff',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold" style={{ color: COLORS.navy }}>{item.title}</div>
                        <div className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>/{item.slug}</div>
                      </div>
                      <Badge tone={STATUS_TONE[item.status]}>{item.status}</Badge>
                    </div>
                    <div className="mt-2 text-sm" style={{ color: COLORS.textMuted }}>{item.category}</div>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={form.id ? 'Serie bearbeiten' : 'Neue Serie'}
          actions={
            form.id ? (
              <Button variant="danger" size="sm" onClick={() => handleDelete(form.id as string)}>
                <Trash2 className="h-3.5 w-3.5" />
                Löschen
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-6">
            <Card className="!bg-[#f5f7fa]" padded>
              <h3 className="mb-3 text-sm font-bold" style={{ color: COLORS.navy }}>Basis</h3>
              <div className="grid gap-3">
                <InputField
                  label="Slug"
                  required
                  value={form.slug}
                  onChange={(event) => updateField('slug', event.target.value)}
                  placeholder="super-bowl"
                />

                <InputField
                  label="Titel"
                  required
                  value={form.title}
                  onChange={(event) => updateField('title', event.target.value)}
                  placeholder="Super Bowl"
                />

                <InputField
                  label="Kategorie"
                  required
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value)}
                  placeholder="Sportevents"
                />

                <TextAreaField
                  label="Beschreibung"
                  rows={3}
                  value={form.description}
                  onChange={(event) => updateField('description', event.target.value)}
                />

                <TextAreaField
                  label="SEO Text fuer Kategorie"
                  rows={5}
                  value={form.category_seo_text}
                  onChange={(event) => updateField('category_seo_text', event.target.value)}
                  placeholder="Einzigartiger SEO-Text fuer die Kategorie, z. B. Sportevents ..."
                  hint="Wird auf der Kategorie-Seite ausgegeben und fuer die Meta-Description genutzt."
                />
              </div>
            </Card>

            <Card padded>
              <h3 className="mb-3 text-sm font-bold" style={{ color: COLORS.navy }}>Media & Status</h3>
              <div className="grid gap-3">
                <AdminImageField
                  label="Hero Bild"
                  value={form.hero_image}
                  onChange={(value) => updateField('hero_image', value)}
                  placeholder="https://.../header.webp"
                  previewLabel="Hero Bild Vorschau"
                />

                <Field label="Status">
                  <SelectInput
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                  >
                    <option value="active">active</option>
                    <option value="draft">draft</option>
                    <option value="archived">archived</option>
                  </SelectInput>
                </Field>
              </div>
            </Card>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={resetForm}>
              Zurücksetzen
            </Button>
            <Button variant="accent" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
