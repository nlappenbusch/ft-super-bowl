'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Cell,
} from 'recharts';
import { TrendingUp, CalendarDays, BarChart3 } from 'lucide-react';
import { SectionCard, COLORS } from './ui';

interface Lead {
  status: 'new' | 'in_progress' | 'booked' | 'rejected';
  created_at?: string;
  package_title?: string;
  event_slug?: string;
}

const MUTED = '#9ca3af';

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function deDay(d: Date) { return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); }

export default function DashboardAnalytics({ leads }: { leads: Lead[] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const yearStart = new Date(now.getFullYear(), 0, 1).getTime();

    let today = 0, month = 0, year = 0;
    const byStatus: Record<Lead['status'], number> = { new: 0, in_progress: 0, booked: 0, rejected: 0 };
    const byEvent = new Map<string, number>();

    // 30-Tage-Buckets
    const days = Array.from({ length: 30 }, (_, idx) => {
      const i = 29 - idx;
      const d = startOfDay(new Date(now.getTime() - i * 86400000));
      return { label: deDay(d), t0: d.getTime(), t1: d.getTime() + 86400000, count: 0 };
    });

    for (const l of leads) {
      if (l.status in byStatus) byStatus[l.status]++;
      const ev = (l.package_title || l.event_slug || 'Unbekannt').trim() || 'Unbekannt';
      byEvent.set(ev, (byEvent.get(ev) || 0) + 1);
      if (!l.created_at) continue;
      const t = new Date(l.created_at).getTime();
      if (Number.isNaN(t)) continue;
      if (t >= todayStart) today++;
      if (t >= monthStart) month++;
      if (t >= yearStart) year++;
      for (const day of days) { if (t >= day.t0 && t < day.t1) { day.count++; break; } }
    }

    const topEvents = [...byEvent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name: name.length > 24 ? name.slice(0, 23) + '…' : name, count }));

    return {
      today, month, year, total: leads.length,
      trend: days.map((d) => ({ label: d.label, Anfragen: d.count })),
      topEvents,
      statusData: [
        { label: 'Neu', value: byStatus.new, color: COLORS.accent },
        { label: 'Kontaktiert', value: byStatus.in_progress, color: COLORS.info },
        { label: 'Gebucht', value: byStatus.booked, color: COLORS.ok },
        { label: 'Verloren', value: byStatus.rejected, color: MUTED },
      ],
    };
  }, [leads]);

  const statusMax = Math.max(1, ...stats.statusData.map((s) => s.value));

  return (
    <div className="mb-6 space-y-6">
      {/* Anfragen-KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Anfragen heute', value: stats.today },
          { label: 'Diesen Monat', value: stats.month },
          { label: 'Dieses Jahr', value: stats.year },
          { label: 'Anfragen gesamt', value: stats.total },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border p-4" style={{ borderColor: COLORS.stroke, background: COLORS.surface }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>{k.label}</div>
            <div className="mt-1 text-3xl font-extrabold tabular-nums" style={{ color: COLORS.navy }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Verlaufs-Graph */}
        <div className="lg:col-span-2">
          <SectionCard title="Anfragen-Verlauf (30 Tage)" icon={<TrendingUp className="h-5 w-5" />}>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={stats.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ftAnfragenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.stroke} vertical={false} />
                  <XAxis dataKey="label" interval={4} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: COLORS.textMuted }} />
                  <YAxis allowDecimals={false} width={28} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: COLORS.textMuted }} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${COLORS.stroke}`, fontSize: 12 }} />
                  <Area type="monotone" dataKey="Anfragen" stroke={COLORS.accent} strokeWidth={2.5} fill="url(#ftAnfragenGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* Status-Verteilung */}
        <SectionCard title="Status-Verteilung" icon={<BarChart3 className="h-5 w-5" />}>
          <div className="space-y-3 pt-1">
            {stats.statusData.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-semibold" style={{ color: COLORS.navy }}>{s.label}</span>
                  <span className="tabular-nums" style={{ color: COLORS.textMuted }}>{s.value}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: COLORS.surfaceMuted }}>
                  <div className="h-2 rounded-full transition-all" style={{ width: `${Math.round((s.value / statusMax) * 100)}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* Top Events */}
      <SectionCard title="Top Events nach Anfragen" icon={<CalendarDays className="h-5 w-5" />}>
        {stats.topEvents.length === 0 ? (
          <div className="py-8 text-center text-sm" style={{ color: COLORS.textMuted }}>Noch keine Daten</div>
        ) : (
          <div style={{ width: '100%', height: Math.max(160, stats.topEvents.length * 42) }}>
            <ResponsiveContainer>
              <BarChart data={stats.topEvents} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={COLORS.stroke} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: COLORS.textMuted }} />
                <YAxis type="category" dataKey="name" width={155} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: COLORS.navy }} />
                <Tooltip cursor={{ fill: COLORS.surfaceMuted }} contentStyle={{ borderRadius: 12, border: `1px solid ${COLORS.stroke}`, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {stats.topEvents.map((_, i) => <Cell key={i} fill={i === 0 ? COLORS.accent : COLORS.navy} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
