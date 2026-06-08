'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import {
  PageHeader, SectionCard, Card, Button, InputField, Badge, Spinner, COLORS,
} from '@/components/admin/ui';
import {
  Mail, Send, RefreshCw, CheckCircle2, XCircle, Server, Inbox, ListChecks, KeyRound,
} from 'lucide-react';

interface MailStatus {
  graphConfigured: boolean;
  mailbox: string;
  fromName: string;
  tenantSet: boolean;
  clientSet: boolean;
  secretSet: boolean;
  brevoConfigured: boolean;
  pollSecretSet: boolean;
}

function StatusDot({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="h-5 w-5" style={{ color: COLORS.ok }} />
    : <XCircle className="h-5 w-5" style={{ color: COLORS.danger }} />;
}

function ConfigRow({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5" style={{ borderBottom: `1px solid ${COLORS.stroke}` }}>
      <span className="text-sm" style={{ color: COLORS.navy }}>{label}</span>
      <span className="flex items-center gap-2 text-sm" style={{ color: COLORS.textMuted }}>
        {value && <span className="font-mono text-xs">{value}</span>}
        <StatusDot ok={ok} />
      </span>
    </div>
  );
}

export default function MailAdminPage() {
  const [status, setStatus] = useState<MailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/mail/status');
      const data = await res.json();
      if (data.success) setStatus(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (ok: boolean, msg: string) => {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 5000);
  };

  const sendTest = async () => {
    if (!testTo.trim()) return;
    setTesting(true);
    try {
      const res = await fetch('/api/admin/mail/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo }),
      });
      const data = await res.json();
      flash(data.success, data.success ? data.message : data.error);
    } catch {
      flash(false, 'Verbindungsfehler.');
    } finally {
      setTesting(false);
    }
  };

  const runPoll = async () => {
    setPolling(true);
    try {
      const res = await fetch('/api/admin/mail/poll', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        flash(true, `Poll fertig: ${data.scanned} geprüft, ${data.matched} zugeordnet, ${data.skipped} übersprungen.`);
      } else {
        flash(false, data.error || 'Poll fehlgeschlagen.');
      }
    } catch {
      flash(false, 'Verbindungsfehler.');
    } finally {
      setPolling(false);
    }
  };

  return (
    <AdminShell title="E-Mail / Microsoft 365">
      <PageHeader
        title="E-Mail / Microsoft 365"
        description="Versand, Antworten und Eingang über euer M365-Postfach – plus Brevo-Listen."
        actions={
          <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Aktualisieren
          </Button>
        }
      />

      {toast && (
        <div
          className="mb-5 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: toast.ok ? '#f0fdf4' : '#fef2f2',
            color: toast.ok ? COLORS.ok : COLORS.danger,
            border: `1px solid ${toast.ok ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {toast.msg}
        </div>
      )}

      {/* Connection banner */}
      <Card className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: status?.graphConfigured ? '#f0fdf4' : '#fef2f2' }}
            >
              <Mail className="h-6 w-6" style={{ color: status?.graphConfigured ? COLORS.ok : COLORS.danger }} />
            </div>
            <div>
              <div className="text-sm font-bold" style={{ color: COLORS.navy }}>
                Microsoft 365 Graph
              </div>
              <div className="text-sm" style={{ color: COLORS.textMuted }}>
                {loading ? 'Prüfe…' : status?.graphConfigured ? 'Verbunden & versandbereit' : 'Nicht konfiguriert'}
              </div>
            </div>
          </div>
          {!loading && (
            <Badge tone={status?.graphConfigured ? 'ok' : 'danger'}>
              {status?.graphConfigured ? 'Aktiv' : 'Inaktiv'}
            </Badge>
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Konfiguration */}
        <SectionCard title="Konfiguration" description="Werte aus der .env (Secrets werden nicht angezeigt)" icon={<Server className="h-5 w-5" />}>
          {loading || !status ? (
            <div className="py-8 text-center"><Spinner /></div>
          ) : (
            <div>
              <ConfigRow label="Tenant-ID (GRAPH_TENANT_ID)" ok={status.tenantSet} />
              <ConfigRow label="Client-ID (GRAPH_CLIENT_ID)" ok={status.clientSet} />
              <ConfigRow label="Client-Secret (GRAPH_CLIENT_SECRET)" ok={status.secretSet} />
              <ConfigRow label="Postfach (GRAPH_MAILBOX)" ok={!!status.mailbox} value={status.mailbox || '–'} />
              <ConfigRow label="Absendername" ok={!!status.fromName} value={status.fromName || '–'} />
              <ConfigRow label="Inbound-Poll-Secret" ok={status.pollSecretSet} />
              <ConfigRow label="Brevo API-Key (Listen)" ok={status.brevoConfigured} />
            </div>
          )}
          <p className="mt-4 text-xs" style={{ color: '#9ca3af' }}>
            Änderungen erfolgen in der <span className="font-mono">.env.local</span>. Details: GRAPH-EMAIL-SETUP.md
          </p>
        </SectionCard>

        <div className="space-y-6">
          {/* Test-Mail */}
          <SectionCard title="Test-E-Mail senden" description="Prüft den Versand über Graph" icon={<Send className="h-5 w-5" />}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <InputField
                label="Empfänger"
                type="email"
                placeholder="du@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                className="flex-1"
              />
              <Button variant="accent" onClick={sendTest} disabled={testing || !status?.graphConfigured}>
                {testing ? <Spinner className="h-4 w-4 border-white" /> : <Send className="h-4 w-4" />} Senden
              </Button>
            </div>
            {!status?.graphConfigured && !loading && (
              <p className="mt-3 text-xs" style={{ color: COLORS.danger }}>Graph nicht konfiguriert – Versand deaktiviert.</p>
            )}
          </SectionCard>

          {/* Inbound-Poll */}
          <SectionCard title="Posteingang abrufen" description="Holt Kundenantworten ins CRM (RQ-Zuordnung)" icon={<Inbox className="h-5 w-5" />}>
            <p className="mb-4 text-sm" style={{ color: COLORS.textMuted }}>
              Liest ungelesene Mails aus <span className="font-mono text-xs">{status?.mailbox || 'request@…'}</span>,
              ordnet sie über die RQ-Nummer im Betreff zu und markiert sie als gelesen. Im Betrieb per Cron automatisieren.
            </p>
            <Button variant="primary" onClick={runPoll} disabled={polling || !status?.graphConfigured}>
              {polling ? <Spinner className="h-4 w-4 border-white" /> : <RefreshCw className="h-4 w-4" />} Jetzt abrufen
            </Button>
          </SectionCard>
        </div>
      </div>

      {/* How it works */}
      <SectionCard className="mt-6" title="So funktioniert's" icon={<ListChecks className="h-5 w-5" />}>
        <ol className="space-y-3 text-sm" style={{ color: COLORS.textMuted }}>
          <li className="flex gap-3"><span className="font-bold" style={{ color: COLORS.accent }}>1.</span> Neue Anfrage → fortlaufende Nummer <span className="font-mono">RQ-12345</span> + automatische Bestätigungsmail an den Kunden.</li>
          <li className="flex gap-3"><span className="font-bold" style={{ color: COLORS.accent }}>2.</span> Im CRM kannst du pro Anfrage antworten – der Betreff trägt automatisch die RQ-Nummer.</li>
          <li className="flex gap-3"><span className="font-bold" style={{ color: COLORS.accent }}>3.</span> Kundenantworten landen in <span className="font-mono text-xs">{status?.mailbox || 'request@…'}</span> und werden per Poll dem richtigen Vorgang zugeordnet.</li>
          <li className="flex gap-3"><KeyRound className="h-4 w-4 shrink-0" /> Brevo-Liste pro Event unter <span className="font-semibold">Events → Event bearbeiten</span> (additiv – bestehende Listen bleiben).</li>
        </ol>
      </SectionCard>
    </AdminShell>
  );
}
