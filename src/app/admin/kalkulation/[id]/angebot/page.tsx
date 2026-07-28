'use client';

/**
 * /admin/kalkulation/[id]/angebot — Kundenansicht einer Angebotskalkulation
 * (TASK-00115). Zeigt NUR die Leistungen und den Gesamtpreis in der
 * Zielwährung — keine EK-Preise, keine Marge, keine internen Notizen.
 * Druck-/PDF-optimiert (Browser-Druck), ohne Admin-Chrome.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, Printer, AlertTriangle, CalendarDays } from 'lucide-react';
import { COLORS, Button, Spinner } from '@/components/admin/ui';
import { CALC_CATEGORIES, computeTotals, fmtMoney, fmtPeriod, categoryLabel, type CalcItem, type MarginMode } from '@/lib/calcModel';
import type { CalcCurrency, RatesSnapshot } from '@/lib/fxRates';

interface CalcData {
  id: string;
  calc_number: string;
  created_at: string;
  title: string;
  customer_name: string | null;
  request_number: string | null;
  travel_start: string;
  travel_end: string;
  target_currency: CalcCurrency;
  margin_mode: MarginMode;
  margin_value: number;
  items: CalcItem[];
  rates_snapshot: RatesSnapshot | null;
}

export default function KalkulationAngebotPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [calc, setCalc] = useState<CalcData | null>(null);
  const [currentRates, setCurrentRates] = useState<RatesSnapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/calculations/${id}`).then((r) => r.json());
      if (res?.success) {
        setCalc(res.data);
        setCurrentRates(res.current_rates || null);
      } else {
        setErr(res?.error || 'Kalkulation nicht gefunden');
      }
    } catch {
      setErr('Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-white"><Spinner /></div>;
  }
  if (err || !calc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white">
        <p className="font-semibold" style={{ color: COLORS.danger }}>{err || 'Kalkulation nicht gefunden'}</p>
        <Link href="/admin/kalkulation" className="text-sm font-semibold" style={{ color: COLORS.accent }}>← Zur Übersicht</Link>
      </div>
    );
  }

  // Preisbasis: festgeschriebener Kurs-Snapshot; Fallback aktuelle Kurse (mit internem Hinweis).
  const rates = calc.rates_snapshot ?? currentRates;
  const totals = computeTotals(calc.items, calc.target_currency, rates, calc.margin_mode, calc.margin_value);
  const knownIds = CALC_CATEGORIES.map((c) => c.id as string);
  const extraIds = Array.from(new Set(calc.items.map((i) => i.category))).filter((c) => !knownIds.includes(c));
  const categories = [...knownIds, ...extraIds]
    .map((catId) => ({ id: catId, label: categoryLabel(catId), items: calc.items.filter((i) => i.category === catId && (i.description.trim() || i.amount > 0)) }))
    .filter((cat) => cat.items.length > 0);
  const dateStr = (calc.created_at || '').slice(0, 10).split('-').reverse().join('.');
  const period = fmtPeriod(calc.travel_start, calc.travel_end);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar (nur Bildschirm) */}
      <div className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur print:hidden" style={{ borderColor: COLORS.stroke }}>
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href={`/admin/kalkulation/${calc.id}`}>
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Zur Kalkulation</Button>
          </Link>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            Kundenansicht — ohne EK, Marge &amp; interne Notizen.
          </span>
          <div className="ml-auto">
            <Button variant="accent" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Drucken / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Interner Hinweis, falls ohne festgeschriebene Kurse gerechnet wird */}
      {!calc.rates_snapshot && (
        <div className="mx-auto mt-4 max-w-3xl px-4 print:hidden">
          <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium" style={{ borderColor: '#fde68a', background: '#fffbeb', color: COLORS.warn }}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Für diese Kalkulation sind keine Kurse festgeschrieben — der Preis basiert auf dem aktuellen Kursstand.
          </div>
        </div>
      )}

      {/* Angebots-Dokument */}
      <div className="mx-auto my-6 max-w-3xl bg-white px-8 py-10 shadow-sm print:my-0 print:max-w-none print:px-0 print:py-0 print:shadow-none sm:px-12">
        {/* Kopf */}
        <div className="flex items-start justify-between gap-6 border-b-4 pb-6" style={{ borderColor: COLORS.navy }}>
          <Image src="/faltin-logo-email.png" alt="Faltin Travel" width={150} height={48} className="h-12 w-auto" />
          <div className="text-right">
            <div className="text-2xl font-extrabold tracking-tight" style={{ color: COLORS.navy }}>Angebot</div>
            <div className="mt-1 text-xs" style={{ color: COLORS.textMuted }}>
              {calc.calc_number && <div>Angebots-Nr. {calc.calc_number}</div>}
              {calc.request_number && <div>Referenz {calc.request_number}</div>}
              <div>Datum {dateStr}</div>
            </div>
          </div>
        </div>

        {/* Empfänger + Titel */}
        <div className="mt-8">
          {calc.customer_name && (
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
              Erstellt für {calc.customer_name}
            </p>
          )}
          <h1 className="mt-1 text-xl font-extrabold" style={{ color: COLORS.navy }}>
            {calc.title || 'Ihr Reise-Arrangement'}
          </h1>
          {period && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: COLORS.accent }}>
              <CalendarDays className="h-4 w-4" /> {period}
            </p>
          )}
        </div>

        {/* Leistungen */}
        <div className="mt-6">
          <p className="border-b pb-2 text-xs font-bold uppercase tracking-widest" style={{ color: COLORS.navy, borderColor: COLORS.stroke }}>
            Inkludierte Leistungen
          </p>
          {categories.length === 0 ? (
            <p className="py-6 text-sm" style={{ color: COLORS.textMuted }}>Noch keine Leistungen erfasst.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: COLORS.stroke }}>
              {categories.map((cat) => (
                <div key={cat.id} className="py-4">
                  <p className="text-sm font-bold" style={{ color: COLORS.accent }}>{cat.label}</p>
                  <ul className="mt-1.5 space-y-1">
                    {cat.items.map((item) => (
                      <li key={item.id} className="flex gap-2 text-sm leading-relaxed" style={{ color: COLORS.navy }}>
                        <span className="select-none" style={{ color: COLORS.accent }}>•</span>
                        <span>
                          {item.qty > 1 ? `${item.qty}× ` : ''}
                          {item.description.trim() || cat.label}
                          {(item.room_category || '').trim() && (
                            <span className="block text-xs" style={{ color: COLORS.textMuted }}>{item.room_category}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gesamtpreis */}
        <div className="mt-4 rounded-xl border-2 px-6 py-5" style={{ borderColor: COLORS.navy }}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-sm font-bold" style={{ color: COLORS.navy }}>Gesamtpreis pro Person</p>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>inkl. aller oben aufgeführten Leistungen</p>
            </div>
            <div className="text-3xl font-extrabold tabular-nums" style={{ color: COLORS.navy }}>
              {totals ? fmtMoney(totals.vkTarget, calc.target_currency) : '—'}
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed" style={{ color: COLORS.textMuted }}>
          Alle Preise pro Person in {calc.target_currency}. Angebot freibleibend — Verfügbarkeit und Preis werden bei Buchung bestätigt.
        </p>

        {/* Fuß */}
        <div className="mt-10 flex items-center justify-between gap-4 border-t pt-5" style={{ borderColor: COLORS.stroke }}>
          <p className="text-xs" style={{ color: COLORS.textMuted }}>
            <span className="font-bold" style={{ color: COLORS.navy }}>Faltin Travel AG</span> · Ihr Partner für Sport-Events &amp; Hospitality · faltintravel.com
          </p>
          <Image src="/schweizer-reisegarantie-logo.svg" alt="Schweizer Reisegarantie" width={110} height={44} className="h-10 w-auto" />
        </div>
      </div>
    </div>
  );
}
