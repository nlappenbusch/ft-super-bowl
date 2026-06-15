/**
 * seoCheck.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * SEO- & GEO-Audit (analog Status-Modul). Crawlt die eigenen Seiten (Sitemap,
 * intern über 127.0.0.1) und prüft On-Page-SEO, Technik, strukturierte Daten
 * (JSON-LD) und GEO/KI-Lesbarkeit. Liefert Gesamt-Score, Kategorie-Sub-Scores,
 * Stärken und KI-Empfehlung. Cache: data/seo-report.json.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { promises as fsp } from 'fs';
import path from 'path';
import { getSettings } from './settingsStore';
import { siteConfig } from './siteConfig';
import { isAiConfigured, anthropicMessage } from './aiAssist';

const REPORT_PATH = path.join(process.cwd(), 'data', 'seo-report.json');
const MAX_PAGES = 30;

export type CheckStatus = 'ok' | 'warn' | 'fail' | 'info';
export type CheckCat = 'onpage' | 'technik' | 'structured' | 'geo';

export interface SeoCheck { key: string; label: string; status: CheckStatus; detail: string; cat: CheckCat }
export interface SeoPage { url: string; label: string; score: number; checks: SeoCheck[] }

export interface SeoReport {
  generatedAt: string;
  durationMs: number;
  baseUrl: string;
  score: number;
  categories: Record<CheckCat, number>;
  strengths: string[];
  pages: SeoPage[];
  site: SeoCheck[];
  jsonldTypes: string[];
  ai: { generatedAt: string; text: string } | null;
  errors: string[];
  summary: { pages: number; ok: number; warn: number; fail: number; checks: number };
}

export const CATEGORY_LABEL: Record<CheckCat, string> = {
  onpage: 'On-Page-SEO', technik: 'Technik & Crawlbarkeit', structured: 'Strukturierte Daten', geo: 'GEO / KI-Lesbarkeit',
};
export const RECOMMENDED_JSONLD = ['Organization', 'Event', 'Product', 'Offer', 'FAQPage', 'BreadcrumbList'];

function baseUrl(): string {
  const m = getSettings().mail as { login_base_url?: string };
  return (m.login_base_url || process.env.NEXT_PUBLIC_SITE_URL || siteConfig.url || 'https://next.faltintravel.com').replace(/\/+$/, '');
}
function internalBase(): string { return `http://127.0.0.1:${process.env.PORT || 3000}`; }

interface ScanTarget { fetchUrl: string; displayUrl: string; label: string }

async function fetchRes(url: string, timeoutMs = 9000): Promise<{ ok: boolean; status: number; body: string; ctype: string; ms: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'ft-seo-audit/2' } });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, ctype: res.headers.get('content-type') || '', ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, status: 0, body: '', ctype: '' + (e as Error).message, ms: Date.now() - t0 };
  } finally { clearTimeout(t); }
}

const STATUS_SCORE: Record<CheckStatus, number> = { ok: 1, warn: 0.5, fail: 0, info: 1 };
function scoreOf(checks: SeoCheck[]): number {
  const g = checks.filter((c) => c.status !== 'info');
  if (!g.length) return 100;
  return Math.round((g.reduce((s, c) => s + STATUS_SCORE[c.status], 0) / g.length) * 100);
}
function attr(html: string, re: RegExp): string | null {
  const m = html.match(re); return m ? (m[1] ?? '').trim() : null;
}
function metaContent(html: string, name: string, kind: 'name' | 'property' = 'name'): string | null {
  return attr(html, new RegExp(`<meta[^>]+${kind}=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i'))
    ?? attr(html, new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+${kind}=["']${name}["']`, 'i'));
}
function extractJsonLd(html: string): { types: string[]; invalid: number } {
  const types: string[] = []; let invalid = 0;
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const json = JSON.parse(m[1].trim());
      const collect = (o: unknown) => {
        if (!o) return;
        if (Array.isArray(o)) return o.forEach(collect);
        if (typeof o === 'object') {
          const t = (o as Record<string, unknown>)['@type'];
          if (typeof t === 'string') types.push(t); else if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && types.push(x));
          const g = (o as Record<string, unknown>)['@graph']; if (g) collect(g);
        }
      };
      collect(json);
    } catch { invalid++; }
  }
  return { types: Array.from(new Set(types)), invalid };
}
function textWordCount(html: string): number {
  const main = (html.match(/<main[\s\S]*?<\/main>/i)?.[0]) || html;
  const txt = main.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
  return (txt.match(/\b[\wäöüÄÖÜß-]{2,}\b/g) || []).length;
}

interface PageAnalysis { page: SeoPage; jsonld: string[]; title: string | null; desc: string | null }

async function analyzePage(fetchUrl: string, displayUrl: string, label: string): Promise<PageAnalysis> {
  const r = await fetchRes(fetchUrl);
  const checks: SeoCheck[] = [];
  const add = (key: string, lbl: string, status: CheckStatus, detail: string, cat: CheckCat) => checks.push({ key, label: lbl, status, detail, cat });
  if (!r.ok) {
    add('reachable', 'Erreichbarkeit', 'fail', `HTTP ${r.status || '—'}`, 'technik');
    return { page: { url: displayUrl, label, score: 0, checks }, jsonld: [], title: null, desc: null };
  }
  const html = r.body;
  const pagePath = (() => { try { return new URL(displayUrl).pathname; } catch { return displayUrl; } })();

  // Antwortzeit
  add('speed', 'Antwortzeit', r.ms < 600 ? 'ok' : r.ms < 1500 ? 'warn' : 'fail', `${r.ms} ms`, 'technik');

  // Title
  const title = attr(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!title) add('title', 'Title', 'fail', 'fehlt', 'onpage');
  else { add('title', 'Title', title.length < 15 || title.length > 60 ? 'warn' : 'ok', `${title.length} Zeichen (ideal 15–60)`, 'onpage');
    add('title_brand', 'Title: Marke', /faltin/i.test(title) ? 'ok' : 'info', /faltin/i.test(title) ? 'Marke im Title' : 'ohne Marke', 'onpage'); }

  // Meta description
  const desc = metaContent(html, 'description');
  if (!desc) add('desc', 'Meta-Description', 'fail', 'fehlt', 'onpage');
  else add('desc', 'Meta-Description', desc.length < 50 || desc.length > 160 ? 'warn' : 'ok', `${desc.length} Zeichen (ideal 50–160)`, 'onpage');

  // H1
  const h1s = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1text = h1s.length === 1 ? h1s[0].replace(/<[^>]+>/g, '').trim() : '';
  if (h1s.length === 0) add('h1', 'H1', 'warn', 'keine H1', 'onpage');
  else if (h1s.length > 1) add('h1', 'H1', 'warn', `${h1s.length} H1 (ideal 1)`, 'onpage');
  else add('h1', 'H1', h1text ? 'ok' : 'warn', h1text ? '1 H1' : 'H1 leer', 'onpage');

  // H2-Struktur
  const h2c = (html.match(/<h2[\s>]/gi) || []).length;
  add('headings', 'Zwischenüberschriften', h2c > 0 ? 'ok' : 'info', h2c > 0 ? `${h2c} H2` : 'keine H2', 'onpage');

  // Canonical + self-ref
  const canon = attr(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ?? attr(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  if (!canon) add('canonical', 'Canonical', 'warn', 'fehlt', 'technik');
  else { let cp = canon; try { cp = new URL(canon, displayUrl).pathname; } catch { /* */ }
    add('canonical', 'Canonical', cp === pagePath ? 'ok' : 'warn', cp === pagePath ? 'self-referenzierend' : `zeigt auf ${cp}`, 'technik'); }

  // OpenGraph + Twitter
  const og = ['og:title', 'og:description', 'og:image', 'og:url'].filter((p) => new RegExp(`property=["']${p}["']`, 'i').test(html));
  add('og', 'OpenGraph', og.length >= 3 ? 'ok' : og.length > 0 ? 'warn' : 'fail', og.length ? `${og.length}/4 (${og.map((o) => o.replace('og:', '')).join(',')})` : 'fehlt', 'onpage');
  add('twitter', 'Twitter Card', /name=["']twitter:card["']/i.test(html) ? 'ok' : 'info', /name=["']twitter:card["']/i.test(html) ? 'gesetzt' : 'fehlt', 'onpage');

  // Technik: viewport, charset, lang, favicon, noindex
  add('viewport', 'Viewport (mobil)', /name=["']viewport["']/i.test(html) ? 'ok' : 'warn', /name=["']viewport["']/i.test(html) ? 'gesetzt' : 'fehlt', 'technik');
  add('charset', 'Charset', /charset=/i.test(html.slice(0, 600)) ? 'ok' : 'warn', /charset=/i.test(html.slice(0, 600)) ? 'gesetzt' : 'fehlt', 'technik');
  add('lang', 'lang-Attribut', /<html[^>]+lang=/i.test(html) ? 'ok' : 'warn', /<html[^>]+lang=/i.test(html) ? 'gesetzt' : 'fehlt', 'technik');
  add('favicon', 'Favicon', /<link[^>]+rel=["'][^"']*icon[^"']*["']/i.test(html) ? 'ok' : 'warn', /<link[^>]+rel=["'][^"']*icon/i.test(html) ? 'vorhanden' : 'fehlt', 'technik');
  add('index', 'Indexierbar', /<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html) ? 'info' : 'ok', /noindex/i.test(html) ? 'noindex gesetzt' : 'indexierbar', 'technik');

  // Bild-Alt
  const imgs = html.match(/<img\b[^>]*>/gi) || [];
  const noAlt = imgs.filter((i) => !/\balt=/i.test(i)).length;
  if (!imgs.length) add('alt', 'Bild-Alt', 'info', 'keine <img>', 'onpage');
  else add('alt', 'Bild-Alt', noAlt === 0 ? 'ok' : 'warn', noAlt === 0 ? `${imgs.length} Bilder, alle mit alt` : `${noAlt}/${imgs.length} ohne alt`, 'onpage');

  // Content-Tiefe + interne Links
  const words = textWordCount(html);
  add('content', 'Inhaltstiefe', words >= 250 ? 'ok' : words >= 100 ? 'warn' : 'warn', `~${words} Wörter`, 'onpage');
  const links = (html.match(/<a\b[^>]+href=["'](\/[^"'#]*|https?:\/\/[^"']*faltintravel[^"']*)["']/gi) || []).length;
  add('links', 'Interne Verlinkung', links >= 3 ? 'ok' : 'info', `${links} interne Links`, 'onpage');

  // Mixed Content
  const httpAssets = (html.match(/(?:src|href)=["']http:\/\/[^"']+/gi) || []).filter((s) => !/http:\/\/(127\.0\.0\.1|localhost)/.test(s));
  add('mixed', 'Mixed Content', httpAssets.length ? 'warn' : 'ok', httpAssets.length ? `${httpAssets.length} http-Ressourcen` : 'nur https', 'technik');

  // Strukturierte Daten
  const { types, invalid } = extractJsonLd(html);
  add('jsonld', 'JSON-LD', types.length ? 'ok' : 'fail', types.length ? types.join(', ') : 'kein JSON-LD', 'structured');
  if (invalid > 0) add('jsonld_valid', 'JSON-LD gültig', 'warn', `${invalid} Block/Blöcke ungültig`, 'structured');

  // GEO: SSR-Fakten, semantisches HTML
  const isOffer = /paket|package|hospitality|ticket|preis|ab\s*(CHF|EUR|€)/i.test(html);
  const hasPrice = /(CHF|EUR|€)\s?\d|\d['’ ]?\d{3}\s?(CHF|EUR|€)/.test(html);
  if (isOffer) add('geo_facts', 'GEO: Fakten im HTML', hasPrice ? 'ok' : 'warn', hasPrice ? 'Preis/Angebot serverseitig sichtbar' : 'keine Preis-Fakten im SSR-HTML', 'geo');
  add('semantic', 'GEO: Semantik', /<main[\s>]/i.test(html) || /<article[\s>]/i.test(html) ? 'ok' : 'warn', /<main[\s>]/i.test(html) ? '<main>/<article> vorhanden' : 'kein <main>/<article>', 'geo');

  return { page: { url: displayUrl, label, score: scoreOf(checks), checks }, jsonld: types, title, desc };
}

async function getTargets(pub: string, internal: string): Promise<ScanTarget[]> {
  const sm = await fetchRes(`${internal}/sitemap.xml`);
  const locs: string[] = [];
  if (sm.ok) { const re = /<loc>([^<]+)<\/loc>/gi; let m: RegExpExecArray | null; while ((m = re.exec(sm.body))) locs.push(m[1].trim()); }
  const uniq = Array.from(new Set(locs.length ? locs : [pub]));
  const targets: ScanTarget[] = uniq.map((loc) => {
    let p = '/'; try { p = new URL(loc).pathname || '/'; } catch { p = loc.startsWith('/') ? loc : '/'; }
    return { fetchUrl: internal + p, displayUrl: loc.startsWith('http') ? loc : pub + p, label: p === '/' ? 'Startseite' : p };
  });
  targets.sort((a, b) => (a.label === 'Startseite' ? -1 : b.label === 'Startseite' ? 1 : 0));
  return targets.slice(0, MAX_PAGES);
}

async function siteChecks(internal: string): Promise<SeoCheck[]> {
  const out: SeoCheck[] = [];
  const add = (key: string, lbl: string, status: CheckStatus, detail: string, cat: CheckCat) => out.push({ key, label: lbl, status, detail, cat });
  const sm = await fetchRes(`${internal}/sitemap.xml`);
  const urlCount = sm.ok ? (sm.body.match(/<loc>/gi) || []).length : 0;
  add('sitemap', 'sitemap.xml', sm.ok ? 'ok' : 'fail', sm.ok ? `${urlCount} URLs` : `HTTP ${sm.status}`, 'technik');
  add('sitemap_lastmod', 'Sitemap: lastmod', sm.ok && /<lastmod>/i.test(sm.body) ? 'ok' : 'info', sm.ok && /<lastmod>/i.test(sm.body) ? 'vorhanden' : 'kein lastmod', 'technik');

  const rb = await fetchRes(`${internal}/robots.txt`);
  if (!rb.ok) add('robots', 'robots.txt', 'fail', `HTTP ${rb.status}`, 'technik');
  else {
    add('robots', 'robots.txt', /sitemap:/i.test(rb.body) ? 'ok' : 'warn', /sitemap:/i.test(rb.body) ? 'vorhanden, Sitemap referenziert' : 'vorhanden, keine Sitemap-Referenz', 'technik');
    const blocksAll = /user-agent:\s*\*[\s\S]*?disallow:\s*\/\s*$/im.test(rb.body);
    if (blocksAll) add('robots_block', 'robots: Freigabe', 'fail', 'Disallow: / blockt alles', 'technik');
    const blocksAi = /user-agent:\s*(gptbot|google-extended|googlebot-extended|ccbot|claudebot|perplexitybot)[\s\S]*?disallow:\s*\//i.test(rb.body);
    add('aicrawler', 'GEO: AI-Crawler', blocksAi ? 'warn' : 'ok', blocksAi ? 'AI-Bots (GPTBot u.a.) geblockt' : 'AI-Bots nicht geblockt', 'geo');
  }
  const llms = await fetchRes(`${internal}/llms.txt`);
  add('llms', 'GEO: llms.txt', llms.ok && llms.status === 200 ? 'ok' : 'fail', llms.ok ? 'vorhanden' : `fehlt (HTTP ${llms.status})`, 'geo');

  // Soft-404: nicht existierende URL muss 404 liefern
  const nf = await fetchRes(`${internal}/__seo_probe_404__${Date.now()}`);
  add('soft404', '404-Handling', nf.status === 404 ? 'ok' : 'warn', nf.status === 404 ? 'korrektes 404' : `liefert HTTP ${nf.status} (Soft-404?)`, 'technik');
  return out;
}

function catScores(pages: SeoPage[], site: SeoCheck[]): Record<CheckCat, number> {
  const all = [...pages.flatMap((p) => p.checks), ...site];
  const cats: CheckCat[] = ['onpage', 'technik', 'structured', 'geo'];
  const res = {} as Record<CheckCat, number>;
  for (const c of cats) res[c] = scoreOf(all.filter((x) => x.cat === c));
  return res;
}

function computeStrengths(pages: SeoPage[], site: SeoCheck[], jsonldTypes: string[]): string[] {
  const s: string[] = [];
  const total = pages.length || 1;
  const allOk = (key: string) => pages.filter((p) => p.checks.some((c) => c.key === key && c.status === 'ok')).length;
  if (allOk('title') >= total * 0.8) s.push(`Aussagekräftige Title-Tags auf ${allOk('title')}/${total} Seiten`);
  if (allOk('desc') >= total * 0.7) s.push(`Gepflegte Meta-Descriptions (${allOk('desc')}/${total})`);
  if (allOk('h1') >= total * 0.8) s.push(`Saubere H1-Struktur (${allOk('h1')}/${total})`);
  if (allOk('alt') >= total * 0.7) s.push(`Bild-Alt-Texte überwiegend vorhanden`);
  if (allOk('viewport') === total) s.push('Mobil-Viewport durchgängig gesetzt');
  if (allOk('speed') >= total * 0.8) s.push('Schnelle Server-Antwortzeiten');
  const have = jsonldTypes.filter((t) => RECOMMENDED_JSONLD.includes(t));
  if (have.length) s.push(`JSON-LD bereits aktiv: ${have.join(', ')}`);
  if (site.find((c) => c.key === 'aicrawler')?.status === 'ok') s.push('KI-Crawler (GPTBot & Co.) sind zugelassen');
  if (site.find((c) => c.key === 'sitemap')?.status === 'ok') s.push('Sitemap vorhanden & gefüllt');
  if (site.find((c) => c.key === 'soft404')?.status === 'ok') s.push('Korrektes 404-Handling');
  return s.slice(0, 8);
}

async function aiRecommendation(r: Omit<SeoReport, 'ai'>): Promise<{ generatedAt: string; text: string } | null> {
  if (!isAiConfigured()) return null;
  const failing = r.pages.flatMap((p) => p.checks.filter((c) => c.status === 'fail' || c.status === 'warn').map((c) => `${p.label}: ${c.label} – ${c.detail}`)).slice(0, 45);
  const payload = { score: r.score, kategorien: r.categories, jsonld: r.jsonldTypes, staerken: r.strengths, site: r.site.filter((c) => c.status !== 'ok').map((c) => `${c.label}: ${c.detail}`), seiten_befunde: failing };
  const system = [
    'Du bist Senior-SEO/GEO-Consultant (GEO = Generative Engine Optimization). Antworte auf Deutsch, knapp, konkret.',
    'WICHTIG: Reines Markdown ohne Tabellen und ohne ">"-Blockquotes. Nur ## Überschriften und "- " Stichpunkte. Keine Sonderzeichen wie Pfeile; schreibe "->" als Wort wenn nötig.',
    'Plattform: Next.js-Sportreisen (Events, Pakete mit Preisen). Priorisiere nach Wirkung/Aufwand.',
    'Struktur: "## 1) Quick Wins", "## 2) Strukturierte Daten", "## 3) GEO-Maßnahmen". Nenne konkrete Seiten/JSON-LD-Typen. Max ~22 Zeilen.',
  ].join(' ');
  const res = await anthropicMessage({ system, userText: 'Audit-Daten als JSON:\n\n' + JSON.stringify(payload, null, 2), maxTokens: 1500 });
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
  const titleMap = new Map<string, string[]>();
  const descMap = new Map<string, string[]>();
  for (const tg of targets) {
    try {
      const a = await analyzePage(tg.fetchUrl, tg.displayUrl, tg.label);
      pages.push(a.page);
      a.jsonld.forEach((t) => allJsonld.add(t));
      if (a.title) { const k = a.title.trim().toLowerCase(); titleMap.set(k, [...(titleMap.get(k) || []), tg.label]); }
      if (a.desc) { const k = a.desc.trim().toLowerCase(); descMap.set(k, [...(descMap.get(k) || []), tg.label]); }
    } catch (e) { errors.push(`${tg.displayUrl}: ${(e as Error).message}`); }
  }

  const site = await siteChecks(internal);

  // Cross-Page: Duplikate
  const dupTitles = [...titleMap.values()].filter((v) => v.length > 1).length;
  const dupDescs = [...descMap.values()].filter((v) => v.length > 1).length;
  site.push({ key: 'dup_title', label: 'Eindeutige Titles', status: dupTitles ? 'warn' : 'ok', detail: dupTitles ? `${dupTitles} doppelte Title-Gruppen` : 'alle eindeutig', cat: 'onpage' });
  site.push({ key: 'dup_desc', label: 'Eindeutige Descriptions', status: dupDescs ? 'warn' : 'ok', detail: dupDescs ? `${dupDescs} doppelte Description-Gruppen` : 'alle eindeutig', cat: 'onpage' });

  const categories = catScores(pages, site);
  const siteScore = scoreOf(site);
  const pageAvg = pages.length ? Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length) : 0;
  const score = Math.round(pageAvg * 0.7 + siteScore * 0.3);
  const strengths = computeStrengths(pages, site, Array.from(allJsonld));

  const allChecks = [...pages.flatMap((p) => p.checks), ...site];
  const summary = {
    pages: pages.length,
    ok: allChecks.filter((c) => c.status === 'ok').length,
    warn: allChecks.filter((c) => c.status === 'warn').length,
    fail: allChecks.filter((c) => c.status === 'fail').length,
    checks: allChecks.length,
  };

  const partial: Omit<SeoReport, 'ai'> = {
    generatedAt: new Date().toISOString(), durationMs: Date.now() - t0, baseUrl: pub,
    score, categories, strengths, pages, site, jsonldTypes: Array.from(allJsonld), errors, summary,
  };
  let ai: SeoReport['ai'] = null;
  if (withAi) { try { ai = await aiRecommendation(partial); } catch (e) { errors.push(`KI: ${(e as Error).message}`); } }

  const report: SeoReport = { ...partial, ai };
  await saveReport(report);
  return report;
}

async function saveReport(report: SeoReport): Promise<void> {
  try { await fsp.mkdir(path.dirname(REPORT_PATH), { recursive: true }); await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8'); } catch { /* */ }
}
export async function readSeoReport(): Promise<SeoReport | null> {
  try { return JSON.parse(await fsp.readFile(REPORT_PATH, 'utf8')) as SeoReport; } catch { return null; }
}
export function seoReportAgeHours(report: SeoReport | null): number | null {
  if (!report?.generatedAt) return null;
  return (Date.now() - new Date(report.generatedAt).getTime()) / 3_600_000;
}

/** KI: optimierten Title + Meta-Description für eine Seite vorschlagen (anhand des Live-HTML). */
export async function suggestMeta(pagePath: string): Promise<{ ok: boolean; title?: string; description?: string; error?: string }> {
  if (!isAiConfigured()) return { ok: false, error: 'Kein Anthropic-Key (Admin -> KI-Redaktion).' };
  const internal = internalBase();
  const p = pagePath.startsWith('/') ? pagePath : '/' + pagePath;
  const r = await fetchRes(internal + p);
  if (!r.ok) return { ok: false, error: `Seite nicht erreichbar (HTTP ${r.status})` };
  const h1 = (r.body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '').replace(/<[^>]+>/g, '').trim();
  const curTitle = attr(r.body, /<title[^>]*>([\s\S]*?)<\/title>/i) || '';
  const text = textWordCount(r.body) ? r.body.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500) : '';
  const system = 'Du bist SEO-Texter. Antworte NUR als JSON {"title":"...","description":"..."}. Deutsch. Title 50-60 Zeichen inkl. Marke Faltin Travel. Description 140–160 Zeichen, mit Nutzen/CTA. Keine Anführungszeichen im Text.';
  const res = await anthropicMessage({ system, userText: `Seite: ${p}\nH1: ${h1}\nAktueller Title: ${curTitle}\nInhalt: ${text}`, maxTokens: 400 });
  if (!res.ok || !res.text) return { ok: false, error: res.error || 'KI-Fehler' };
  try {
    const j = JSON.parse(res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1));
    return { ok: true, title: String(j.title || '').trim(), description: String(j.description || '').trim() };
  } catch { return { ok: false, error: 'KI-Antwort nicht lesbar' }; }
}
