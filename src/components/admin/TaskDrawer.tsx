'use client';

import { useEffect, useState, useRef } from 'react';
import { X, Plus, Trash2, Check, Paperclip, Download } from 'lucide-react';
import { Button, TextArea, Spinner, Badge, COLORS } from './ui';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'offen' | 'in_arbeit' | 'erledigt';
  priority: 'niedrig' | 'normal' | 'hoch';
  due_date: string | null;
}
interface Subtask { id: string; title: string; done: number }
interface Att { id: string; filename: string; mime: string; size: number }

const PRIO_TONE = { niedrig: 'muted', normal: 'info', hoch: 'danger' } as const;
const STATUS_LABEL = { offen: 'Offen', in_arbeit: 'In Arbeit', erledigt: 'Erledigt' } as const;

export default function TaskDrawer({ task, onClose, onChanged }: { task: Task; onClose: () => void; onChanged?: () => void }) {
  const [desc, setDesc] = useState(task.description || '');
  const [savingDesc, setSavingDesc] = useState(false);
  const [subs, setSubs] = useState<Subtask[]>([]);
  const [newSub, setNewSub] = useState('');
  const [loading, setLoading] = useState(true);
  const [atts, setAtts] = useState<Att[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSubs = () => {
    setLoading(true);
    fetch(`/api/admin/tasks/${task.id}/subtasks`)
      .then((r) => r.json())
      .then((r) => { if (r.success) setSubs(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  const loadAtts = () => {
    fetch(`/api/admin/tasks/${task.id}/attachments`).then((r) => r.json()).then((r) => { if (r.success) setAtts(r.data); }).catch(() => {});
  };
  useEffect(() => { loadSubs(); loadAtts(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [task.id]);

  const saveDesc = async () => {
    setSavingDesc(true);
    try {
      await fetch(`/api/admin/tasks/${task.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: desc }),
      });
      onChanged?.();
    } finally { setSavingDesc(false); }
  };

  const addSub = async () => {
    const t = newSub.trim();
    if (!t) return;
    setNewSub('');
    await fetch(`/api/admin/tasks/${task.id}/subtasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t }),
    });
    loadSubs();
  };
  const toggleSub = async (s: Subtask) => {
    setSubs((prev) => prev.map((x) => (x.id === s.id ? { ...x, done: x.done ? 0 : 1 } : x)));
    await fetch(`/api/admin/tasks/${task.id}/subtasks`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subtaskId: s.id, done: !s.done }),
    });
  };
  const delSub = async (s: Subtask) => {
    setSubs((prev) => prev.filter((x) => x.id !== s.id));
    await fetch(`/api/admin/tasks/${task.id}/subtasks?subtaskId=${encodeURIComponent(s.id)}`, { method: 'DELETE' });
  };
  const onUpload = async (f: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      await fetch(`/api/admin/tasks/${task.id}/attachments`, { method: 'POST', body: fd });
      loadAtts();
    } finally { setUploading(false); }
  };
  const delAtt = async (a: Att) => {
    setAtts((prev) => prev.filter((x) => x.id !== a.id));
    await fetch(`/api/admin/tasks/${task.id}/attachments?attId=${encodeURIComponent(a.id)}`, { method: 'DELETE' });
  };

  const doneCount = subs.filter((s) => s.done).length;
  const pct = subs.length ? Math.round((doneCount / subs.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }} onClick={onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold" style={{ color: COLORS.navy }}>{task.title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 transition hover:bg-gray-100" title="Schließen">
            <X className="h-5 w-5" style={{ color: COLORS.textMuted }} />
          </button>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Badge tone="muted">{STATUS_LABEL[task.status]}</Badge>
          <Badge tone={PRIO_TONE[task.priority]}>{task.priority}</Badge>
          {task.due_date && <span className="text-xs" style={{ color: COLORS.textMuted }}>📅 {task.due_date}</span>}
        </div>

        {/* Beschreibung */}
        <div className="mb-6">
          <label className="mb-1 block text-xs font-semibold" style={{ color: COLORS.textMuted }}>Beschreibung</label>
          <TextArea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Notizen, Kontext, Links…" />
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={saveDesc} disabled={savingDesc || desc === (task.description || '')}>
              {savingDesc ? <Spinner className="h-4 w-4" /> : null} Speichern
            </Button>
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs font-semibold" style={{ color: COLORS.textMuted }}>Subtasks</label>
            {subs.length > 0 && <span className="text-xs tabular-nums" style={{ color: COLORS.textMuted }}>{doneCount}/{subs.length}</span>}
          </div>
          {subs.length > 0 && (
            <div className="mb-3 h-1.5 rounded-full" style={{ background: COLORS.surfaceMuted }}>
              <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS.ok }} />
            </div>
          )}
          {loading ? (
            <div className="py-4 text-center"><Spinner /></div>
          ) : (
            <div className="space-y-1.5">
              {subs.map((s) => (
                <div key={s.id} className="group flex items-center gap-2">
                  <button
                    onClick={() => toggleSub(s)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition"
                    style={{ borderColor: s.done ? COLORS.ok : COLORS.stroke, background: s.done ? COLORS.ok : '#fff' }}
                  >
                    {s.done ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                  </button>
                  <span className="flex-1 text-sm" style={{ color: s.done ? COLORS.textMuted : COLORS.navy, textDecoration: s.done ? 'line-through' : 'none' }}>{s.title}</span>
                  <button onClick={() => delSub(s)} className="opacity-0 transition group-hover:opacity-100" title="Löschen">
                    <Trash2 className="h-3.5 w-3.5" style={{ color: COLORS.textMuted }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addSub(); }}
              placeholder="Neuer Subtask…"
              className="flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none"
              style={{ borderColor: COLORS.stroke }}
            />
            <Button size="sm" variant="ghost" onClick={addSub} disabled={!newSub.trim()}><Plus className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Datei-Anhänge */}
        <div className="mt-6">
          <label className="mb-2 block text-xs font-semibold" style={{ color: COLORS.textMuted }}>Dateien</label>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }} />
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />} Datei anhängen
          </Button>
          {atts.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {atts.map((a) => (
                <div key={a.id} className="group flex items-center gap-2 text-sm">
                  <a href={`/api/admin/tasks/${task.id}/attachments?attId=${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer" className="flex flex-1 items-center gap-1.5 truncate hover:underline" style={{ color: COLORS.navy }}>
                    <Download className="h-3.5 w-3.5 shrink-0" style={{ color: COLORS.textMuted }} />
                    <span className="truncate">{a.filename}</span>
                  </a>
                  <button onClick={() => delAtt(a)} className="opacity-0 transition group-hover:opacity-100" title="Löschen"><Trash2 className="h-3.5 w-3.5" style={{ color: COLORS.textMuted }} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
