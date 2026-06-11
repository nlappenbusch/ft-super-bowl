'use client';

import { useRef, useState } from 'react';
import { FolderOpen, Trash2, Upload } from 'lucide-react';
import MediaLibraryDialog from '@/components/admin/MediaLibraryDialog';

interface AdminImageFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  previewLabel?: string;
}

export default function AdminImageField({
  label,
  value,
  onChange,
  placeholder,
  previewLabel
}: AdminImageFieldProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/admin/media', { method: 'POST', body: formData });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Upload fehlgeschlagen');
      setUploading(false);
      return;
    }

    onChange(result.data.url);
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-600">{label}</label>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <FolderOpen className="h-4 w-4" />
          Mediathek
        </button>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Lade hoch...' : 'Upload'}
        </button>

        {value.trim() && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Entfernen
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {value.trim() ? (
          <div className="aspect-4/3 bg-gray-100">
            <img src={value} alt={previewLabel || label} className="h-full w-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center bg-gray-50 text-sm text-gray-400">
            Kein Bild ausgewaehlt
          </div>
        )}
        <div className="border-t border-gray-100 px-3 py-2 text-xs text-gray-500">{previewLabel || label}</div>
      </div>

      <MediaLibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelect={onChange} />
    </div>
  );
}