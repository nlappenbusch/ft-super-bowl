'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, Spinner, Badge, Button, EmptyState } from '@/components/admin/ui';
import { Activity, RefreshCw, ShieldAlert, ShieldCheck, PackageCheck, Sparkles, FileDown } from 'lucide-react';

type HealthStatus = 'ok' | 'warn' | 'down';
interface HealthItem { key: string; label: string; status: HealthStatus; detail: string }
interface HealthReport { generatedAt: string; uptimeSec: number; nodeVersion: string; env: string; items: HealthItem[] }
type VersionState = 'current' | 'patch' | 'minor' | 'major' | 'unknown';
interface VersionRow { name: string; installed: string; latest: string; state: VersionState; source: string }
interface VulnRow { package: string; version: string; id: string; cve: string; severity: string; summary: string; url: string }
interface StatusReport { generatedAt: string; durationMs: number; versions: VersionRow[]; vulnerabilities: VulnRow[]; ai: { generatedAt: string; text: string } | null; errors: string[] }

const DOT: Record<HealthStatus, string> = { ok: '#16a34a', warn: '#d97706', down: '#dc2626' };
const STATE_BADGE: Record<VersionState, { tone: 'ok' | 'info' | 'warn' | 'danger' | 'muted'; label: string }> = {
  current: { tone: 'ok', label: 'aktuell' },
  patch: { tone: 'info', label: 'Patch' },
  minor: { tone: 'warn', label: 'Minor' },
  major: { tone: 'danger', label: 'Major' },
  unknown: { tone: 'muted', label: '–' },
};

function uptime(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function when(iso?: string): string {
  if (!iso) return '–';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function sevTone(sev: string): 'danger' | 'warn' | 'info' | 'muted' {
  const s = sev.toLowerCase();
  if (s.includes('crit')) return 'danger';
  if (s.includes('high')) return 'danger';
  if (s.includes('moder') || s.includes('medium')) return 'warn';
  if (s.includes('low')) return 'info';
  return 'muted';
}

function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code style="background:#eef2f7;padding:1px 4px;border-radius:4px;">$1</code>');
  const lines = md.split(/\r?\n/);
  let html = ''; let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) { closeList(); html += `<div style="font-weight:800;color:#143047;margin:12px 0 4px;">${inline(m[1])}</div>`; }
    else if ((m = line.match(/^[-*]\s+(.*)$/))) { if (!inList) { html += '<ul style="margin:4px 0 4px 18px;list-style:disc;">'; inList = true; } html += `<li style="margin:3px 0;">${inline(m[1])}</li>`; }
    else { closeList(); html += `<p style="margin:6px 0;">${inline(line)}</p>`; }
  }
  closeList();
  return html;
}

export default function StatusPage() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [report, setReport] = useState<StatusReport | null>(null);
  const [ageHours, setAgeHours] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/status').then((r) => r.json());
      if (res.success) {
        setHealth(res.health);
        setReport(res.report);
        setAgeHours(res.ageHours);
        setRefreshing(!!res.refreshing);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/admin/status/scan', { method: 'POST' }).then((r) => r.json());
      if (res.success) { setReport(res.report); setAgeHours(0); setRefreshing(false); }
      else alert('Scan fehlgeschlagen: ' + (res.error || 'unbekannt'));
    } catch (e) {
      alert('Scan fehlgeschlagen: ' + (e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const outdated = (report?.versions || []).filter((v) => v.state === 'minor' || v.state === 'major');
  const vulns = report?.vulnerabilities || [];

  return (
    <AdminShell title="Status">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#eef2f7' }}>
            <Activity className="h-5 w-5" style={{ color: COLORS.navy }} />
          </span>
          <div>
            <div className="text-sm text-gray-500">System-Status</div>
            <div className="text-lg font-extrabold" style={{ color: COLORS.navy }}>
              Health · Versionen · Sicherheit
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {report?.generatedAt && (
            <span className="text-xs text-gray-500">
              Scan: {when(report.generatedAt)}{ageHours !== null && ageHours > 24 ? ' · veraltet' : ''}
            </span>
          )}
          <Button variant="secondary" onClick={() => window.open('/api/admin/status/report', '_blank')}>
            <FileDown className="h-4 w-4" /> PDF-Report
          </Button>
          <Button variant="accent" onClick={runScan} disabled={scanning}>
            {scanning ? <Spinner className="h-4 w-4 border-white" /> : <RefreshCw className="h-4 w-4" />} Jetzt prüfen
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Spinner /></div>
      ) : (
        <div className="grid gap-5">
          {/* HEALTH */}
          <SectionCard title="Live-Health" description={health ? `Uptime ${uptime(health.uptimeSec)} · Node ${health.nodeVersion} · ${health.env}` : ''} icon={<Activity className="h-5 w-5" />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {(health?.items || []).map((it) => (
                <div key={it.key} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: COLORS.stroke }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DOT[it.status] }} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: COLORS.navy }}>{it.label}</div>
                    <div className="truncate text-xs text-gray-500">{it.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* SICHERHEIT / CVE */}
          <SectionCard
            title={`Sicherheit / CVEs${vulns.length ? ` (${vulns.length})` : ''}`}
            description="Bekannte Schwachstellen der eingesetzten Pakete (Quelle: OSV.dev)."
            icon={vulns.length ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
          >
            {!report ? (
              <p className="text-sm text-gray-500">Noch kein Scan. Klicke „Jetzt prüfen“.</p>
            ) : vulns.length === 0 ? (
              <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Keine bekannten Schwachstellen." description="Keine der beobachteten Versionen hat aktuell einen OSV-Eintrag." />
            ) : (
              <div className="grid gap-2">
                {vulns.map((v) => (
                  <div key={v.id} className="rounded-xl border px-3 py-2.5" style={{ borderColor: COLORS.stroke }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={sevTone(v.severity)}>{v.severity}</Badge>
                      <span className="text-sm font-semibold" style={{ color: COLORS.navy }}>{v.package}@{v.version}</span>
                      <a href={v.url} target="_blank" rel="noreferrer" className="text-xs font-semibold underline" style={{ color: COLORS.accent }}>{v.cve || v.id}</a>
                    </div>
                    {v.summary && <p className="mt-1 text-xs text-gray-600">{v.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* VERSIONEN */}
          <SectionCard
            title={`Versionen${outdated.length ? ` · ${outdated.length} veraltet` : ''}`}
            description="Installiert vs. aktuell verfügbar (npm-Registry / nodejs.org)."
            icon={<PackageCheck className="h-5 w-5" />}
          >
            {!report ? (
              <p className="text-sm text-gray-500">Noch kein Scan.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="py-1.5 pr-3">Paket</th>
                      <th className="py-1.5 pr-3">Installiert</th>
                      <th className="py-1.5 pr-3">Aktuell</th>
                      <th className="py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.versions.map((v) => {
                      const b = STATE_BADGE[v.state];
                      return (
                        <tr key={v.name} className="border-t" style={{ borderColor: COLORS.stroke }}>
                          <td className="py-1.5 pr-3 font-semibold" style={{ color: COLORS.navy }}>{v.name}</td>
                          <td className="py-1.5 pr-3 text-gray-600">{v.installed}</td>
                          <td className="py-1.5 pr-3 text-gray-600">{v.latest}</td>
                          <td className="py-1.5"><Badge tone={b.tone}>{b.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* KI-FIXES */}
          <SectionCard title="KI-Empfehlung" description={report?.ai ? `Erstellt: ${when(report.ai.generatedAt)}` : 'Konkrete Fix-/Upgrade-Vorschläge (Anthropic).'} icon={<Sparkles className="h-5 w-5" />}>
            {report?.ai?.text ? (
              <div className="text-sm leading-relaxed text-gray-700" dangerouslySetInnerHTML={{ __html: mdToHtml(report.ai.text) }} />
            ) : (
              <p className="text-sm text-gray-500">
                {refreshing ? 'Report wird im Hintergrund erstellt – in ~1 Min. erneut laden.' : 'Noch keine KI-Empfehlung. Mit „Jetzt prüfen“ erzeugen (nutzt den Anthropic-Key aus KI-Redaktion).'}
              </p>
            )}
          </SectionCard>

          {report?.errors && report.errors.length > 0 && (
            <p className="text-xs text-gray-400">Hinweise beim Scan: {report.errors.slice(0, 5).join(' · ')}{report.errors.length > 5 ? ' …' : ''}</p>
          )}
        </div>
      )}
    </AdminShell>
  );
}
