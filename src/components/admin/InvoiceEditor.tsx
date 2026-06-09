'use client';

/**
 * InvoiceEditor – gemeinsamer Rechnungs-Editor (identisch zum Buchungen-Editor).
 * Verwendet in CRM (fester Lead), Finanzen (Lead wählen ODER individuelle Buchung)
 * und Buchungen. Erstellt über POST /api/invoices.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  SectionCard, Field, TextInput, TextArea, SelectInput, InputField, TextAreaField, Button, Spinner,
} from '@/components/admin/ui';

export interface InvoiceLead {
  id: string;
  email?: string;
  phone?: string;
  package_title?: string;
  event_slug?: string;
  number_of_persons?: number;
  double_rooms?: number;
  single_rooms?: number;
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

function defaultItemsFor(lead?: InvoiceLead): Item[] {
  if (!lead) return [{ description: '', quantity: 1, unit_price: 0 }];
  return [{
    description: `${lead.event_slug ? lead.event_slug + ' - ' : ''}${lead.package_title || 'Pauschalreise'}\n${lead.number_of_persons ?? 1} Personen, ${lead.double_rooms ?? 0} DZ, ${lead.single_rooms ?? 0} EZ`,
    quantity: 1,
    unit_price: lead.total_price || 0,
  }];
}

const DEFAULT_TICKET_DETAILS = [
  'Inkl. Zutritt zum VIP-Bereich mit Catering & Getränken',
  'Inkl. Faltin Travel Lanyard',
  'Inkl. detaillierte Reiseinformation & Schweizer Reisegarantie',
].join('\n');

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

  const selectedLead = lockedLead ? lead : (leads || []).find((l) => l.id === selectedLeadId);

  const [invoiceItems, setInvoiceItems] = useState<Item[]>(defaultItemsFor(lead));
  const [invoiceDueDays, setInvoiceDueDays] = useState(14);
  const [invoicePdfMeta, setInvoicePdfMeta] = useState({
    event_name: lead?.event_slug || '',
    destination: '',
    hotel_description: lead?.package_title || '',
    ticket_details: DEFAULT_TICKET_DETAILS,
    thank_you_text: '',
  });

  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wenn im Finanzen-Modus ein anderer Lead gewählt wird → Positionen/Meta vorbefüllen
  const applyLeadPrefill = (l?: InvoiceLead) => {
    setInvoiceItems(defaultItemsFor(l));
    setInvoicePdfMeta((prev) => ({
      ...prev,
      event_name: l?.event_slug || '',
      hotel_description: l?.package_title || '',
    }));
  };

  const updateInvoiceItem = (index: number, field: keyof Item, value: string | number) => {
    setInvoiceItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };
  const removeInvoiceItem = (index: number) => setInvoiceItems((prev) => prev.filter((_, i) => i !== index));
  const addInvoiceItem = () => setInvoiceItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }]);

  const addExtraNight = (position: 'before' | 'after') => {
    const timing = position === 'before' ? 'VORAB' : 'VERLÄNGERUNG';
    setInvoiceItems((prev) => {
      const idx = prev.findIndex((it) =>
        it.description.toLowerCase().includes('zusatznacht') && it.description.toLowerCase().includes(timing.toLowerCase()));
      if (idx !== -1) return prev.map((it, i) => (i === idx ? { ...it, quantity: it.quantity + 1 } : it));
      return [...prev, { description: `Zusatznacht ${timing}\nDoppelzimmer mit Frühstück`, quantity: 1, unit_price: 0 }];
    });
  };

  const invoiceTotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const createInvoice = async () => {
    setError(null);

    if (invoiceItems.length === 0) { setError('Bitte mindestens eine Position hinzufügen.'); return; }
    if (invoiceItems.some((i) => !i.description.trim())) { setError('Alle Positionen müssen eine Beschreibung haben.'); return; }
    if (invoiceItems.some((i) => i.unit_price <= 0 || i.quantity <= 0)) { setError('Preis und Anzahl müssen größer als 0 sein.'); return; }

    const bookingId = lockedLead ? lead!.id : (mode === 'lead' ? selectedLeadId : null);
    if (mode === 'lead' && !bookingId) { setError('Bitte einen Lead auswählen.'); return; }
    if (mode === 'manual' && !manual.lastName.trim() && !manual.firstName.trim()) { setError('Bitte mindestens einen Kundennamen angeben.'); return; }

    const items = invoiceItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
    }));

    const notesJson = JSON.stringify({
      event_name: invoicePdfMeta.event_name,
      destination: invoicePdfMeta.destination,
      hotel_description: invoicePdfMeta.hotel_description,
      ticket_details: invoicePdfMeta.ticket_details,
      thank_you_text: invoicePdfMeta.thank_you_text,
    });

    setIsCreatingInvoice(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          manualCustomer: mode === 'manual' && !lockedLead ? manual : undefined,
          items,
          dueInDays: invoiceDueDays,
          notes: notesJson,
        }),
      });
      const data = await res.json();
      if (data.success) { onCreated(); } else { setError('Fehler: ' + data.error); }
    } catch {
      setError('Verbindungsfehler.');
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  return (
    <SectionCard
      title="Neue Rechnung erstellen"
      actions={onCancel ? (
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      ) : undefined}
    >
      {/* Empfänger: nur wenn nicht an festen Lead gebunden (Finanzen) */}
      {!lockedLead && (
        <div className="mb-5 space-y-3">
          <div className="flex gap-2">
            {(['lead', 'manual'] as const).map((m) => (
              <Button
                key={m}
                size="sm"
                variant={mode === m ? 'primary' : 'secondary'}
                onClick={() => setMode(m)}
              >
                {m === 'lead' ? 'Bestehender Lead' : 'Individuelle Buchung'}
              </Button>
            ))}
          </div>

          {mode === 'lead' ? (
            <Field label="Lead / Buchung">
              <SelectInput
                value={selectedLeadId}
                onChange={(e) => { setSelectedLeadId(e.target.value); applyLeadPrefill((leads || []).find((l) => l.id === e.target.value)); }}
              >
                <option value="">– Lead wählen –</option>
                {(leads || []).map((l) => <option key={l.id} value={l.id}>{leadLabel(l)}</option>)}
              </SelectInput>
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Vorname" value={manual.firstName} onChange={(e) => setManual((m) => ({ ...m, firstName: e.target.value }))} />
              <InputField label="Nachname" value={manual.lastName} onChange={(e) => setManual((m) => ({ ...m, lastName: e.target.value }))} />
              <InputField label="E-Mail" type="email" value={manual.email} onChange={(e) => setManual((m) => ({ ...m, email: e.target.value }))} />
              <InputField label="Telefon" value={manual.phone} onChange={(e) => setManual((m) => ({ ...m, phone: e.target.value }))} />
              <div className="col-span-2">
                <InputField label="Bezeichnung der Buchung" value={manual.packageTitle} onChange={(e) => setManual((m) => ({ ...m, packageTitle: e.target.value }))} placeholder="z.B. Individuelle Reise" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Invoice Items */}
      <div className="mb-4 space-y-3">
        <Field label="Rechnungspositionen">
          <div className="space-y-3">
            {invoiceItems.map((item, index) => (
              <div key={index} className="grid grid-cols-12 items-start gap-2 rounded-xl border border-gray-200 p-3">
                <div className="col-span-6">
                  <TextArea
                    value={item.description}
                    onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                    placeholder="Beschreibung (z.B. Eventticket Package)"
                    rows={2}
                  />
                </div>
                <div className="col-span-2">
                  <TextInput
                    type="number"
                    value={item.quantity}
                    onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 1)}
                    placeholder="Anzahl"
                    min="1"
                  />
                </div>
                <div className="col-span-3">
                  <TextInput
                    type="number"
                    value={item.unit_price}
                    onChange={(e) => updateInvoiceItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    placeholder="Preis (CHF)"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  {invoiceItems.length > 1 && (
                    <Button size="sm" variant="danger" onClick={() => removeInvoiceItem(index)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="col-span-12 text-right text-sm font-semibold text-gray-700">
                  Gesamt: CHF {(item.quantity * item.unit_price).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Button variant="secondary" size="sm" onClick={() => addExtraNight('before')}>
            🏨 ← Nacht DAVOR
          </Button>
          <Button variant="secondary" size="sm" onClick={() => addExtraNight('after')}>
            🏨 Nacht DANACH →
          </Button>
          <Button variant="secondary" size="sm" onClick={addInvoiceItem}>
            <Plus className="h-4 w-4" />
            Andere Position
          </Button>
        </div>
      </div>

      {/* Due Date */}
      <Field label="Fälligkeitsfrist (Tage)" className="mb-4">
        <SelectInput value={invoiceDueDays} onChange={(e) => setInvoiceDueDays(parseInt(e.target.value))}>
          <option value="7">7 Tage</option>
          <option value="14">14 Tage (Standard)</option>
          <option value="21">21 Tage</option>
          <option value="30">30 Tage</option>
        </SelectInput>
      </Field>

      {/* PDF Meta Fields */}
      <details className="mb-4 overflow-hidden rounded-xl border border-gray-200">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-semibold" style={{ color: '#143047' }}>
          📄 PDF-Felder bearbeiten <span className="font-normal text-gray-500">(Veranstaltung, Destination, Details…)</span>
        </summary>
        <div className="space-y-3 border-t border-gray-200 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField
              label="Veranstaltung"
              value={invoicePdfMeta.event_name}
              onChange={(e) => setInvoicePdfMeta((p) => ({ ...p, event_name: e.target.value }))}
              placeholder="z.B. French Open 2027"
            />
            <InputField
              label="Destination"
              value={invoicePdfMeta.destination}
              onChange={(e) => setInvoicePdfMeta((p) => ({ ...p, destination: e.target.value }))}
              placeholder="z.B. Frankreich – Paris"
            />
          </div>
          <InputField
            label="Hotel / Package-Beschreibung"
            value={invoicePdfMeta.hotel_description}
            onChange={(e) => setInvoicePdfMeta((p) => ({ ...p, hotel_description: e.target.value }))}
            placeholder="z.B. 5* Hotel Roland Garros"
          />
          <TextAreaField
            label="Leistungen / Inklusivleistungen (eine pro Zeile)"
            hint="Diese Punkte erscheinen als Liste auf der Rechnung"
            value={invoicePdfMeta.ticket_details}
            onChange={(e) => setInvoicePdfMeta((p) => ({ ...p, ticket_details: e.target.value }))}
            rows={5}
            placeholder="Inkl. VIP-Zugang&#10;Inkl. Catering & Getränke&#10;Inkl. Reiseinformation"
            className="font-mono"
          />
          <InputField
            label="Dankes-Text (Seite 2)"
            value={invoicePdfMeta.thank_you_text}
            onChange={(e) => setInvoicePdfMeta((p) => ({ ...p, thank_you_text: e.target.value }))}
            placeholder="Leer = Standard-Text aus Einstellungen"
          />
        </div>
      </details>

      {/* Total Preview */}
      <div className="mb-4 rounded-xl border-2 p-4" style={{ borderColor: '#143047' }}>
        <div className="flex justify-between text-lg font-bold">
          <span style={{ color: '#143047' }}>Gesamtbetrag:</span>
          <span style={{ color: '#d9531e' }}>CHF {invoiceTotal.toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isCreatingInvoice} className="flex-1">
            Abbrechen
          </Button>
        )}
        <Button variant="primary" onClick={createInvoice} disabled={isCreatingInvoice} className="flex-1">
          {isCreatingInvoice ? (
            <>
              <Spinner className="h-4 w-4" />
              Erstelle Rechnung...
            </>
          ) : 'Rechnung erstellen'}
        </Button>
      </div>
    </SectionCard>
  );
}
