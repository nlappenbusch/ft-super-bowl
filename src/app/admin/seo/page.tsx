'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, Spinner, Badge, Button, EmptyState } from '@/components/admin/ui';
import { Globe, RefreshCw, FileDown, Sparkles, ListChecks, FileCode2 } from 'lucide-react';

type CheckStatus = 'ok' | 'warn' | 'fail' | 'info';
interface SeoCheck { key: string; label: string; status: CheckStatus; detail: string }
interface SeoPage { url: string; label: string; score: number; checks: SeoCheck[] }
interface SeoReport {
  generatedAt: string; durationMs: number; baseUrl: string; score: number;
  pages: SeoPage[]; site: SeoCheck[]; jsonldTypes: string[];
  ai: { generatedAt: string; text: string } | null; errors: string[];
  summary: { pages: number; ok: number; warn: number; fail: number };
}

const DOT: Record<CheckStatus, string> = { ok: '#16a34a', warn: '#d97706', fail: '#dc2626', info: '#6b7280' };
const RECOMMENDED_JSONLD = ['Organization', 'Event', 'Product', 'Offer', 'FAQPage', 'BreadcrumbList'];

function scoreColor(s: number): string {
  if (s >= 85) return '#16a34a';
  if (s >= 60) return '#d97706';
  return '#dc2626';
}
function when(iso?: string): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code style="background:#eef2f7;padding:1px 4px;border-radius:4px;">$1</code>');
  let html = ''; let inList = false;
  const close = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) { close(); html += `<div style="font-weight:800;color:#143047;margin:12px 0 4px;">${inline(m[1])}</div>`; }
    else if ((m = line.match(/^[-*]\s+(.*)$/))) { if (!inList) { html += '<ul style="margin:4px 0 4px 18px;list-style:disc;">'; inList = true; } html += `<li style="margin:3px 0;">${inline(m[1])}</li>`; }
    else { close(); html += `<p style="margin:6px 0;">${inline(line)}</p>`; }
  }
  close();
  return html;
}

export default function SeoPage() {
  const [report, setReport] = useState<SeoReport | null>(null);
  const [ageHours, setAgeHours] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/seo').then((r) => r.json());
      if (res.success) { setReport(res.report); setAgeHours(res.ageHours); setRefreshing(!!res.refreshing); }
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/admin/seo/scan', { method: 'POST' }).then((r) => r.json());
      if (res.success) { setReport(res.report); setAgeHours(0); setRefreshing(false); }
      else alert('Scan fehlgeschlagen: ' + (res.error || 'unbekannt'));
    } catch (e) { alert('Scan fehlgeschlagen: ' + (e as Error).message); }
    finally { setScanning(false); }
  };

  const missingJsonld = report ? RECOMMENDED_JSONLD.filter((t) => !report.jsonldTypes.includes(t)) : [];

  return (
    <AdminShell title="SEO & GEO">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#eef2f7' }}>
            <Globe className="h-5 w-5" style={{ color: COLORS.navy }} />
          </span>
          <div>
            <div className="text-sm text-gray-500">SEO & GEO Audit</div>
            <div className="text-lg font-extrabold" style={{ color: COLORS.navy }}>On-Page · Technik · Structured Data · KI-Lesbarkeit</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {report?.generatedAt && <span className="text-xs text-gray-500">Scan: {when(report.generatedAt)}{ageHours !== null && ageHours > 24 ? ' · veraltet' : ''}</span>}
          <Button variant="secondary" onClick={() => window.open('/api/admin/seo/report', '_blank')}><FileDown className="h-4 w-4" /> PDF-Report</Button>
          <Button variant="accent" onClick={scan} disabled={scanning}>{scanning ? <Spinner className="h-4 w-4 border-white" /> : <RefreshCw className="h-4 w-4" />} Jetzt scannen</Button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center"><Spinner /></div>
      ) : !report ? (
        <SectionCard title="SEO & GEO" description="Noch kein Scan."><p className="text-sm text-gray-500">{refreshing ? 'Erster Scan läuft im Hintergrund – in ~1 Min. neu laden.' : 'Klicke „Jetzt scannen", um Seiten, Technik, strukturierte Daten und KI-Lesbarkeit zu prüfen.'}</p></SectionCard>
      ) : (
        <div className="grid gap-5">
          {/* SCORE */}
          <SectionCard title="Gesamt-Score" description={`${report.summary.pages} Seiten geprüft · ${report.summary.ok} ok · ${report.summary.warn} Warnungen · ${report.summary.fail} Fehler`} icon={<ListChecks className="h-5 w-5" />}>
            <div className="flex items-center gap-5">
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full" style={{ border: `6px solid ${scoreColor(report.score)}` }}>
                <span className="text-2xl font-extrabold" style={{ color: COLORS.navy }}>{report.score}</span>
                <span className="text-[10px] text-gray-400">/ 100</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="ok">{report.summary.ok} ok</Badge>
                <Badge tone="warn">{report.summary.warn} Warnungen</Badge>
                <Badge tone="danger">{report.summary.fail} Fehler</Badge>
                {report.jsonldTypes.length > 0 && <Badge tone="info">JSON-LD: {report.jsonldTypes.join(', ')}</Badge>}
              </div>
            </div>
          </SectionCard>

          {/* TECHNIK / SITE */}
          <SectionCard title="Technik & GEO (Site-Ebene)" description="sitemap.xml, robots.txt, AI-Crawler-Zugriff, llms.txt." icon={<Globe className="h-5 w-5" />}>
            <div className="grid gap-2 sm:grid-cols-2">
              {report.site.map((c) => (
                <div key={c.key} className="flex items-center gap-3 rounded-xl border px-3 py-2.5" style={{ borderColor: COLORS.stroke }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DOT[c.status] }} />
                  <div className="min-w-0"><div className="text-sm font-semibold" style={{ color: COLORS.navy }}>{c.label}</div><div className="truncate text-xs text-gray-500">{c.detail}</div></div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* STRUKTURIERTE DATEN */}
          <SectionCard title="Strukturierte Daten (JSON-LD)" description="Gefundene vs. empfohlene Typen für Rich Results & KI-Verständnis." icon={<FileCode2 className="h-5 w-5" />}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {RECOMMENDED_JSONLD.map((t) => {
                const have = report.jsonldTypes.includes(t);
                return <Badge key={t} tone={have ? 'ok' : 'danger'}>{have ? '✓ ' : '✗ '}{t}</Badge>;
              })}
            </div>
            {missingJsonld.length > 0 && <p className="mt-3 text-xs text-gray-500">Fehlend: {missingJsonld.join(', ')} — empfohlen für Event-/Paket-/FAQ-Seiten (Rich Results + bessere KI-Auffindbarkeit).</p>}
          </SectionCard>

          {/* SEITEN */}
          <SectionCard title={`Seiten (${report.pages.length})`} description="Score je Seite + offene Befunde (nur Warnungen/Fehler)." icon={<ListChecks className="h-5 w-5" />}>
            {report.pages.length === 0 ? (
              <EmptyState icon={<Globe className="h-6 w-6" />} title="Keine Seiten." description="Sitemap leer oder nicht erreichbar." />
            ) : (
              <div className="grid gap-2">
                {report.pages.map((p) => {
                  const issues = p.checks.filter((c) => c.status === 'warn' || c.status === 'fail');
                  return (
                    <div key={p.url} className="rounded-xl border px-3 py-2.5" style={{ borderColor: COLORS.stroke }}>
                      <div className="flex items-center justify-between gap-3">
                        <a href={p.url} target="_blank" rel="noreferrer" className="truncate text-sm font-semibold hover:underline" style={{ color: COLORS.navy }}>{p.label}</a>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: scoreColor(p.score) }}>{p.score}</span>
                      </div>
                      {issues.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {issues.map((c) => (
                            <span key={c.key} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px]" style={{ background: c.status === 'fail' ? '#fef2f2' : '#fffbeb', color: c.status === 'fail' ? '#b91c1c' : '#b45309' }} title={c.detail}>
                              {c.label}: {c.detail}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          {/* KI-EMPFEHLUNG */}
          <SectionCard title="KI-Empfehlung" description={report.ai ? `Erstellt: ${when(report.ai.generatedAt)}` : 'Priorisierte SEO/GEO-Maßnahmen (Anthropic).'} icon={<Sparkles className="h-5 w-5" />}>
            {report.ai?.text ? (
              <div className="text-sm leading-relaxed text-gray-700" dangerouslySetInnerHTML={{ __html: mdToHtml(report.ai.text) }} />
            ) : (
              <p className="text-sm text-gray-500">{refreshing ? 'Wird im Hintergrund erstellt – in ~1 Min. neu laden.' : 'Noch keine KI-Empfehlung. Mit „Jetzt scannen" erzeugen (nutzt den Anthropic-Key aus KI-Redaktion).'}</p>
            )}
          </SectionCard>

          {report.errors?.length > 0 && <p className="text-xs text-gray-400">Hinweise: {report.errors.slice(0, 4).join(' · ')}{report.errors.length > 4 ? ' …' : ''}</p>}
        </div>
      )}
    </AdminShell>
  );
}
