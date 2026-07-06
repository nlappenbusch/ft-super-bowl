'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import TaskDrawer from '@/components/admin/TaskDrawer';
import { Card, Spinner, COLORS } from '@/components/admin/ui';
import { ArrowLeft } from 'lucide-react';

type TaskStatus = 'offen' | 'in_arbeit' | 'warten_requester' | 'warten_dritte' | 'erledigt';

interface Task {
  id: string;
  ticket_number?: number | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'niedrig' | 'normal' | 'hoch';
  due_date: string | null;
  assignee_id?: string | null;
  booking_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  project_id?: string | null;
  project_name?: string | null;
}

/** Ticket-Vollansicht: /admin/aufgaben/[id] — großes, zweispaltiges Arbeits-Layout. */
export default function TicketPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [task, setTask] = useState<Task | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await fetch(`/api/admin/tasks/${id}`).then((x) => x.json());
      if (r.success) { setTask(r.data); setErr(''); }
      else setErr(r.error || 'Ticket nicht gefunden');
    } catch {
      setErr('Ticket konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  return (
    <AdminShell title="Ticket" wide>
      <div className="mb-4">
        <Link href="/admin/aufgaben" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline" style={{ color: COLORS.textMuted }}>
          <ArrowLeft className="h-4 w-4" /> Zurück zum Aufgaben-Board
        </Link>
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : err || !task ? (
        <Card><span className="text-sm font-semibold" style={{ color: COLORS.danger }}>{err || 'Ticket nicht gefunden'}</span></Card>
      ) : (
        <TaskDrawer task={task} variant="page" onClose={() => {}} onChanged={load} />
      )}
    </AdminShell>
  );
}
