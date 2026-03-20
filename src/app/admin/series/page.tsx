'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import AdminImageField from '@/components/admin/AdminImageField';

interface SeriesFormState {
  id?: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  hero_image: string;
  status: 'active' | 'draft' | 'archived';
}

const emptyForm: SeriesFormState = {
  slug: '',
  title: '',
  category: '',
  description: '',
  hero_image: '',
  status: 'active'
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
      alert('Bitte Slug, Titel und Kategorie ausfuellen.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      category: form.category.trim(),
      description: form.description || null,
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
    if (!confirm('Serie wirklich loeschen? Die Events werden ohne Serie weitergefuehrt.')) return;

    const response = await fetch(`/api/admin/series/${seriesId}`, { method: 'DELETE' });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Loeschen');
      return;
    }

    await loadSeries();
    resetForm();
  };

  return (
    <AdminShell title="Serien verwalten">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Serien</h2>
            <button
              onClick={loadSeries}
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
              placeholder="Titel, Slug, Kategorie"
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {loading && <p className="text-gray-500">Laedt...</p>}
          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="space-y-3">
            {series
              .filter((item) => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                return [item.title, item.slug, item.category]
                  .filter(Boolean)
                  .some((value) => value.toLowerCase().includes(term));
              })
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => setForm({ ...item })}
                  className={`w-full text-left p-4 border rounded-lg transition ${
                    form.id === item.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-900">{item.title}</div>
                      <div className="text-xs text-gray-500 mt-1">/{item.slug}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                      {item.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mt-2">{item.category}</div>
                </button>
              ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {form.id ? 'Serie bearbeiten' : 'Neue Serie'}
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
                  <label className="text-xs font-semibold text-gray-600">Slug</label>
                  <input
                    value={form.slug}
                    onChange={(event) => updateField('slug', event.target.value)}
                    placeholder="super-bowl"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Titel</label>
                  <input
                    value={form.title}
                    onChange={(event) => updateField('title', event.target.value)}
                    placeholder="Super Bowl"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Kategorie</label>
                  <input
                    value={form.category}
                    onChange={(event) => updateField('category', event.target.value)}
                    placeholder="Sportevents"
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600">Beschreibung</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => updateField('description', event.target.value)}
                    rows={3}
                    className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </section>

            <section className="border border-gray-100 rounded-xl p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-700">Media & Status</h3>
              <div className="mt-3 grid gap-3">
                <AdminImageField
                  label="Hero Bild"
                  value={form.hero_image}
                  onChange={(value) => updateField('hero_image', value)}
                  placeholder="https://.../header.webp"
                  previewLabel="Hero Bild Vorschau"
                />

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
            </section>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200"
            >
              Zuruecksetzen
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
