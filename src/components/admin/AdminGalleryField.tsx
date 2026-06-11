'use client';

import { useMemo, useRef, useState } from 'react';
import { FolderPlus, Trash2, Upload } from 'lucide-react';
import MediaLibraryDialog from '@/components/admin/MediaLibraryDialog';

function parseList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

interface AdminGalleryFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function AdminGalleryField({ label, value, onChange, placeholder }: AdminGalleryFieldProps) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const images = useMemo(() => parseList(value), [value]);

  const writeImages = (nextImages: string[]) => {
    onChange(nextImages.join('\n'));
  };

  const handleLibrarySelect = (url: string) => {
    writeImages([...images, url]);
  };

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

    writeImages([...images, result.data.url]);
    setUploading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-semibold text-gray-600">{label}</label>
        <div className="text-xs text-gray-400">{images.length} Bilder</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          <FolderPlus className="h-4 w-4" />
          Aus Mediathek
        </button>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          disabled={uploading}
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Lade hoch...' : 'Bild hochladen'}
        </button>
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-3">
        {images.length === 0 && (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-sm text-gray-400">
            Noch keine Bilder ausgewaehlt
          </div>
        )}

        {images.map((image, index) => (
          <div key={`${image}-${index}`} className="grid gap-3 rounded-xl border border-gray-200 bg-white p-3 lg:grid-cols-[120px_minmax(0,1fr)_auto] lg:items-center">
            <div className="aspect-4/3 overflow-hidden rounded-lg bg-gray-100">
              <img src={image} alt={`Bild ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </div>
            <input
              value={image}
              onChange={(event) => {
                const nextImages = [...images];
                nextImages[index] = event.target.value;
                writeImages(nextImages);
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => writeImages(images.filter((_, imageIndex) => imageIndex !== index))}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Entfernen
            </button>
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-semibold text-gray-600">Rohwerte</label>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          placeholder={placeholder}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
        />
      </div>

      <MediaLibraryDialog open={libraryOpen} onClose={() => setLibraryOpen(false)} onSelect={handleLibrarySelect} />
    </div>
  );
}