'use client';

/**
 * /admin/kalkulation — Übersicht der Angebotskalkulationen (TASK-00115).
 * EK-Kalkulationen mit Fremdwährungs-Positionen, Kurs-Snapshot und FX-Alert:
 * grün = EK seit Erstellung gesunken (mehr Marge), rot = EK gestiegen.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, Spinner, EmptyState, Button, Badge, StatCard, PageHeader } from '@/components/admin/ui';
import { Calculator, Plus, TrendingDown, TrendingUp, Minus, Trash2, ExternalLink, FileText } from 'lucide-react';
import { computeTotals, fmtMoney, fmtPct, type CalcItem, type FxComparison, type MarginMode } from '@/lib/calcModel';
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
      <Badge tone="ok" className="whitespace-nowrap" >
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
    <span className="inline-flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap" title={`${info} — Veränderung unter ${FX_ALERT_THRESHOLD} %.`}>
      <Minus className="h-3 w-3" /> stabil
    </span>
  );
}

export default function KalkulationListPage() {
  const [rows, setRows] = useState<CalcRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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
        description="EK-Kalkulationen für Arrangements — Positionen in EUR/USD/CHF/GBP, Kurs-Snapshot bei Erstellung, Marge & Kundenansicht."
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
        description="EK/VK in der Zielwährung zu festgeschriebenen Kursen. Das FX-Badge zeigt die EK-Veränderung durch Kursbewegungen seit Erstellung."
      >
        {loading ? (
          <div className="py-10 text-center"><Spinner /></div>
        ) : error ? (
          <p className="py-6 text-center text-sm" style={{ color: COLORS.danger }}>{error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Calculator className="h-6 w-6" />}
            title="Noch keine Kalkulation."
            description="Lege die erste Angebotskalkulation an — Positionen je Kategorie, EK in der Einkaufswährung, Marge, fertig."
            action={<Link href="/admin/kalkulation/neu"><Button variant="accent"><Plus className="h-4 w-4" /> Neue Kalkulation</Button></Link>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-3 py-2">Nr.</th>
                  <th className="px-3 py-2">Titel</th>
                  <th className="px-3 py-2">Kunde / Anfrage</th>
                  <th className="px-3 py-2 text-center">Pos.</th>
                  <th className="px-3 py-2 text-right">EK gesamt</th>
                  <th className="px-3 py-2 text-right">Marge</th>
                  <th className="px-3 py-2 text-right">VK gesamt</th>
                  <th className="px-3 py-2">Kurs-Alert</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const totals = computeTotals(r.items, r.target_currency, r.rates_snapshot, r.margin_mode, r.margin_value);
                  return (
                    <tr key={r.id} className="border-t transition-colors hover:bg-gray-50" style={{ borderColor: '#eef2f7' }}>
                      <td className="px-3 py-3 font-mono text-xs font-bold" style={{ color: COLORS.navy }}>
                        <Link href={`/admin/kalkulation/${r.id}`}>{r.calc_number || r.id.slice(0, 8)}</Link>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/admin/kalkulation/${r.id}`} className="font-bold" style={{ color: COLORS.navy }}>
                          {r.title || '(ohne Titel)'}
                        </Link>
                        <div className="text-xs text-gray-400">{(r.created_at || '').slice(0, 10)} · Zielwährung {r.target_currency}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-gray-700">{r.customer_name || <span className="text-gray-400">—</span>}</div>
                        {r.request_number && (
                          <div className="text-xs text-gray-400">{r.request_number}{r.package_title ? ` · ${r.package_title}` : ''}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-gray-700">{r.items.length}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                        {totals ? fmtMoney(totals.ekTarget, r.target_currency) : <span className="text-xs text-gray-400" title="Keine Kurse festgeschrieben.">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-500">
                        {totals ? `${fmtMoney(totals.marginAmount, r.target_currency)} · ${totals.marginPercent.toFixed(1).replace('.', ',')} %` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums" style={{ color: COLORS.navy }}>
                        {totals ? fmtMoney(totals.vkTarget, r.target_currency) : '—'}
                      </td>
                      <td className="px-3 py-3"><FxBadge fx={r.fx} currency={r.target_currency} /></td>
                      <td className="px-3 py-3"><Badge tone={STATUS_LABEL[r.status].tone}>{STATUS_LABEL[r.status].label}</Badge></td>
                      <td className="px-3 py-3">
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
                            title="Kalkulation öffnen"
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
