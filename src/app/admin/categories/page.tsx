'use client';

import { useEffect, useState } from 'react';
import { RefreshCw, FolderTree, Trash2, Save, RotateCcw } from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import {
  COLORS,
  cn,
  SectionCard,
  PageHeader,
  Button,
  InputField,
  TextAreaField,
  Field,
  SelectInput,
  Badge,
  EmptyState,
  Spinner,
} from '@/components/admin/ui';

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

const STATUS_TONE: Record<string, 'ok' | 'warn' | 'muted'> = {
  active: 'ok',
  draft: 'warn',
  archived: 'muted'
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
      <PageHeader
        title="Kategorien SEO verwalten"
        description="SEO-Texte, Meta-Beschreibungen und Status der Kategorieseiten pflegen."
        actions={
          <Button variant="secondary" onClick={loadEntries} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Aktualisieren
          </Button>
        }
      />

      {error && (
        <div
          className="mb-6 rounded-xl px-4 py-3 text-sm font-medium"
          style={{ color: COLORS.danger, background: '#fef2f2', border: '1px solid #fecaca' }}
        >
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <SectionCard
          title="Kategorien"
          description="Eintrag zum Bearbeiten auswählen."
          icon={<FolderTree className="h-5 w-5" />}
        >
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-10" style={{ color: COLORS.textMuted }}>
              <Spinner />
              <span className="text-sm">Lädt...</span>
            </div>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={<FolderTree className="h-8 w-8" />}
              title="Noch keine Kategorien"
              description="Lege rechts einen neuen Kategorie-SEO-Eintrag an."
            />
          ) : (
            <div className="space-y-3">
              {entries.map((item) => {
                const isActive = originalSlug === item.slug;
                return (
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
                    className="w-full rounded-xl p-4 text-left transition"
                    style={{
                      border: `1.5px solid ${isActive ? COLORS.accent : COLORS.stroke}`,
                      background: isActive ? '#fff7f3' : '#fff'
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold" style={{ color: COLORS.navy }}>{item.title}</p>
                        <p className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>/{item.slug}</p>
                      </div>
                      <Badge tone={STATUS_TONE[item.status || 'active'] || 'muted'}>
                        {item.status || 'active'}
                      </Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm" style={{ color: COLORS.textMuted }}>
                      {item.intro_text}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={originalSlug ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
          description={originalSlug ? `/${originalSlug}` : 'Neuen SEO-Eintrag erstellen.'}
          actions={
            originalSlug ? (
              <Button variant="danger" size="sm" onClick={() => handleDelete(originalSlug)}>
                <Trash2 className="h-4 w-4" />
                Löschen
              </Button>
            ) : undefined
          }
        >
          <div className="grid gap-4">
            <InputField
              label="Slug"
              required
              value={form.slug}
              onChange={(event) => updateField('slug', event.target.value)}
              placeholder="tennis"
            />

            <InputField
              label="Titel"
              required
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Tennis"
            />

            <TextAreaField
              label="SEO Intro-Text"
              required
              value={form.intro_text}
              onChange={(event) => updateField('intro_text', event.target.value)}
              rows={6}
              placeholder="Hier den laengeren Kategorietext fuer SEO eintragen..."
            />

            <TextAreaField
              label="Meta Description (optional)"
              hint="Kurztext für Suchergebnisse (ca. 140-160 Zeichen)."
              value={form.meta_description}
              onChange={(event) => updateField('meta_description', event.target.value)}
              rows={3}
              placeholder="Kurztext fuer Suchergebnisse (ca. 140-160 Zeichen)"
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

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="secondary" onClick={resetForm}>
              <RotateCcw className="h-4 w-4" />
              Zurücksetzen
            </Button>
            <Button variant="accent" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saving ? 'Speichern...' : 'Speichern'}
            </Button>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
