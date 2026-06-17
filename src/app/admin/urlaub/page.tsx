'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, SectionCard, Button, Field, TextInput, SelectInput, Badge, Spinner, COLORS,
} from '@/components/admin/ui';
import { Palmtree, Plus, Check, X, Trash2, CalendarRange, AlertTriangle } from 'lucide-react';

interface Holiday { date: string; name: string }

interface Vacation {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  days: number;
  type: 'urlaub' | 'krankheit' | 'kompensation' | 'sonstiges';
  status: 'beantragt' | 'genehmigt' | 'abgelehnt';
  comment: string;
}

interface Balance { entitlement: number; carryover: number; used: number; pending: number; sickDays: number; remaining: number }

interface PlannerEmployee {
  id: string;
  name: string;
  balance: Balance;
  vacations: Vacation[];
}

interface Planner {
  year: number;
  holidays: Holiday[];
  employees: PlannerEmployee[];
}

const TYPE_LABEL: Record<Vacation['type'], string> = {
  urlaub: 'Urlaub', krankheit: 'Krankheit', kompensation: 'Kompensation', sonstiges: 'Sonstiges',
};

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const DAY_W = 7;          // px pro Tag im Planer
const LABEL_W = 152;      // px für die Namensspalte
const todayIso = new Date().toISOString().slice(0, 10);

function isoDaysOfYear(year: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(year, 0, 1));
  while (d.getUTCFullYear() === year) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export default function UrlaubPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ employee_id: '', start_date: '', end_date: '', type: 'urlaub', comment: '', half_day: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/vacation?year=${year}`).then((x) => x.json());
      if (r.success) setPlanner(r.data);
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const singleDay = !!form.start_date && form.start_date === form.end_date;

  // Überschneidung mit bestehenden Anträgen des gewählten Mitarbeiters?
  const overlap = useMemo(() => {
    if (!planner || !form.employee_id || !form.start_date || !form.end_date) return null;
    const emp = planner.employees.find((e) => e.id === form.employee_id);
    if (!emp) return null;
    return emp.vacations.find((v) => v.status !== 'abgelehnt' && v.start_date <= form.end_date && v.end_date >= form.start_date) || null;
  }, [planner, form.employee_id, form.start_date, form.end_date]);

  const submit = async () => {
    if (!form.start_date || !form.end_date) return;
    if (overlap && !confirm(`Überschneidung mit ${TYPE_LABEL[overlap.type]} (${overlap.start_date}–${overlap.end_date}). Trotzdem erfassen?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/vacation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, half_day: singleDay && form.half_day, employee_id: form.employee_id || undefined }),
      }).then((x) => x.json());
      if (!res.success) {
        setError(res.error?.includes('erforderlich') || res.error?.includes('Mitarbeiter')
          ? 'Kein eigenes Mitarbeiterprofil (lokaler Admin) – bitte oben einen Mitarbeiter auswählen.'
          : (res.error || 'Speichern fehlgeschlagen.'));
        return;
      }
      setForm({ employee_id: '', start_date: '', end_date: '', type: 'urlaub', comment: '', half_day: false });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, status: 'genehmigt' | 'abgelehnt') => {
    await fetch(`/api/admin/vacation/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm('Antrag löschen?')) return;
    await fetch(`/api/admin/vacation/${id}`, { method: 'DELETE' });
    await load();
  };

  const pickDay = (employeeId: string, iso: string) => {
    setForm((f) => ({ ...f, employee_id: employeeId, start_date: iso, end_date: iso }));
    setError(null);
    if (typeof document !== 'undefined') document.getElementById('absence-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const days = useMemo(() => isoDaysOfYear(year), [year]);
  const holidaySet = useMemo(() => new Map((planner?.holidays || []).map((h) => [h.date, h.name])), [planner]);

  const dayColor = (emp: PlannerEmployee, iso: string): { bg: string; label?: string; half?: boolean } => {
    const hol = holidaySet.get(iso);
    if (hol) return { bg: COLORS.navy, label: hol };
    const v = emp.vacations.find((x) => x.status !== 'abgelehnt' && x.start_date <= iso && x.end_date >= iso);
    if (v) {
      const half = v.days === 0.5;
      if (v.status === 'beantragt') return { bg: '#fbbf24', label: `${TYPE_LABEL[v.type]} (beantragt)${half ? ', ½ Tag' : ''}`, half };
      if (v.type === 'krankheit') return { bg: '#ef4444', label: 'Krankheit', half };
      if (v.type === 'urlaub') return { bg: COLORS.accent, label: `Urlaub${half ? ' (½ Tag)' : ''}`, half };
      return { bg: '#8b5cf6', label: TYPE_LABEL[v.type], half };
    }
    const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) return { bg: '#e5e7eb' };
    return { bg: '#f6f8fa' };
  };

  const allRequests: Array<Vacation & { employeeName: string }> = useMemo(() => {
    if (!planner) return [];
    return planner.employees
      .flatMap((e) => e.vacations.map((v) => ({ ...v, employeeName: e.name })))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [planner]);

  const totalWidth = LABEL_W + days.length * DAY_W;

  return (
    <AdminShell title="Urlaub">
      <PageHeader
        title="Urlaubsplanung"
        description="Gemeinsamer Jahresplaner. Verbrauch in Arbeitstagen – Feiertage (Kanton Zürich) und Wochenenden zählen nicht. Klick auf einen Tag, um eine Abwesenheit zu erfassen."
        actions={
          <SelectInput value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="w-28">
            {[year - 1, year, year + 1, year + 2].filter((v, i, a) => a.indexOf(v) === i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </SelectInput>
        }
      />

      {loading || !planner ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {/* Jahresplaner */}
          <SectionCard
            title={`Teamplaner ${year}`}
            icon={<CalendarRange className="h-4 w-4" />}
            description="Orange = Urlaub · Gelb = beantragt · Rot = Krankheit/Feiertag · Dunkelblau = Feiertag (ZH) · Grau = Wochenende · rote Linie = heute"
          >
            {planner.employees.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.textMuted }}>Noch keine aktiven Mitarbeiter. Lege sie unter „Team“ an.</p>
            ) : (
              <div className="overflow-x-auto pb-2">
                <div style={{ minWidth: totalWidth }}>
                  {/* Monats-Skala */}
                  <div className="mb-1 flex" style={{ paddingLeft: LABEL_W }}>
                    {MONTHS.map((m, i) => {
                      const daysInMonth = new Date(Date.UTC(year, i + 1, 0)).getUTCDate();
                      return (
                        <div
                          key={m}
                          className="text-[10px] font-bold uppercase"
                          style={{ width: daysInMonth * DAY_W, color: COLORS.textMuted, boxShadow: 'inset 1px 0 0 #e5e7eb', paddingLeft: 3 }}
                        >
                          {m}
                        </div>
                      );
                    })}
                  </div>
                  {planner.employees.map((emp) => (
                    <div key={emp.id} className="mb-1.5 flex items-center">
                      <div className="shrink-0 pr-3 text-right" style={{ width: LABEL_W }}>
                        <div className="truncate text-xs font-semibold" style={{ color: COLORS.navy }}>{emp.name}</div>
                        <div className="text-[10px]" style={{ color: COLORS.textMuted }}>
                          {emp.balance.remaining} / {emp.balance.entitlement + emp.balance.carryover} übrig
                        </div>
                      </div>
                      <div className="flex h-6 overflow-hidden rounded-md" style={{ width: days.length * DAY_W }}>
                        {days.map((iso) => {
                          const c = dayColor(emp, iso);
                          const isMonthStart = iso.endsWith('-01');
                          const isToday = iso === todayIso;
                          return (
                            <div
                              key={iso}
                              onClick={() => pickDay(emp.id, iso)}
                              title={c.label ? `${iso}: ${c.label}` : iso}
                              style={{
                                width: DAY_W,
                                background: c.half ? `linear-gradient(135deg, ${c.bg} 50%, #f6f8fa 50%)` : c.bg,
                                cursor: 'pointer',
                                boxShadow: isToday
                                  ? 'inset 2px 0 0 #ef4444'
                                  : isMonthStart ? 'inset 1px 0 0 #cbd5e1' : undefined,
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>

          {/* Salden je Mitarbeiter */}
          <SectionCard title={`Salden ${year}`} className="mt-6">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {planner.employees.map((e) => (
                <div key={e.id} className="rounded-xl border px-3 py-2.5" style={{ borderColor: COLORS.stroke }}>
                  <div className="text-sm font-semibold" style={{ color: COLORS.navy }}>{e.name}</div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: COLORS.textMuted }}>
                    <span><b style={{ color: COLORS.navy }}>{e.balance.remaining}</b> übrig</span>
                    <span>Anspruch {e.balance.entitlement}</span>
                    {e.balance.carryover > 0 && <span>Übertrag +{e.balance.carryover}</span>}
                    <span>genommen {e.balance.used}</span>
                    {e.balance.pending > 0 && <span style={{ color: '#b45309' }}>offen {e.balance.pending}</span>}
                    {e.balance.sickDays > 0 && <span style={{ color: '#b91c1c' }}>krank {e.balance.sickDays}</span>}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Antrag erfassen */}
          <SectionCard title="Abwesenheit erfassen" icon={<Plus className="h-4 w-4" />} className="mt-6">
            <div id="absence-form" className="grid gap-3 sm:grid-cols-5">
              <Field label="Mitarbeiter">
                <SelectInput value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                  <option value="">Mein Konto</option>
                  {planner.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </SelectInput>
              </Field>
              <Field label="Von">
                <TextInput type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: form.end_date && form.end_date >= e.target.value ? form.end_date : e.target.value })} />
              </Field>
              <Field label="Bis">
                <TextInput type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Field>
              <Field label="Typ">
                <SelectInput value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="urlaub">Urlaub</option>
                  <option value="krankheit">Krankheit</option>
                  <option value="kompensation">Kompensation</option>
                  <option value="sonstiges">Sonstiges</option>
                </SelectInput>
              </Field>
              <Field label="Kommentar">
                <TextInput value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className={`flex items-center gap-2 text-sm ${singleDay ? '' : 'opacity-40'}`} title={singleDay ? '' : 'Nur für einen einzelnen Tag möglich'}>
                <input
                  type="checkbox"
                  checked={singleDay && form.half_day}
                  disabled={!singleDay}
                  onChange={(e) => setForm({ ...form, half_day: e.target.checked })}
                />
                Halber Tag (0,5)
              </label>
              <Button variant="accent" onClick={submit} disabled={saving || !form.start_date || !form.end_date}>
                {saving ? <Spinner className="h-4 w-4" /> : <Palmtree className="h-4 w-4" />} Antrag erfassen
              </Button>
            </div>

            {overlap && (
              <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Überschneidung mit {TYPE_LABEL[overlap.type]} ({overlap.start_date}–{overlap.end_date}, {overlap.status}).
              </div>
            )}
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </SectionCard>

          {/* Anträge */}
          <SectionCard title={`Anträge ${year}`} className="mt-6">
            {allRequests.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.textMuted }}>Noch keine Anträge.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                      <th className="py-2 pr-4">Mitarbeiter</th>
                      <th className="py-2 pr-4">Zeitraum</th>
                      <th className="py-2 pr-4">Arbeitstage</th>
                      <th className="py-2 pr-4">Typ</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Kommentar</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRequests.map((v) => (
                      <tr key={v.id} className="border-t" style={{ borderColor: COLORS.stroke }}>
                        <td className="py-2 pr-4 font-semibold" style={{ color: COLORS.navy }}>{v.employeeName}</td>
                        <td className="py-2 pr-4">{v.start_date}{v.end_date !== v.start_date ? ` – ${v.end_date}` : ''}</td>
                        <td className="py-2 pr-4">{v.days}{v.days === 0.5 ? ' (½)' : ''}</td>
                        <td className="py-2 pr-4">{TYPE_LABEL[v.type]}</td>
                        <td className="py-2 pr-4">
                          <Badge tone={v.status === 'genehmigt' ? 'ok' : v.status === 'abgelehnt' ? 'danger' : 'warn'}>{v.status}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-xs" style={{ color: COLORS.textMuted }}>{v.comment}</td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {v.status === 'beantragt' && (
                              <>
                                <Button size="sm" variant="secondary" onClick={() => decide(v.id, 'genehmigt')} title="Genehmigen">
                                  <Check className="h-3.5 w-3.5" style={{ color: COLORS.ok }} />
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => decide(v.id, 'abgelehnt')} title="Ablehnen">
                                  <X className="h-3.5 w-3.5" style={{ color: COLORS.danger }} />
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => remove(v.id)} title="Löschen">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </AdminShell>
  );
}
