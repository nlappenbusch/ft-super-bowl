'use client';

/**
 * InvoiceEditor – gemeinsamer Rechnungs-Editor für CRM (fester Lead) und
 * Finanzen (Lead wählen ODER individuelle/manuelle Buchung).
 * Positionen, Fälligkeit, Notizen. Erstellt über POST /api/invoices.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface InvoiceLead {
  id: string;
  email?: string;
  phone?: string;
  package_title?: string;
  event_slug?: string;
  number_of_persons?: number;
  total_price?: number;
  travelers?: string | Array<{ firstName?: string; lastName?: string; first_name?: string; last_name?: string }>;
}

interface Item { description: string; quantity: number; unit_price: number }

export function leadLabel(l: InvoiceLead): string {
  let name = l.email || l.id;
  try {
    const t = typeof l.travelers === 'string' ? JSON.parse(l.travelers) : l.travelers;
    if (Array.isArray(t) && t[0]) {
      const n = [t[0].firstName || t[0].first_name, t[0].lastName || t[0].last_name].filter(Boolean).join(' ');
      if (n) name = n;
    }
  } catch { /* ignore */ }
  return `${name}${l.package_title ? ' · ' + l.package_title : ''}`;
}

const fmt = (n: number) => new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format(n);
const cls = 'w-full text-sm border rounded-lg px-3 py-2 focus:outline-none';
const bd = { borderColor: '#e5e8ed' } as React.CSSProperties;

export default function InvoiceEditor({
  lead, leads, onCreated, onCancel,
}: {
  lead?: InvoiceLead;
  leads?: InvoiceLead[];
  onCreated: () => void;
  onCancel?: () => void;
}) {
  const lockedLead = !!lead;
  const [mode, setMode] = useState<'lead' | 'manual'>(lockedLead ? 'lead' : (leads && leads.length ? 'lead' : 'manual'));
  const [selectedLeadId, setSelectedLeadId] = useState(lead?.id || leads?.[0]?.id || '');
  const [manual, setManual] = useState({ firstName: '', lastName: '', email: '', phone: '', packageTitle: '' });
  const [items, setItems] = useState<Item[]>(
    lead
      ? [{ description: `${lead.event_slug ? lead.event_slug + ' – ' : ''}${lead.package_title || 'Pauschalreise'}\n${lead.number_of_persons || 1} Person(en)`, quantity: 1, unit_price: lead.total_price || 0 }]
      : [{ description: '', quantity: 1, unit_price: 0 }]
  );
  const [dueDays, setDueDays] = useState(14);
  const [meta, setMeta] = useState({ event_name: '', destination: '', hotel_description: '', ticket_details: '', thank_you_text: '' });
  const [showMeta, setShowMeta] = useState(false);
  const setM = (k: keyof typeof meta, v: string) => setMeta((m) => ({ ...m, [k]: v }));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const setItem = (idx: number, patch: Partial<Item>) => setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const create = async () => {
    setError(null);
    if (items.some((i) => !i.description.trim() || i.unit_price <= 0)) { setError('Bitte alle Positionen ausfüllen (Beschreibung + Preis).'); return; }
    const bookingId = lockedLead ? lead!.id : (mode === 'lead' ? selectedLeadId : null);
    if (mode === 'lead' && !bookingId) { setError('Bitte einen Lead auswählen.'); return; }
    if (mode === 'manual' && !manual.lastName.trim() && !manual.firstName.trim()) { setError('Bitte mindestens einen Kundennamen angeben.'); return; }

    const metaFilled = Object.entries(meta).filter(([, v]) => v.trim());
    const notesPayload = metaFilled.length ? JSON.stringify(Object.fromEntries(metaFilled)) : '';

    setCreating(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          manualCustomer: mode === 'manual' && !lockedLead ? manual : undefined,
          items: items.map((i) => ({ ...i, total_price: i.quantity * i.unit_price })),
          dueInDays: dueDays,
          notes: notesPayload,
        }),
      });
      const data = await res.json();
      if (data.success) { onCreated(); } else { setError('Fehler: ' + data.error); }
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: '#f0f7ff', border: '1.5px solid #1a6fa820' }}>
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm" style={{ color: '#143047' }}>Neue Rechnung</span>
        {onCancel && <button onClick={onCancel} aria-label="Schließen"><X className="w-4 h-4 text-gray-400" /></button>}
      </div>

      {/* Empfänger: nur wenn nicht an festen Lead gebunden (CRM) */}
      {!lockedLead && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {(['lead', 'manual'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className="flex-1 rounded-lg px-3 py-1.5 text-xs font-bold transition"
                style={{ background: mode === m ? '#143047' : '#fff', color: mode === m ? '#fff' : '#143047', border: '1px solid #d8dde4' }}>
                {m === 'lead' ? 'Bestehender Lead' : 'Individuelle Buchung'}
              </button>
            ))}
          </div>

          {mode === 'lead' ? (
            <select value={selectedLeadId} onChange={(e) => setSelectedLeadId(e.target.value)} className={cls} style={bd}>
              <option value="">– Lead wählen –</option>
              {(leads || []).map((l) => <option key={l.id} value={l.id}>{leadLabel(l)}</option>)}
            </select>
          ) : (
            <div className="space-y-2 rounded-lg bg-white p-3" style={bd}>
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Vorname" value={manual.firstName} onChange={(e) => setManual((m) => ({ ...m, firstName: e.target.value }))} className={cls} style={bd} />
                <input placeholder="Nachname" value={manual.lastName} onChange={(e) => setManual((m) => ({ ...m, lastName: e.target.value }))} className={cls} style={bd} />
              </div>
              <input placeholder="E-Mail" type="email" value={manual.email} onChange={(e) => setManual((m) => ({ ...m, email: e.target.value }))} className={cls} style={bd} />
              <input placeholder="Telefon" value={manual.phone} onChange={(e) => setManual((m) => ({ ...m, phone: e.target.value }))} className={cls} style={bd} />
              <input placeholder="Bezeichnung der Buchung (optional)" value={manual.packageTitle} onChange={(e) => setManual((m) => ({ ...m, packageTitle: e.target.value }))} className={cls} style={bd} />
            </div>
          )}
        </div>
      )}

      {/* Positionen */}
      {items.map((item, idx) => (
        <div key={idx} className="bg-white rounded-lg p-3 space-y-2" style={bd}>
          <textarea value={item.description} onChange={(e) => setItem(idx, { description: e.target.value })} rows={2} placeholder="Beschreibung" className={`${cls} resize-none`} style={bd} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">Anzahl</label>
              <input type="number" value={item.quantity} onChange={(e) => setItem(idx, { quantity: parseInt(e.target.value) || 1 })} min="1" className={cls} style={bd} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Einzelpreis (€)</label>
              <input type="number" value={item.unit_price} onChange={(e) => setItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} min="0" step="0.01" className={cls} style={bd} />
            </div>
          </div>
          <div className="text-xs text-right font-semibold text-gray-700">Gesamt: {fmt(item.quantity * item.unit_price)}</div>
          {items.length > 1 && (
            <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="text-xs text-red-500 hover:text-red-700">Position entfernen</button>
          )}
        </div>
      ))}

      <button onClick={() => setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }])}
        className="w-full py-2 rounded-lg text-sm border-2 border-dashed text-gray-500 hover:bg-white transition flex items-center justify-center gap-1" style={bd}>
        <Plus className="w-3 h-3" /> Position hinzufügen
      </button>

      <div>
        <label className="text-xs text-gray-500">Zahlungsziel (Tage)</label>
        <input type="number" value={dueDays} onChange={(e) => setDueDays(parseInt(e.target.value) || 14)} min="1" className={cls} style={bd} />
      </div>

      <button type="button" onClick={() => setShowMeta((v) => !v)} className="text-xs font-semibold" style={{ color: '#18395a' }}>
        {showMeta ? '▾' : '▸'} Rechnungs-Texte individualisieren (optional)
      </button>
      {showMeta && (
        <div className="space-y-2 rounded-lg bg-white p-3" style={bd}>
          <p className="text-[11px] text-gray-400">Überschreiben die automatischen Werte auf der PDF – ideal für individuelle Buchungen.</p>
          <input placeholder="Event-/Reise-Name" value={meta.event_name} onChange={(e) => setM('event_name', e.target.value)} className={cls} style={bd} />
          <input placeholder="Reiseziel / Destination" value={meta.destination} onChange={(e) => setM('destination', e.target.value)} className={cls} style={bd} />
          <input placeholder="Hotel-Beschreibung" value={meta.hotel_description} onChange={(e) => setM('hotel_description', e.target.value)} className={cls} style={bd} />
          <textarea rows={2} placeholder="Ticket-Details" value={meta.ticket_details} onChange={(e) => setM('ticket_details', e.target.value)} className={`${cls} resize-none`} style={bd} />
          <textarea rows={2} placeholder="Danke-Text (unten auf der Rechnung)" value={meta.thank_you_text} onChange={(e) => setM('thank_you_text', e.target.value)} className={`${cls} resize-none`} style={bd} />
        </div>
      )}

      <div className="flex items-center justify-between text-sm font-bold pt-1" style={{ color: '#143047' }}>
        <span>Rechnungssumme</span><span>{fmt(total)}</span>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2 border border-red-200">{error}</p>}

      <button onClick={create} disabled={creating}
        className="w-full py-2.5 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: '#143047' }}>
        {creating ? 'Wird erstellt…' : '📄 Rechnung erstellen'}
      </button>
    </div>
  );
}
