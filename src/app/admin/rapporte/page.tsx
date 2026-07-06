'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, Card, SectionCard, Button, Field, TextInput, SelectInput, Badge, Spinner, StatCard, COLORS,
} from '@/components/admin/ui';
import {
  FileClock, Hourglass, CheckCircle2, FileText, Trash2, Plus, RotateCcw, Lock, X, Pencil, Check, Users,
} from 'lucide-react';

interface TimeEntry {
  id: string;
  task_id: string;
  employee_id: string | null;
  minutes: number;
  note: string;
  work_date: string;
  report_id: string | null;
  ticket_number: number | null;
  task_title: string;
  employee_name: string | null;
  project_id: string | null;
  project_name: string | null;
  report_number: number | null;
  report_status: 'entwurf' | 'final' | null;
}

interface ProjectLite { id: string; name: string }

interface Stats { open_count: number; open_minutes: number; reported_count: number; reported_minutes: number }

interface Report {
  id: string;
  report_number: number | null;
  title: string;
  period_from: string;
  period_to: string;
  hourly_rate: number | null;
  currency: string;
  status: 'entwurf' | 'final';
  note: string;
  created_at: string;
  finalized_at: string | null;
  entry_count?: number;
  total_minutes?: number;
}

interface EmployeeLite { id: string; name: string }

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')} h`;
}

function fmtMoney(v: number): string {
  return new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function ticketNo(n: number | null | undefined): string {
  return n && n > 0 ? `TASK-${String(n).padStart(5, '0')}` : '';
}

function reportNo(n: number | null | undefined): string {
  return n && n > 0 ? `RAP-${String(n).padStart(4, '0')}` : '';
}

function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  return m ? `${m[3]}.${m[2]}.${m[1]}` : (d || '–');
}

export default function RapportePage() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [employees, setEmployees] = useState<EmployeeLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Filter offene Zeiten
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [employee, setEmployee] = useState('');
  const [project, setProject] = useState('');
  const [projects, setProjects] = useState<ProjectLite[]>([]);

  // Auswahl + Rapport-Anlage
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [rate, setRate] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [creating, setCreating] = useState(false);

  // Rapport-Detail
  const [detail, setDetail] = useState<{ report: Report; entries: TimeEntry[]; total_minutes: number } | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  // Inline-Editor für Zeitbuchungen (Mitarbeiter/Datum/Minuten/Notiz)
  const [edit, setEdit] = useState<{ id: string; minutes: string; note: string; work_date: string; employee_id: string } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Stammdaten-Editor am Rapport-Entwurf (Titel/Stundensatz/Währung)
  const [meta, setMeta] = useState<{ title: string; rate: string; currency: string } | null>(null);
  const [savingMeta, setSavingMeta] = useState(false);

  // Batch-Aktionen auf der Checkbox-Auswahl (Mitarbeiter zuweisen / löschen)
  const [batchEmp, setBatchEmp] = useState('');
  const [batchBusy, setBatchBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const q = new URLSearchParams();
      if (from) q.set('from', from);
      if (to) q.set('to', to);
      if (employee) q.set('employee', employee);
      if (project) q.set('project', project);
      const [re, rr] = await Promise.all([
        fetch(`/api/admin/time-entries?${q}`).then((x) => x.json()),
        fetch('/api/admin/time-reports').then((x) => x.json()),
      ]);
      if (re.success) { setEntries(re.data.entries); setStats(re.data.stats); } else setErr(re.error || 'Fehler');
      if (rr.success) setReports(rr.data);
    } finally {
      setLoading(false);
    }
  }, [from, to, employee, project]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/admin/team').then((r) => r.json()).then((r) => {
      if (r.success) setEmployees(r.data.map((e: EmployeeLite) => ({ id: e.id, name: e.name })));
    }).catch(() => {});
    fetch('/api/admin/projects').then((r) => r.json()).then((r) => {
      if (r.success) setProjects(r.data.map((p: ProjectLite) => ({ id: p.id, name: p.name })));
    }).catch(() => {});
  }, []);

  const openEntries = useMemo(() => entries.filter((e) => !e.report_id), [entries]);
  const selEntries = useMemo(() => openEntries.filter((e) => sel.has(e.id)), [openEntries, sel]);
  const selMinutes = selEntries.reduce((s, e) => s + (e.minutes || 0), 0);
  const allSelected = openEntries.length > 0 && openEntries.every((e) => sel.has(e.id));
  const draftCount = reports.filter((r) => r.status === 'entwurf').length;

  const toggle = (id: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSel(allSelected ? new Set() : new Set(openEntries.map((e) => e.id)));
  };

  const openDetail = useCallback(async (id: string) => {
    setDetailBusy(true);
    try {
      const r = await fetch(`/api/admin/time-reports/${id}`).then((x) => x.json());
      if (r.success) {
        setDetail(r.data);
        setMeta({
          title: r.data.report.title || '',
          rate: r.data.report.hourly_rate != null ? String(r.data.report.hourly_rate) : '',
          currency: r.data.report.currency || 'EUR',
        });
      } else setErr(r.error || 'Fehler');
    } finally {
      setDetailBusy(false);
    }
  }, []);

  const saveMeta = async () => {
    if (!detail || !meta) return;
    setSavingMeta(true);
    try {
      await patchReport(detail.report.id, {
        title: meta.title.trim(),
        hourly_rate: meta.rate.trim() === '' ? null : Number(meta.rate.replace(',', '.')),
        currency: meta.currency,
      });
    } finally {
      setSavingMeta(false);
    }
  };

  const createReport = async () => {
    if (!selEntries.length) return;
    setCreating(true);
    setErr('');
    try {
      const r = await fetch('/api/admin/time-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_ids: selEntries.map((e) => e.id),
          title: title.trim() || undefined,
          hourly_rate: rate.trim() === '' ? null : Number(rate.replace(',', '.')),
          currency,
        }),
      }).then((x) => x.json());
      if (!r.success) { setErr(r.error || 'Fehler beim Erstellen'); return; }
      setSel(new Set());
      setTitle('');
      await load();
      await openDetail(r.data.id);
    } finally {
      setCreating(false);
    }
  };

  const patchReport = async (id: string, body: Record<string, unknown>) => {
    setErr('');
    const r = await fetch(`/api/admin/time-reports/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }).then((x) => x.json());
    if (!r.success) { setErr(r.error || 'Fehler'); return; }
    await load();
    await openDetail(id);
  };

  const removeEntry = async (reportId: string, entryId: string) => {
    setErr('');
    const r = await fetch(`/api/admin/time-reports/${reportId}/entries`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ remove: [entryId] }),
    }).then((x) => x.json());
    if (!r.success) { setErr(r.error || 'Fehler'); return; }
    await load();
    await openDetail(reportId);
  };

  const delReport = async (id: string) => {
    if (!confirm('Rapport löschen? Die enthaltenen Zeiten werden wieder als offen geführt.')) return;
    setErr('');
    const r = await fetch(`/api/admin/time-reports/${id}`, { method: 'DELETE' }).then((x) => x.json());
    if (!r.success) { setErr(r.error || 'Fehler'); return; }
    setDetail(null);
    await load();
  };

  const startEdit = (e: TimeEntry) => {
    setErr('');
    setEdit({ id: e.id, minutes: String(e.minutes), note: e.note || '', work_date: e.work_date || '', employee_id: e.employee_id || '' });
  };

  const saveEdit = async () => {
    if (!edit) return;
    setSavingEdit(true);
    setErr('');
    try {
      const r = await fetch(`/api/admin/time-entries/${edit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minutes: Number(edit.minutes),
          note: edit.note,
          work_date: edit.work_date,
          employee_id: edit.employee_id || null,
        }),
      }).then((x) => x.json());
      if (!r.success) { setErr(r.error || 'Fehler beim Speichern'); return; }
      setEdit(null);
      await load();
      if (detail) await openDetail(detail.report.id);
    } finally {
      setSavingEdit(false);
    }
  };

  /** Editierbare Zellen (Datum/Mitarbeiter/Notiz/Minuten) — für beide Tabellen einzeln einsetzbar. */
  const editCell = edit ? {
    date: (
      <td className="py-2 pr-4">
        <TextInput type="date" value={edit.work_date} onChange={(ev) => setEdit({ ...edit, work_date: ev.target.value })} className="w-36" />
      </td>
    ),
    emp: (
      <td className="py-2 pr-4">
        <SelectInput value={edit.employee_id} onChange={(ev) => setEdit({ ...edit, employee_id: ev.target.value })} className="w-40">
          <option value="">Extern (API)</option>
          {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
        </SelectInput>
      </td>
    ),
    note: (
      <td className="py-2 pr-4">
        <TextInput value={edit.note} onChange={(ev) => setEdit({ ...edit, note: ev.target.value })} placeholder="Tätigkeit" className="w-full min-w-[160px]" />
      </td>
    ),
    minutes: (
      <td className="py-2 text-right">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <TextInput type="number" min={1} value={edit.minutes} onChange={(ev) => setEdit({ ...edit, minutes: ev.target.value })} className="w-20 text-right" />
          <span className="text-xs" style={{ color: COLORS.textMuted }}>min</span>
        </span>
      </td>
    ),
  } : null;

  const editActions = (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Button size="sm" variant="accent" onClick={saveEdit} disabled={savingEdit || !edit || !Number(edit.minutes)} aria-label="Speichern">
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEdit(null)} aria-label="Abbrechen">
        <X className="h-3.5 w-3.5" />
      </Button>
    </span>
  );

  const batchAssign = async () => {
    if (!selEntries.length) return;
    setBatchBusy(true);
    setErr('');
    try {
      const results = await Promise.all(selEntries.map((e) =>
        fetch(`/api/admin/time-entries/${e.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: batchEmp || null }),
        }).then((x) => x.json()).catch(() => ({ success: false }))
      ));
      const failed = results.filter((r) => !r.success).length;
      if (failed) setErr(`${failed} von ${selEntries.length} Einträgen konnten nicht zugewiesen werden`);
      setSel(new Set());
      await load();
    } finally {
      setBatchBusy(false);
    }
  };

  const batchDelete = async () => {
    if (!selEntries.length) return;
    if (!confirm(`${selEntries.length} ${selEntries.length === 1 ? 'Zeiteintrag' : 'Zeiteinträge'} (${fmtMin(selMinutes)}) unwiderruflich löschen?`)) return;
    setBatchBusy(true);
    setErr('');
    try {
      const results = await Promise.all(selEntries.map((e) =>
        fetch(`/api/admin/time-entries/${e.id}`, { method: 'DELETE' })
          .then((x) => x.json()).catch(() => ({ success: false }))
      ));
      const failed = results.filter((r) => !r.success).length;
      if (failed) setErr(`${failed} von ${selEntries.length} Einträgen konnten nicht gelöscht werden`);
      setSel(new Set());
      await load();
    } finally {
      setBatchBusy(false);
    }
  };

  const delEntry = async (e: TimeEntry) => {
    if (!confirm(`Zeiteintrag vom ${fmtDate(e.work_date)} (${fmtMin(e.minutes)}) löschen?`)) return;
    setErr('');
    const r = await fetch(`/api/admin/time-entries/${e.id}`, { method: 'DELETE' }).then((x) => x.json());
    if (!r.success) { setErr(r.error || 'Fehler beim Löschen'); return; }
    setSel((prev) => { const next = new Set(prev); next.delete(e.id); return next; });
    await load();
  };

  const reportAmount = (r: Report): string => {
    if (r.hourly_rate == null || r.total_minutes == null) return '–';
    return `${fmtMoney((r.total_minutes / 60) * r.hourly_rate)} ${r.currency}`;
  };

  return (
    <AdminShell title="Zeit-Rapporte">
      <PageHeader
        title="Zeit-Rapporte"
        description="Auf Tickets gebuchte Zeiten abrechnen: offene Zeiten auswählen → Rapport erstellen → als PDF exportieren. Jede Zeitbuchung ist entweder offen oder genau einem Rapport zugeordnet."
      />

      {/* Übersicht */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<Hourglass className="h-5 w-5" />}
            label="Offen (nicht rapportiert)"
            value={fmtMin(stats.open_minutes)}
            sub={`${stats.open_count} ${stats.open_count === 1 ? 'Eintrag' : 'Einträge'}`}
            tone={stats.open_minutes > 0 ? 'warn' : 'ok'}
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Rapportiert"
            value={fmtMin(stats.reported_minutes)}
            sub={`${stats.reported_count} ${stats.reported_count === 1 ? 'Eintrag' : 'Einträge'}`}
            tone="ok"
          />
          <StatCard
            icon={<FileClock className="h-5 w-5" />}
            label="Rapporte"
            value={String(reports.length)}
            sub={draftCount ? `davon ${draftCount} im Entwurf` : 'alle finalisiert'}
            tone="navy"
          />
        </div>
      )}

      {err && <Card className="mt-6"><span className="text-sm font-semibold" style={{ color: COLORS.danger }}>{err}</span></Card>}

      {/* Offene Zeiten */}
      <SectionCard
        title="Offene Zeiten"
        icon={<Hourglass className="h-4 w-4" />}
        description="Noch nicht rapportierte Zeitbuchungen. Auswählen und daraus einen Rapport erstellen."
        className="mt-6"
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Field label="Von">
            <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </Field>
          <Field label="Bis">
            <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </Field>
          <Field label="Mitarbeiter">
            <SelectInput value={employee} onChange={(e) => setEmployee(e.target.value)} className="w-48">
              <option value="">Alle</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </SelectInput>
          </Field>
          <Field label="Projekt">
            <SelectInput value={project} onChange={(e) => setProject(e.target.value)} className="w-52">
              <option value="">Alle</option>
              <option value="none">Ohne Projekt</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectInput>
          </Field>
          {(from || to || employee || project) && (
            <Button size="sm" variant="ghost" onClick={() => { setFrom(''); setTo(''); setEmployee(''); setProject(''); }}>
              <X className="h-3.5 w-3.5" /> Filter zurücksetzen
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : openEntries.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.textMuted }}>
            Keine offenen Zeiten {from || to || employee || project ? 'im gewählten Filter' : ''} — alles rapportiert. 🎉
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                    <th className="py-2 pr-3">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Alle auswählen" />
                    </th>
                    <th className="py-2 pr-4">Datum</th>
                    <th className="py-2 pr-4">Ticket</th>
                    <th className="py-2 pr-4">Mitarbeiter</th>
                    <th className="py-2 pr-4">Tätigkeit</th>
                    <th className="py-2 text-right">Zeit</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {openEntries.map((e) => {
                    const isEdit = edit?.id === e.id;
                    return (
                      <tr
                        key={e.id}
                        className={`border-t ${isEdit ? '' : 'cursor-pointer'}`}
                        style={{ borderColor: COLORS.stroke, background: isEdit ? '#f0f6ff' : sel.has(e.id) ? '#fff7ed' : undefined }}
                        onClick={isEdit ? undefined : () => toggle(e.id)}
                      >
                        <td className="py-2 pr-3">
                          <input type="checkbox" checked={sel.has(e.id)} onChange={() => toggle(e.id)} onClick={(ev) => ev.stopPropagation()} disabled={isEdit} />
                        </td>
                        {isEdit && editCell ? editCell.date : (
                          <td className="py-2 pr-4 tabular-nums whitespace-nowrap">{fmtDate(e.work_date)}</td>
                        )}
                        <td className="py-2 pr-4">
                          <span className="font-semibold whitespace-nowrap" style={{ color: COLORS.navy }}>{ticketNo(e.ticket_number) || '–'}</span>
                          <span className="ml-2 hidden text-xs sm:inline" style={{ color: COLORS.textMuted }}>{e.task_title}</span>
                          {e.project_name && <div className="text-[11px] font-medium" style={{ color: COLORS.accent }}>🗂 {e.project_name}</div>}
                        </td>
                        {isEdit && editCell ? editCell.emp : (
                          <td className="py-2 pr-4 whitespace-nowrap">{e.employee_name || <span style={{ color: COLORS.textMuted }}>Extern (API)</span>}</td>
                        )}
                        {isEdit && editCell ? editCell.note : (
                          <td className="py-2 pr-4 text-xs" style={{ color: COLORS.textMuted }}>{e.note || '–'}</td>
                        )}
                        {isEdit && editCell ? editCell.minutes : (
                          <td className="py-2 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color: COLORS.navy }}>{fmtMin(e.minutes)}</td>
                        )}
                        <td className="py-2 pl-2 text-right whitespace-nowrap">
                          {isEdit ? editActions : (
                            <span className="inline-flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={(ev) => { ev.stopPropagation(); startEdit(e); }} aria-label="Bearbeiten">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={(ev) => { ev.stopPropagation(); delEntry(e); }} aria-label="Löschen">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Rapport erstellen */}
            <div className="mt-4 rounded-xl border p-4" style={{ borderColor: COLORS.stroke, background: '#fafbfc' }}>
              <div className="mb-3 text-sm font-bold" style={{ color: COLORS.navy }}>
                {sel.size > 0
                  ? `${sel.size} ${sel.size === 1 ? 'Eintrag' : 'Einträge'} · ${fmtMin(selMinutes)} ausgewählt`
                  : 'Einträge auswählen, um einen Rapport zu erstellen'}
              </div>
              {sel.size > 0 && (
                <div className="mb-3 flex flex-wrap items-end gap-3 border-b pb-3" style={{ borderColor: COLORS.stroke }}>
                  <Field label="Mitarbeiter für Auswahl setzen">
                    <SelectInput value={batchEmp} onChange={(e) => setBatchEmp(e.target.value)} className="w-48">
                      <option value="">Extern (API)</option>
                      {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </SelectInput>
                  </Field>
                  <Button size="sm" variant="secondary" onClick={batchAssign} disabled={batchBusy}>
                    {batchBusy ? <Spinner className="h-4 w-4" /> : <Users className="h-4 w-4" />} Zuweisen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={batchDelete} disabled={batchBusy}>
                    <Trash2 className="h-4 w-4" /> Auswahl löschen
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Titel (optional)">
                  <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Entwicklung Juni 2026" className="w-64" />
                </Field>
                <Field label="Stundensatz (optional)">
                  <TextInput type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="—" className="w-32" />
                </Field>
                <Field label="Währung">
                  <SelectInput value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-28">
                    <option value="EUR">EUR</option>
                    <option value="CHF">CHF</option>
                  </SelectInput>
                </Field>
                <Button variant="accent" onClick={createReport} disabled={creating || sel.size === 0}>
                  {creating ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Rapport erstellen
                </Button>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      {/* Rapporte */}
      <SectionCard
        title="Rapporte"
        icon={<FileClock className="h-4 w-4" />}
        description="Entwürfe können geändert oder gelöscht werden; finalisierte Rapporte sind gesperrt."
        className="mt-6"
      >
        {reports.length === 0 ? (
          <p className="text-sm" style={{ color: COLORS.textMuted }}>Noch keine Rapporte erstellt.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                  <th className="py-2 pr-4">Nr.</th>
                  <th className="py-2 pr-4">Titel</th>
                  <th className="py-2 pr-4">Zeitraum</th>
                  <th className="py-2 pr-4 text-right">Einträge</th>
                  <th className="py-2 pr-4 text-right">Zeit</th>
                  <th className="py-2 pr-4 text-right">Betrag</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-t transition-colors hover:bg-slate-50"
                    style={{ borderColor: COLORS.stroke, background: detail?.report.id === r.id ? '#f0f6ff' : undefined }}
                    onClick={() => openDetail(r.id)}
                  >
                    <td className="py-2 pr-4 font-bold whitespace-nowrap" style={{ color: COLORS.navy }}>{reportNo(r.report_number)}</td>
                    <td className="py-2 pr-4">{r.title}</td>
                    <td className="py-2 pr-4 tabular-nums whitespace-nowrap">{r.period_from ? `${fmtDate(r.period_from)} – ${fmtDate(r.period_to)}` : '–'}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{r.entry_count ?? '–'}</td>
                    <td className="py-2 pr-4 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color: COLORS.navy }}>{fmtMin(r.total_minutes || 0)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums whitespace-nowrap">{reportAmount(r)}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={r.status === 'final' ? 'ok' : 'warn'}>{r.status === 'final' ? 'Final' : 'Entwurf'}</Badge>
                    </td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <a
                        href={`/api/admin/time-reports/${r.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(ev) => ev.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
                        style={{ color: COLORS.accent }}
                      >
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Rapport-Detail */}
      {(detail || detailBusy) && (
        <SectionCard
          title={detail ? `${reportNo(detail.report.report_number)} – ${detail.report.title}` : 'Rapport'}
          icon={detail?.report.status === 'final' ? <Lock className="h-4 w-4" /> : <FileClock className="h-4 w-4" />}
          className="mt-6"
          actions={detail ? (
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/api/admin/time-reports/${detail.report.id}/pdf`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary"><FileText className="h-4 w-4" /> PDF</Button>
              </a>
              {detail.report.status === 'entwurf' ? (
                <>
                  <Button size="sm" variant="accent" onClick={() => patchReport(detail.report.id, { status: 'final' })}>
                    <CheckCircle2 className="h-4 w-4" /> Finalisieren
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => delReport(detail.report.id)}>
                    <Trash2 className="h-4 w-4" /> Löschen
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => patchReport(detail.report.id, { status: 'entwurf' })}>
                  <RotateCcw className="h-4 w-4" /> Auf Entwurf zurücksetzen
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setDetail(null)} aria-label="Schließen"><X className="h-4 w-4" /></Button>
            </div>
          ) : undefined}
        >
          {!detail ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-x-8 gap-y-1 text-sm">
                <span><span style={{ color: COLORS.textMuted }}>Zeitraum:</span> <strong>{detail.report.period_from ? `${fmtDate(detail.report.period_from)} – ${fmtDate(detail.report.period_to)}` : '–'}</strong></span>
                <span><span style={{ color: COLORS.textMuted }}>Gesamtzeit:</span> <strong style={{ color: COLORS.navy }}>{fmtMin(detail.total_minutes)}</strong></span>
                {detail.report.hourly_rate != null && (
                  <span><span style={{ color: COLORS.textMuted }}>Betrag ({fmtMoney(detail.report.hourly_rate)} {detail.report.currency}/h):</span>{' '}
                    <strong style={{ color: COLORS.accent }}>{fmtMoney((detail.total_minutes / 60) * detail.report.hourly_rate)} {detail.report.currency}</strong>
                  </span>
                )}
                <span>
                  <Badge tone={detail.report.status === 'final' ? 'ok' : 'warn'}>
                    {detail.report.status === 'final' ? `Finalisiert${detail.report.finalized_at ? ` am ${fmtDate(detail.report.finalized_at)}` : ''}` : 'Entwurf'}
                  </Badge>
                </span>
              </div>

              {/* Stammdaten (nur Entwurf änderbar) */}
              {detail.report.status === 'entwurf' && meta && (
                <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border p-3" style={{ borderColor: COLORS.stroke, background: '#fafbfc' }}>
                  <Field label="Titel">
                    <TextInput value={meta.title} onChange={(ev) => setMeta({ ...meta, title: ev.target.value })} className="w-64" />
                  </Field>
                  <Field label="Stundensatz (leer = ohne)">
                    <TextInput type="number" min={0} step="0.01" value={meta.rate} onChange={(ev) => setMeta({ ...meta, rate: ev.target.value })} className="w-32" />
                  </Field>
                  <Field label="Währung">
                    <SelectInput value={meta.currency} onChange={(ev) => setMeta({ ...meta, currency: ev.target.value })} className="w-28">
                      {!['EUR', 'CHF'].includes(meta.currency) && <option value={meta.currency}>{meta.currency}</option>}
                      <option value="EUR">EUR</option>
                      <option value="CHF">CHF</option>
                    </SelectInput>
                  </Field>
                  <Button size="sm" variant="secondary" onClick={saveMeta} disabled={savingMeta}>
                    {savingMeta ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />} Stammdaten speichern
                  </Button>
                </div>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                    <th className="py-2 pr-4">Datum</th>
                    <th className="py-2 pr-4">Ticket</th>
                    <th className="py-2 pr-4">Mitarbeiter</th>
                    <th className="py-2 pr-4">Tätigkeit</th>
                    <th className="py-2 text-right">Zeit</th>
                    {detail.report.status === 'entwurf' && <th className="py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {detail.entries.map((e) => {
                    const isEdit = detail.report.status === 'entwurf' && edit?.id === e.id;
                    return (
                      <tr key={e.id} className="border-t" style={{ borderColor: COLORS.stroke, background: isEdit ? '#f0f6ff' : undefined }}>
                        {isEdit && editCell ? editCell.date : (
                          <td className="py-2 pr-4 tabular-nums whitespace-nowrap">{fmtDate(e.work_date)}</td>
                        )}
                        <td className="py-2 pr-4">
                          <span className="font-semibold whitespace-nowrap" style={{ color: COLORS.navy }}>{ticketNo(e.ticket_number) || '–'}</span>
                          <span className="ml-2 hidden text-xs sm:inline" style={{ color: COLORS.textMuted }}>{e.task_title}</span>
                          {e.project_name && <div className="text-[11px] font-medium" style={{ color: COLORS.accent }}>🗂 {e.project_name}</div>}
                        </td>
                        {isEdit && editCell ? editCell.emp : (
                          <td className="py-2 pr-4 whitespace-nowrap">{e.employee_name || <span style={{ color: COLORS.textMuted }}>Extern (API)</span>}</td>
                        )}
                        {isEdit && editCell ? editCell.note : (
                          <td className="py-2 pr-4 text-xs" style={{ color: COLORS.textMuted }}>{e.note || '–'}</td>
                        )}
                        {isEdit && editCell ? editCell.minutes : (
                          <td className="py-2 text-right font-semibold tabular-nums whitespace-nowrap" style={{ color: COLORS.navy }}>{fmtMin(e.minutes)}</td>
                        )}
                        {detail.report.status === 'entwurf' && (
                          <td className="py-2 pl-2 text-right whitespace-nowrap">
                            {isEdit ? editActions : (
                              <span className="inline-flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => startEdit(e)} aria-label="Bearbeiten">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => removeEntry(detail.report.id, e.id)} aria-label="Aus Rapport entfernen">
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </SectionCard>
      )}
    </AdminShell>
  );
}
