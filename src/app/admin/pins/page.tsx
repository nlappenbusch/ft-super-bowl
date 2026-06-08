'use client';

import { useEffect, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  COLORS,
  Card,
  SectionCard,
  PageHeader,
  Button,
  Field,
  TextInput,
  Badge,
  EmptyState,
  Spinner,
} from '@/components/admin/ui';
import {
  MapPin,
  Upload,
  Trash2,
  Image as ImageIcon,
  Info,
  CheckCircle2,
  AlertTriangle,
  Plus,
} from 'lucide-react';

interface PinIcon {
  id: string;
  name: string;
  image?: string | null;
}

const emptyForm: Omit<PinIcon, 'id'> & { id?: string } = {
  name: '',
  image: null,
};

export default function AdminPinsPage() {
  const [icons, setIcons] = useState<PinIcon[]>([]);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadIcons = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/pin-icons');
      const result = await res.json();
      if (result.success) setIcons(result.data || []);
      else setError(result.error || 'Fehler beim Laden');
    } catch {
      setError('Verbindungsfehler');
    }
    setLoading(false);
  };

  useEffect(() => { loadIcons(); }, []);

  const updateField = (field: keyof typeof emptyForm, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => setForm(emptyForm);

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/media', { method: 'POST', body: fd });
      const result = await res.json();
      if (result.success && result.data?.url) {
        updateField('image', result.data.url);
      } else {
        setError(result.error || 'Upload fehlgeschlagen');
      }
    } catch {
      setError('Upload-Verbindungsfehler');
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert('Bitte einen Namen eingeben.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = form.id ? `/api/admin/pin-icons/${form.id}` : '/api/admin/pin-icons';
      const res = await fetch(url, {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), image: form.image || null }),
      });
      const result = await res.json();
      if (!result.success) { setError(result.error || 'Fehler beim Speichern'); setSaving(false); return; }
      await loadIcons();
      resetForm();
    } catch { setError('Verbindungsfehler'); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Dieses Icon wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/admin/pin-icons/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!result.success) { setError(result.error || 'Fehler beim Löschen'); return; }
      await loadIcons();
      resetForm();
    } catch { setError('Verbindungsfehler'); }
  };

  return (
    <AdminShell title="Lageplan-Icons verwalten">
      <PageHeader
        title="Lageplan-Icons verwalten"
        description="Zentrale Icon-Bibliothek für Kartenmarkierungen. Laden Sie PNG-Icons hoch (z.B. Flugzeug, Hotel, Stadion) — diese können dann beim Erstellen von Lageplan-Pins in jedem Event ausgewählt werden."
      />

      {error && (
        <div
          className="mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
          style={{ color: COLORS.danger, background: '#fef2f2', border: '1px solid #fecaca' }}
        >
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        {/* Icon list */}
        <SectionCard
          title="Vorhandene Icons"
          icon={<MapPin size={18} />}
          actions={loading ? <Spinner className="h-5 w-5" /> : undefined}
        >
          <div className="space-y-3 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
            {icons.length === 0 && !loading && (
              <EmptyState
                icon={<MapPin size={32} />}
                title="Noch keine Icons vorhanden"
                description="Erstellen Sie rechts ein neues Icon, um Ihre Icon-Bibliothek aufzubauen."
              />
            )}
            {icons.map((icon) => {
              const isActive = form.id === icon.id;
              return (
                <button
                  key={icon.id}
                  onClick={() => setForm({ id: icon.id, name: icon.name, image: icon.image || null })}
                  className="w-full text-left p-4 rounded-xl transition flex items-center gap-4"
                  style={{
                    border: `1.5px solid ${isActive ? COLORS.navy : COLORS.stroke}`,
                    background: isActive ? '#eef2f7' : '#fff',
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                    style={{ border: `1px solid ${COLORS.stroke}`, background: COLORS.surfaceMuted }}
                  >
                    {icon.image ? (
                      <img src={icon.image} alt={icon.name} className="w-10 h-10 object-contain" />
                    ) : (
                      <MapPin size={24} style={{ color: '#cbd5e1' }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm" style={{ color: COLORS.navy }}>{icon.name}</div>
                    <div className="text-xs mt-0.5 truncate font-mono" style={{ color: '#9ca3af' }}>{icon.id}</div>
                    <div className="mt-1.5">
                      {icon.image ? (
                        <Badge tone="ok"><CheckCircle2 size={12} /> Icon hochgeladen</Badge>
                      ) : (
                        <Badge tone="warn"><AlertTriangle size={12} /> Kein Icon-Bild</Badge>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Icon editor */}
        <SectionCard
          title={form.id ? 'Icon bearbeiten' : 'Neues Icon erstellen'}
          icon={form.id ? <ImageIcon size={18} /> : <Plus size={18} />}
          actions={
            form.id ? (
              <Button variant="danger" size="sm" onClick={() => handleDelete(form.id!)}>
                <Trash2 size={14} /> Löschen
              </Button>
            ) : undefined
          }
        >
          <div className="space-y-4">
            <Field label="Icon-Name (Kategorie)">
              <TextInput
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="z.B. Flughafen, Hotel, Stadion..."
              />
            </Field>

            {/* Icon Upload */}
            <Field label="Icon-Bild (PNG empfohlen)">
              {/* Preview */}
              <div className="mb-3 flex items-center gap-4">
                <div
                  className="w-20 h-20 rounded-xl flex items-center justify-center overflow-hidden"
                  style={{ border: `2px dashed ${COLORS.stroke}`, background: COLORS.surfaceMuted }}
                >
                  {form.image ? (
                    <img src={form.image} alt="Icon Vorschau" className="w-16 h-16 object-contain" />
                  ) : (
                    <ImageIcon size={28} style={{ color: '#cbd5e1' }} />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="accent" onClick={handleUploadClick} disabled={uploading}>
                    {uploading ? <><Spinner className="h-4 w-4" /> Wird hochgeladen...</> : <><Upload size={16} /> PNG hochladen</>}
                  </Button>
                  {form.image && (
                    <Button type="button" variant="secondary" onClick={() => updateField('image', null)}>
                      Icon entfernen
                    </Button>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/svg+xml,image/webp,image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Or enter URL manually */}
              <Field label="Oder URL manuell eingeben">
                <TextInput
                  type="text"
                  value={form.image || ''}
                  onChange={(e) => updateField('image', e.target.value || null)}
                  placeholder="/uploads/pin-icons/airport.png"
                  className="font-mono"
                />
              </Field>
            </Field>

            {/* Info box */}
            <div
              className="flex items-start gap-2 rounded-xl p-4 text-xs leading-relaxed"
              style={{ color: COLORS.info, background: '#f0f7ff', border: '1px solid #dbeafe' }}
            >
              <Info size={16} className="mt-0.5 shrink-0" />
              <span>
                <strong>Hinweis:</strong> Icons erscheinen auf der Karte als weisses Symbol im blauen Kreis-Pin.
                Empfehlung: <strong>transparente PNG-Icons</strong>, ca. 64×64 px oder grösser.
                Wenn kein Icon hochgeladen wird, wird ein Platzhalter-Symbol verwendet.
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? <><Spinner className="h-4 w-4" /> Speichern...</> : form.id ? 'Änderungen speichern' : 'Icon erstellen'}
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              Neu
            </Button>
          </div>
        </SectionCard>
      </div>
    </AdminShell>
  );
}
