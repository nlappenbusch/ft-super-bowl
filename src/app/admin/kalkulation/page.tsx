'use client';

/**
 * /admin/kalkulation — Übersicht der Angebotskalkulationen (TASK-00115/-00116).
 * EK-Kalkulationen (alle Preise pro Person) mit Kurs-Snapshot und FX-Alert:
 * grün = EK seit Erstellung gesunken (mehr Marge), rot = EK gestiegen.
 * Zeilen sind aufklappbar und zeigen die volle Kalkulationstabelle.
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, Spinner, EmptyState, Button, Badge, StatCard, PageHeader } from '@/components/admin/ui';
import CalculationTable from '@/components/admin/CalculationTable';
import {
  Calculator, Plus, TrendingDown, TrendingUp, Minus, Trash2, ExternalLink, FileText,
  ChevronRight, ChevronDown, CalendarDays, Landmark,
} from 'lucide-react';
import { computeTotals, fmtMoney, fmtPct, fmtPeriod, type CalcItem, type FxComparison, type MarginMode } from '@/lib/calcModel';
import type { CalcCurrency, RatesSnapshot } from '@/lib/fxRates';

/** Ab dieser EK-Veränderung (±%) erscheint das farbige Alert-Badge in der Liste. */
const FX_ALERT_THRESHOLD = 1;

interface CalcRow {
  id: string;
  calc_number: string;
  created_at: string;
  title: string;
  customer_id: string | null;
  customer_name: string | null;
  booking_id: string | null;
  request_number: string | null;
  package_title: string | null;
  travel_start: string;
  travel_end: string;
  target_currency: CalcCurrency;
  margin_mode: MarginMode;
  margin_value: number;
  items: CalcItem[];
  rates_snapshot: RatesSnapshot | null;
  status: 'entwurf' | 'aktiv' | 'archiviert';
  fx: FxComparison | null;
}

const STATUS_LABEL: Record<CalcRow['status'], { label: string; tone: 'muted' | 'ok' | 'navy' }> = {
  entwurf: { label: 'Entwurf', tone: 'muted' },
  aktiv: { label: 'Aktiv', tone: 'ok' },
  archiviert: { label: 'Archiviert', tone: 'navy' },
};

function FxBadge({ fx, currency }: { fx: FxComparison | null; currency: string }) {
  if (!fx) {
    return <span className="text-xs text-gray-400" title="Kein Kursvergleich möglich (Kurse fehlen oder keine Positionen).">–</span>;
  }
  const pct = fx.diffPct;
  const info = `EK zu aktuellen Kursen: ${fmtMoney(fx.ekAtCurrent, currency)} (Kalkulation: ${fmtMoney(fx.ekAtSnapshot, currency)}, Kursbasis ${fx.snapshotDate})`;
  if (pct <= -FX_ALERT_THRESHOLD) {
    return (
      <Badge tone="ok" className="whitespace-nowrap">
        <TrendingDown className="h-3 w-3" />
        <span title={`${info} — EK gesunken, mehr Marge als kalkuliert.`}>EK {fmtPct(pct)}</span>
      </Badge>
    );
  }
  if (pct >= FX_ALERT_THRESHOLD) {
    return (
      <Badge tone="danger" className="whitespace-nowrap">
        <TrendingUp className="h-3 w-3" />
        <span title={`${info} — EK gestiegen, Marge schrumpft.`}>EK {fmtPct(pct)}</span>
      </Badge>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-gray-400" title={`${info} — Veränderung unter ${FX_ALERT_THRESHOLD} %.`}>
      <Minus className="h-3 w-3" /> stabil
    </span>
  );
}

export default function KalkulationListPage() {
  const [rows, setRows] = useState<CalcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/calculations').then((r) => r.json());
      if (res.success) setRows(res.data || []);
      else setError(res.error || 'Laden fehlgeschlagen');
    } catch {
      setError('Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    setConfirmDelete(null);
    const res = await fetch(`/api/admin/calculations/${id}`, { method: 'DELETE' }).then((r) => r.json()).catch(() => null);
    if (res?.success) setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const alerts = rows.filter((r) => r.fx && Math.abs(r.fx.diffPct) >= FX_ALERT_THRESHOLD);
  const better = alerts.filter((r) => (r.fx?.diffPct ?? 0) < 0).length;
  const worse = alerts.filter((r) => (r.fx?.diffPct ?? 0) > 0).length;

  return (
    <AdminShell title="Angebotskalkulation">
      <PageHeader
        title="Angebotskalkulation"
        description="EK-Kalkulationen pro Person — Positionen in EUR/USD/CHF/GBP, Kurs-Snapshot bei Erstellung, Marge & Kundenansicht."
        actions={
          <Link href="/admin/kalkulation/neu">
            <Button variant="accent"><Plus className="h-4 w-4" /> Neue Kalkulation</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<Calculator className="h-4 w-4" />} label="Kalkulationen" value={rows.length} sub={`${rows.filter((r) => r.status === 'entwurf').length} Entwürfe`} />
        <StatCard icon={<TrendingDown className="h-4 w-4" />} label="EK gesunken" value={better} sub={`Kursvorteil ≥ ${FX_ALERT_THRESHOLD} % — mehr Marge`} tone="ok" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="EK gestiegen" value={worse} sub={`Kursnachteil ≥ ${FX_ALERT_THRESHOLD} % — Marge prüfen`} tone="danger" />
      </div>

      <SectionCard
        title="Alle Kalkulationen"
        description="Klick auf eine Zeile klappt die volle Kalkulationstabelle auf. EK/VK pro Person, in der Zielwährung zu festgeschriebenen Kursen."
      >
        {loading ? (
          <div className="py-10 text-center"><Spinner /></div>
        ) : error ? (
          <p className="py-6 text-center text-sm" style={{ color: COLORS.danger }}>{error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Calculator className="h-6 w-6" />}
            title="Noch keine Kalkulation."
            description="Lege die erste Angebotskalkulation an — Positionen je Kategorie, EK pro Person in der Einkaufswährung, Marge, fertig."
            action={<Link href="/admin/kalkulation/neu"><Button variant="accent"><Plus className="h-4 w-4" /> Neue Kalkulation</Button></Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400">
                  <th className="w-8 px-2 py-2.5"></th>
                  <th className="px-3 py-2.5">Nr.</th>
                  <th className="px-3 py-2.5">Titel / Reisetermin</th>
                  <th className="px-3 py-2.5">Kunde / Anfrage</th>
                  <th className="px-3 py-2.5 text-right">EK p.P.</th>
                  <th className="px-3 py-2.5 text-right">Marge</th>
                  <th className="px-3 py-2.5 text-right">VK p.P.</th>
                  <th className="px-3 py-2.5">Kurs-Alert</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const totals = computeTotals(r.items, r.target_currency, r.rates_snapshot, r.margin_mode, r.margin_value);
                  const period = fmtPeriod(r.travel_start, r.travel_end);
                  const expanded = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="cursor-pointer border-t transition-colors hover:bg-gray-50"
                        style={{ borderColor: '#eef2f7', background: expanded ? '#fafbfd' : undefined }}
                        onClick={() => setExpandedId(expanded ? null : r.id)}
                      >
                        <td className="px-2 py-3 text-gray-400">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </td>
                        <td className="px-3 py-3 font-mono text-xs font-bold" style={{ color: COLORS.navy }}>
                          {r.calc_number || r.id.slice(0, 8)}
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-bold" style={{ color: COLORS.navy }}>{r.title || '(ohne Titel)'}</span>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-400">
                            {period && (
                              <span className="inline-flex items-center gap-1" style={{ color: COLORS.accent }}>
                                <CalendarDays className="h-3 w-3" /> {period}
                              </span>
                            )}
                            <span>{(r.created_at || '').slice(0, 10)} · {r.items.length} Pos. · {r.target_currency}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-gray-700">{r.customer_name || <span className="text-gray-400">—</span>}</div>
                          {r.request_number && (
                            <div className="text-xs text-gray-400">{r.request_number}{r.package_title ? ` · ${r.package_title}` : ''}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                          {totals ? fmtMoney(totals.ekTarget, r.target_currency) : <span className="text-xs text-gray-400" title="Keine Kurse festgeschrieben.">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: totals && totals.marginAmount < 0 ? COLORS.danger : '#6b7280' }}>
                          {totals ? `${totals.marginPercent.toFixed(1).replace('.', ',')} %` : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums" style={{ color: COLORS.navy }}>
                          {totals ? fmtMoney(totals.vkTarget, r.target_currency) : '—'}
                        </td>
                        <td className="px-3 py-3"><FxBadge fx={r.fx} currency={r.target_currency} /></td>
                        <td className="px-3 py-3"><Badge tone={STATUS_LABEL[r.status].tone}>{STATUS_LABEL[r.status].label}</Badge></td>
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/admin/kalkulation/${r.id}/angebot`}
                              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                              title="Kundenansicht öffnen"
                            >
                              <FileText className="h-4 w-4" />
                            </Link>
                            <Link
                              href={`/admin/kalkulation/${r.id}`}
                              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                              title="Kalkulation bearbeiten"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                            <button
                              onClick={() => remove(r.id)}
                              className="rounded-lg p-1.5 transition hover:bg-red-50"
                              style={{ color: confirmDelete === r.id ? COLORS.danger : '#9ca3af' }}
                              title={confirmDelete === r.id ? 'Wirklich löschen? Erneut klicken.' : 'Löschen'}
                            >
                              {confirmDelete === r.id ? <span className="px-1 text-xs font-bold">Sicher?</span> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded && (
                        <tr style={{ background: '#fafbfd' }}>
                          <td colSpan={10} className="px-4 pb-5 pt-1 sm:px-6">
                            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: COLORS.textMuted }}>
                              {period && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {period}</span>}
                              {r.rates_snapshot && <span className="inline-flex items-center gap-1"><Landmark className="h-3.5 w-3.5" /> Kursbasis EZB {r.rates_snapshot.date}</span>}
                              {r.customer_name && <span>Kunde: {r.customer_name}</span>}
                              {r.request_number && <span>Anfrage: {r.request_number}</span>}
                              <Link href={`/admin/kalkulation/${r.id}`} className="ml-auto font-semibold hover:underline" style={{ color: COLORS.accent }}>
                                Bearbeiten →
                              </Link>
                            </div>
                            <CalculationTable
                              items={r.items}
                              target={r.target_currency}
                              rates={r.rates_snapshot}
                              marginMode={r.margin_mode}
                              marginValue={r.margin_value}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </AdminShell>
  );
}
