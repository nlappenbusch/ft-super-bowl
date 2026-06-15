/**
 * seoCheck.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SEO- & GEO-Audit (analog zum Status-Modul). Scannt die eigenen öffentlichen
 * Seiten (aus der Sitemap), prüft On-Page-SEO, Technik, strukturierte Daten
 * (JSON-LD) und GEO/KI-Lesbarkeit (llms.txt, SSR-Fakten, AI-Crawler) und bildet
 * einen Score + KI-Empfehlung. Ergebnis wird in data/seo-report.json gecacht.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { promises as fsp } from 'fs';
import path from 'path';
import { getSettings } from './settingsStore';
import { siteConfig } from './siteConfig';
import { isAiConfigured, anthropicMessage } from './aiAssist';

const REPORT_PATH = path.join(process.cwd(), 'data', 'seo-report.json');
const MAX_PAGES = 24;

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'info';

export interface SeoCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface SeoPage {
  url: string;
  label: string;
  score: number;        // 0..100
  checks: SeoCheck[];
}

export interface SeoReport {
  generatedAt: string;
  durationMs: number;
  baseUrl: string;
  score: number;        // 0..100 gesamt
  pages: SeoPage[];
  site: SeoCheck[];
  jsonldTypes: string[];
  ai: { generatedAt: string; text: string } | null;
  errors: string[];
  summary: { pages: number; ok: number; warn: number; fail: number };
}

function baseUrl(): string {
  const m = getSettings().mail as { login_base_url?: string };
  return (m.login_base_url || process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url || 'https://next.faltintravel.com').replace(/\/+$/, '');
}

/**
 * Interne Basis-URL: Der Container scannt sich selbst über localhost. Die öffentliche
 * Domain ist von innen oft nicht erreichbar (kein Hairpin-NAT) → sonst HTTP 0.
 */
function internalBase(): string {
  return `http://127.0.0.1:${process.env.PORT || 3000}`;
}

interface ScanTarget { fetchUrl: string; displayUrl: string; label: string }

async function fetchText(url: string, timeoutMs = 9000): Promise<{ ok: boolean; status: number; body: string; ctype: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'ft-seo-audit/1' } });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, ctype: res.headers.get('content-type') || '' };
  } catch (e) {
    return { ok: false, status: 0, body: '', ctype: '' + (e as Error).message };
  } finally {
    clearTimeout(t);
  }
}

const STATUS_SCORE: Record<CheckStatus, number> = { ok: 1, warn: 0.5, fail: 0, info: 1 };
function scoreOf(checks: SeoCheck[]): number {
  const graded = checks.filter((c) => c.status !== 'info');
  if (graded.length === 0) return 100;
  const sum = graded.reduce((s, c) => s + STATUS_SCORE[c.status], 0);
  return Math.round((sum / graded.length) * 100);
}

function attr(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? (m[1] ?? '').trim() : null;
}

function extractJsonLdTypes(html: string): string[] {
  const types: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const json = JSON.parse(m[1].trim());
      const collect = (o: unknown) => {
        if (!o) return;
        if (Array.isArray(o)) return o.forEach(collect);
        if (typeof o === 'object') {
          const t = (o as { '@type'?: unknown })['@type'];
          if (typeof t === 'string') types.push(t);
          else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && types.push(x));
          const graph = (o as { '@graph'?: unknown })['@graph'];
          if (graph) collect(graph);
        }
      };
      collect(json);
    } catch { /* invalid JSON-LD wird separat als Befund gewertet */ }
  }
  return Array.from(new Set(types));
}

/** Analysiert eine einzelne Seite. */
async function analyzePage(fetchUrl: string, displayUrl: string, label: string): Promise<{ page: SeoPage; jsonld: string[] }> {
  const r = await fetchText(fetchUrl);
  const checks: SeoCheck[] = [];
  if (!r.ok) {
    checks.push({ key: 'reachable', label: 'Erreichbarkeit', status: 'fail', detail: `HTTP ${r.status || '—'}` });
    return { page: { url: displayUrl, label, score: 0, checks }, jsonld: [] };
  }
  const html = r.body;

  // Title
  const title = attr(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!title) checks.push({ key: 'title', label: 'Title', status: 'fail', detail: 'fehlt' });
  else if (title.length < 15 || title.length > 65) checks.push({ key: 'title', label: 'Title', status: 'warn', detail: `${title.length} Zeichen (ideal 15–65)` });
  else checks.push({ key: 'title', label: 'Title', status: 'ok', detail: `${title.length} Zeichen` });

  // Meta description
  const desc = attr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    ?? attr(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  if (!desc) checks.push({ key: 'desc', label: 'Meta-Description', status: 'fail', detail: 'fehlt' });
  else if (desc.length < 50 || desc.length > 165) checks.push({ key: 'desc', label: 'Meta-Description', status: 'warn', detail: `${desc.length} Zeichen (ideal 50–165)` });
  else checks.push({ key: 'desc', label: 'Meta-Description', status: 'ok', detail: `${desc.length} Zeichen` });

  // H1
  const h1count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1count === 0) checks.push({ key: 'h1', label: 'H1', status: 'warn', detail: 'keine H1' });
  else if (h1count > 1) checks.push({ key: 'h1', label: 'H1', status: 'warn', detail: `${h1count} H1 (ideal 1)` });
  else checks.push({ key: 'h1', label: 'H1', status: 'ok', detail: '1 H1' });

  // Canonical
  checks.push(/rel=["']canonical["']/i.test(html)
    ? { key: 'canonical', label: 'Canonical', status: 'ok', detail: 'vorhanden' }
    : { key: 'canonical', label: 'Canonical', status: 'warn', detail: 'fehlt' });

  // OpenGraph
  const ogImg = /property=["']og:image["']/i.test(html);
  const ogTitle = /property=["']og:title["']/i.test(html);
  checks.push(ogImg && ogTitle
    ? { key: 'og', label: 'OpenGraph', status: 'ok', detail: 'og:title + og:image' }
    : { key: 'og', label: 'OpenGraph', status: 'warn', detail: ogImg || ogTitle ? 'unvollständig' : 'fehlt' });

  // lang
  checks.push(/<html[^>]+lang=/i.test(html)
    ? { key: 'lang', label: 'lang-Attribut', status: 'ok', detail: 'gesetzt' }
    : { key: 'lang', label: 'lang-Attribut', status: 'warn', detail: 'fehlt' });

  // noindex
  if (/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html)) checks.push({ key: 'index', label: 'Indexierbar', status: 'info', detail: 'noindex gesetzt' });
  else checks.push({ key: 'index', label: 'Indexierbar', status: 'ok', detail: 'indexierbar' });

  // Bild-Alt
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter((i) => !/\balt=/i.test(i)).length;
  if (imgs.length === 0) checks.push({ key: 'alt', label: 'Bild-Alt', status: 'info', detail: 'keine <img> im HTML' });
  else if (noAlt === 0) checks.push({ key: 'alt', label: 'Bild-Alt', status: 'ok', detail: `${imgs.length} Bilder, alle mit alt` });
  else checks.push({ key: 'alt', label: 'Bild-Alt', status: 'warn', detail: `${noAlt}/${imgs.length} ohne alt` });

  // Strukturierte Daten (JSON-LD)
  const jsonld = extractJsonLdTypes(html);
  checks.push(jsonld.length > 0
    ? { key: 'jsonld', label: 'Strukturierte Daten', status: 'ok', detail: jsonld.join(', ') }
    : { key: 'jsonld', label: 'Strukturierte Daten', status: 'fail', detail: 'kein JSON-LD' });

  // GEO: serverseitige Fakten (Preis im HTML, nicht nur clientseitig)
  const hasPriceFact = /(CHF|EUR|€)\s?\d|\d['’ ]?\d{3}\s?(CHF|EUR|€)/.test(html);
  const looksLikeOffer = /paket|package|hospitality|ticket|preis|ab\s*(CHF|EUR|€)/i.test(html);
  if (looksLikeOffer) {
    checks.push(hasPriceFact
      ? { key: 'geo_facts', label: 'GEO: Fakten im HTML', status: 'ok', detail: 'Preis/Angebot serverseitig sichtbar' }
      : { key: 'geo_facts', label: 'GEO: Fakten im HTML', status: 'warn', detail: 'keine Preis-Fakten im SSR-HTML (nur clientseitig?)' });
  }

  return { page: { url: displayUrl, label, score: scoreOf(checks), checks }, jsonld };
}

/** Scan-Ziele aus der Sitemap: intern fetchen, öffentlich anzeigen (gekappt auf MAX_PAGES). */
async function getTargets(pub: string, internal: string): Promise<ScanTarget[]> {
  const sm = await fetchText(`${internal}/sitemap.xml`);
  const locs: string[] = [];
  if (sm.ok) {
    const re = /<loc>([^<]+)<\/loc>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sm.body))) locs.push(m[1].trim());
  }
  const uniq = Array.from(new Set(locs.length ? locs : [pub]));
  const targets: ScanTarget[] = uniq.map((loc) => {
    let p = '/';
    try { p = new URL(loc).pathname || '/'; } catch { p = loc.startsWith('/') ? loc : '/'; }
    return { fetchUrl: internal + p, displayUrl: loc.startsWith('http') ? loc : pub + p, label: p === '/' ? 'Startseite' : p };
  });
  targets.sort((a, b) => (a.label === 'Startseite' ? -1 : b.label === 'Startseite' ? 1 : 0));
  return targets.slice(0, MAX_PAGES);
}

async function siteChecks(base: string, errors: string[]): Promise<SeoCheck[]> {
  const out: SeoCheck[] = [];
  // sitemap
  const sm = await fetchText(`${base}/sitemap.xml`);
  const urlCount = sm.ok ? (sm.body.match(/<loc>/gi) || []).length : 0;
  out.push(sm.ok ? { key: 'sitemap', label: 'sitemap.xml', status: 'ok', detail: `${urlCount} URLs` } : { key: 'sitemap', label: 'sitemap.xml', status: 'fail', detail: `HTTP ${sm.status}` });
  // robots.txt
  const rb = await fetchText(`${base}/robots.txt`);
  if (!rb.ok) out.push({ key: 'robots', label: 'robots.txt', status: 'fail', detail: `HTTP ${rb.status}` });
  else {
    const hasSitemap = /sitemap:/i.test(rb.body);
    out.push(hasSitemap ? { key: 'robots', label: 'robots.txt', status: 'ok', detail: 'vorhanden, Sitemap referenziert' } : { key: 'robots', label: 'robots.txt', status: 'warn', detail: 'vorhanden, aber keine Sitemap-Referenz' });
    // AI-Crawler
    const blocksAi = /user-agent:\s*(gptbot|google-extended|ccbot|claudebot|perplexitybot)[\s\S]*?disallow:\s*\//i.test(rb.body);
    out.push(blocksAi
      ? { key: 'aicrawler', label: 'GEO: AI-Crawler', status: 'warn', detail: 'AI-Bots (GPTBot u.a.) werden geblockt' }
      : { key: 'aicrawler', label: 'GEO: AI-Crawler', status: 'ok', detail: 'AI-Bots nicht geblockt' });
  }
  // llms.txt
  const llms = await fetchText(`${base}/llms.txt`);
  out.push(llms.ok && /text\/(plain|markdown)/i.test(llms.ctype) || (llms.ok && llms.status === 200)
    ? { key: 'llms', label: 'GEO: llms.txt', status: 'ok', detail: 'vorhanden' }
    : { key: 'llms', label: 'GEO: llms.txt', status: 'fail', detail: 'fehlt (HTTP ' + llms.status + ')' });
  if (errors.length > 200) errors.length = 200;
  return out;
}

async function aiRecommendation(report: Omit<SeoReport, 'ai'>): Promise<{ generatedAt: string; text: string } | null> {
  if (!isAiConfigured()) return null;
  const failing = report.pages.flatMap((p) => p.checks.filter((c) => c.status === 'fail' || c.status === 'warn').map((c) => `${p.label}: ${c.label} (${c.status}) – ${c.detail}`)).slice(0, 40);
  const siteFail = report.site.filter((c) => c.status !== 'ok').map((c) => `${c.label}: ${c.detail}`);
  const payload = { score: report.score, jsonld_vorhanden: report.jsonldTypes, site: siteFail, seiten_befunde: failing };
  const system = [
    'Du bist Senior-SEO/GEO-Consultant (GEO = Generative Engine Optimization, Auffindbarkeit in KI-Antworten). Antworte auf Deutsch, knapp, konkret, Markdown.',
    'Du bekommst einen Audit einer Next.js-Sportreisen-Plattform (Events, Pakete mit Preisen). Priorisiere nach Wirkung/Aufwand.',
    'Gib: 1) Quick Wins (sofort), 2) Strukturierte Daten (welche JSON-LD-Typen wo: Event, Product/Offer, FAQPage, BreadcrumbList), 3) GEO-Maßnahmen (llms.txt, Preis-/Fakten serverseitig rendern, AI-Crawler).',
    'Keine Einleitung, keine Wiederholung der Rohdaten. Max ~24 Zeilen, kurze Überschriften + Stichpunkte.',
  ].join(' ');
  const res = await anthropicMessage({ system, userText: 'Audit-Daten als JSON:\n\n' + JSON.stringify(payload, null, 2), maxTokens: 1600 });
  return res.ok && res.text ? { generatedAt: new Date().toISOString(), text: res.text } : null;
}

export async function runSeoScan(withAi = true): Promise<SeoReport> {
  const t0 = Date.now();
  const pub = baseUrl();
  const internal = internalBase();
  const errors: string[] = [];

  const targets = await getTargets(pub, internal);
  const pages: SeoPage[] = [];
  const allJsonld = new Set<string>();
  // sequenziell, um den eigenen Server nicht zu fluten
  for (const tg of targets) {
    try {
      const { page, jsonld } = await analyzePage(tg.fetchUrl, tg.displayUrl, tg.label);
      pages.push(page);
      jsonld.forEach((t) => allJsonld.add(t));
    } catch (e) {
      errors.push(`${tg.displayUrl}: ${(e as Error).message}`);
    }
  }

  const site = await siteChecks(internal, errors);

  // Gesamt-Score: Mittel aus Seiten-Scores + Site-Checks
  const siteScore = scoreOf(site);
  const pageScoreAvg = pages.length ? Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length) : 0;
  const score = Math.round(pageScoreAvg * 0.7 + siteScore * 0.3);

  const allChecks = [...pages.flatMap((p) => p.checks), ...site];
  const summary = {
    pages: pages.length,
    ok: allChecks.filter((c) => c.status === 'ok').length,
    warn: allChecks.filter((c) => c.status === 'warn').length,
    fail: allChecks.filter((c) => c.status === 'fail').length,
  };

  const partial: Omit<SeoReport, 'ai'> = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    baseUrl: pub,
    score,
    pages,
    site,
    jsonldTypes: Array.from(allJsonld),
    errors,
    summary,
  };

  let ai: SeoReport['ai'] = null;
  if (withAi) {
    try { ai = await aiRecommendation(partial); } catch (e) { errors.push(`KI: ${(e as Error).message}`); }
  }

  const report: SeoReport = { ...partial, ai };
  await saveReport(report);
  return report;
}

async function saveReport(report: SeoReport): Promise<void> {
  try {
    await fsp.mkdir(path.dirname(REPORT_PATH), { recursive: true });
    await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  } catch { /* best effort */ }
}

export async function readSeoReport(): Promise<SeoReport | null> {
  try {
    return JSON.parse(await fsp.readFile(REPORT_PATH, 'utf8')) as SeoReport;
  } catch {
    return null;
  }
}

export function seoReportAgeHours(report: SeoReport | null): number | null {
  if (!report?.generatedAt) return null;
  return (Date.now() - new Date(report.generatedAt).getTime()) / 3_600_000;
}
