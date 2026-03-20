'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';

interface CategorySeoFormState {
  slug: string;
  title: string;
  intro_text: string;
  meta_description: string;
  status: 'active' | 'draft' | 'archived';
}

const emptyForm: CategorySeoFormState = {
  slug: '',
  title: '',
  intro_text: '',
  meta_description: '',
  status: 'active'
};

export default function AdminCategoriesPage() {
  const [entries, setEntries] = useState<CategorySeoFormState[]>([]);
  const [form, setForm] = useState<CategorySeoFormState>(emptyForm);
  const [originalSlug, setOriginalSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEntries = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch('/api/admin/categories');
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Laden');
      setLoading(false);
      return;
    }

    setEntries(result.data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const updateField = (field: keyof CategorySeoFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setOriginalSlug(null);
  };

  const handleSave = async () => {
    if (!form.slug.trim() || !form.title.trim() || !form.intro_text.trim()) {
      alert('Bitte Slug, Titel und Intro-Text ausfüllen.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      intro_text: form.intro_text.trim(),
      meta_description: form.meta_description.trim() || null,
      status: form.status
    };

    const isEdit = Boolean(originalSlug);
    const response = await fetch(isEdit ? `/api/admin/categories/${originalSlug}` : '/api/admin/categories', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Speichern');
      setSaving(false);
      return;
    }

    await loadEntries();
    resetForm();
    setSaving(false);
  };

  const handleDelete = async (slug: string) => {
    if (!confirm('Kategorie-SEO-Eintrag wirklich löschen?')) return;

    const response = await fetch(`/api/admin/categories/${slug}`, { method: 'DELETE' });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Löschen');
      return;
    }

    await loadEntries();
    resetForm();
  };

  return (
    <AdminShell title="Kategorien SEO verwalten">
      <div className="grid lg:grid-cols-[1.05fr_1fr] gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Kategorien</h2>
            <button
              onClick={loadEntries}
              className="px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
            >
              Aktualisieren
            </button>
          </div>

          {loading && <p className="text-gray-500">Lädt...</p>}
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}

          <div className="space-y-3">
            {entries.map((item) => (
              <button
                key={item.slug}
                onClick={() => {
                  setForm({
                    slug: item.slug,
                    title: item.title,
                    intro_text: item.intro_text,
                    meta_description: item.meta_description || '',
                    status: item.status || 'active'
                  });
                  setOriginalSlug(item.slug);
                }}
                className={`w-full text-left p-4 border rounded-lg transition ${
                  originalSlug === item.slug
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-1">/{item.slug}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                    {item.status || 'active'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{item.intro_text}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {originalSlug ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
            </h2>
            {originalSlug && (
              <button
                onClick={() => handleDelete(originalSlug)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Löschen
              </button>
            )}
          </div>

          <div className="grid gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600">Slug</label>
              <input
                value={form.slug}
                onChange={(event) => updateField('slug', event.target.value)}
                placeholder="tennis"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Titel</label>
              <input
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                placeholder="Tennis"
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">SEO Intro-Text</label>
              <textarea
                value={form.intro_text}
                onChange={(event) => updateField('intro_text', event.target.value)}
                rows={6}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Hier den laengeren Kategorietext fuer SEO eintragen..."
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600">Meta Description (optional)</label>
              <textarea
                value={form.meta_description}
                onChange={(event) => updateField('meta_description', event.target.value)}
                rows={3}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Kurztext fuer Suchergebnisse (ca. 140-160 Zeichen)"
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

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200"
            >
              Zurücksetzen
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
