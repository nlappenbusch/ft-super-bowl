'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, Card, SectionCard, Button, Field, TextInput, SelectInput, TextArea, Badge, Spinner, COLORS,
} from '@/components/admin/ui';
import { Plus, Trash2, ChevronRight, ChevronLeft, ListTodo, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import TaskDrawer from '@/components/admin/TaskDrawer';

type TaskStatus = 'offen' | 'in_arbeit' | 'warten_requester' | 'warten_dritte' | 'erledigt';

interface StaffTask {
  id: string;
  ticket_number: number | null;
  created_at?: string;
  title: string;
  description: string;
  assignee_id: string | null;
  booking_id: string | null;
  due_date: string | null;
  priority: 'niedrig' | 'normal' | 'hoch';
  status: TaskStatus;
  created_by: string | null;
  project_id?: string | null;
  project_name?: string | null;
}

interface ProjectLite { id: string; name: string }

function ticketNo(n: number | null): string {
  return n && n > 0 ? `TASK-${String(n).padStart(5, '0')}` : '';
}

interface EmployeeLite { id: string; name: string }

/** Board-Spalten: beide Warte-Status teilen sich eine Spalte (Umschalter auf der Karte). */
type BoardCol = 'offen' | 'in_arbeit' | 'warten' | 'erledigt';

const COLUMNS: Array<{ id: BoardCol; label: string }> = [
  { id: 'offen', label: 'Offen' },
  { id: 'in_arbeit', label: 'In Arbeit' },
  { id: 'warten', label: 'Wartet auf …' },
  { id: 'erledigt', label: 'Erledigt' },
];

const isWaiting = (s: TaskStatus) => s === 'warten_requester' || s === 'warten_dritte';
const colOf = (s: TaskStatus): BoardCol => (isWaiting(s) ? 'warten' : (s as BoardCol));

const PRIO_TONE = { niedrig: 'muted', normal: 'info', hoch: 'danger' } as const;
const PRIO_RANK = { hoch: 0, normal: 1, niedrig: 2 } as const;

/** Sortierung innerhalb einer Spalte: Priorität → Fälligkeit → neueste zuerst. */
function sortColumn(list: StaffTask[]): StaffTask[] {
  return [...list].sort((a, b) =>
    (PRIO_RANK[a.priority] - PRIO_RANK[b.priority])
    || (a.due_date || '9999').localeCompare(b.due_date || '9999')
    || (b.created_at || '').localeCompare(a.created_at || ''));
}

/** In "Erledigt" nur die jüngsten Karten anzeigen, damit die Spalte nicht endlos wächst. */
const DONE_LIMIT = 12;

function DropColumn({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="min-h-[60px] space-y-3 rounded-xl p-1 transition-colors"
      style={{ background: isOver ? COLORS.surfaceMuted : 'transparent' }}
    >
      {children}
    </div>
  );
}

function TaskCard({
  t, today, employees, empName, onOpen, onMove, onRemove, onAssign, onToggleWait,
}: {
  t: StaffTask;
  today: string;
  employees: EmployeeLite[];
  empName: (id: string | null) => string;
  onOpen: (t: StaffTask) => void;
  onMove: (t: StaffTask, dir: 1 | -1) => void;
  onRemove: (id: string) => void;
  onAssign: (id: string, v: string | null) => void;
  onToggleWait: (t: StaffTask) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: t.id });
  const [expanded, setExpanded] = useState(false);
  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    boxShadow: isDragging ? '0 10px 24px rgba(20,48,71,0.18)' : undefined,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <span
              {...listeners}
              {...attributes}
              className="mt-0.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
              title="Ziehen, um zu verschieben"
            >
              <GripVertical className="h-4 w-4" style={{ color: COLORS.textMuted }} />
            </span>
            <div className="min-w-0 cursor-pointer" onClick={() => onOpen(t)} title="Details öffnen">
              {ticketNo(t.ticket_number) && (
                <span className="mb-0.5 inline-block font-mono text-[10px] font-bold tracking-wide" style={{ color: COLORS.accent }}>{ticketNo(t.ticket_number)}</span>
              )}
              <div className="font-semibold" style={{ color: COLORS.navy }}>{t.title}</div>
              {t.description && (
                <p className={`mt-1 text-xs ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`} style={{ color: COLORS.textMuted }}>{t.description}</p>
              )}
              {t.description && (t.description.length > 120 || t.description.includes('\n')) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
                  className="mt-0.5 text-[11px] font-medium hover:underline"
                  style={{ color: COLORS.accent }}
                >
                  {expanded ? 'weniger anzeigen' : 'mehr anzeigen'}
                </button>
              )}
            </div>
          </div>
          <Badge tone={PRIO_TONE[t.priority]}>{t.priority}</Badge>
        </div>
        {isWaiting(t.status) && (
          <button
            onClick={() => onToggleWait(t)}
            className="mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition hover:opacity-80"
            style={{ borderColor: '#f4c169', background: '#fdf3df', color: '#8a5a00' }}
            title="Klicken zum Umschalten: Requester ↔ Extern"
          >
            ⏳ Wartet auf: {t.status === 'warten_requester' ? (t.created_by || 'Requester') : 'Extern (Dritte)'}
          </button>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: COLORS.textMuted }}>
          <span>👤 {empName(t.assignee_id)}</span>
          {t.project_name && (
            <span
              className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{ borderColor: '#c7d7ea', background: '#eef4fb', color: COLORS.navy }}
              title="Projekt"
            >
              🗂 {t.project_name}
            </span>
          )}
          {t.created_by && <span title="Erstellt von">✍️ {t.created_by}</span>}
          {t.due_date && (
            <span style={{ color: t.due_date < today && t.status !== 'erledigt' ? COLORS.danger : undefined }}>📅 {t.due_date}</span>
          )}
          {t.booking_id && (
            <Link href={`/admin/crm?booking=${t.booking_id}`} className="underline" style={{ color: COLORS.accent }}>Anfrage öffnen</Link>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between border-t pt-2" style={{ borderColor: COLORS.stroke }}>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onMove(t, -1)} disabled={colOf(t.status) === 'offen'} title="Zurück"><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onMove(t, 1)} disabled={colOf(t.status) === 'erledigt'} title="Weiter"><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
          <div className="flex items-center gap-1">
            <SelectInput value={t.assignee_id || ''} onChange={(e) => onAssign(t.id, e.target.value || null)} className="!w-32 !py-1 !text-xs">
              <option value="">Niemand</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </SelectInput>
            <Button size="sm" variant="ghost" onClick={() => onRemove(t.id)} title="Löschen"><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function AufgabenPage() {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', due_date: '', priority: 'normal', project_id: '' });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<StaffTask | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filterAssignee) q.set('assignee', filterAssignee);
      if (filterProject) q.set('project', filterProject);
      const r = await fetch(`/api/admin/tasks?${q}`).then((x) => x.json());
      if (r.success) setTasks(r.data);
    } finally {
      setLoading(false);
    }
  }, [filterAssignee, filterProject]);

  const loadProjects = useCallback(async () => {
    const r = await fetch('/api/admin/projects').then((x) => x.json()).catch(() => null);
    if (r?.success) setProjects(r.data.map((p: ProjectLite) => ({ id: p.id, name: p.name })));
  }, []);

  useEffect(() => {
    fetch('/api/admin/team').then((r) => r.json()).then((r) => {
      if (r.success) setEmployees(r.data.map((e: EmployeeLite) => ({ id: e.id, name: e.name })));
    }).catch(() => {});
    loadProjects();
  }, [loadProjects]);

  /** "+ Neues Projekt…" in Selects: Name abfragen, anlegen, direkt auswählen. */
  const newProject = async (): Promise<string> => {
    const name = (window.prompt('Name des neuen Projekts:') || '').trim();
    if (!name) return '';
    const r = await fetch('/api/admin/projects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }),
    }).then((x) => x.json());
    if (!r.success) { alert(r.error || 'Projekt konnte nicht angelegt werden'); return ''; }
    await loadProjects();
    return r.data.id;
  };

  useEffect(() => { load(); }, [load]);

  // Deep-Link ?task=<id> (z.B. aus dem Benachrichtigungs-Center) → Drawer öffnen.
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current || !tasks.length) return;
    const id = new URLSearchParams(window.location.search).get('task');
    deepLinkDone.current = true;
    if (!id) return;
    const t = tasks.find((x) => x.id === id);
    if (t) setSelected(t);
  }, [tasks]);

  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name || '–';

  const create = async () => {
    if (!form.title) return;
    setSaving(true);
    try {
      await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          assignee_id: form.assignee_id || null,
          due_date: form.due_date || null,
          priority: form.priority,
          project_id: form.project_id || null,
        }),
      });
      setForm({ title: '', description: '', assignee_id: '', due_date: '', priority: 'normal', project_id: form.project_id });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const patch = async (id: string, body: Partial<StaffTask>) => {
    await fetch(`/api/admin/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Aufgabe löschen?')) return;
    await fetch(`/api/admin/tasks/${id}`, { method: 'DELETE' });
    await load();
  };

  /** Ziel-Status beim Wechsel in eine Board-Spalte (Warten-Spalte → Default Requester). */
  const statusForCol = (t: StaffTask, col: BoardCol): TaskStatus =>
    col === 'warten' ? (isWaiting(t.status) ? t.status : 'warten_requester') : col;

  const moveStatus = (t: StaffTask, dir: 1 | -1) => {
    const idx = COLUMNS.findIndex((c) => c.id === colOf(t.status));
    const next = COLUMNS[idx + dir];
    if (next) patch(t.id, { status: statusForCol(t, next.id) });
  };

  /** Umschalter auf der Karte: Wartet auf Requester ↔ Extern (Dritte). */
  const toggleWait = (t: StaffTask) => {
    const newStatus: TaskStatus = t.status === 'warten_requester' ? 'warten_dritte' : 'warten_requester';
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: newStatus } : x)));
    fetch(`/api/admin/tasks/${t.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }),
    }).catch(() => load());
  };

  // Drag & Drop (dnd-kit): Karte in die Ziel-Spalte verschieben (optimistisch + persistiert)
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const col = String(over.id) as BoardCol;
    const id = String(active.id);
    const t = tasks.find((x) => x.id === id);
    if (!t || colOf(t.status) === col) return;
    const newStatus = statusForCol(t, col);
    setTasks((prev) => prev.map((x) => (x.id === id ? { ...x, status: newStatus } : x)));
    fetch(`/api/admin/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => load());
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AdminShell title="Aufgaben" wide>
      <PageHeader
        title="Aufgaben"
        description="Interne Tasks – per Drag & Drop verschieben, zuweisen, mit Fälligkeit und Priorität."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SelectInput value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="w-52">
              <option value="">Alle Projekte</option>
              <option value="none">Ohne Projekt</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectInput>
            <SelectInput value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="w-48">
              <option value="">Alle Mitarbeiter</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </SelectInput>
          </div>
        }
      />

      {/* Neue Aufgabe */}
      <SectionCard title="Neue Aufgabe" icon={<Plus className="h-4 w-4" />}>
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Titel" className="sm:col-span-2">
            <TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. Angebot für RQ-10006 nachfassen" />
          </Field>
          <Field label="Zugewiesen an">
            <SelectInput value={form.assignee_id} onChange={(e) => setForm({ ...form, assignee_id: e.target.value })}>
              <option value="">Niemand</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Fällig am">
            <TextInput type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </Field>
          <Field label="Beschreibung" className="sm:col-span-2">
            <TextArea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Projekt">
            <SelectInput
              value={form.project_id}
              onChange={async (e) => {
                const v = e.target.value;
                if (v === '__new__') {
                  const id = await newProject();
                  setForm((f) => ({ ...f, project_id: id }));
                } else {
                  setForm({ ...form, project_id: v });
                }
              }}
            >
              <option value="">Kein Projekt</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="__new__">＋ Neues Projekt…</option>
            </SelectInput>
          </Field>
          <Field label="Priorität">
            <SelectInput value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="niedrig">Niedrig</option>
              <option value="normal">Normal</option>
              <option value="hoch">Hoch</option>
            </SelectInput>
          </Field>
        </div>
        <div className="mt-3">
          <Button variant="accent" onClick={create} disabled={saving || !form.title}>
            {saving ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Aufgabe anlegen
          </Button>
        </div>
      </SectionCard>

      {/* Board */}
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          {/* Volle Breite; unterhalb von 4 × ~290px scrollt das Board horizontal statt zu quetschen. */}
          <div className="mt-6 flex gap-4 overflow-x-auto pb-4">
            {COLUMNS.map((col) => {
              const all = sortColumn(tasks.filter((t) => colOf(t.status) === col.id));
              const colTasks = col.id === 'erledigt' ? all.slice(0, DONE_LIMIT) : all;
              const hidden = all.length - colTasks.length;
              return (
                <div key={col.id} className="min-w-[290px] flex-1">
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <ListTodo className="h-4 w-4" style={{ color: COLORS.textMuted }} />
                    <span className="whitespace-nowrap text-sm font-bold" style={{ color: COLORS.navy }}>{col.label}</span>
                    <Badge tone="muted">{all.length}</Badge>
                  </div>
                  <DropColumn id={col.id}>
                    {colTasks.length === 0 && (
                      <Card className="text-center"><span className="text-xs" style={{ color: COLORS.textMuted }}>Hierher ziehen</span></Card>
                    )}
                    {colTasks.map((t) => (
                      <TaskCard
                        key={t.id}
                        t={t}
                        today={today}
                        employees={employees}
                        empName={empName}
                        onOpen={setSelected}
                        onMove={moveStatus}
                        onRemove={remove}
                        onAssign={(id, v) => patch(id, { assignee_id: v })}
                        onToggleWait={toggleWait}
                      />
                    ))}
                    {hidden > 0 && (
                      <p className="px-1 py-2 text-center text-xs" style={{ color: COLORS.textMuted }}>
                        + {hidden} ältere erledigte Aufgaben (über den Mitarbeiter-Filter weiterhin auffindbar)
                      </p>
                    )}
                  </DropColumn>
                </div>
              );
            })}
          </div>
        </DndContext>
      )}
      {selected && <TaskDrawer task={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </AdminShell>
  );
}
