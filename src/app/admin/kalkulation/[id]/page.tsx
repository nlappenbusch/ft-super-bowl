'use client';

/**
 * /admin/kalkulation/[id] — Editor einer Angebotskalkulation (TASK-00115).
 * id = "neu" legt eine neue Kalkulation an. Positionen je Kategorie mit EK in
 * EUR/USD/CHF/GBP, Live-Umrechnung in die Zielwährung (Kursbasis = Snapshot
 * bei Erstellung), Marge als Prozent (Slider 0–200 %) oder Fixbetrag,
 * FX-Alert bei Kursveränderung, Kunden-/Anfrage-Zuordnung, Kundenansicht.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import {
  COLORS, SectionCard, Card, Spinner, Button, Field, TextInput, TextArea, SelectInput, InputField, Badge, PageHeader,
} from '@/components/admin/ui';
import {
  ArrowLeft, Plus, X, Save, Trash2, FileText, TrendingDown, TrendingUp, Minus, RefreshCw, AlertTriangle, Landmark,
} from 'lucide-react';
import {
  CALC_CATEGORIES, computeTotals, compareEk, itemEk, fmtMoney, fmtPct,
  type CalcItem, type MarginMode,
} from '@/lib/calcModel';
import { CALC_CURRENCIES, convertAmount, type CalcCurrency, type RatesSnapshot } from '@/lib/fxRates';

type CalcStatus = 'entwurf' | 'aktiv' | 'archiviert';

interface CustomerOption { id: string; name: string; company: string; primary_email: string }
interface BookingOption { id: string; request_number: string | null; package_title: string; email: string; customer_id?: string | null }

function newItem(category: string, currency: CalcCurrency): CalcItem {
  return { id: crypto.randomUUID(), category, description: '', currency, amount: 0, qty: 1 };
}

export default function KalkulationEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const isNew = id === 'neu';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [calcNumber, setCalcNumber] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [title, setTitle] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [bookingId, setBookingId] = useState('');
  const [target, setTarget] = useState<CalcCurrency>('CHF');
  const [marginMode, setMarginMode] = useState<MarginMode>('percent');
  const [marginValue, setMarginValue] = useState(10);
  const [items, setItems] = useState<CalcItem[]>([]);
  const [status, setStatus] = useState<CalcStatus>('entwurf');
  const [notes, setNotes] = useState('');
  const [snapshot, setSnapshot] = useState<RatesSnapshot | null>(null);
  const [current, setCurrent] = useState<RatesSnapshot | null>(null);

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [bookings, setBookings] = useState<BookingOption[]>([]);
  const [confirmAction, setConfirmAction] = useState<null | 'delete' | 'rebase'>(null);

  /* ─── Laden ─────────────────────────────────────────────────────────── */

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [customersRes, bookingsRes] = await Promise.all([
        fetch('/api/admin/customers').then((r) => r.json()).catch(() => null),
        fetch('/api/bookings').then((r) => r.json()).catch(() => null),
      ]);
      if (customersRes?.success) setCustomers(customersRes.data || []);
      if (bookingsRes?.success) setBookings(bookingsRes.data || []);

      if (isNew) {
        const ratesRes = await fetch('/api/admin/calculations/rates').then((r) => r.json()).catch(() => null);
        if (ratesRes?.success) setCurrent(ratesRes.data);
        else setNotice('Wechselkurse sind aktuell nicht abrufbar — die Vorschau bleibt leer, Kurse werden beim Speichern nachgeholt.');
      } else {
        const res = await fetch(`/api/admin/calculations/${id}`).then((r) => r.json());
        if (!res?.success) {
          setErr(res?.error || 'Kalkulation nicht gefunden');
          return;
        }
        const d = res.data;
        setCalcNumber(d.calc_number || '');
        setCreatedAt(d.created_at || '');
        setTitle(d.title || '');
        setCustomerId(d.customer_id || '');
        setBookingId(d.booking_id || '');
        setTarget(d.target_currency || 'CHF');
        setMarginMode(d.margin_mode || 'percent');
        setMarginValue(Number(d.margin_value) || 0);
        setItems(Array.isArray(d.items) ? d.items : []);
        setStatus(d.status || 'entwurf');
        setNotes(d.notes || '');
        setSnapshot(d.rates_snapshot || null);
        setCurrent(res.current_rates || null);
      }
    } catch {
      setErr('Laden fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  /* ─── Abgeleitete Werte ─────────────────────────────────────────────── */

  /** Kursbasis der Kalkulation: festgeschriebener Snapshot, bei Neuanlage die aktuellen Kurse. */
  const baseRates = snapshot ?? current;
  const totals = useMemo(
    () => computeTotals(items, target, baseRates, marginMode, marginValue),
    [items, target, baseRates, marginMode, marginValue]
  );
  const fx = useMemo(
    () => compareEk(items, target, snapshot, current),
    [items, target, snapshot, current]
  );

  /* ─── Positionen ────────────────────────────────────────────────────── */

  const addItem = (category: string) => setItems((prev) => [...prev, newItem(category, target)]);
  const removeItem = (itemId: string) => setItems((prev) => prev.filter((i) => i.id !== itemId));
  const patchItem = (itemId: string, patch: Partial<CalcItem>) =>
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));

  const onBookingChange = (v: string) => {
    setBookingId(v);
    if (v && !customerId) {
      const b = bookings.find((x) => x.id === v);
      if (b?.customer_id) setCustomerId(b.customer_id);
    }
  };

  /* ─── Aktionen ──────────────────────────────────────────────────────── */

  const save = async () => {
    setSaving(true);
    setErr(null);
    setNotice(null);
    const payload = {
      title, customer_id: customerId || null, booking_id: bookingId || null,
      target_currency: target, margin_mode: marginMode, margin_value: marginValue,
      items, status, notes,
    };
    try {
      if (isNew) {
        const res = await fetch('/api/admin/calculations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        }).then((r) => r.json());
        if (!res?.success) { setErr(res?.error || 'Speichern fehlgeschlagen'); return; }
        router.replace(`/admin/kalkulation/${res.data.id}`);
      } else {
        const res = await fetch(`/api/admin/calculations/${id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        }).then((r) => r.json());
        if (!res?.success) { setErr(res?.error || 'Speichern fehlgeschlagen'); return; }
        setSnapshot(res.data?.rates_snapshot || null);
        if (res.current_rates) setCurrent(res.current_rates);
        setNotice('Gespeichert.');
      }
    } catch {
      setErr('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  /** Kurs-Snapshot neu auf den aktuellen Stand festschreiben (neue Kalkulationsbasis). */
  const rebaseRates = async () => {
    if (confirmAction !== 'rebase') { setConfirmAction('rebase'); return; }
    setConfirmAction(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/calculations/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_rates: true }),
      }).then((r) => r.json());
      if (!res?.success) { setErr(res?.error || 'Kurse konnten nicht aktualisiert werden'); return; }
      setSnapshot(res.data?.rates_snapshot || null);
      if (res.current_rates) setCurrent(res.current_rates);
      setNotice('Kurse neu festgeschrieben — die Kalkulation rechnet ab jetzt mit dem aktuellen Stand.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (confirmAction !== 'delete') { setConfirmAction('delete'); return; }
    setConfirmAction(null);
    const res = await fetch(`/api/admin/calculations/${id}`, { method: 'DELETE' }).then((r) => r.json()).catch(() => null);
    if (res?.success) router.push('/admin/kalkulation');
    else setErr(res?.error || 'Löschen fehlgeschlagen');
  };

  /* ─── Render ────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <AdminShell title="Angebotskalkulation">
        <div className="py-16 text-center"><Spinner /></div>
      </AdminShell>
    );
  }

  if (err && !isNew && !calcNumber) {
    return (
      <AdminShell title="Angebotskalkulation">
        <Card className="mx-auto max-w-lg text-center">
          <p className="font-semibold" style={{ color: COLORS.danger }}>{err}</p>
          <Link href="/admin/kalkulation" className="mt-3 inline-block text-sm font-semibold" style={{ color: COLORS.accent }}>
            ← Zur Übersicht
          </Link>
        </Card>
      </AdminShell>
    );
  }

  const usedCurrencies = Array.from(new Set(items.map((i) => i.currency)));

  return (
    <AdminShell title={isNew ? 'Neue Kalkulation' : `Kalkulation ${calcNumber}`}>
      <PageHeader
        title={isNew ? 'Neue Angebotskalkulation' : `${calcNumber || 'Kalkulation'}${title ? ` — ${title}` : ''}`}
        description={
          isNew
            ? 'Positionen erfassen, EK in der Einkaufswährung eingeben — beim Speichern werden die aktuellen EZB-Kurse festgeschrieben.'
            : `Angelegt am ${(createdAt || '').slice(0, 10)}${snapshot ? ` · Kursbasis EZB ${snapshot.date}` : ' · noch keine Kurse festgeschrieben'}`
        }
        actions={
          <>
            <Link href="/admin/kalkulation">
              <Button variant="ghost"><ArrowLeft className="h-4 w-4" /> Übersicht</Button>
            </Link>
            {!isNew && (
              <Link href={`/admin/kalkulation/${id}/angebot`}>
                <Button variant="secondary"><FileText className="h-4 w-4" /> Kundenansicht</Button>
              </Link>
            )}
            <Button variant="accent" onClick={save} disabled={saving}>
              {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />} Speichern
            </Button>
          </>
        }
      />

      {(err || notice) && (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm font-medium"
          style={err
            ? { borderColor: '#fecaca', background: '#fef2f2', color: COLORS.danger }
            : { borderColor: '#bbf7d0', background: '#f0fdf4', color: COLORS.ok }}
        >
          {err || notice}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ─── Linke Spalte: Stammdaten + Positionen ─── */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Stammdaten" description="Titel, Zuordnung zu Kunde und Anfrage (RQ), Status.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <InputField
                  label="Titel" required placeholder="z. B. Super Bowl LXII — VIP-Arrangement 4 Personen"
                  value={title} onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <Field label="Kunde">
                <SelectInput value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">— kein Kunde zugeordnet —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {(c.name || c.primary_email || c.id.slice(0, 8)) + (c.company ? ` · ${c.company}` : '')}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Anfrage (REQ)" hint="Verknüpft die Kalkulation mit einer Buchungsanfrage.">
                <SelectInput value={bookingId} onChange={(e) => onBookingChange(e.target.value)}>
                  <option value="">— keine Anfrage zugeordnet —</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {(b.request_number || b.id.slice(0, 8)) + (b.package_title ? ` · ${b.package_title}` : '') + (b.email ? ` · ${b.email}` : '')}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Status">
                <SelectInput value={status} onChange={(e) => setStatus(e.target.value as CalcStatus)}>
                  <option value="entwurf">Entwurf</option>
                  <option value="aktiv">Aktiv</option>
                  <option value="archiviert">Archiviert</option>
                </SelectInput>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Interne Notizen" hint="Nur intern — erscheint nicht in der Kundenansicht.">
                  <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="z. B. Ticket-Kontingent bei Broker XY angefragt…" />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Positionen (EK)"
            description="Einkaufspreise je Position in der jeweiligen Einkaufswährung — pro Kategorie beliebig viele Positionen (z. B. mehrere Transfers)."
          >
            <div className="space-y-5">
              {CALC_CATEGORIES.map((cat) => {
                const catItems = items.filter((i) => i.category === cat.id);
                const catSum = baseRates
                  ? catItems.reduce((s, i) => s + convertAmount(itemEk(i), i.currency, target, baseRates), 0)
                  : null;
                return (
                  <div key={cat.id} className="rounded-xl border" style={{ borderColor: COLORS.stroke }}>
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ background: COLORS.surfaceMuted, borderRadius: '0.75rem 0.75rem 0 0' }}>
                      <span className="text-sm font-bold" style={{ color: COLORS.navy }}>{cat.label}</span>
                      <div className="flex items-center gap-3">
                        {catItems.length > 0 && catSum !== null && (
                          <span className="text-xs font-semibold tabular-nums" style={{ color: COLORS.textMuted }}>
                            {fmtMoney(catSum, target)}
                          </span>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => addItem(cat.id)}>
                          <Plus className="h-3.5 w-3.5" /> Position
                        </Button>
                      </div>
                    </div>
                    {catItems.length > 0 && (
                      <div className="space-y-2 p-3">
                        {catItems.map((item) => {
                          const ek = itemEk(item);
                          const inTarget = baseRates ? convertAmount(ek, item.currency, target, baseRates) : null;
                          return (
                            <div key={item.id} className="flex flex-wrap items-center gap-2">
                              <TextInput
                                className="min-w-40 flex-1"
                                placeholder="Beschreibung, z. B. Kat.-1-Ticket Unterrang"
                                value={item.description}
                                onChange={(e) => patchItem(item.id, { description: e.target.value })}
                              />
                              <TextInput
                                type="number" min={0} step={1} title="Menge"
                                className="w-16 text-center"
                                value={item.qty}
                                onChange={(e) => patchItem(item.id, { qty: Math.max(0, Number(e.target.value) || 0) })}
                              />
                              <SelectInput
                                className="w-24" title="Einkaufswährung"
                                value={item.currency}
                                onChange={(e) => patchItem(item.id, { currency: e.target.value as CalcCurrency })}
                              >
                                {CALC_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                              </SelectInput>
                              <TextInput
                                type="number" min={0} step={0.01} title="EK je Einheit"
                                className="w-28 text-right"
                                value={item.amount}
                                onChange={(e) => patchItem(item.id, { amount: Math.max(0, Number(e.target.value) || 0) })}
                              />
                              <span className="w-28 text-right text-xs font-bold tabular-nums" style={{ color: COLORS.navy }}>
                                {inTarget !== null ? fmtMoney(inTarget, target) : '—'}
                              </span>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-500"
                                title="Position entfernen"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* ─── Rechte Spalte: Kalkulation + Kurse ─── */}
        <div className="h-fit space-y-6 lg:sticky lg:top-20">
          <SectionCard title="Kalkulation" description="Zielwährung, Marge und Summen.">
            <div className="space-y-4">
              <Field label="Zielwährung" hint="Die gesamte Kalkulation wird in diese Währung umgerechnet.">
                <SelectInput value={target} onChange={(e) => setTarget(e.target.value as CalcCurrency)}>
                  {CALC_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </SelectInput>
              </Field>

              <Field label="Marge">
                <div className="flex gap-2">
                  <SelectInput
                    className="w-36 shrink-0"
                    value={marginMode}
                    onChange={(e) => setMarginMode(e.target.value as MarginMode)}
                  >
                    <option value="percent">Prozent (%)</option>
                    <option value="fixed">Fixbetrag ({target})</option>
                  </SelectInput>
                  <TextInput
                    type="number" min={0} step={marginMode === 'percent' ? 0.5 : 10}
                    className="text-right"
                    value={marginValue}
                    onChange={(e) => setMarginValue(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                {marginMode === 'percent' && (
                  <input
                    type="range" min={0} max={200} step={0.5}
                    value={Math.min(200, marginValue)}
                    onChange={(e) => setMarginValue(Number(e.target.value))}
                    className="mt-3 w-full cursor-pointer"
                    style={{ accentColor: COLORS.accent }}
                  />
                )}
                {totals && (
                  <p className="mt-2 text-xs font-semibold" style={{ color: COLORS.textMuted }}>
                    {marginMode === 'percent'
                      ? <>= {fmtMoney(totals.marginAmount, target)} Marge</>
                      : <>= {totals.marginPercent.toFixed(1).replace('.', ',')} % vom EK</>}
                  </p>
                )}
              </Field>

              {totals ? (
                <div className="rounded-xl border p-4" style={{ borderColor: COLORS.stroke, background: COLORS.surfaceMuted }}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span style={{ color: COLORS.textMuted }}>EK gesamt</span>
                    <span className="font-bold tabular-nums" style={{ color: COLORS.navy }}>{fmtMoney(totals.ekTarget, target)}</span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between text-sm">
                    <span style={{ color: COLORS.textMuted }}>Marge ({totals.marginPercent.toFixed(1).replace('.', ',')} %)</span>
                    <span className="font-bold tabular-nums" style={{ color: COLORS.navy }}>{fmtMoney(totals.marginAmount, target)}</span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between border-t pt-2" style={{ borderColor: COLORS.stroke }}>
                    <span className="text-sm font-bold" style={{ color: COLORS.navy }}>VK gesamt</span>
                    <span className="text-xl font-extrabold tabular-nums" style={{ color: COLORS.accent }}>{fmtMoney(totals.vkTarget, target)}</span>
                  </div>
                  {totals.byCurrency.length > 0 && (
                    <div className="mt-3 space-y-1 border-t pt-2 text-xs" style={{ borderColor: COLORS.stroke, color: COLORS.textMuted }}>
                      {totals.byCurrency.map((bc) => (
                        <div key={bc.currency} className="flex justify-between tabular-nums">
                          <span>EK-Anteil {bc.currency}</span>
                          <span>{fmtMoney(bc.sum, bc.currency)}{bc.currency !== target ? ` → ${fmtMoney(bc.inTarget, target)}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium" style={{ borderColor: '#fde68a', background: '#fffbeb', color: COLORS.warn }}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Keine Wechselkurse verfügbar — Summen können nicht berechnet werden. Beim Speichern wird der Abruf erneut versucht.
                </div>
              )}
            </div>
          </SectionCard>

          {/* FX-Alert: Kursveränderung seit Festschreibung */}
          {!isNew && snapshot && (
            <SectionCard
              title="Wechselkurs-Check"
              description={`Kursbasis: EZB ${snapshot.date} · Vergleich mit aktuellem Stand${current ? ` (${current.date})` : ''}.`}
              icon={<Landmark className="h-5 w-5" />}
            >
              {fx ? (
                <div
                  className="rounded-xl border p-4"
                  style={fx.diffPct >= 1
                    ? { borderColor: '#fecaca', background: '#fef2f2' }
                    : fx.diffPct <= -1
                      ? { borderColor: '#bbf7d0', background: '#f0fdf4' }
                      : { borderColor: COLORS.stroke, background: COLORS.surfaceMuted }}
                >
                  <div className="flex items-center gap-2">
                    {fx.diffPct <= -1 ? (
                      <TrendingDown className="h-5 w-5" style={{ color: COLORS.ok }} />
                    ) : fx.diffPct >= 1 ? (
                      <TrendingUp className="h-5 w-5" style={{ color: COLORS.danger }} />
                    ) : (
                      <Minus className="h-5 w-5" style={{ color: COLORS.textMuted }} />
                    )}
                    <span className="text-lg font-extrabold tabular-nums" style={{ color: fx.diffPct >= 1 ? COLORS.danger : fx.diffPct <= -1 ? COLORS.ok : COLORS.navy }}>
                      EK {fmtPct(fx.diffPct)}
                    </span>
                    <span className="ml-auto text-xs font-semibold tabular-nums" style={{ color: COLORS.textMuted }}>
                      {fmtMoney(fx.diffAbs, target)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: COLORS.navy }}>
                    {fx.diffPct <= -1 && (
                      <>Der EK ist durch die Kursentwicklung <b>gesunken</b> ({fmtMoney(fx.ekAtSnapshot, target)} → {fmtMoney(fx.ekAtCurrent, target)}). <b>Mehr Marge</b> als ursprünglich kalkuliert.</>
                    )}
                    {fx.diffPct >= 1 && (
                      <>Der EK ist durch die Kursentwicklung <b>gestiegen</b> ({fmtMoney(fx.ekAtSnapshot, target)} → {fmtMoney(fx.ekAtCurrent, target)}). Die Marge <b>schrumpft</b> entsprechend — Kalkulation prüfen.</>
                    )}
                    {Math.abs(fx.diffPct) < 1 && (
                      <>Kurse seit Festschreibung praktisch unverändert ({fmtMoney(fx.ekAtSnapshot, target)} → {fmtMoney(fx.ekAtCurrent, target)}).</>
                    )}
                  </p>
                  {fx.perCurrency.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {fx.perCurrency.map((pc) => (
                        <Badge key={pc.currency} tone={pc.ratePct >= 1 ? 'danger' : pc.ratePct <= -1 ? 'ok' : 'muted'}>
                          {pc.currency}→{target} {fmtPct(pc.ratePct)}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  Kein Vergleich möglich — {current ? 'noch keine (umrechenbaren) Positionen erfasst.' : 'aktuelle Kurse sind nicht abrufbar.'}
                </p>
              )}

              {/* Kurs-Tabelle Snapshot vs. aktuell */}
              {usedCurrencies.filter((c) => c !== target).length > 0 && current && (
                <div className="mt-3 space-y-1 text-xs tabular-nums" style={{ color: COLORS.textMuted }}>
                  {usedCurrencies.filter((c) => c !== target).map((c) => {
                    const snapRate = convertAmount(1, c, target, snapshot);
                    const curRate = convertAmount(1, c, target, current);
                    return (
                      <div key={c} className="flex justify-between">
                        <span>1 {c}</span>
                        <span>{snapRate.toFixed(4)} → {curRate.toFixed(4)} {target}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={rebaseRates} disabled={saving || !current}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {confirmAction === 'rebase' ? 'Wirklich? Erneut klicken' : 'Kurse neu festschreiben'}
                </Button>
                <p className="mt-1.5 text-[11px]" style={{ color: '#9ca3af' }}>
                  Setzt die Kalkulationsbasis auf den aktuellen Kursstand — der bisherige Vergleich beginnt von vorn.
                </p>
              </div>
            </SectionCard>
          )}

          {!isNew && !snapshot && (
            <SectionCard title="Wechselkurs-Check" icon={<Landmark className="h-5 w-5" />}>
              <div className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium" style={{ borderColor: '#fde68a', background: '#fffbeb', color: COLORS.warn }}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Für diese Kalkulation sind noch keine Kurse festgeschrieben.
              </div>
              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={rebaseRates} disabled={saving}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {confirmAction === 'rebase' ? 'Wirklich? Erneut klicken' : 'Kurse jetzt festschreiben'}
                </Button>
              </div>
            </SectionCard>
          )}

          {isNew && (
            <Card>
              <p className="text-xs leading-relaxed" style={{ color: COLORS.textMuted }}>
                <b style={{ color: COLORS.navy }}>Kurs-Snapshot:</b> Beim Speichern werden die aktuell gültigen EZB-Referenzkurse
                {current ? ` (Stand ${current.date})` : ''} als Kalkulationsbasis festgeschrieben. Verändern sich die Kurse danach,
                zeigt die Kalkulation einen grünen/roten Alert mit der EK-Abweichung in Prozent.
              </p>
            </Card>
          )}

          {baseRates && (
            <p className="px-1 text-[11px]" style={{ color: '#9ca3af' }}>
              Kursquelle: {baseRates.source} · Kursdatum {baseRates.date}
            </p>
          )}

          {!isNew && (
            <div className="flex justify-end">
              <Button variant="danger" size="sm" onClick={remove}>
                <Trash2 className="h-3.5 w-3.5" />
                {confirmAction === 'delete' ? 'Wirklich löschen? Erneut klicken' : 'Kalkulation löschen'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
