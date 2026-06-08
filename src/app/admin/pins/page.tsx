'use client';

import { useEffect, useRef, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import Image from 'next/image';

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
      <div className="mb-6">
        <p className="text-sm text-gray-500 max-w-xl">
          Hier verwalten Sie die <strong>zentrale Icon-Bibliothek</strong> für Kartenmarkierungen. Laden Sie PNG-Icons hoch (z.B. Flugzeug, Hotel, Stadion) — diese können dann beim Erstellen von Lageplan-Pins in jedem Event ausgewählt werden.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        {/* Icon list */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Vorhandene Icons</h2>
          {loading && <p className="text-gray-400 text-sm">Lädt...</p>}
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <div className="space-y-3 max-h-[calc(100vh-20rem)] overflow-y-auto pr-1">
            {icons.length === 0 && !loading && (
              <p className="text-gray-400 text-sm italic">Noch keine Icons vorhanden.</p>
            )}
            {icons.map((icon) => (
              <button
                key={icon.id}
                onClick={() => setForm({ id: icon.id, name: icon.name, image: icon.image || null })}
                className={`w-full text-left p-4 border rounded-xl transition flex items-center gap-4 ${
                  form.id === icon.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="w-14 h-14 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {icon.image ? (
                    <img src={icon.image} alt={icon.name} className="w-10 h-10 object-contain" />
                  ) : (
                    <div className="text-2xl text-gray-300">📍</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{icon.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate font-mono">{icon.id}</div>
                  {icon.image ? (
                    <div className="text-xs text-green-600 mt-1">✓ Icon hochgeladen</div>
                  ) : (
                    <div className="text-xs text-amber-500 mt-1">⚠ Kein Icon-Bild</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Icon editor */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold">
              {form.id ? 'Icon bearbeiten' : 'Neues Icon erstellen'}
            </h2>
            {form.id && (
              <button
                onClick={() => handleDelete(form.id!)}
                className="text-sm text-red-500 hover:text-red-700 font-semibold"
              >
                Löschen
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Icon-Name (Kategorie)</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="z.B. Flughafen, Hotel, Stadion..."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Icon Upload */}
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-2">Icon-Bild (PNG empfohlen)</label>
              
              {/* Preview */}
              <div className="mb-3 flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {form.image ? (
                    <img src={form.image} alt="Icon Vorschau" className="w-16 h-16 object-contain" />
                  ) : (
                    <div className="text-gray-300 text-3xl">🖼</div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    disabled={uploading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition disabled:bg-gray-400"
                  >
                    {uploading ? 'Wird hochgeladen...' : '📁 PNG hochladen'}
                  </button>
                  {form.image && (
                    <button
                      type="button"
                      onClick={() => updateField('image', null)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition"
                    >
                      Icon entfernen
                    </button>
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
              <div>
                <label className="text-xs text-gray-400 block mb-1">Oder URL manuell eingeben:</label>
                <input
                  type="text"
                  value={form.image || ''}
                  onChange={(e) => updateField('image', e.target.value || null)}
                  placeholder="/uploads/pin-icons/airport.png"
                  className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            {/* Info box */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 leading-relaxed">
              <strong>💡 Hinweis:</strong> Icons erscheinen auf der Karte als weisses Symbol im blauen Kreis-Pin.
              Empfehlung: <strong>transparente PNG-Icons</strong>, ca. 64×64 px oder grösser.
              Wenn kein Icon hochgeladen wird, wird ein Platzhalter-Symbol verwendet.
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold text-sm transition"
            >
              {saving ? 'Speichern...' : form.id ? 'Änderungen speichern' : 'Icon erstellen'}
            </button>
            <button
              onClick={resetForm}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-sm transition"
            >
              Neu
            </button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
