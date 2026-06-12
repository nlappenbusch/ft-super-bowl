'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, Card, Button, Field, TextInput, SelectInput, Badge, Toggle, Spinner, EmptyState, COLORS,
} from '@/components/admin/ui';
import { Users, Pencil, X, Save } from 'lucide-react';

type WeeklyHours = [number, number, number, number, number, number, number];

interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'mitarbeiter';
  active: boolean;
  weekly_hours: WeeklyHours;
  vacation_days_per_year: number;
  employment_start: string | null;
  notes: string;
  last_login_at: string | null;
  vacation: { entitlement: number; used: number; pending: number; remaining: number };
}

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
// Anzeige-Reihenfolge Mo–So → Index in weekly_hours
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function fmtDate(s: string | null): string {
  if (!s) return '–';
  try { return new Date(s).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return s; }
}

export default function TeamPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/team').then((x) => x.json());
      if (r.success) setEmployees(r.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/team/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editing.name,
          role: editing.role,
          active: editing.active,
          weekly_hours: editing.weekly_hours,
          vacation_days_per_year: editing.vacation_days_per_year,
          employment_start: editing.employment_start,
          notes: editing.notes,
        }),
      });
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const weekTotal = (w: WeeklyHours) => Math.round(w.reduce((s, h) => s + h, 0) * 100) / 100;

  return (
    <AdminShell title="Team">
      <PageHeader
        title="Team & Userverwaltung"
        description="Mitarbeiter werden beim Microsoft-Login automatisch angelegt. Hier definierst du Arbeitszeiten, Urlaubsanspruch und Rollen."
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : employees.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="Noch keine Mitarbeiter"
          description="Sobald sich jemand mit seinem Microsoft-Konto (@faltintravel.com) anmeldet, erscheint er hier automatisch."
        />
      ) : (
        <Card padded={false} className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">E-Mail</th>
                <th className="px-5 py-3">Rolle</th>
                <th className="px-5 py-3">Pensum/Woche</th>
                <th className="px-5 py-3">Urlaub (Rest)</th>
                <th className="px-5 py-3">Letzter Login</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-t" style={{ borderColor: COLORS.stroke }}>
                  <td className="px-5 py-3 font-semibold" style={{ color: COLORS.navy }}>{e.name}</td>
                  <td className="px-5 py-3" style={{ color: COLORS.textMuted }}>{e.email}</td>
                  <td className="px-5 py-3">
                    <Badge tone={e.role === 'admin' ? 'accent' : 'navy'}>{e.role}</Badge>
                  </td>
                  <td className="px-5 py-3">{weekTotal(e.weekly_hours)} h</td>
                  <td className="px-5 py-3">
                    {e.vacation.remaining} / {e.vacation.entitlement} Tage
                    {e.vacation.pending > 0 && (
                      <span className="ml-1.5 text-xs" style={{ color: COLORS.textMuted }}>({e.vacation.pending} beantragt)</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs" style={{ color: COLORS.textMuted }}>{fmtDate(e.last_login_at)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={e.active ? 'ok' : 'muted'}>{e.active ? 'aktiv' : 'inaktiv'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="secondary" onClick={() => setEditing({ ...e, weekly_hours: [...e.weekly_hours] as WeeklyHours })}>
                      <Pencil className="h-3.5 w-3.5" /> Bearbeiten
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Edit-Dialog */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <Card className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: COLORS.navy }}>{editing.name}</h2>
              <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">
                <TextInput value={editing.name} onChange={(ev) => setEditing({ ...editing, name: ev.target.value })} />
              </Field>
              <Field label="Rolle" hint="Aktuell haben alle Tenant-Logins Vollzugriff; die Rolle ist für spätere Rechte-Trennung vorgesehen.">
                <SelectInput value={editing.role} onChange={(ev) => setEditing({ ...editing, role: ev.target.value as Employee['role'] })}>
                  <option value="admin">Admin</option>
                  <option value="mitarbeiter">Mitarbeiter</option>
                </SelectInput>
              </Field>
              <Field label="Urlaubsanspruch (Tage/Jahr)">
                <TextInput
                  type="number" step="0.5" min="0"
                  value={editing.vacation_days_per_year}
                  onChange={(ev) => setEditing({ ...editing, vacation_days_per_year: parseFloat(ev.target.value) || 0 })}
                />
              </Field>
              <Field label="Eintrittsdatum">
                <TextInput
                  type="date"
                  value={editing.employment_start || ''}
                  onChange={(ev) => setEditing({ ...editing, employment_start: ev.target.value || null })}
                />
              </Field>
            </div>

            <Field label="Soll-Arbeitszeit pro Wochentag (Stunden)" hint="Feiertage des Kantons Zürich werden automatisch als arbeitsfrei gerechnet." className="mt-4">
              <div className="grid grid-cols-7 gap-2">
                {DAY_ORDER.map((di) => (
                  <div key={di}>
                    <div className="mb-1 text-center text-xs font-semibold" style={{ color: COLORS.textMuted }}>{DAY_LABELS[di]}</div>
                    <TextInput
                      type="number" step="0.1" min="0" max="24"
                      className="text-center"
                      value={editing.weekly_hours[di]}
                      onChange={(ev) => {
                        const w = [...editing.weekly_hours] as WeeklyHours;
                        w[di] = parseFloat(ev.target.value) || 0;
                        setEditing({ ...editing, weekly_hours: w });
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs" style={{ color: COLORS.textMuted }}>
                Total: <strong>{weekTotal(editing.weekly_hours)} h/Woche</strong>
              </div>
            </Field>

            <Field label="Notizen" className="mt-4">
              <TextInput value={editing.notes} onChange={(ev) => setEditing({ ...editing, notes: ev.target.value })} />
            </Field>

            <div className="mt-5 flex items-center justify-between">
              <Toggle checked={editing.active} onChange={(v) => setEditing({ ...editing, active: v })} label="Aktiv" />
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setEditing(null)}>Abbrechen</Button>
                <Button variant="accent" onClick={save} disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} Speichern
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
