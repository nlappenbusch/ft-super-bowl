'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, SectionCard, Card, Button, InputField, Field, TextInput, Badge, Toggle, Spinner, COLORS,
} from '@/components/admin/ui';
import { buildEntraSetupScript } from '@/lib/entraSetupScript';
import {
  Mail, Send, RefreshCw, CheckCircle2, XCircle, Server, Inbox, ListChecks, KeyRound,
  Save, Terminal, Copy, Download, ShieldCheck,
} from 'lucide-react';

interface MailStatus {
  graphConfigured: boolean;
  mailbox: string;
  fromName: string;
  brevoConfigured: boolean;
  pollSecretSet: boolean;
}

interface MailConfig {
  tenant_id: string;
  client_id: string;
  mailbox: string;
  from_name: string;
  inbound_poll_secret: string;
  has_client_secret: boolean;
  has_brevo: boolean;
}

export default function MailAdminPage() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [cfg, setCfg] = useState<MailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable form state
  const [form, setForm] = useState({
    tenant_id: '', client_id: '', client_secret: '', mailbox: '', from_name: '',
    inbound_poll_secret: '', brevo_api_key: '', login_base_url: '',
  });

  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  // Script generator
  const [appName, setAppName] = useState('Faltin CRM Mailer');
  const [restrict, setRestrict] = useState(true);
  const [script, setScript] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        fetch('/api/admin/mail/status').then((r) => r.json()),
        fetch('/api/admin/mail/config').then((r) => r.json()),
      ]);
      if (s.success) setStatus(s.data);
      if (c.success) {
        setCfg(c.data);
        setForm((f) => ({
          ...f,
          tenant_id: c.data.tenant_id || '',
          client_id: c.data.client_id || '',
          mailbox: c.data.mailbox || '',
          from_name: c.data.from_name || 'Faltin Travel',
          inbound_poll_secret: c.data.inbound_poll_secret || '',
          login_base_url: c.data.login_base_url || '',
          client_secret: '',
          brevo_api_key: '',
        }));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 5000);
  };
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const genSecret = () =>
    set('inbound_poll_secret', (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, ''));
  const redirectUri = `${(form.login_base_url || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '')}/api/auth/microsoft/callback`;
  const loginCfg = Boolean((status as Record<string, unknown> | null)?.loginConfigured);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/mail/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) { flash(true, 'Mail-Einstellungen gespeichert.'); await load(); }
      else flash(false, data.error || 'Speichern fehlgeschlagen.');
    } catch { flash(false, 'Verbindungsfehler.'); }
    finally { setSaving(false); }
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    try {
      const res = await fetch('/api/admin/mail/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      flash(data.success, data.success ? data.message : data.error);
    } catch { flash(false, 'Verbindungsfehler.'); }
    finally { setTesting(false); }
  };

  const runPoll = async () => {
    setPolling(true);
    try {
      const res = await fetch('/api/admin/mail/poll', { method: 'POST' });
      const data = await res.json();
      if (data.success) flash(true, `Poll fertig: ${data.scanned} geprüft, ${data.matched} zugeordnet, ${data.skipped} übersprungen.`);
      else flash(false, data.error || 'Poll fehlgeschlagen.');
    } catch { flash(false, 'Verbindungsfehler.'); }
    finally { setPolling(false); }
  };

  const generate = () => {
    setScript(buildEntraSetupScript({ appName, mailbox: form.mailbox || 'request@faltintravel.com', restrict }));
  };
  const copyScript = async () => {
    try { await navigator.clipboard.writeText(script); flash(true, 'Script in die Zwischenablage kopiert.'); }
    catch { flash(false, 'Kopieren nicht möglich.'); }
  };
  const downloadScript = () => {
    const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'faltin-entra-setup.ps1';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell title="E-Mail / Microsoft 365">
      <PageHeader
        title="E-Mail / Microsoft 365"
        description="Konfiguration, Test, Eingang und Setup-Script – alles an einem Ort."
        actions={
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
          </Button>
        }
      />

      {toast && (
        <div className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
          style={{ background: toast.ok ? '#f0fdf4' : '#fef2f2', color: toast.ok ? COLORS.ok : COLORS.danger, border: `1px solid ${toast.ok ? '#bbf7d0' : '#fecaca'}` }}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {toast.msg}
        </div>
      )}

      {/* Connection banner */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: status?.graphConfigured ? '#f0fdf4' : '#fef2f2' }}>
              <Mail className="h-6 w-6" style={{ color: status?.graphConfigured ? COLORS.ok : COLORS.danger }} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: COLORS.navy }}>Microsoft 365 Graph</div>
              <div className="text-sm" style={{ color: COLORS.textMuted }}>
                {loading ? 'Prüfe…' : status?.graphConfigured ? 'Verbunden & versandbereit' : 'Nicht konfiguriert'}
              </div>
            </div>
          </div>
          {!loading && <Badge tone={status?.graphConfigured ? 'ok' : 'danger'}>{status?.graphConfigured ? 'Aktiv' : 'Inaktiv'}</Badge>}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editable config */}
        <SectionCard title="Konfiguration" description="Werte hier pflegen (haben Vorrang vor .env)" icon={<Server className="h-5 w-5" />}
          actions={<Button variant="accent" size="sm" onClick={save} disabled={saving}>{saving ? <Spinner className="h-4 w-4 border-white" /> : <Save className="h-4 w-4" />} Speichern</Button>}>
          {loading ? (
            <div className="py-8 text-center"><Spinner /></div>
          ) : (
            <div className="grid gap-4">
              <InputField label="Tenant-ID" value={form.tenant_id} onChange={(e) => set('tenant_id', e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
              <InputField label="Client-ID" value={form.client_id} onChange={(e) => set('client_id', e.target.value)} placeholder="App (Client) ID" />
              <InputField
                label="Client-Secret"
                type="password"
                value={form.client_secret}
                onChange={(e) => set('client_secret', e.target.value)}
                placeholder={cfg?.has_client_secret ? '•••••••• (gesetzt – leer lassen = unverändert)' : 'Client-Secret eintragen'}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <InputField label="Postfach (Mailbox)" value={form.mailbox} onChange={(e) => set('mailbox', e.target.value)} placeholder="request@faltintravel.com" />
                <InputField label="Absendername" value={form.from_name} onChange={(e) => set('from_name', e.target.value)} placeholder="Faltin Travel" />
              </div>
              <Field
                label="Inbound-Poll-Secret"
                hint="Frei wählbares Passwort – schützt NUR unseren Cron-Endpoint /api/inbound/poll. Hat nichts mit Azure/MS Graph zu tun. Einfach generieren lassen."
              >
                <div className="flex gap-2">
                  <TextInput
                    value={form.inbound_poll_secret}
                    onChange={(e) => set('inbound_poll_secret', e.target.value)}
                    placeholder="langes Zufalls-Token"
                    className="flex-1"
                  />
                  <Button type="button" variant="secondary" onClick={genSecret}>Generieren</Button>
                </div>
              </Field>
              <InputField
                label="Brevo API-Key (Listen)"
                type="password"
                value={form.brevo_api_key}
                onChange={(e) => set('brevo_api_key', e.target.value)}
                placeholder={cfg?.has_brevo ? '•••••••• (gesetzt – leer lassen = unverändert)' : 'Brevo API-Key'}
              />
              <p className="text-xs" style={{ color: '#9ca3af' }}>
                Secrets werden serverseitig in <span className="font-mono">data/settings.json</span> gespeichert. Leer lassen = bestehenden Wert behalten.
              </p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Microsoft 365 Login (SSO)" description="Damit der „Mit Microsoft 365 anmelden“-Button funktioniert. Nutzt dieselbe App-Registrierung wie der Mailversand." icon={<KeyRound className="h-5 w-5" />}>
          <div className="grid gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${loginCfg ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <span className="font-semibold" style={{ color: COLORS.navy }}>{loginCfg ? 'SSO-Login aktiv' : 'SSO-Login inaktiv'}</span>
              {!loginCfg && <span className="text-xs text-gray-500">– Tenant-ID, Client-ID & Client-Secret oben ausfüllen</span>}
            </div>
            <InputField label="App-Basis-URL (für Redirect)" value={form.login_base_url} onChange={(e) => set('login_base_url', e.target.value)} placeholder="https://next.faltintravel.com" />
            <Field label="Redirect-URI – genau so in Azure registrieren" hint="Azure-Portal → App-Registrierung → Authentifizierung → Plattform „Web“ → Umleitungs-URIs.">
              <div className="flex gap-2">
                <TextInput readOnly value={redirectUri} className="flex-1 font-mono text-xs" />
                <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(redirectUri)}>Kopieren</Button>
              </div>
            </Field>
            <ul className="space-y-1.5 text-xs" style={{ color: '#6b7280' }}>
              <li>1. Gleiche App-Registrierung wie für den Mailversand verwenden.</li>
              <li>2. Obige Redirect-URI unter „Authentifizierung → Web“ hinzufügen.</li>
              <li>3. Delegierte Berechtigungen openid, profile, email (Standard, kein Admin-Consent nötig).</li>
              <li>4. Speichern – danach können sich alle Nutzer des Tenants per Microsoft 365 anmelden.</li>
            </ul>
          </div>
        </SectionCard>

        <div className="space-y-6">
          {/* Test mail */}
          <SectionCard title="Test-E-Mail senden" description="Prüft den Versand über Graph" icon={<Send className="h-5 w-5" />}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <InputField label="Empfänger" type="email" placeholder="du@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} className="flex-1" />
              <Button variant="accent" onClick={sendTest} disabled={testing || !status?.graphConfigured}>
                {testing ? <Spinner className="h-4 w-4 border-white" /> : <Send className="h-4 w-4" />} Senden
              </Button>
            </div>
            {!status?.graphConfigured && !loading && <p className="mt-3 text-xs" style={{ color: COLORS.danger }}>Graph nicht konfiguriert – Versand deaktiviert.</p>}
          </SectionCard>

          {/* Poll */}
          <SectionCard title="Posteingang abrufen" description="Holt Kundenantworten ins CRM (RQ-Zuordnung)" icon={<Inbox className="h-5 w-5" />}>
            <p className="mb-4 text-sm" style={{ color: COLORS.textMuted }}>
              Liest ungelesene Mails aus <span className="font-mono text-xs">{status?.mailbox || form.mailbox || 'request@…'}</span> und ordnet sie über die RQ-Nummer zu.
            </p>
            <Button variant="primary" onClick={runPoll} disabled={polling || !status?.graphConfigured}>
              {polling ? <Spinner className="h-4 w-4 border-white" /> : <RefreshCw className="h-4 w-4" />} Jetzt abrufen
            </Button>
          </SectionCard>
        </div>
      </div>

      {/* Script generator */}
      <SectionCard className="mt-6" title="Setup-Script generieren" description="PowerShell-Script für die Entra-App-Registrierung – inkl. Berechtigungen, Consent, Secret & optional Zugriffsbeschränkung." icon={<Terminal className="h-5 w-5" />}>
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <InputField label="App-Name" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="Faltin CRM Mailer" />
          <Field label="Postfach (aus Konfiguration)">
            <TextInput value={form.mailbox || 'request@faltintravel.com'} readOnly className="bg-gray-50" />
          </Field>
          <div className="flex items-center gap-2 pb-2">
            <ShieldCheck className="h-4 w-4" style={{ color: COLORS.navy }} />
            <Toggle checked={restrict} onChange={setRestrict} label="Zugriff auf Postfach beschränken" />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" onClick={generate}><Terminal className="h-4 w-4" /> Script generieren</Button>
          {script && <Button variant="secondary" onClick={copyScript}><Copy className="h-4 w-4" /> Kopieren</Button>}
          {script && <Button variant="secondary" onClick={downloadScript}><Download className="h-4 w-4" /> .ps1 herunterladen</Button>}
        </div>
        {script && (
          <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl p-4 text-xs leading-relaxed" style={{ background: '#0f1f30', color: '#e2e8f0' }}>
            {script}
          </pre>
        )}
        <p className="mt-3 text-xs" style={{ color: '#9ca3af' }}>
          Voraussetzungen im Script enthalten. Nach dem Lauf gibt es <span className="font-mono">TENANT_ID / CLIENT_ID / CLIENT_SECRET</span> aus → oben in die Konfiguration eintragen.
        </p>
      </SectionCard>

      {/* How it works */}
      <SectionCard className="mt-6" title="So funktioniert's" icon={<ListChecks className="h-5 w-5" />}>
        <ol className="space-y-3 text-sm" style={{ color: COLORS.textMuted }}>
          <li className="flex gap-3"><span className="font-bold" style={{ color: COLORS.accent }}>1.</span> Neue Anfrage → fortlaufende Nummer <span className="font-mono">RQ-12345</span> + automatische Bestätigungsmail.</li>
          <li className="flex gap-3"><span className="font-bold" style={{ color: COLORS.accent }}>2.</span> Im CRM pro Anfrage antworten – der Betreff trägt automatisch die RQ-Nummer.</li>
          <li className="flex gap-3"><span className="font-bold" style={{ color: COLORS.accent }}>3.</span> Kundenantworten landen in <span className="font-mono text-xs">{status?.mailbox || form.mailbox || 'request@…'}</span> und werden per Poll zugeordnet.</li>
          <li className="flex gap-3"><KeyRound className="h-4 w-4 shrink-0" /> Brevo-Liste pro Event unter <span className="font-semibold">Events → Event bearbeiten</span> (additiv).</li>
        </ol>
      </SectionCard>
    </AdminShell>
  );
}
