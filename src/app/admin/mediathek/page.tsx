'use client';

/**
 * /admin/mediathek — Mediathek: alle Dateien auf dem Webserver (TASK-00120)
 * ─────────────────────────────────────────────────────────────────────────────
 * Zeigt sämtliche hochgeladenen Dateien aus allen Ablagen (Bilder, Anhänge der
 * automatischen Antworten, Kundendokumente, Aufgaben- und Mail-Anhänge) mit
 * Ablageort, Verwendung und – wo vorhanden – der öffentlichen URL zum Verlinken.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, Copy, Download, ExternalLink, FileText, FolderOpen, Image as ImageIcon,
  Link2, Paperclip, RefreshCw, Search, Trash2, Upload, Users,
} from 'lucide-react';
import AdminShell from '@/components/admin/AdminShell';
import {
  Badge, Button, Card, COLORS, EmptyState, PageHeader, SelectInput, Spinner, StatCard, TextInput,
} from '@/components/admin/ui';

type FileKind = 'bild' | 'anhang' | 'kundendokument' | 'aufgabe' | 'nachricht';

interface InventoryUsage { label: string; href?: string }

interface InventoryFile {
  id: string;
  kind: FileKind;
  name: string;
  fileName: string;
  mime: string;
  size: number;
  updatedAt: string;
  publicUrl: string | null;
  href: string;
  storage: string;
  usedIn: InventoryUsage[];
  missing?: boolean;
  orphan?: boolean;
}

interface Inventory {
  files: InventoryFile[];
  counts: Record<FileKind, number>;
  totalBytes: number;
}

const KIND_LABEL: Record<FileKind, string> = {
  bild: 'Bilder',
  anhang: 'Anhänge (Auto-Antwort)',
  kundendokument: 'Kundendokumente',
  aufgabe: 'Aufgaben-Anhänge',
  nachricht: 'Mail-Anhänge',
};

const KIND_ICON: Record<FileKind, React.ReactNode> = {
  bild: <ImageIcon className="h-4 w-4" />,
  anhang: <Paperclip className="h-4 w-4" />,
  kundendokument: <Users className="h-4 w-4" />,
  aufgabe: <FileText className="h-4 w-4" />,
  nachricht: <FileText className="h-4 w-4" />,
};

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MediathekPage() {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<FileKind | 'alle'>('alle');
  const [copied, setCopied] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/files').then((r) => r.json());
      if (!res?.success) throw new Error(res?.error || 'Laden fehlgeschlagen.');
      setInventory(res.data as Inventory);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const files = inventory?.files || [];
    const q = query.trim().toLowerCase();
    return files.filter((f) => {
      if (kind !== 'alle' && f.kind !== kind) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.fileName.toLowerCase().includes(q) ||
        f.storage.toLowerCase().includes(q) ||
        f.usedIn.some((u) => u.label.toLowerCase().includes(q))
      );
    });
  }, [inventory, query, kind]);

  const copy = async (file: InventoryFile) => {
    const url = file.publicUrl ? `${origin}${file.publicUrl}` : `${origin}${file.href}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(file.id);
      setTimeout(() => setCopied((c) => (c === file.id ? null : c)), 1800);
    } catch {
      window.prompt('URL kopieren:', url);
    }
  };

  const upload = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setUploadMsg('');
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/admin/files', { method: 'POST', body: fd }).then((r) => r.json());
        if (!res?.success) throw new Error(res?.error || 'Upload fehlgeschlagen.');
      }
      setUploadMsg(`${files.length} Datei(en) hochgeladen.`);
      await load();
    } catch (e) {
      setUploadMsg((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (file: InventoryFile) => {
    if (!window.confirm(`„${file.name}" endgültig vom Server löschen?`)) return;
    try {
      const res = await fetch(`/api/admin/files?file=${encodeURIComponent(file.fileName)}`, { method: 'DELETE' })
        .then((r) => r.json());
      if (!res?.success) throw new Error(res?.error || 'Löschen fehlgeschlagen.');
      await load();
    } catch (e) {
      window.alert((e as Error).message);
    }
  };

  const counts = inventory?.counts;

  return (
    <AdminShell title="Mediathek" wide>
      <PageHeader
        title="Mediathek"
        description="Alle auf dem Webserver gespeicherten Dateien — mit Ablageort, Verwendung und öffentlicher URL zum Verlinken."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png,image/webp,.webp"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                upload(files);
                e.target.value = '';
              }}
            />
            <Button variant="secondary" onClick={load} disabled={loading}>
              <RefreshCw className="h-4 w-4" /> Aktualisieren
            </Button>
            <Button variant="accent" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />} Datei hochladen
            </Button>
          </>
        }
      />

      {uploadMsg && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#f0fdf4', color: COLORS.navy }}>
          {uploadMsg}
        </div>
      )}

      {counts && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<FolderOpen className="h-4 w-4" />} label="Dateien gesamt" value={inventory?.files.length ?? 0} sub={formatBytes(inventory?.totalBytes ?? 0)} />
          <StatCard icon={<ImageIcon className="h-4 w-4" />} label="Bilder" value={counts.bild} sub="public/uploads/media" tone="info" />
          <StatCard icon={<Paperclip className="h-4 w-4" />} label="Anhänge Auto-Antwort" value={counts.anhang} sub="data/uploads/auto-reply" tone="accent" />
          <StatCard icon={<FileText className="h-4 w-4" />} label="Dateien in der Datenbank" value={counts.kundendokument + counts.aufgabe + counts.nachricht} sub="Kunden · Aufgaben · Mails" tone="navy" />
        </div>
      )}

      <Card className="mb-4" padded>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: '#9ca3af' }} />
            <TextInput
              className="pl-9"
              placeholder="Dateiname, Event, Kunde …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="sm:w-72">
            <SelectInput value={kind} onChange={(e) => setKind(e.target.value as FileKind | 'alle')}>
              <option value="alle">Alle Ablagen</option>
              {(Object.keys(KIND_LABEL) as FileKind[]).map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}{counts ? ` (${counts[k]})` : ''}</option>
              ))}
            </SelectInput>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: '#fef2f2', color: COLORS.danger }}>{error}</div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12" style={{ color: COLORS.textMuted }}>
          <Spinner className="h-4 w-4" /> Dateien werden gelesen …
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="Keine Dateien gefunden"
          description="Passe die Suche an oder lade eine Datei hoch."
        />
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: COLORS.surfaceMuted, color: COLORS.textMuted }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Datei</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Ablage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Verwendet in</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Größe</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Datum</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider">URL / Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((file) => (
                  <tr key={file.id} className="border-t align-top" style={{ borderColor: COLORS.stroke }}>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span style={{ color: COLORS.textMuted }}>{KIND_ICON[file.kind]}</span>
                        <div className="min-w-0">
                          <div className="truncate font-semibold" style={{ color: COLORS.navy }}>{file.name}</div>
                          <div className="truncate text-xs" style={{ color: COLORS.textMuted }}>{file.fileName}</div>
                          {file.missing && <Badge tone="danger" className="mt-1">Datei fehlt auf dem Server</Badge>}
                          {file.orphan && !file.missing && <Badge tone="warn" className="mt-1">nicht verwendet</Badge>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div style={{ color: COLORS.navy }}>{KIND_LABEL[file.kind]}</div>
                      <div className="text-xs" style={{ color: COLORS.textMuted }}>{file.storage}</div>
                    </td>
                    <td className="px-4 py-3">
                      {file.usedIn.length === 0 ? (
                        <span className="text-xs" style={{ color: COLORS.textMuted }}>—</span>
                      ) : (
                        <div className="grid gap-0.5">
                          {file.usedIn.map((u, i) =>
                            u.href ? (
                              <a key={i} href={u.href} className="text-xs underline" style={{ color: COLORS.info }}>{u.label}</a>
                            ) : (
                              <span key={i} className="text-xs" style={{ color: COLORS.textMuted }}>{u.label}</span>
                            )
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: COLORS.textMuted }}>{formatBytes(file.size)}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: COLORS.textMuted }}>{formatDate(file.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-1.5">
                        {file.publicUrl ? (
                          <code className="max-w-[22rem] truncate rounded-lg px-2 py-1 text-xs" style={{ background: COLORS.surfaceMuted, color: COLORS.navy }}>
                            {origin}{file.publicUrl}
                          </code>
                        ) : (
                          <span className="text-xs" style={{ color: COLORS.textMuted }}>nur mit Login abrufbar</span>
                        )}
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {!file.missing && (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => copy(file)}>
                                {copied === file.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                {copied === file.id ? 'Kopiert' : file.publicUrl ? 'URL kopieren' : 'Link kopieren'}
                              </Button>
                              <a href={file.href} target="_blank" rel="noreferrer">
                                <Button size="sm" variant="ghost">
                                  {file.publicUrl ? <ExternalLink className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />} Öffnen
                                </Button>
                              </a>
                            </>
                          )}
                          {file.kind === 'anhang' && !file.missing && file.usedIn.length === 0 && (
                            <Button size="sm" variant="danger" onClick={() => remove(file)}>
                              <Trash2 className="h-3.5 w-3.5" /> Löschen
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-xl px-4 py-3 text-xs" style={{ background: COLORS.surfaceMuted, color: COLORS.textMuted }}>
        <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <strong style={{ color: COLORS.navy }}>Öffentliche Links:</strong> Bilder liegen unter <code>/uploads/media/…</code>,
          Anhänge der automatischen Antworten sind über <code>/dokumente/&lt;dateiname&gt;</code> erreichbar — diese URL kann
          direkt in Mails oder auf der Website verlinkt werden. Kundendokumente, Aufgaben- und Mail-Anhänge liegen in der
          Datenbank und sind bewusst nur mit Admin-Login abrufbar.
        </div>
      </div>
    </AdminShell>
  );
}
