'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, Spinner, Badge, Button, EmptyState } from '@/components/admin/ui';
import { Activity, RefreshCw, ShieldAlert, ShieldCheck, PackageCheck, Sparkles, FileDown, Wrench, GitPullRequest, Download, KeyRound, CheckCircle2 } from 'lucide-react';

type HealthStatus = 'ok' | 'warn' | 'down';
interface HealthItem { key: string; label: string; status: HealthStatus; detail: string }
interface HealthReport { generatedAt: string; uptimeSec: number; nodeVersion: string; env: string; items: HealthItem[] }
type VersionState = 'current' | 'patch' | 'minor' | 'major' | 'unknown';
interface VersionRow { name: string; installed: string; latest: string; state: VersionState; source: string }
interface VulnRow { package: string; version: string; id: string; cve: string; severity: string; summary: string; url: string }
interface StatusReport { generatedAt: string; durationMs: number; versions: VersionRow[]; vulnerabilities: VulnRow[]; ai: { generatedAt: string; text: string } | null; errors: string[] }
interface FixItem { name: string; from: string; to: string; type: string; dev: boolean; security: boolean }
interface FixPlan { scope: string; items: FixItem[]; summary: { total: number; security: number; major: number; minor: number; patch: number }; nodeHint: string | null }
interface GithubCfg { configured: boolean; owner: string; repo: string; base: string }

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
  // Auto-Fix
  const [fixScope, setFixScope] = useState<'security' | 'minor' | 'all'>('all');
  const [plan, setPlan] = useState<FixPlan | null>(null);
  const [github, setGithub] = useState<GithubCfg | null>(null);
  const [fixAi, setFixAi] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [prLoading, setPrLoading] = useState(false);
  const [prResult, setPrResult] = useState<{ url?: string; error?: string } | null>(null);
  const [token, setToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  const loadFixPlan = useCallback(async (scope: 'security' | 'minor' | 'all') => {
    setFixAi(null); setPrResult(null);
    try {
      const res = await fetch(`/api/admin/status/fix-plan?scope=${scope}`).then((r) => r.json());
      if (res.success) { setPlan(res.plan); setGithub(res.github); }
    } catch { /* ignore */ }
  }, []);

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
  useEffect(() => { loadFixPlan(fixScope); }, [fixScope, loadFixPlan, report]);

  const loadFixAi = async () => {
    setAiLoading(true);
    try {
      const res = await fetch(`/api/admin/status/fix-plan?scope=${fixScope}&ai=1`).then((r) => r.json());
      if (res.success) setFixAi(res.ai || 'Keine KI-Hinweise (Key fehlt?).');
    } finally { setAiLoading(false); }
  };
  const createPr = async () => {
    if (!confirm(`GitHub-PR mit ${plan?.summary.total ?? 0} Updates anlegen (Branch + Pull Request)? Es wird nichts gemergt/deployt – das machst du nach CI-Grün selbst.`)) return;
    setPrLoading(true); setPrResult(null);
    try {
      const res = await fetch('/api/admin/status/fix-pr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scope: fixScope }) }).then((r) => r.json());
      setPrResult(res.success ? { url: res.url } : { error: res.error });
    } catch (e) { setPrResult({ error: (e as Error).message }); }
    finally { setPrLoading(false); }
  };
  const saveToken = async () => {
    setSavingToken(true);
    try {
      const res = await fetch('/api/admin/status/github', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).then((r) => r.json());
      if (res.success) { setToken(''); const g = await fetch('/api/admin/status/github').then((r) => r.json()); setGithub((prev) => prev ? { ...prev, configured: !!g.data?.has_token } : prev); }
      else alert('Speichern fehlgeschlagen: ' + (res.error || ''));
    } finally { setSavingToken(false); }
  };

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

          {/* AUTO-FIX */}
          <SectionCard
            title="Auto-Fix"
            description="Bereitet die Updates vor (Prod kann sich nicht selbst updaten): Upgrade-Skript & aktualisierte package.json zum Download – oder direkt ein GitHub-PR. CI baut & deployt erst nach deinem Merge."
            icon={<Wrench className="h-5 w-5" />}
          >
            <div className="grid gap-4">
              {/* Umfang */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: COLORS.navy }}>Umfang:</span>
                {([['security', 'Nur Sicherheit'], ['minor', '+ Minor/Patch'], ['all', 'Alles inkl. Major']] as const).map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFixScope(k)}
                    className="rounded-full border px-3 py-1 text-xs font-semibold transition"
                    style={fixScope === k
                      ? { background: COLORS.navy, color: '#fff', borderColor: COLORS.navy }
                      : { background: '#fff', color: COLORS.navy, borderColor: COLORS.stroke }}
                  >
                    {lbl}
                  </button>
                ))}
              </div>

              {!plan ? (
                <p className="text-sm text-gray-500">Plan wird geladen …</p>
              ) : plan.summary.total === 0 ? (
                <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Nichts zu tun." description="Im gewählten Umfang sind keine Updates verfügbar." />
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone="navy">{plan.summary.total} Updates</Badge>
                    {plan.summary.security > 0 && <Badge tone="danger">{plan.summary.security} Sicherheit</Badge>}
                    {plan.summary.major > 0 && <Badge tone="warn">{plan.summary.major} Major</Badge>}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {plan.items.map((it) => (
                          <tr key={it.name} className="border-t" style={{ borderColor: COLORS.stroke }}>
                            <td className="py-1.5 pr-3 font-semibold" style={{ color: COLORS.navy }}>
                              {it.security && <span title="sicherheitsrelevant">🔒 </span>}{it.name}{it.dev && <span className="text-gray-400"> (dev)</span>}
                            </td>
                            <td className="py-1.5 pr-3 text-gray-500">{it.from} → {it.to}</td>
                            <td className="py-1.5"><Badge tone={it.type === 'major' ? 'danger' : it.type === 'minor' ? 'warn' : 'info'}>{it.type}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {plan.nodeHint && <p className="text-xs text-gray-500">ℹ {plan.nodeHint}</p>}

                  {/* Aktionen: Download + KI */}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => window.open(`/api/admin/status/fix-plan?scope=${fixScope}&format=script`, '_blank')}>
                      <Download className="h-4 w-4" /> Upgrade-Skript (.sh)
                    </Button>
                    <Button variant="secondary" onClick={() => window.open(`/api/admin/status/fix-plan?scope=${fixScope}&format=pkg`, '_blank')}>
                      <Download className="h-4 w-4" /> package.json
                    </Button>
                    <Button variant="secondary" onClick={loadFixAi} disabled={aiLoading}>
                      {aiLoading ? <Spinner className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} KI-Hinweise
                    </Button>
                  </div>
                  {fixAi && (
                    <div className="rounded-xl border p-3 text-sm leading-relaxed text-gray-700" style={{ borderColor: COLORS.stroke, background: '#f7f9fb' }} dangerouslySetInnerHTML={{ __html: mdToHtml(fixAi) }} />
                  )}

                  {/* GitHub-PR */}
                  <div className="rounded-xl border p-3" style={{ borderColor: COLORS.stroke }}>
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.navy }}>
                      <GitPullRequest className="h-4 w-4" /> Automatischer GitHub-PR
                    </div>
                    {github?.configured ? (
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-gray-500">Ziel: {github.owner}/{github.repo} · Branch aus {github.base}. Es wird nur ein PR erstellt – Merge & Deploy entscheidest du.</div>
                        <div>
                          <Button variant="accent" onClick={createPr} disabled={prLoading}>
                            {prLoading ? <Spinner className="h-4 w-4 border-white" /> : <GitPullRequest className="h-4 w-4" />} GitHub-PR erstellen
                          </Button>
                        </div>
                        {prResult?.url && (
                          <a href={prResult.url} target="_blank" rel="noreferrer" className="text-sm font-semibold underline" style={{ color: COLORS.accent }}>✓ PR erstellt – öffnen ({prResult.url.split('/').pop()})</a>
                        )}
                        {prResult?.error && <p className="text-sm" style={{ color: COLORS.danger }}>Fehler: {prResult.error}</p>}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="text-xs text-gray-500">Noch kein GitHub-Token hinterlegt. Personal Access Token (Repo-Schreibrechte) eingeben, um PRs direkt aus dem Admin zu erstellen.</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 text-gray-400"><KeyRound className="h-4 w-4" /></span>
                          <input
                            type="password"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="ghp_… (wird verschlüsselt in den Settings gespeichert)"
                            className="min-w-[260px] flex-1 rounded-lg border px-3 py-2 text-sm"
                            style={{ borderColor: COLORS.stroke }}
                          />
                          <Button variant="secondary" onClick={saveToken} disabled={savingToken || !token.trim()}>
                            {savingToken ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />} Speichern
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </SectionCard>

          {report?.errors && report.errors.length > 0 && (
            <p className="text-xs text-gray-400">Hinweise beim Scan: {report.errors.slice(0, 5).join(' · ')}{report.errors.length > 5 ? ' …' : ''}</p>
          )}
        </div>
      )}
    </AdminShell>
  );
}
