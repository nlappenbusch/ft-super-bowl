'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { Building2, Banknote, FileText, CalendarDays, Globe, Save, CheckCircle, AlertCircle } from 'lucide-react';
import type { AllSettings } from '@/lib/settingsStore';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Tab = 'company' | 'bank' | 'invoice' | 'event' | 'site';

/* ─── Input helpers ──────────────────────────────────────────────────────── */
function Field({ label, value, onChange, placeholder, type = 'text', hint }: {
  label: string; value: string | number; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
        style={{ borderColor: '#e5e8ed', focusRingColor: '#143047' } as React.CSSProperties}
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function TextareaField({ label, value, onChange, rows = 3, hint }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
        style={{ borderColor: '#e5e8ed' }}
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="relative shrink-0 w-10 h-6 rounded-full transition-colors mt-0.5"
        style={{ background: checked ? '#143047' : '#d1d5db' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </button>
      <div>
        <div className="text-sm font-semibold" style={{ color: '#143047' }}>{label}</div>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    </div>
  );
}

/* ─── Section wrapper ────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm font-bold mb-3 pb-2 border-b" style={{ color: '#143047', borderColor: '#e5e8ed' }}>{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function SettingsPage() {
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('company');

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { if (d.success) setSettings(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Fehler beim Speichern');
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const update = (section: keyof AllSettings, key: string, value: unknown) => {
    setSettings(prev => prev ? {
      ...prev,
      [section]: { ...(prev[section] as unknown as Record<string, unknown>), [key]: value }
    } : null);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'company', label: 'Firma',          icon: <Building2 className="w-4 h-4" /> },
    { id: 'bank',    label: 'Bankverbindung', icon: <Banknote className="w-4 h-4" /> },
    { id: 'invoice', label: 'Rechnung',       icon: <FileText className="w-4 h-4" /> },
    { id: 'event',   label: 'Event / PDF',    icon: <CalendarDays className="w-4 h-4" /> },
    { id: 'site',    label: 'Website',        icon: <Globe className="w-4 h-4" /> },
  ];

  if (loading) return (
    <AdminShell title="Einstellungen">
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Lädt…</div>
    </AdminShell>
  );

  if (!settings) return (
    <AdminShell title="Einstellungen">
      <div className="flex items-center justify-center py-20 text-red-500 text-sm">Einstellungen konnten nicht geladen werden.</div>
    </AdminShell>
  );

  return (
    <AdminShell title="Einstellungen">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6 border-b pb-0" style={{ borderColor: '#e5e8ed' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition"
            style={{
              borderBottomColor: tab === t.id ? '#143047' : 'transparent',
              color: tab === t.id ? '#143047' : '#6b7280',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Firma */}
      {tab === 'company' && (
        <div>
          <Section title="Firmenname & Rechtsform">
            <Field label="Firmenname" value={settings.company.name} onChange={v => update('company', 'name', v)} placeholder="Faltin Travel AG" />
            <Field label="Rechtsform" value={settings.company.legal_form} onChange={v => update('company', 'legal_form', v)} placeholder="AG" hint="z.B. AG, GmbH — wird hinter dem Namen angezeigt" />
          </Section>
          <Section title="Adresse">
            <Field label="Strasse & Hausnummer" value={settings.company.street} onChange={v => update('company', 'street', v)} />
            <Field label="PLZ" value={settings.company.zip} onChange={v => update('company', 'zip', v)} />
            <Field label="Ort" value={settings.company.city} onChange={v => update('company', 'city', v)} />
            <Field label="Land (Kürzel)" value={settings.company.country} onChange={v => update('company', 'country', v)} placeholder="CH" />
          </Section>
          <Section title="Kontakt">
            <Field label="Telefon" value={settings.company.phone} onChange={v => update('company', 'phone', v)} placeholder="+41 44 700 22 77" />
            <Field label="Fax" value={settings.company.fax} onChange={v => update('company', 'fax', v)} />
            <Field label="E-Mail" value={settings.company.email} onChange={v => update('company', 'email', v)} />
            <Field label="Website" value={settings.company.website} onChange={v => update('company', 'website', v)} />
          </Section>
          <Section title="Handelsregister & Steuern">
            <Field label="UID / MWST-Nummer" value={settings.company.uid} onChange={v => update('company', 'uid', v)} placeholder="CHE-267.347.685 MWST" />
            <Field label="HR-ID" value={settings.company.hr_id} onChange={v => update('company', 'hr_id', v)} />
            <Field label="Geschäftsführer / Inhaber" value={settings.company.ceo} onChange={v => update('company', 'ceo', v)} />
            <Field label="Logo-Pfad (in /public)" value={settings.company.logo_path} onChange={v => update('company', 'logo_path', v)} placeholder="/faltin_logo_black.png" hint="Relativer Pfad, z.B. /faltin_logo_black.png" />
          </Section>
        </div>
      )}

      {/* Tab: Bank */}
      {tab === 'bank' && (
        <div>
          <Section title="Bankverbindung">
            <Field label="Bank" value={settings.bank.bank_name} onChange={v => update('bank', 'bank_name', v)} placeholder="UBS Switzerland AG" />
            <Field label="Kontoinhaber" value={settings.bank.account_holder} onChange={v => update('bank', 'account_holder', v)} />
            <Field
              label="IBAN (ohne Leerzeichen)"
              value={settings.bank.iban}
              onChange={v => update('bank', 'iban', v.replace(/\s/g, '').toUpperCase())}
              placeholder="CH6500291291113518607"
              hint="Nur Buchstaben und Zahlen, keine Leerzeichen — werden automatisch formatiert"
            />
            <Field label="BIC / SWIFT" value={settings.bank.bic_swift} onChange={v => update('bank', 'bic_swift', v)} placeholder="UBSWCHZH80A" />
            <Field label="Währung" value={settings.bank.currency} onChange={v => update('bank', 'currency', v)} placeholder="EUR" hint="EUR oder CHF" />
          </Section>
        </div>
      )}

      {/* Tab: Rechnung */}
      {tab === 'invoice' && (
        <div>
          <Section title="Rechnungsnummer">
            <Field
              label="Präfix"
              value={settings.invoice.prefix}
              onChange={v => update('invoice', 'prefix', v)}
              placeholder="RE"
              hint="Rechnungen werden als RE-2026-0001 nummeriert"
            />
            <Field
              label="Standard-Zahlungsziel (Tage)"
              value={settings.invoice.due_days}
              onChange={v => update('invoice', 'due_days', parseInt(v) || 14)}
              type="number"
              placeholder="14"
            />
          </Section>
          <Section title="MWST">
            <Field
              label="MWST-Satz (%)"
              value={settings.invoice.vat_rate}
              onChange={v => update('invoice', 'vat_rate', parseFloat(v) || 0)}
              type="number"
              placeholder="0"
              hint="0 = steuerbefreit"
            />
            <Field
              label="MWST-Anzeige auf Rechnung"
              value={settings.invoice.vat_note}
              onChange={v => update('invoice', 'vat_note', v)}
              placeholder="Mehrwertsteuer 0%"
            />
          </Section>
          <div className="mb-6">
            <h3 className="text-sm font-bold mb-3 pb-2 border-b" style={{ color: '#143047', borderColor: '#e5e8ed' }}>Zahlungshinweis-Text (Fusszeile Rechnung)</h3>
            <TextareaField
              label=""
              value={settings.invoice.payment_note}
              onChange={v => update('invoice', 'payment_note', v)}
              rows={4}
              hint="Dieser Text erscheint auf jeder Rechnung als Zahlungshinweis"
            />
          </div>
          <div className="mb-4">
            <Toggle
              label="Swiss QR-Code auf Rechnung anzeigen"
              checked={settings.invoice.show_qr}
              onChange={v => update('invoice', 'show_qr', v)}
              hint="Seite 2 der PDF-Rechnung enthält den Swiss QR-Payment Code"
            />
          </div>
          <Section title="Logos auf Rechnung">
            <Field
              label="Reisegarantie-Logo (in /public)"
              value={settings.invoice.reisegarantie_logo}
              onChange={v => update('invoice', 'reisegarantie_logo', v)}
              placeholder="/reisegarantielogo-de-768x258.webp"
              hint="Leer lassen wenn kein Garantiesiegel angezeigt werden soll"
            />
          </Section>
        </div>
      )}

      {/* Tab: Event / PDF */}
      {tab === 'event' && (
        <div>
          <div className="mb-4 rounded-xl p-4 text-sm" style={{ background: '#f0f7ff', border: '1.5px solid #1a6fa820' }}>
            <strong>Hinweis:</strong> Diese Angaben sind <em>Fallback-Werte</em> für das Rechnungs-PDF. Primär werden die Daten aus dem gebuchten Event geladen (Name, Datum, Venue). Diese Werte greifen nur wenn das Event keine entsprechenden Daten hat.
          </div>
          <Section title="Event-Daten">
            <Field label="Event-Name (Fallback)" value={settings.event.event_name} onChange={v => update('event', 'event_name', v)} placeholder="French Open 2027" />
            <Field label="Destination (Fallback)" value={settings.event.destination} onChange={v => update('event', 'destination', v)} placeholder="Frankreich – Paris" />
            <Field label="Hotel-Beschreibung (Fallback)" value={settings.event.hotel_description} onChange={v => update('event', 'hotel_description', v)} placeholder="5* Hotel in Paris" />
          </Section>
          <Section title="Reisetermine (Fallback)">
            <Field label="Standard Check-in" value={settings.event.base_checkin} onChange={v => update('event', 'base_checkin', v)} type="date" hint="Greifen wenn das Event kein start_date hat" />
            <Field label="Standard Check-out" value={settings.event.base_checkout} onChange={v => update('event', 'base_checkout', v)} type="date" />
          </Section>
          <div className="mb-6">
            <h3 className="text-sm font-bold mb-3 pb-2 border-b" style={{ color: '#143047', borderColor: '#e5e8ed' }}>Dankes-Text auf Rechnung (Seite 2)</h3>
            <TextareaField
              label=""
              value={settings.event.thank_you_text}
              onChange={v => update('event', 'thank_you_text', v)}
              rows={3}
              hint="Wird auf Seite 2 der PDF-Rechnung angezeigt"
            />
          </div>
        </div>
      )}

      {/* Tab: Website */}
      {tab === 'site' && (
        <div>
          <div className="mb-4 rounded-xl p-4 text-sm" style={{ background: '#fff8f5', border: '1.5px solid #d9531e20' }}>
            <strong>Info:</strong> Diese Angaben steuern SEO-Titel, Meta-Description und das OG-Image der Website. Nach Änderungen ist ein Neustart des Servers notwendig damit die Next.js Metadata API die Werte aufgreift.
          </div>
          <Section title="SEO & Branding">
            <Field label="Site-Titel (Browser-Tab)" value={settings.site.site_title} onChange={v => update('site', 'site_title', v)} placeholder="French Open 2027 Tickets | Faltin Travel" />
            <Field label="Kurzname / Event-Name" value={settings.site.site_name} onChange={v => update('site', 'site_name', v)} placeholder="French Open 2027" />
            <Field label="OG-Image (in /public)" value={settings.site.og_image} onChange={v => update('site', 'og_image', v)} placeholder="/french-open-og.webp" />
          </Section>
          <div className="mb-6">
            <h3 className="text-sm font-bold mb-3 pb-2 border-b" style={{ color: '#143047', borderColor: '#e5e8ed' }}>Meta-Description</h3>
            <TextareaField
              label=""
              value={settings.site.site_description}
              onChange={v => update('site', 'site_description', v)}
              rows={3}
            />
          </div>
          <Section title="Admin">
            <Field
              label="Admin-Passwort"
              value={settings.site.admin_password}
              onChange={v => update('site', 'admin_password', v)}
              type="password"
              hint="Passwort für den Admin-Bereich — nach Änderung neu einloggen"
            />
          </Section>
        </div>
      )}

      {/* Save bar */}
      <div
        className="sticky bottom-0 left-0 right-0 mt-8 -mx-6 px-6 py-4 flex items-center justify-between gap-4"
        style={{ background: 'white', borderTop: '1.5px solid #e5e8ed', marginBottom: -32 }}
      >
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4" /> Einstellungen gespeichert!
          </div>
        )}
        {!error && !saved && <div />}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: '#143047' }}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Speichern…' : 'Einstellungen speichern'}
        </button>
      </div>
    </AdminShell>
  );
}
