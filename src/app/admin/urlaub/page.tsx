'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, SectionCard, Button, Field, TextInput, SelectInput, Badge, Spinner, COLORS,
} from '@/components/admin/ui';
import {
  Palmtree, Plus, Check, X, Trash2, CalendarRange, AlertTriangle, Inbox, User, Undo2, UserCheck,
} from 'lucide-react';
import {
  VACATION_TYPE_LABEL as TYPE_LABEL, fmtRangeDe, fmtRangeDeYear, fmtDaysDe, fmtDayDe,
} from '@/lib/vacationFormat';

interface Holiday { date: string; name: string }

interface Vacation {
  id: string;
  employee_id: string;
  created_at: string;
  start_date: string;
  end_date: string;
  days: number;
  type: 'urlaub' | 'krankheit' | 'kompensation' | 'sonstiges';
  status: 'beantragt' | 'genehmigt' | 'abgelehnt';
  comment: string;
  decided_by: string | null;
  decided_at: string | null;
  substitute_id: string | null;
  decision_comment: string;
}

interface Balance { entitlement: number; carryover: number; used: number; pending: number; sickDays: number; remaining: number }

interface PlannerEmployee {
  id: string;
  name: string;
  balance: Balance;
  vacations: Vacation[];
}

interface ConflictAbsence {
  id: string;
  employee_id: string;
  employee_name: string;
  start_date: string;
  end_date: string;
  days: number;
  type: Vacation['type'];
  status: 'beantragt' | 'genehmigt';
  is_substitute: boolean;
}

interface Conflicts {
  requested_days: number;
  team_size: number;
  absences: ConflictAbsence[];
  own_overlaps: Vacation[];
  coverage: Array<{ date: string; present: number; total: number; absent_names: string[] }>;
  balance_after: Array<{ year: number; remaining: number; pending: number; requested: number; after: number }>;
  warnings: string[];
}

interface PendingItem extends Vacation {
  employee_name: string;
  substitute_name: string | null;
  approver_names: string[];
  responsible: boolean;
  self_fallback: boolean;
  conflicts: Conflicts;
}

interface Me { employee_id: string | null; name: string; is_admin: boolean }

interface Planner {
  year: number;
  holidays: Holiday[];
  employees: PlannerEmployee[];
  me: Me;
  pending_for_me: PendingItem[];
}

type Notice = { tone: 'ok' | 'error'; text: string } | null;

const STATUS_TONE: Record<Vacation['status'], 'ok' | 'danger' | 'warn'> = { genehmigt: 'ok', abgelehnt: 'danger', beantragt: 'warn' };
const TYPE_COLOR: Record<Vacation['type'], string> = {
  urlaub: COLORS.accent, krankheit: '#ef4444', kompensation: '#8b5cf6', sonstiges: '#8b5cf6',
};

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const DAY_W = 7;          // px pro Tag im Planer
const LABEL_W = 152;      // px für die Namensspalte
const todayIso = new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { employee_id: '', start_date: '', end_date: '', type: 'urlaub', comment: '', half_day: false, substitute_id: '' };

function isoDaysOfYear(year: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(year, 0, 1));
  while (d.getUTCFullYear() === year) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** Überschneidungen, Besetzung und Hinweise – für Formular-Vorschau und Genehmigungsansicht. */
function ConflictPanel({ c }: { c: Conflicts }) {
  const tightest = c.coverage.length ? c.coverage.reduce((m, d) => (d.present < m.present ? d : m), c.coverage[0]) : null;
  return (
    <div className="mt-3 space-y-2">
      {c.warnings.length > 0 && (
        <ul className="space-y-1 rounded-lg px-3 py-2 text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>
          {c.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-xs" style={{ color: COLORS.textMuted }}>
        {c.absences.length === 0 ? (
          <span style={{ color: COLORS.ok }}>Niemand sonst ist in diesem Zeitraum abwesend.</span>
        ) : (
          <>
            <span>Gleichzeitig abwesend:</span>
            {c.absences.map((a) => (
              <span
                key={a.id}
                className="rounded-full px-2 py-0.5"
                style={{
                  background: a.status === 'beantragt' ? '#fffbeb' : '#f3f4f6',
                  color: a.is_substitute ? COLORS.danger : COLORS.navy,
                  border: a.status === 'beantragt' ? '1px dashed #f59e0b' : '1px solid transparent',
                }}
                title={`${TYPE_LABEL[a.type]}, ${a.status}`}
              >
                {a.employee_name} · {fmtRangeDe(a.start_date, a.end_date)}
                {a.status === 'beantragt' ? ' (beantragt)' : ''}
                {a.is_substitute ? ' – Stellvertretung!' : ''}
              </span>
            ))}
          </>
        )}
        {tightest && tightest.total > 1 && (
          <span className="ml-1">· Besetzung: mind. {tightest.present} von {tightest.total} anwesend</span>
        )}
      </div>
    </div>
  );
}

/** Ein offener Antrag in „Zur Genehmigung“ mit optionalem Kommentar. */
function PendingCard({ item, busy, onDecide }: {
  item: PendingItem;
  busy: boolean;
  onDecide: (id: string, status: 'genehmigt' | 'abgelehnt', comment: string) => void;
}) {
  const [comment, setComment] = useState('');
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: COLORS.stroke }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold" style={{ color: COLORS.navy }}>{item.employee_name}</span>
        <Badge tone="navy">{TYPE_LABEL[item.type]}</Badge>
        <span className="text-sm" style={{ color: COLORS.navy }}>
          {fmtRangeDeYear(item.start_date, item.end_date)} · {fmtDaysDe(item.days)}
        </span>
        {item.self_fallback && <Badge tone="warn">Selbstgenehmigung – sonst ist niemand zuständig</Badge>}
        {!item.responsible && (
          <Badge tone="muted">als Admin · zuständig: {item.approver_names.join(', ') || '–'}</Badge>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs" style={{ color: COLORS.textMuted }}>
        <span>Stellvertretung: <b style={{ color: COLORS.navy }}>{item.substitute_name || '–'}</b></span>
        <span>beantragt am {fmtDayDe(String(item.created_at).slice(0, 10), true)}</span>
        {item.comment && <span>Kommentar: „{item.comment}“</span>}
      </div>
      <ConflictPanel c={item.conflicts} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <TextInput
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Kommentar an die antragstellende Person (optional)"
          className="min-w-[220px] flex-1"
        />
        <Button variant="secondary" disabled={busy} onClick={() => onDecide(item.id, 'genehmigt', comment)}>
          <Check className="h-4 w-4" style={{ color: COLORS.ok }} /> Genehmigen
        </Button>
        <Button variant="danger" disabled={busy} onClick={() => onDecide(item.id, 'abgelehnt', comment)}>
          <X className="h-4 w-4" /> Ablehnen
        </Button>
      </div>
    </div>
  );
}

export default function UrlaubPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ key: string; data: Conflicts } | null>(null);

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

  const me: Me = planner?.me || { employee_id: null, name: '', is_admin: false };
  const isAdmin = me.is_admin;
  // Nicht-Admins erfassen nur für sich selbst.
  const targetId = (isAdmin ? form.employee_id : '') || me.employee_id || '';
  const singleDay = !!form.start_date && form.start_date === form.end_date;
  const halfDay = singleDay && form.half_day;

  // Live-Vorschau: Überschneidungen/Warnungen, sobald der Zeitraum gesetzt ist (entprellt).
  const previewKey = targetId && form.start_date && form.end_date && form.end_date >= form.start_date
    ? new URLSearchParams({
      employee_id: targetId, start: form.start_date, end: form.end_date, type: form.type,
      substitute_id: form.substitute_id, half_day: halfDay ? '1' : '0',
    }).toString()
    : '';
  useEffect(() => {
    if (!previewKey) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/vacation/conflicts?${previewKey}`, { signal: ctrl.signal }).then((x) => x.json());
        if (r.success) setPreview({ key: previewKey, data: r.data });
      } catch { /* abgebrochen oder offline – die Vorschau ist optional */ }
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [previewKey]);
  const conflicts = preview && preview.key === previewKey ? preview.data : null;
  const previewLoading = !!previewKey && !conflicts;

  const submit = async () => {
    if (!form.start_date || !form.end_date) return;
    if (!targetId) { setError('Bitte einen Mitarbeiter auswählen (der lokale Admin hat kein eigenes Profil).'); return; }
    if (conflicts?.own_overlaps.length) {
      const o = conflicts.own_overlaps[0];
      if (!confirm(`Überschneidung mit ${TYPE_LABEL[o.type]} (${fmtRangeDe(o.start_date, o.end_date)}, ${o.status}). Trotzdem erfassen?`)) return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/vacation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: targetId,
          start_date: form.start_date,
          end_date: form.end_date,
          type: form.type,
          comment: form.comment,
          half_day: halfDay,
          substitute_id: form.substitute_id || undefined,
        }),
      }).then((x) => x.json()).catch(() => ({ success: false }));
      if (!res.success) {
        setError(res.error || 'Speichern fehlgeschlagen.');
        return;
      }
      const approverNames = (res.approvers || []).map((a: { name: string }) => a.name).join(', ');
      setNotice({
        tone: 'ok',
        text: res.data?.type === 'krankheit'
          ? 'Krankmeldung erfasst – die zuständige Person ist informiert.'
          : res.self_approval_fallback
            ? 'Antrag erfasst. Ausser dir darf niemand genehmigen – du kannst ihn unter „Zur Genehmigung“ selbst entscheiden.'
            : `Antrag erfasst und zur Genehmigung an ${approverNames || 'die Admins'} gesendet.`,
      });
      setForm(EMPTY_FORM);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const decide = async (id: string, status: 'genehmigt' | 'abgelehnt', comment = '') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/vacation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, comment }),
      }).then((x) => x.json()).catch(() => ({ success: false }));
      setNotice(res.success
        ? { tone: 'ok', text: `Antrag ${status}.` }
        : { tone: 'error', text: res.error || 'Entscheid fehlgeschlagen.' });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (v: Vacation, own: boolean) => {
    const withdraw = own && v.status === 'beantragt';
    if (!confirm(withdraw ? 'Antrag zurückziehen?' : 'Abwesenheit löschen?')) return;
    const res = await fetch(`/api/admin/vacation/${v.id}`, { method: 'DELETE' }).then((x) => x.json()).catch(() => ({ success: false }));
    setNotice(res.success
      ? { tone: 'ok', text: withdraw ? 'Antrag zurückgezogen.' : 'Abwesenheit gelöscht.' }
      : { tone: 'error', text: res.error || 'Löschen fehlgeschlagen.' });
    await load();
  };

  const pickDay = (employeeId: string, iso: string) => {
    setForm((f) => ({
      ...f,
      employee_id: isAdmin ? (employeeId === me.employee_id ? '' : employeeId) : f.employee_id,
      substitute_id: isAdmin && f.substitute_id === employeeId ? '' : f.substitute_id,
      start_date: iso,
      end_date: iso,
    }));
    setError(null);
    if (typeof document !== 'undefined') document.getElementById('absence-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const days = useMemo(() => isoDaysOfYear(year), [year]);
  const holidaySet = useMemo(() => new Map((planner?.holidays || []).map((h) => [h.date, h.name])), [planner]);
  const nameOf = (id: string | null) => (id && planner?.employees.find((e) => e.id === id)?.name) || null;

  const dayStyle = (emp: PlannerEmployee, iso: string): { background: string; label?: string } => {
    const hol = holidaySet.get(iso);
    if (hol) return { background: COLORS.navy, label: hol };
    const v = emp.vacations.find((x) => x.status !== 'abgelehnt' && x.start_date <= iso && x.end_date >= iso);
    if (v) {
      const half = v.days === 0.5;
      const color = TYPE_COLOR[v.type];
      const pending = v.status === 'beantragt';
      // Beantragt = schraffiert, genehmigt = vollflächig; Halbtag = diagonal halb gefüllt.
      const base = pending ? `repeating-linear-gradient(135deg, ${color} 0 2px, #ffffff 2px 4px)` : color;
      const background = half ? `linear-gradient(135deg, transparent 50%, #f6f8fa 50%), ${base}` : base;
      return { background, label: `${TYPE_LABEL[v.type]}${pending ? ' (beantragt)' : ''}${half ? ', ½ Tag' : ''}` };
    }
    const dow = new Date(`${iso}T00:00:00Z`).getUTCDay();
    if (dow === 0 || dow === 6) return { background: '#e5e7eb' };
    return { background: '#f6f8fa' };
  };

  const allRequests: Array<Vacation & { employeeName: string }> = useMemo(() => {
    if (!planner) return [];
    return planner.employees
      .flatMap((e) => e.vacations.map((v) => ({ ...v, employeeName: e.name })))
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [planner]);

  const myRequests = (planner && me.employee_id ? planner.employees.find((e) => e.id === me.employee_id)?.vacations : null) || [];
  const pendingIds = new Set((planner?.pending_for_me || []).map((p) => p.id));

  const totalWidth = LABEL_W + days.length * DAY_W;

  return (
    <AdminShell title="Urlaub">
      <PageHeader
        title="Urlaubsplanung"
        description="Gemeinsamer Jahresplaner mit Genehmigungsweg. Verbrauch in Arbeitstagen – Feiertage (Kanton Zürich) und Wochenenden zählen nicht. Klick auf einen Tag, um eine Abwesenheit zu erfassen."
        actions={
          <SelectInput value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="w-28">
            {[year - 1, year, year + 1, year + 2].filter((v, i, a) => a.indexOf(v) === i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </SelectInput>
        }
      />

      {notice && (
        <div
          className="mb-4 flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
          style={notice.tone === 'ok' ? { background: '#f0fdf4', color: '#166534' } : { background: '#fee2e2', color: '#991b1b' }}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="rounded p-1 hover:bg-black/5" aria-label="Hinweis schliessen">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {loading && !planner ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : !planner ? (
        <p className="text-sm" style={{ color: COLORS.textMuted }}>Urlaubsdaten konnten nicht geladen werden.</p>
      ) : (
        <>
          {/* Zur Genehmigung */}
          {planner.pending_for_me.length > 0 && (
            <SectionCard
              title={`Zur Genehmigung (${planner.pending_for_me.length})`}
              icon={<Inbox className="h-4 w-4" />}
              description="Offene Anträge, über die du entscheiden darfst – mit Überschneidungen und Hinweisen."
              className="mb-6"
            >
              <div className="space-y-3">
                {planner.pending_for_me.map((p) => (
                  <PendingCard key={p.id} item={p} busy={busyId === p.id} onDecide={decide} />
                ))}
              </div>
            </SectionCard>
          )}

          {/* Meine Anträge */}
          {me.employee_id && (
            <SectionCard title={`Meine Anträge ${year}`} icon={<User className="h-4 w-4" />} className="mb-6">
              {myRequests.length === 0 ? (
                <p className="text-sm" style={{ color: COLORS.textMuted }}>Keine Abwesenheiten in {year}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
                        <th className="py-2 pr-4">Zeitraum</th>
                        <th className="py-2 pr-4">Tage</th>
                        <th className="py-2 pr-4">Typ</th>
                        <th className="py-2 pr-4">Stellvertretung</th>
                        <th className="py-2 pr-4">Status</th>
                        <th className="py-2 pr-4">Entscheid</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {myRequests.map((v) => (
                        <tr key={v.id} className="border-t align-top" style={{ borderColor: COLORS.stroke }}>
                          <td className="py-2 pr-4 font-semibold" style={{ color: COLORS.navy }}>
                            {fmtRangeDeYear(v.start_date, v.end_date)}
                            {v.comment && <div className="text-xs font-normal" style={{ color: COLORS.textMuted }}>{v.comment}</div>}
                          </td>
                          <td className="py-2 pr-4">{fmtDaysDe(v.days)}</td>
                          <td className="py-2 pr-4">{TYPE_LABEL[v.type]}</td>
                          <td className="py-2 pr-4">{nameOf(v.substitute_id) || '–'}</td>
                          <td className="py-2 pr-4"><Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge></td>
                          <td className="py-2 pr-4 text-xs" style={{ color: COLORS.textMuted }}>
                            {v.decided_by ? (
                              <>
                                {v.decided_by}{v.decided_at ? `, ${fmtDayDe(String(v.decided_at).slice(0, 10), true)}` : ''}
                                {v.decision_comment && <div style={{ color: COLORS.navy }}>„{v.decision_comment}“</div>}
                              </>
                            ) : 'offen'}
                          </td>
                          <td className="py-2 text-right">
                            {v.status === 'beantragt' && (
                              <Button size="sm" variant="secondary" onClick={() => remove(v, true)} title="Antrag zurückziehen">
                                <Undo2 className="h-3.5 w-3.5" /> Zurückziehen
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}

          {/* Jahresplaner */}
          <SectionCard
            title={`Teamplaner ${year}`}
            icon={<CalendarRange className="h-4 w-4" />}
            description="Orange = Urlaub · Rot = Krankheit · Violett = Kompensation/Sonstiges · schraffiert = beantragt (noch nicht genehmigt) · Dunkelblau = Feiertag (ZH) · Grau = Wochenende · rote Linie = heute"
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
                        <div className="truncate text-xs font-semibold" style={{ color: COLORS.navy }}>
                          {emp.name}{emp.id === me.employee_id ? ' (du)' : ''}
                        </div>
                        <div className="text-[10px]" style={{ color: COLORS.textMuted }}>
                          {emp.balance.remaining} / {emp.balance.entitlement + emp.balance.carryover} übrig
                        </div>
                      </div>
                      <div className="flex h-6 overflow-hidden rounded-md" style={{ width: days.length * DAY_W }}>
                        {days.map((iso) => {
                          const c = dayStyle(emp, iso);
                          const isMonthStart = iso.endsWith('-01');
                          const isToday = iso === todayIso;
                          return (
                            <div
                              key={iso}
                              onClick={() => pickDay(emp.id, iso)}
                              title={c.label ? `${iso}: ${c.label}` : iso}
                              style={{
                                width: DAY_W,
                                background: c.background,
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
          <SectionCard
            title="Abwesenheit erfassen"
            icon={<Plus className="h-4 w-4" />}
            className="mt-6"
            description={isAdmin
              ? 'Als Admin kannst du auch für andere erfassen. Anträge gehen an die zuständige Person zur Genehmigung.'
              : 'Dein Antrag geht an die zuständige Person zur Genehmigung.'}
          >
            <div id="absence-form" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Field label="Mitarbeiter">
                {isAdmin ? (
                  <SelectInput
                    value={form.employee_id}
                    onChange={(e) => setForm({
                      ...form,
                      employee_id: e.target.value,
                      substitute_id: form.substitute_id === e.target.value ? '' : form.substitute_id,
                    })}
                  >
                    <option value="">{me.employee_id ? 'Mein Konto' : '— bitte wählen —'}</option>
                    {planner.employees.filter((e) => e.id !== me.employee_id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </SelectInput>
                ) : (
                  <TextInput value={me.name} disabled />
                )}
              </Field>
              <Field label="Von">
                <TextInput type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: form.end_date && form.end_date >= e.target.value ? form.end_date : e.target.value })} />
              </Field>
              <Field label="Bis">
                <TextInput type="date" value={form.end_date} min={form.start_date || undefined} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </Field>
              <Field label="Typ">
                <SelectInput value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="urlaub">Urlaub</option>
                  <option value="krankheit">Krankheit</option>
                  <option value="kompensation">Kompensation</option>
                  <option value="sonstiges">Sonstiges</option>
                </SelectInput>
              </Field>
              <Field label="Stellvertretung">
                <SelectInput value={form.substitute_id} onChange={(e) => setForm({ ...form, substitute_id: e.target.value })}>
                  <option value="">— keine —</option>
                  {planner.employees.filter((e) => e.id !== targetId).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
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
                  checked={halfDay}
                  disabled={!singleDay}
                  onChange={(e) => setForm({ ...form, half_day: e.target.checked })}
                />
                Halber Tag (0,5)
              </label>
              <Button variant="accent" onClick={submit} disabled={saving || !form.start_date || !form.end_date}>
                {saving ? <Spinner className="h-4 w-4" /> : <Palmtree className="h-4 w-4" />}
                {form.type === 'krankheit' ? 'Krankmeldung erfassen' : 'Antrag einreichen'}
              </Button>
              {form.type === 'krankheit' && (
                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                  Krankheit wird gemeldet, nicht genehmigt – sie wird direkt erfasst, die zuständige Person wird informiert.
                </span>
              )}
            </div>

            {/* Live-Vorschau */}
            {previewKey && (
              <div className="mt-4 rounded-xl border px-4 py-3" style={{ borderColor: COLORS.stroke, background: COLORS.surfaceMuted }}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
                  <UserCheck className="h-3.5 w-3.5" /> Vorschau {fmtRangeDeYear(form.start_date, form.end_date)}
                  {conflicts && <span className="normal-case tracking-normal">· {fmtDaysDe(conflicts.requested_days)}</span>}
                  {previewLoading && <Spinner className="h-3 w-3" />}
                </div>
                {conflicts && <ConflictPanel c={conflicts} />}
              </div>
            )}
            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>
                <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </SectionCard>

          {/* Alle Anträge */}
          <SectionCard title={`Alle Anträge ${year}`} className="mt-6">
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
                      <th className="py-2 pr-4">Vertretung</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Kommentar</th>
                      <th className="py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRequests.map((v) => (
                      <tr key={v.id} className="border-t" style={{ borderColor: COLORS.stroke }}>
                        <td className="py-2 pr-4 font-semibold" style={{ color: COLORS.navy }}>{v.employeeName}</td>
                        <td className="py-2 pr-4">{fmtRangeDeYear(v.start_date, v.end_date)}</td>
                        <td className="py-2 pr-4">{v.days}{v.days === 0.5 ? ' (½)' : ''}</td>
                        <td className="py-2 pr-4">{TYPE_LABEL[v.type]}</td>
                        <td className="py-2 pr-4">{nameOf(v.substitute_id) || '–'}</td>
                        <td className="py-2 pr-4">
                          <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-xs" style={{ color: COLORS.textMuted }}>
                          {v.comment}
                          {v.decision_comment && <div style={{ color: COLORS.navy }}>Entscheid: „{v.decision_comment}“</div>}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {v.status === 'beantragt' && pendingIds.has(v.id) && (
                              <>
                                <Button size="sm" variant="secondary" disabled={busyId === v.id} onClick={() => decide(v.id, 'genehmigt')} title="Genehmigen">
                                  <Check className="h-3.5 w-3.5" style={{ color: COLORS.ok }} />
                                </Button>
                                <Button size="sm" variant="secondary" disabled={busyId === v.id} onClick={() => decide(v.id, 'abgelehnt')} title="Ablehnen">
                                  <X className="h-3.5 w-3.5" style={{ color: COLORS.danger }} />
                                </Button>
                              </>
                            )}
                            {isAdmin && (
                              <Button size="sm" variant="ghost" onClick={() => remove(v, v.employee_id === me.employee_id)} title="Löschen">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
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
