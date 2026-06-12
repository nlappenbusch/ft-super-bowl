'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, Card, SectionCard, Button, Field, TextInput, SelectInput, Badge, Spinner, StatCard, COLORS,
} from '@/components/admin/ui';
import { Timer, Play, Square, Plus, Trash2, Target, Hourglass, Scale } from 'lucide-react';

interface TimeEntry {
  id: string;
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  break_minutes: number;
  source: 'stamp' | 'manual';
  note: string;
}

interface Summary {
  employee: { id: string; name: string };
  month: string;
  running: TimeEntry | null;
  target_hours: number;
  actual_hours: number;
  balance: number;
  entries: TimeEntry[];
}

interface EmployeeLite { id: string; name: string }

function entryHours(e: TimeEntry): number {
  if (!e.end_time) return 0;
  const [sh, sm] = e.start_time.split(':').map(Number);
  const [eh, em] = e.end_time.split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm) - (e.break_minutes || 0)) / 60;
}

function fmtH(h: number): string {
  return `${h.toFixed(2)} h`;
}

export default function ZeitPage() {
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [selected, setSelected] = useState<string>(''); // '' = eigener Account
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [breakMin, setBreakMin] = useState('0');
  const [stamping, setStamping] = useState(false);

  // Manueller Eintrag
  const [manual, setManual] = useState({ date: '', start_time: '', end_time: '', break_minutes: '0', note: '' });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const q = new URLSearchParams({ month });
      if (selected) q.set('employee', selected);
      const r = await fetch(`/api/admin/time?${q}`).then((x) => x.json());
      if (r.success) setSummary(r.data);
      else { setSummary(null); setErr(r.error || 'Fehler'); }
    } finally {
      setLoading(false);
    }
  }, [month, selected]);

  useEffect(() => {
    fetch('/api/admin/team').then((r) => r.json()).then((r) => {
      if (r.success) setEmployees(r.data.map((e: EmployeeLite) => ({ id: e.id, name: e.name })));
    }).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const stamp = async (action: 'in' | 'out') => {
    setStamping(true);
    try {
      await fetch('/api/admin/time/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, break_minutes: parseInt(breakMin, 10) || 0 }),
      });
      await load();
    } finally {
      setStamping(false);
    }
  };

  const addManual = async () => {
    if (!manual.date || !manual.start_time || !manual.end_time) return;
    setAdding(true);
    try {
      await fetch('/api/admin/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: selected || undefined,
          date: manual.date,
          start_time: manual.start_time,
          end_time: manual.end_time,
          break_minutes: parseInt(manual.break_minutes, 10) || 0,
          note: manual.note,
        }),
      });
      setManual({ date: '', start_time: '', end_time: '', break_minutes: '0', note: '' });
      await load();
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Eintrag löschen?')) return;
    await fetch(`/api/admin/time/${id}`, { method: 'DELETE' });
    await load();
  };

  const running = summary?.running || null;

  return (
    <AdminShell title="Zeiterfassung">
      <PageHeader
        title="Zeiterfassung"
        description="Stempeluhr und manuelle Erfassung. Soll-Zeiten basieren auf dem Wochenplan abzüglich der Feiertage des Kantons Zürich."
        actions={
          <div className="flex items-center gap-2">
            <SelectInput value={selected} onChange={(e) => setSelected(e.target.value)} className="w-48">
              <option value="">Mein Konto</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </SelectInput>
            <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          </div>
        }
      />

      {/* Stempeluhr (immer eigener Account) */}
      <SectionCard title="Stempeluhr" icon={<Timer className="h-4 w-4" />} description="Gilt immer für dein eigenes Konto.">
        <div className="flex flex-wrap items-center gap-3">
          {running ? (
            <>
              <Badge tone="ok">Eingestempelt seit {running.start_time} ({running.date})</Badge>
              <Field label="Pause (Minuten)">
                <TextInput type="number" min="0" value={breakMin} onChange={(e) => setBreakMin(e.target.value)} className="w-28" />
              </Field>
              <Button variant="accent" onClick={() => stamp('out')} disabled={stamping}>
                <Square className="h-4 w-4" /> Ausstempeln
              </Button>
            </>
          ) : (
            <Button variant="accent" onClick={() => stamp('in')} disabled={stamping}>
              <Play className="h-4 w-4" /> Einstempeln
            </Button>
          )}
        </div>
      </SectionCard>

      {err && <Card className="mt-6"><span className="text-sm" style={{ color: COLORS.danger }}>{err}</span></Card>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : summary && (
        <>
          {/* Monatsbilanz */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatCard icon={<Target className="h-5 w-5" />} label="Soll (bis heute)" value={fmtH(summary.target_hours)} tone="navy" />
            <StatCard icon={<Hourglass className="h-5 w-5" />} label="Ist" value={fmtH(summary.actual_hours)} tone="navy" />
            <StatCard
              icon={<Scale className="h-5 w-5" />}
              label="Saldo"
              value={`${summary.balance >= 0 ? '+' : ''}${fmtH(summary.balance)}`}
              tone={summary.balance >= 0 ? 'ok' : 'danger'}
            />
          </div>

          {/* Einträge */}
          <SectionCard title={`Einträge ${summary.month} – ${summary.employee.name}`} className="mt-6">
            {summary.entries.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.textMuted }}>Keine Einträge in diesem Monat.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                    <th className="py-2 pr-4">Datum</th>
                    <th className="py-2 pr-4">Von</th>
                    <th className="py-2 pr-4">Bis</th>
                    <th className="py-2 pr-4">Pause</th>
                    <th className="py-2 pr-4">Stunden</th>
                    <th className="py-2 pr-4">Quelle</th>
                    <th className="py-2 pr-4">Notiz</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {summary.entries.map((e) => (
                    <tr key={e.id} className="border-t" style={{ borderColor: COLORS.stroke }}>
                      <td className="py-2 pr-4">{e.date}</td>
                      <td className="py-2 pr-4">{e.start_time}</td>
                      <td className="py-2 pr-4">{e.end_time || <Badge tone="ok">läuft</Badge>}</td>
                      <td className="py-2 pr-4">{e.break_minutes} min</td>
                      <td className="py-2 pr-4 font-semibold" style={{ color: COLORS.navy }}>{e.end_time ? fmtH(entryHours(e)) : '–'}</td>
                      <td className="py-2 pr-4">
                        <Badge tone={e.source === 'stamp' ? 'info' : 'muted'}>{e.source === 'stamp' ? 'Stempel' : 'manuell'}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-xs" style={{ color: COLORS.textMuted }}>{e.note}</td>
                      <td className="py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => remove(e.id)} aria-label="Löschen">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SectionCard>

          {/* Manuell nacherfassen */}
          <SectionCard title="Manuell nacherfassen" icon={<Plus className="h-4 w-4" />} className="mt-6">
            <div className="grid gap-3 sm:grid-cols-5">
              <Field label="Datum">
                <TextInput type="date" value={manual.date} onChange={(e) => setManual({ ...manual, date: e.target.value })} />
              </Field>
              <Field label="Von">
                <TextInput type="time" value={manual.start_time} onChange={(e) => setManual({ ...manual, start_time: e.target.value })} />
              </Field>
              <Field label="Bis">
                <TextInput type="time" value={manual.end_time} onChange={(e) => setManual({ ...manual, end_time: e.target.value })} />
              </Field>
              <Field label="Pause (min)">
                <TextInput type="number" min="0" value={manual.break_minutes} onChange={(e) => setManual({ ...manual, break_minutes: e.target.value })} />
              </Field>
              <Field label="Notiz">
                <TextInput value={manual.note} onChange={(e) => setManual({ ...manual, note: e.target.value })} />
              </Field>
            </div>
            <div className="mt-3">
              <Button variant="primary" onClick={addManual} disabled={adding || !manual.date || !manual.start_time || !manual.end_time}>
                {adding ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Eintrag speichern
              </Button>
            </div>
          </SectionCard>
        </>
      )}
    </AdminShell>
  );
}
