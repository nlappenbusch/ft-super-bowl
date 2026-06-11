'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { Building2, Banknote, FileText, CalendarDays, Globe, Save, CheckCircle, AlertCircle } from 'lucide-react';
import type { AllSettings } from '@/lib/settingsStore';
import {
  COLORS,
  PageHeader,
  SectionCard,
  Button,
  Tabs,
  Toggle,
  Spinner,
  InputField,
  TextAreaField,
} from '@/components/admin/ui';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type Tab = 'company' | 'bank' | 'invoice' | 'event' | 'site';

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
      <div className="flex items-center justify-center gap-3 py-20 text-sm" style={{ color: COLORS.textMuted }}>
        <Spinner /> Lädt…
      </div>
    </AdminShell>
  );

  if (!settings) return (
    <AdminShell title="Einstellungen">
      <div className="flex items-center justify-center gap-2 py-20 text-sm" style={{ color: COLORS.danger }}>
        <AlertCircle className="w-4 h-4" /> Einstellungen konnten nicht geladen werden.
      </div>
    </AdminShell>
  );

  const saveButton = (
    <Button onClick={handleSave} disabled={saving}>
      {saving ? <Spinner className="h-4 w-4" /> : <Save className="w-4 h-4" />}
      {saving ? 'Speichern…' : 'Einstellungen speichern'}
    </Button>
  );

  return (
    <AdminShell title="Einstellungen">
      <PageHeader
        title="Einstellungen"
        description="Firmen-, Rechnungs- und Website-Konfiguration verwalten"
        actions={saveButton}
      />

      {/* Status messages */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ color: COLORS.danger, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}
      {saved && (
        <div className="mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ color: COLORS.ok, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <CheckCircle className="w-4 h-4" /> Einstellungen gespeichert!
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
      </div>

      {/* Tab: Firma */}
      {tab === 'company' && (
        <div className="space-y-6">
          <SectionCard title="Firmenname & Rechtsform" icon={<Building2 className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Firmenname" value={settings.company.name} onChange={e => update('company', 'name', e.target.value)} placeholder="Faltin Travel AG" />
              <InputField label="Rechtsform" value={settings.company.legal_form} onChange={e => update('company', 'legal_form', e.target.value)} placeholder="AG" hint="z.B. AG, GmbH — wird hinter dem Namen angezeigt" />
            </div>
          </SectionCard>
          <SectionCard title="Adresse">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Strasse & Hausnummer" value={settings.company.street} onChange={e => update('company', 'street', e.target.value)} />
              <InputField label="PLZ" value={settings.company.zip} onChange={e => update('company', 'zip', e.target.value)} />
              <InputField label="Ort" value={settings.company.city} onChange={e => update('company', 'city', e.target.value)} />
              <InputField label="Land (Kürzel)" value={settings.company.country} onChange={e => update('company', 'country', e.target.value)} placeholder="CH" />
            </div>
          </SectionCard>
          <SectionCard title="Kontakt">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Telefon" value={settings.company.phone} onChange={e => update('company', 'phone', e.target.value)} placeholder="+41 44 700 22 77" />
              <InputField label="Fax" value={settings.company.fax} onChange={e => update('company', 'fax', e.target.value)} />
              <InputField label="E-Mail" value={settings.company.email} onChange={e => update('company', 'email', e.target.value)} />
              <InputField label="Website" value={settings.company.website} onChange={e => update('company', 'website', e.target.value)} />
            </div>
          </SectionCard>
          <SectionCard title="Handelsregister & Steuern">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="UID / MWST-Nummer" value={settings.company.uid} onChange={e => update('company', 'uid', e.target.value)} placeholder="CHE-267.347.685 MWST" />
              <InputField label="HR-ID" value={settings.company.hr_id} onChange={e => update('company', 'hr_id', e.target.value)} />
              <InputField label="Geschäftsführer / Inhaber" value={settings.company.ceo} onChange={e => update('company', 'ceo', e.target.value)} />
              <InputField label="Logo-Pfad (in /public)" value={settings.company.logo_path} onChange={e => update('company', 'logo_path', e.target.value)} placeholder="/faltin_logo_black.png" hint="Relativer Pfad, z.B. /faltin_logo_black.png" />
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab: Bank */}
      {tab === 'bank' && (
        <div className="space-y-6">
          <SectionCard title="Bankverbindung" icon={<Banknote className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Bank" value={settings.bank.bank_name} onChange={e => update('bank', 'bank_name', e.target.value)} placeholder="UBS Switzerland AG" />
              <InputField label="Kontoinhaber" value={settings.bank.account_holder} onChange={e => update('bank', 'account_holder', e.target.value)} />
              <InputField
                label="IBAN (ohne Leerzeichen)"
                value={settings.bank.iban}
                onChange={e => update('bank', 'iban', e.target.value.replace(/\s/g, '').toUpperCase())}
                placeholder="CH6500291291113518607"
                hint="Nur Buchstaben und Zahlen, keine Leerzeichen — werden automatisch formatiert"
              />
              <InputField label="BIC / SWIFT" value={settings.bank.bic_swift} onChange={e => update('bank', 'bic_swift', e.target.value)} placeholder="UBSWCHZH80A" />
              <InputField label="Währung" value={settings.bank.currency} onChange={e => update('bank', 'currency', e.target.value)} placeholder="EUR" hint="EUR oder CHF" />
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab: Rechnung */}
      {tab === 'invoice' && (
        <div className="space-y-6">
          <SectionCard title="Rechnungsnummer" icon={<FileText className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Präfix"
                value={settings.invoice.prefix}
                onChange={e => update('invoice', 'prefix', e.target.value)}
                placeholder="RE"
                hint="Rechnungen werden als RE-2026-0001 nummeriert"
              />
              <InputField
                label="Standard-Zahlungsziel (Tage)"
                value={settings.invoice.due_days}
                onChange={e => update('invoice', 'due_days', parseInt(e.target.value) || 14)}
                type="number"
                placeholder="14"
              />
            </div>
          </SectionCard>
          <SectionCard title="MWST">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="MWST-Satz (%)"
                value={settings.invoice.vat_rate}
                onChange={e => update('invoice', 'vat_rate', parseFloat(e.target.value) || 0)}
                type="number"
                placeholder="0"
                hint="0 = steuerbefreit"
              />
              <InputField
                label="MWST-Anzeige auf Rechnung"
                value={settings.invoice.vat_note}
                onChange={e => update('invoice', 'vat_note', e.target.value)}
                placeholder="Mehrwertsteuer 0%"
              />
            </div>
          </SectionCard>
          <SectionCard title="Zahlungshinweis-Text (Fusszeile Rechnung)">
            <TextAreaField
              value={settings.invoice.payment_note}
              onChange={e => update('invoice', 'payment_note', e.target.value)}
              rows={4}
              hint="Dieser Text erscheint auf jeder Rechnung als Zahlungshinweis"
            />
          </SectionCard>
          <SectionCard title="Swiss QR-Code">
            <div className="flex flex-col gap-2">
              <Toggle
                label="Swiss QR-Code auf Rechnung anzeigen"
                checked={settings.invoice.show_qr}
                onChange={v => update('invoice', 'show_qr', v)}
              />
              <p className="text-xs" style={{ color: '#9ca3af' }}>Seite 2 der PDF-Rechnung enthält den Swiss QR-Payment Code</p>
            </div>
          </SectionCard>
          <SectionCard title="Logos auf Rechnung">
            <InputField
              label="Reisegarantie-Logo (in /public)"
              value={settings.invoice.reisegarantie_logo}
              onChange={e => update('invoice', 'reisegarantie_logo', e.target.value)}
              placeholder="/reisegarantielogo-de-768x258.webp"
              hint="Leer lassen wenn kein Garantiesiegel angezeigt werden soll"
            />
          </SectionCard>
        </div>
      )}

      {/* Tab: Event / PDF */}
      {tab === 'event' && (
        <div className="space-y-6">
          <div className="rounded-xl p-4 text-sm" style={{ background: '#f0f7ff', border: `1.5px solid ${COLORS.info}20`, color: COLORS.navy }}>
            <strong>Hinweis:</strong> Diese Angaben sind <em>Fallback-Werte</em> für das Rechnungs-PDF. Primär werden die Daten aus dem gebuchten Event geladen (Name, Datum, Venue). Diese Werte greifen nur wenn das Event keine entsprechenden Daten hat.
          </div>
          <SectionCard title="Event-Daten" icon={<CalendarDays className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Event-Name (Fallback)" value={settings.event.event_name} onChange={e => update('event', 'event_name', e.target.value)} placeholder="French Open 2027" />
              <InputField label="Destination (Fallback)" value={settings.event.destination} onChange={e => update('event', 'destination', e.target.value)} placeholder="Frankreich – Paris" />
              <InputField label="Hotel-Beschreibung (Fallback)" value={settings.event.hotel_description} onChange={e => update('event', 'hotel_description', e.target.value)} placeholder="5* Hotel in Paris" />
            </div>
          </SectionCard>
          <SectionCard title="Reisetermine (Fallback)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Standard Check-in" value={settings.event.base_checkin} onChange={e => update('event', 'base_checkin', e.target.value)} type="date" hint="Greifen wenn das Event kein start_date hat" />
              <InputField label="Standard Check-out" value={settings.event.base_checkout} onChange={e => update('event', 'base_checkout', e.target.value)} type="date" />
            </div>
          </SectionCard>
          <SectionCard title="Dankes-Text auf Rechnung (Seite 2)">
            <TextAreaField
              value={settings.event.thank_you_text}
              onChange={e => update('event', 'thank_you_text', e.target.value)}
              rows={3}
              hint="Wird auf Seite 2 der PDF-Rechnung angezeigt"
            />
          </SectionCard>
        </div>
      )}

      {/* Tab: Website */}
      {tab === 'site' && (
        <div className="space-y-6">
          <div className="rounded-xl p-4 text-sm" style={{ background: '#fff8f5', border: `1.5px solid ${COLORS.accent}20`, color: COLORS.navy }}>
            <strong>Info:</strong> Diese Angaben steuern SEO-Titel, Meta-Description und das OG-Image der Website. Nach Änderungen ist ein Neustart des Servers notwendig damit die Next.js Metadata API die Werte aufgreift.
          </div>
          <SectionCard title="SEO & Branding" icon={<Globe className="w-5 h-5" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Site-Titel (Browser-Tab)" value={settings.site.site_title} onChange={e => update('site', 'site_title', e.target.value)} placeholder="French Open 2027 Tickets | Faltin Travel" />
              <InputField label="Kurzname / Event-Name" value={settings.site.site_name} onChange={e => update('site', 'site_name', e.target.value)} placeholder="French Open 2027" />
              <InputField label="OG-Image (in /public)" value={settings.site.og_image} onChange={e => update('site', 'og_image', e.target.value)} placeholder="/french-open-og.webp" />
            </div>
          </SectionCard>
          <SectionCard title="Meta-Description">
            <TextAreaField
              value={settings.site.site_description}
              onChange={e => update('site', 'site_description', e.target.value)}
              rows={3}
            />
          </SectionCard>
          <SectionCard title="Admin">
            <InputField
              label="Admin-Passwort"
              value={settings.site.admin_password}
              onChange={e => update('site', 'admin_password', e.target.value)}
              type="password"
              hint="Passwort für den Admin-Bereich — nach Änderung neu einloggen"
            />
          </SectionCard>
        </div>
      )}

      {/* Save bar */}
      <div
        className="sticky bottom-0 left-0 right-0 mt-8 -mx-6 flex items-center justify-end gap-4 px-6 py-4"
        style={{ background: 'white', borderTop: `1.5px solid ${COLORS.stroke}`, marginBottom: -32 }}
      >
        {error && (
          <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.danger }}>
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.ok }}>
            <CheckCircle className="w-4 h-4" /> Einstellungen gespeichert!
          </div>
        )}
        {saveButton}
      </div>
    </AdminShell>
  );
}
