'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/admin/AdminShell';
import { COLORS, SectionCard, Spinner, Badge, Button, EmptyState } from '@/components/admin/ui';
import { Globe, RefreshCw, FileDown, Sparkles, ListChecks, FileCode2, ChevronDown, ChevronRight, ThumbsUp, Copy } from 'lucide-react';

type CheckStatus = 'ok' | 'warn' | 'fail' | 'info';
type CheckCat = 'onpage' | 'technik' | 'structured' | 'geo';
interface SeoCheck { key: string; label: string; status: CheckStatus; detail: string; cat: CheckCat }
interface SeoPage { url: string; label: string; score: number; checks: SeoCheck[] }
interface SeoReport {
  generatedAt: string; durationMs: number; baseUrl: string; score: number;
  categories: Record<CheckCat, number>; strengths: string[];
  pages: SeoPage[]; site: SeoCheck[]; jsonldTypes: string[];
  ai: { generatedAt: string; text: string } | null; errors: string[];
  summary: { pages: number; ok: number; warn: number; fail: number; checks: number };
}

const DOT: Record<CheckStatus, string> = { ok: '#16a34a', warn: '#d97706', fail: '#dc2626', info: '#9ca3af' };
const CAT_LABEL: Record<CheckCat, string> = { onpage: 'On-Page-SEO', technik: 'Technik & Crawlbarkeit', structured: 'Strukturierte Daten', geo: 'GEO / KI-Lesbarkeit' };
const RECOMMENDED_JSONLD = ['Organization', 'Event', 'Product', 'Offer', 'FAQPage', 'BreadcrumbList'];

function scoreColor(s: number): string { return s >= 85 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626'; }
function when(iso?: string): string { if (!iso) return '–'; const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code style="background:#eef2f7;padding:1px 4px;border-radius:4px;">$1</code>');
  let html = ''; let inList = false; const close = () => { if (inList) { html += '</ul>'; inList = false; } };
  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^[-*_]{3,}$/.test(line) || line.startsWith('|') || line.startsWith('>')) { close(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^#{1,6}\s+(.*)$/))) { close(); html += `<div style="font-weight:800;color:#143047;margin:12px 0 4px;">${inline(m[1])}</div>`; }
    else if ((m = line.match(/^[-*]\s+(.*)$/))) { if (!inList) { html += '<ul style="margin:4px 0 4px 18px;list-style:disc;">'; inList = true; } html += `<li style="margin:3px 0;">${inline(m[1])}</li>`; }
    else { close(); html += `<p style="margin:6px 0;">${inline(line)}</p>`; }
  }
  close(); return html;
}

interface Suggestion { loading?: boolean; title?: string; description?: string; error?: string }

export default function SeoPage() {
  const [report, setReport] = useState<SeoReport | null>(null);
  const [ageHours, setAgeHours] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [openPage, setOpenPage] = useState<string | null>(null);
  const [sugg, setSugg] = useState<Record<string, Suggestion>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch('/api/admin/seo').then((r) => r.json()); if (res.success) { setReport(res.report); setAgeHours(res.ageHours); setRefreshing(!!res.refreshing); } }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const scan = async () => {
    setScanning(true);
    try { const res = await fetch('/api/admin/seo/scan', { method: 'POST' }).then((r) => r.json()); if (res.success) { setReport(res.report); setAgeHours(0); setRefreshing(false); setSugg({}); } else alert('Scan fehlgeschlagen: ' + (res.error || 'unbekannt')); }
    catch (e) { alert('Scan fehlgeschlagen: ' + (e as Error).message); } finally { setScanning(false); }
  };

  const suggest = async (page: SeoPage) => {
    let p = '/'; try { p = new URL(page.url).pathname; } catch { /* */ }
    setSugg((s) => ({ ...s, [page.url]: { loading: true } }));
    try {
      const res = await fetch('/api/admin/seo/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p }) }).then((r) => r.json());
      setSugg((s) => ({ ...s, [page.url]: res.success ? { title: res.title, description: res.description } : { error: res.error } }));
    } catch (e) { setSugg((s) => ({ ...s, [page.url]: { error: (e as Error).message } })); }
  };
  const copy = (t?: string) => { if (t) navigator.clipboard?.writeText(t).catch(() => {}); };

  const missingJsonld = report ? RECOMMENDED_JSONLD.filter((t) => !report.jsonldTypes.includes(t)) : [];

  return (
    <AdminShell title="SEO & GEO">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#eef2f7' }}><Globe className="h-5 w-5" style={{ color: COLORS.navy }} /></span>
          <div><div className="text-sm text-gray-500">SEO & GEO Audit</div><div className="text-lg font-extrabold" style={{ color: COLORS.navy }}>On-Page · Technik · Structured Data · KI-Lesbarkeit</div></div>
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
        <SectionCard title="SEO & GEO" description="Noch kein Scan."><p className="text-sm text-gray-500">{refreshing ? 'Erster Scan läuft im Hintergrund – in ~1 Min. neu laden.' : 'Klicke „Jetzt scannen".'}</p></SectionCard>
      ) : (
        <div className="grid gap-5">
          {/* SCORE + KATEGORIEN */}
          <SectionCard title="Gesamt-Score" description={`${report.summary.pages} Seiten · ${report.summary.checks} Checks · ${report.summary.ok} ok / ${report.summary.warn} Warnungen / ${report.summary.fail} Fehler`} icon={<ListChecks className="h-5 w-5" />}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full" style={{ border: `6px solid ${scoreColor(report.score)}` }}>
                <span className="text-2xl font-extrabold" style={{ color: COLORS.navy }}>{report.score}</span><span className="text-[10px] text-gray-400">/ 100</span>
              </div>
              <div className="flex-1 grid gap-2">
                {(['onpage', 'technik', 'structured', 'geo'] as CheckCat[]).map((c) => {
                  const v = report.categories?.[c] ?? 0;
                  return (
                    <div key={c} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 text-xs font-semibold" style={{ color: COLORS.navy }}>{CAT_LABEL[c]}</span>
                      <span className="relative h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: '#edf0f4' }}>
                        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v}%`, background: scoreColor(v) }} />
                      </span>
                      <span className="w-7 text-right text-xs font-bold" style={{ color: scoreColor(v) }}>{v}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </SectionCard>

          {/* STÄRKEN */}
          {report.strengths?.length > 0 && (
            <SectionCard title="Das läuft bereits gut" description="Stärken aus dem Audit – behalten & ausbauen." icon={<ThumbsUp className="h-5 w-5" />}>
              <div className="grid gap-2 sm:grid-cols-2">
                {report.strengths.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: '#f0fdf4', color: '#14532d' }}>
                    <ThumbsUp className="h-4 w-4 shrink-0" style={{ color: '#16a34a' }} /> {s}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* SITE / TECHNIK */}
          <SectionCard title="Technik, Crawlbarkeit & GEO (Site-Ebene)" description="sitemap.xml, robots.txt, AI-Crawler, llms.txt, 404-Handling, Duplikate." icon={<Globe className="h-5 w-5" />}>
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
              {RECOMMENDED_JSONLD.map((t) => { const have = report.jsonldTypes.includes(t); return <Badge key={t} tone={have ? 'ok' : 'danger'}>{have ? '✓ ' : '✗ '}{t}</Badge>; })}
            </div>
            {missingJsonld.length > 0 && <p className="mt-3 text-xs text-gray-500">Fehlend: {missingJsonld.join(', ')} — empfohlen für Event-/Paket-/FAQ-Seiten.</p>}
          </SectionCard>

          {/* SEITEN (ausklappbar) */}
          <SectionCard title={`Seiten (${report.pages.length})`} description="Klick auf eine Seite zeigt alle Checks. Bei Title/Description-Lücken: KI-Vorschlag." icon={<ListChecks className="h-5 w-5" />}>
            {report.pages.length === 0 ? (
              <EmptyState icon={<Globe className="h-6 w-6" />} title="Keine Seiten." description="Sitemap leer oder nicht erreichbar." />
            ) : (
              <div className="grid gap-2">
                {report.pages.map((p) => {
                  const issues = p.checks.filter((c) => c.status === 'warn' || c.status === 'fail');
                  const isOpen = openPage === p.url;
                  const hasMetaIssue = p.checks.some((c) => (c.key === 'title' || c.key === 'desc') && c.status !== 'ok' && c.status !== 'info');
                  const sg = sugg[p.url];
                  return (
                    <div key={p.url} className="rounded-xl border" style={{ borderColor: COLORS.stroke }}>
                      <button type="button" onClick={() => setOpenPage(isOpen ? null : p.url)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
                        <span className="flex min-w-0 items-center gap-2">
                          {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
                          <span className="truncate text-sm font-semibold" style={{ color: COLORS.navy }}>{p.label}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {issues.length > 0 && <span className="text-xs text-gray-400">{issues.length} offen</span>}
                          <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: scoreColor(p.score) }}>{p.score}</span>
                        </span>
                      </button>
                      {isOpen && (
                        <div className="border-t px-3 py-3" style={{ borderColor: COLORS.stroke }}>
                          <div className="grid gap-1.5 sm:grid-cols-2">
                            {p.checks.map((c) => (
                              <div key={c.key} className="flex items-start gap-2 text-xs">
                                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: DOT[c.status] }} />
                                <span><span className="font-semibold" style={{ color: COLORS.navy }}>{c.label}:</span> <span className="text-gray-500">{c.detail}</span></span>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <a href={p.url} target="_blank" rel="noreferrer" className="text-xs font-semibold underline" style={{ color: COLORS.accent }}>Seite öffnen ↗</a>
                            {hasMetaIssue && (
                              <Button variant="secondary" size="sm" onClick={() => suggest(p)} disabled={sg?.loading}>
                                {sg?.loading ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} KI: Title & Description
                              </Button>
                            )}
                          </div>
                          {sg && !sg.loading && (
                            <div className="mt-2 rounded-lg border p-2 text-xs" style={{ borderColor: COLORS.stroke, background: '#f7f9fb' }}>
                              {sg.error ? <span style={{ color: COLORS.danger }}>{sg.error}</span> : (
                                <div className="grid gap-1.5">
                                  <div className="flex items-start justify-between gap-2"><span><b style={{ color: COLORS.navy }}>Title</b> ({sg.title?.length}): {sg.title}</span><button onClick={() => copy(sg.title)} title="Kopieren"><Copy className="h-3.5 w-3.5 text-gray-400" /></button></div>
                                  <div className="flex items-start justify-between gap-2"><span><b style={{ color: COLORS.navy }}>Description</b> ({sg.description?.length}): {sg.description}</span><button onClick={() => copy(sg.description)} title="Kopieren"><Copy className="h-3.5 w-3.5 text-gray-400" /></button></div>
                                </div>
                              )}
                            </div>
                          )}
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
            {report.ai?.text ? <div className="text-sm leading-relaxed text-gray-700" dangerouslySetInnerHTML={{ __html: mdToHtml(report.ai.text) }} /> : <p className="text-sm text-gray-500">{refreshing ? 'Wird im Hintergrund erstellt – in ~1 Min. neu laden.' : 'Noch keine KI-Empfehlung. Mit „Jetzt scannen" erzeugen.'}</p>}
          </SectionCard>

          {report.errors?.length > 0 && <p className="text-xs text-gray-400">Hinweise: {report.errors.slice(0, 4).join(' · ')}{report.errors.length > 4 ? ' …' : ''}</p>}
        </div>
      )}
    </AdminShell>
  );
}
