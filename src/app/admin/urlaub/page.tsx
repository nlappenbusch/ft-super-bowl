'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, Card, SectionCard, Button, Field, TextInput, SelectInput, Badge, Spinner, COLORS,
} from '@/components/admin/ui';
import { Palmtree, Plus, Check, X, Trash2, CalendarRange } from 'lucide-react';

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

interface PlannerEmployee {
  id: string;
  name: string;
  balance: { entitlement: number; used: number; pending: number; remaining: number };
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
  const [form, setForm] = useState({ employee_id: '', start_date: '', end_date: '', type: 'urlaub', comment: '' });
  const [saving, setSaving] = useState(false);

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

  const submit = async () => {
    if (!form.start_date || !form.end_date) return;
    setSaving(true);
    try {
      await fetch('/api/admin/vacation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, employee_id: form.employee_id || undefined }),
      });
      setForm({ employee_id: '', start_date: '', end_date: '', type: 'urlaub', comment: '' });
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

  const days = useMemo(() => isoDaysOfYear(year), [year]);
  const holidaySet = useMemo(() => new Map((planner?.holidays || []).map((h) => [h.date, h.name])), [planner]);

  // Tages-Status pro Mitarbeiter für den Planner-Strip
  const dayColor = (emp: PlannerEmployee, iso: string): { bg: string; label?: string } => {
    const hol = holidaySet.get(iso);
    if (hol) return { bg: COLORS.navy, label: hol };
    const v = emp.vacations.find((x) => x.status !== 'abgelehnt' && x.start_date <= iso && x.end_date >= iso);
    if (v) {
      if (v.status === 'beantragt') return { bg: '#fbbf24', label: `${TYPE_LABEL[v.type]} (beantragt)` };
      if (v.type === 'krankheit') return { bg: '#ef4444', label: 'Krankheit' };
      if (v.type === 'urlaub') return { bg: COLORS.accent, label: 'Urlaub' };
      return { bg: '#8b5cf6', label: TYPE_LABEL[v.type] };
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

  return (
    <AdminShell title="Urlaub">
      <PageHeader
        title="Urlaubsplanung"
        description="Gemeinsamer Jahresplaner für das ganze Team. Verbrauch wird in Arbeitstagen gerechnet – Feiertage des Kantons Zürich und freie Wochentage zählen nicht."
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
            description="Orange = Urlaub · Gelb = beantragt · Rot = Krankheit · Dunkelblau = Feiertag (ZH) · Grau = Wochenende"
          >
            <div className="overflow-x-auto pb-2">
              <div style={{ minWidth: 1100 }}>
                {/* Monats-Skala */}
                <div className="mb-1 flex pl-36">
                  {MONTHS.map((m, i) => {
                    const daysInMonth = new Date(Date.UTC(year, i + 1, 0)).getUTCDate();
                    return (
                      <div key={m} className="text-[10px] font-bold uppercase" style={{ width: `${(daysInMonth / days.length) * 100}%`, color: COLORS.textMuted }}>
                        {m}
                      </div>
                    );
                  })}
                </div>
                {planner.employees.map((emp) => (
                  <div key={emp.id} className="mb-1.5 flex items-center">
                    <div className="w-36 shrink-0 pr-3 text-right">
                      <div className="truncate text-xs font-semibold" style={{ color: COLORS.navy }}>{emp.name}</div>
                      <div className="text-[10px]" style={{ color: COLORS.textMuted }}>{emp.balance.remaining}/{emp.balance.entitlement} Tage übrig</div>
                    </div>
                    <div className="flex h-6 flex-1 overflow-hidden rounded-md">
                      {days.map((iso) => {
                        const c = dayColor(emp, iso);
                        return (
                          <div
                            key={iso}
                            title={c.label ? `${iso}: ${c.label}` : iso}
                            style={{ background: c.bg, flex: 1, marginRight: iso.endsWith('01') ? 0 : undefined }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Antrag erfassen */}
          <SectionCard title="Abwesenheit erfassen" icon={<Plus className="h-4 w-4" />} className="mt-6">
            <div className="grid gap-3 sm:grid-cols-5">
              <Field label="Mitarbeiter">
                <SelectInput value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                  <option value="">Mein Konto</option>
                  {planner.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </SelectInput>
              </Field>
              <Field label="Von">
                <TextInput type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
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
            <div className="mt-3">
              <Button variant="accent" onClick={submit} disabled={saving || !form.start_date || !form.end_date}>
                {saving ? <Spinner className="h-4 w-4" /> : <Palmtree className="h-4 w-4" />} Antrag erfassen
              </Button>
            </div>
          </SectionCard>

          {/* Anträge */}
          <SectionCard title={`Anträge ${year}`} className="mt-6">
            {allRequests.length === 0 ? (
              <p className="text-sm" style={{ color: COLORS.textMuted }}>Noch keine Anträge.</p>
            ) : (
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
                      <td className="py-2 pr-4">{v.start_date} – {v.end_date}</td>
                      <td className="py-2 pr-4">{v.days}</td>
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
            )}
          </SectionCard>
        </>
      )}
    </AdminShell>
  );
}
