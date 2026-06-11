'use client';

import { useEffect, useMemo, useState } from 'react';
import { ImageIcon, LoaderCircle, Search, Upload, X } from 'lucide-react';

interface MediaItem {
  name: string;
  url: string;
  relativePath: string;
  size: number;
  updatedAt: string;
  source: 'upload' | 'public';
}

interface MediaLibraryDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

export default function MediaLibraryDialog({ open, onClose, onSelect }: MediaLibraryDialogProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const loadLibrary = async () => {
    setLoading(true);
    setError(null);

    const response = await fetch('/api/admin/media');
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Fehler beim Laden der Mediathek');
      setLoading(false);
      return;
    }

    setItems(result.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!open) return;
    loadLibrary();
  }, [open]);

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const term = query.toLowerCase();
    return items.filter((item) =>
      [item.name, item.relativePath, item.url].some((value) => value.toLowerCase().includes(term))
    );
  }, [items, query]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/admin/media', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();

    if (!result.success) {
      setError(result.error || 'Upload fehlgeschlagen');
      setUploading(false);
      return;
    }

    setItems((prev) => [result.data, ...prev]);
    setUploading(false);
    onSelect(result.data.url);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-gray-900">Mediathek</div>
            <div className="mt-1 text-xs text-gray-500">Bestehende Grafiken aus dem Projekt oder neue Uploads verwenden.</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Dateiname oder Pfad suchen"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white"
            />
          </div>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Datei hochladen
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Mediathek wird geladen...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
              Keine Bilder gefunden.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredItems.map((item) => (
                <button
                  key={`${item.relativePath}-${item.updatedAt}`}
                  onClick={() => {
                    onSelect(item.url);
                    onClose();
                  }}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="aspect-square bg-gray-100">
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="space-y-1 px-3 py-3">
                    <div className="truncate text-sm font-semibold text-gray-900">{item.name}</div>
                    <div className="truncate text-xs text-gray-500">{item.relativePath}</div>
                    <div className="flex items-center gap-2 pt-1 text-[11px] uppercase tracking-wide text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {item.source}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}