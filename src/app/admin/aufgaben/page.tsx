'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, Card, SectionCard, Button, Field, TextInput, SelectInput, TextArea, Badge, Spinner, COLORS,
} from '@/components/admin/ui';
import { Plus, Trash2, ChevronRight, ChevronLeft, ListTodo, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import TaskDrawer from '@/components/admin/TaskDrawer';

interface StaffTask {
  id: string;
  title: string;
  description: string;
  assignee_id: string | null;
  booking_id: string | null;
  due_date: string | null;
  priority: 'niedrig' | 'normal' | 'hoch';
  status: 'offen' | 'in_arbeit' | 'erledigt';
  created_by: string | null;
}

interface EmployeeLite { id: string; name: string }

const COLUMNS: Array<{ id: StaffTask['status']; label: string }> = [
  { id: 'offen', label: 'Offen' },
  { id: 'in_arbeit', label: 'In Arbeit' },
  { id: 'erledigt', label: 'Erledigt' },
];

const PRIO_TONE = { niedrig: 'muted', normal: 'info', hoch: 'danger' } as const;

export default function AufgabenPage() {
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [form, setForm] = useState({ title: '', description: '', assignee_id: '', due_date: '', priority: 'normal' });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<StaffTask | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = filterAssignee ? `?assignee=${encodeURIComponent(filterAssignee)}` : '';
      const r = await fetch(`/api/admin/tasks${q}`).then((x) => x.json());
      if (r.success) setTasks(r.data);
    } finally {
      setLoading(false);
    }
  }, [filterAssignee]);

  useEffect(() => {
    fetch('/api/admin/team').then((r) => r.json()).then((r) => {
      if (r.success) setEmployees(r.data.map((e: EmployeeLite) => ({ id: e.id, name: e.name })));
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

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
        }),
      });
      setForm({ title: '', description: '', assignee_id: '', due_date: '', priority: 'normal' });
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

  const moveStatus = (t: StaffTask, dir: 1 | -1) => {
    const idx = COLUMNS.findIndex((c) => c.id === t.status);
    const next = COLUMNS[idx + dir];
    if (next) patch(t.id, { status: next.id });
  };

  // Drag & Drop: Karte in die Ziel-Spalte verschieben (optimistisch + persistiert)
  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    const newStatus = destination.droppableId as StaffTask['status'];
    setTasks((prev) => prev.map((t) => (t.id === draggableId ? { ...t, status: newStatus } : t)));
    fetch(`/api/admin/tasks/${draggableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => load());
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AdminShell title="Aufgaben">
      <PageHeader
        title="Aufgaben"
        description="Interne Tasks – per Drag & Drop verschieben, zuweisen, mit Fälligkeit und Priorität."
        actions={
          <SelectInput value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="w-48">
            <option value="">Alle Mitarbeiter</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </SelectInput>
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
          <Field label="Beschreibung" className="sm:col-span-3">
            <TextArea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {COLUMNS.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col.id);
              return (
                <div key={col.id}>
                  <div className="mb-2 flex items-center gap-2 px-1">
                    <ListTodo className="h-4 w-4" style={{ color: COLORS.textMuted }} />
                    <span className="text-sm font-bold" style={{ color: COLORS.navy }}>{col.label}</span>
                    <Badge tone="muted">{colTasks.length}</Badge>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(dropProvided, dropSnapshot) => (
                      <div
                        ref={dropProvided.innerRef}
                        {...dropProvided.droppableProps}
                        className="min-h-[60px] space-y-3 rounded-xl p-1 transition-colors"
                        style={{ background: dropSnapshot.isDraggingOver ? COLORS.surfaceMuted : 'transparent' }}
                      >
                        {colTasks.length === 0 && !dropSnapshot.isDraggingOver && (
                          <Card className="text-center"><span className="text-xs" style={{ color: COLORS.textMuted }}>Hierher ziehen</span></Card>
                        )}
                        {colTasks.map((t, idx) => (
                          <Draggable key={t.id} draggableId={t.id} index={idx}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                style={{
                                  ...dragProvided.draggableProps.style,
                                  boxShadow: dragSnapshot.isDragging ? '0 10px 24px rgba(20,48,71,0.18)' : undefined,
                                }}
                              >
                                <Card>
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex min-w-0 items-start gap-2">
                                      <span
                                        {...dragProvided.dragHandleProps}
                                        className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing"
                                        title="Ziehen, um zu verschieben"
                                      >
                                        <GripVertical className="h-4 w-4" style={{ color: COLORS.textMuted }} />
                                      </span>
                                      <div className="min-w-0 cursor-pointer" onClick={() => setSelected(t)} title="Details öffnen">
                                        <div className="font-semibold" style={{ color: COLORS.navy }}>{t.title}</div>
                                        {t.description && <p className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>{t.description}</p>}
                                      </div>
                                    </div>
                                    <Badge tone={PRIO_TONE[t.priority]}>{t.priority}</Badge>
                                  </div>
                                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: COLORS.textMuted }}>
                                    <span>👤 {empName(t.assignee_id)}</span>
                                    {t.due_date && (
                                      <span style={{ color: t.due_date < today && t.status !== 'erledigt' ? COLORS.danger : undefined }}>
                                        📅 {t.due_date}
                                      </span>
                                    )}
                                    {t.booking_id && (
                                      <Link href={`/admin/crm?booking=${t.booking_id}`} className="underline" style={{ color: COLORS.accent }}>
                                        Anfrage öffnen
                                      </Link>
                                    )}
                                  </div>
                                  <div className="mt-3 flex items-center justify-between border-t pt-2" style={{ borderColor: COLORS.stroke }}>
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" onClick={() => moveStatus(t, -1)} disabled={t.status === 'offen'} title="Zurück">
                                        <ChevronLeft className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => moveStatus(t, 1)} disabled={t.status === 'erledigt'} title="Weiter">
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <SelectInput
                                        value={t.assignee_id || ''}
                                        onChange={(e) => patch(t.id, { assignee_id: e.target.value || null })}
                                        className="!w-32 !py-1 !text-xs"
                                      >
                                        <option value="">Niemand</option>
                                        {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                                      </SelectInput>
                                      <Button size="sm" variant="ghost" onClick={() => remove(t.id)} title="Löschen">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {dropProvided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}
      {selected && <TaskDrawer task={selected} onClose={() => setSelected(null)} onChanged={load} />}
    </AdminShell>
  );
}
