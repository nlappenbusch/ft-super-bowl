'use client';

import { useCallback, useEffect, useState } from 'react';
import { Archive, ArchiveRestore, FolderKanban, Plus, X } from 'lucide-react';
import { Button, Field, TextInput, Badge, Spinner, COLORS } from './ui';

interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  status: 'aktiv' | 'archiviert';
  task_count: number;
  total_minutes: number;
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')} h`;
}

/**
 * Projekte verwalten: anlegen, archivieren, reaktivieren.
 * Archivierte Projekte verschwinden aus den Zuordnungs-Dropdowns,
 * bleiben aber an bestehenden Tickets/Zeiten und im Filter sichtbar.
 */
export default function ProjectManagerDialog({
  open, onClose, onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/projects').then((x) => x.json());
      if (r.success) setProjects(r.data);
      else setError(r.error || 'Projekte konnten nicht geladen werden');
    } catch {
      setError('Projekte konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError('');
    load();
  }, [open, load]);

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const r = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, description: form.description }),
      }).then((x) => x.json());
      if (!r.success) { setError(r.error || 'Projekt konnte nicht angelegt werden'); return; }
      setForm({ name: '', description: '' });
      await load();
      onChanged?.();
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (p: ProjectSummary, status: 'aktiv' | 'archiviert') => {
    setBusyId(p.id);
    setError('');
    try {
      const r = await fetch(`/api/admin/projects/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then((x) => x.json());
      if (!r.success) { setError(r.error || 'Projekt konnte nicht aktualisiert werden'); return; }
      await load();
      onChanged?.();
    } finally {
      setBusyId('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: COLORS.stroke }}>
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" style={{ color: COLORS.accent }} />
            <div>
              <div className="text-sm font-bold" style={{ color: COLORS.navy }}>Projekte verwalten</div>
              <div className="text-xs" style={{ color: COLORS.textMuted }}>
                Tickets und Zeiten werden im Rapport nach Projekt gruppiert.
              </div>
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition hover:bg-gray-100" title="Schließen">
            <X className="h-5 w-5" style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        {/* Neues Projekt */}
        <div className="border-b px-5 py-4" style={{ borderColor: COLORS.stroke }}>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Neues Projekt" className="min-w-40 flex-1">
              <TextInput
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
                placeholder="Projektname"
              />
            </Field>
            <Field label="Beschreibung (optional)" className="min-w-40 flex-1">
              <TextInput
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') create(); }}
                placeholder="Kurzbeschreibung"
              />
            </Field>
            <Button variant="accent" onClick={create} disabled={saving || !form.name.trim()}>
              {saving ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Anlegen
            </Button>
          </div>
          {error && <p className="mt-2 text-xs font-medium" style={{ color: COLORS.danger }}>{error}</p>}
        </div>

        {/* Projektliste */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : projects.length === 0 ? (
            <p className="py-6 text-center text-sm" style={{ color: COLORS.textMuted }}>
              Noch keine Projekte — oben das erste anlegen.
            </p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: COLORS.stroke, opacity: p.status === 'archiviert' ? 0.6 : 1 }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold" style={{ color: COLORS.navy }}>🗂 {p.name}</span>
                      {p.status === 'archiviert' && <Badge tone="muted">archiviert</Badge>}
                    </div>
                    {p.description && (
                      <p className="mt-0.5 text-xs" style={{ color: COLORS.textMuted }}>{p.description}</p>
                    )}
                    <p className="mt-0.5 text-xs" style={{ color: COLORS.textMuted }}>
                      {p.task_count} {p.task_count === 1 ? 'Ticket' : 'Tickets'} · {fmtMin(p.total_minutes)}
                    </p>
                  </div>
                  {p.status === 'aktiv' ? (
                    <Button
                      size="sm" variant="ghost" disabled={busyId === p.id}
                      onClick={() => setStatus(p, 'archiviert')}
                      title="Archivieren — verschwindet aus den Zuordnungs-Dropdowns, Tickets/Zeiten bleiben erhalten"
                    >
                      {busyId === p.id ? <Spinner className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />} Archivieren
                    </Button>
                  ) : (
                    <Button
                      size="sm" variant="secondary" disabled={busyId === p.id}
                      onClick={() => setStatus(p, 'aktiv')}
                      title="Reaktivieren — wieder in den Zuordnungs-Dropdowns verfügbar"
                    >
                      {busyId === p.id ? <Spinner className="h-3.5 w-3.5" /> : <ArchiveRestore className="h-3.5 w-3.5" />} Reaktivieren
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
