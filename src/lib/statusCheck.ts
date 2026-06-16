/**
 * statusCheck.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * System-Status für das Admin (/admin/status):
 *   1) Live-Health: App/Uptime, SQLite-DB, M365/Graph, Brevo, KI, Daten-Volume.
 *   2) Versions-Check: installierte vs. aktuell verfügbare Versionen
 *      (npm-Registry für Pakete, nodejs.org für Node).
 *   3) CVEs: bekannte Schwachstellen pro Version via OSV.dev (Google, frei).
 *
 * Health ist günstig und wird live berechnet. Versions-/CVE-Scan ist teurer
 * (externe APIs) und wird gecacht in data/status-report.json.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync } from 'fs';
import { promises as fsp } from 'fs';
import path from 'path';
import { dbGet } from './dbq';
import { pgEnabled } from './pg';
import './database';
import { getSettings } from './settingsStore';
import { graphHealth } from './graphMailer';
import { isAiConfigured, anthropicMessage } from './aiAssist';

const DATA_DIR = path.join(process.cwd(), 'data');
const REPORT_PATH = path.join(DATA_DIR, 'status-report.json');

/** Pakete, die im Versions-/CVE-Check beobachtet werden. */
const WATCHED_PACKAGES = [
  'next', 'react', 'react-dom', 'better-sqlite3', 'pg', 'lucide-react', 'react-hook-form',
  'date-fns', 'jspdf', 'jspdf-autotable', 'qrcode', 'pdf-parse', '@supabase/supabase-js',
  'typescript', 'tailwindcss', 'eslint', 'eslint-config-next',
];

// ─── Typen ───────────────────────────────────────────────────────────────────

export type HealthStatus = 'ok' | 'warn' | 'down';

export interface HealthItem {
  key: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface HealthReport {
  generatedAt: string;
  uptimeSec: number;
  nodeVersion: string;
  env: string;
  items: HealthItem[];
}

export type VersionState = 'current' | 'patch' | 'minor' | 'major' | 'unknown';

export interface VersionRow {
  name: string;
  installed: string;
  latest: string;
  state: VersionState;
  source: 'npm' | 'node';
}

export interface VulnRow {
  package: string;
  version: string;
  id: string;
  cve: string;
  severity: string;
  summary: string;
  url: string;
}

export interface StatusReport {
  generatedAt: string;
  durationMs: number;
  versions: VersionRow[];
  vulnerabilities: VulnRow[];
  /** Anzahl aller installierten Pakete, die auf CVEs geprüft wurden (inkl. transitiv). */
  scannedDeps: number;
  ai: { generatedAt: string; text: string } | null;
  errors: string[];
}

// ─── Helfer ──────────────────────────────────────────────────────────────────

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 9000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function cleanVersion(range: string): string {
  const m = (range || '').match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!m) return '';
  const major = m[1];
  const minor = m[2] ?? '0';
  const patch = m[3] ?? '0';
  return `${major}.${minor}.${patch}`;
}

function compareVersions(a: string, b: string): VersionState {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  if (pa[0] !== pb[0]) return 'major';
  if (pa[1] !== pb[1]) return 'minor';
  if (pa[2] !== pb[2]) return 'patch';
  return 'current';
}

/** Liest die tatsächlich installierte Version aus node_modules (Fallback: package.json-Range). */
function installedVersion(pkg: string, declared: string): string {
  try {
    const p = path.join(process.cwd(), 'node_modules', pkg, 'package.json');
    const j = JSON.parse(readFileSync(p, 'utf8')) as { version?: string };
    if (j.version) return j.version;
  } catch {
    /* node_modules evtl. nicht vorhanden (standalone) */
  }
  return cleanVersion(declared);
}

/** Listet ALLE installierten Pakete aus node_modules (inkl. transitiv + scoped @org/pkg). */
function listInstalledPackages(): { name: string; version: string }[] {
  const base = path.join(process.cwd(), 'node_modules');
  const out: { name: string; version: string }[] = [];
  const readPkg = (dir: string, fallbackName: string) => {
    try {
      const j = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { name?: string; version?: string };
      if (j.version) out.push({ name: j.name || fallbackName, version: j.version });
    } catch {
      /* kein gültiges Paket */
    }
  };
  let entries: string[] = [];
  try { entries = readdirSync(base); } catch { return out; }
  for (const e of entries) {
    if (e.startsWith('.')) continue;
    if (e.startsWith('@')) {
      try {
        for (const sub of readdirSync(path.join(base, e))) readPkg(path.join(base, e, sub), `${e}/${sub}`);
      } catch { /* skip scope */ }
    } else {
      readPkg(path.join(base, e), e);
    }
  }
  // Duplikate (gleicher name@version) entfernen
  const seen = new Set<string>();
  return out.filter((p) => { const k = `${p.name}@${p.version}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function readPackageJson(): { dependencies: Record<string, string>; devDependencies: Record<string, string> } {
  try {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
    return { dependencies: j.dependencies || {}, devDependencies: j.devDependencies || {} };
  } catch {
    return { dependencies: {}, devDependencies: {} };
  }
}

// ─── Health (live) ───────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthReport> {
  const items: HealthItem[] = [];

  // App
  items.push({ key: 'app', label: 'Anwendung (Next.js)', status: 'ok', detail: `läuft · ${process.env.NODE_ENV || 'production'}` });

  // Datenbank
  const dbLabel = `Datenbank (${pgEnabled() ? 'PostgreSQL' : 'SQLite'})`;
  try {
    const row = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM booking_requests');
    items.push({ key: 'db', label: dbLabel, status: 'ok', detail: `erreichbar · ${Number(row?.n) || 0} Anfragen` });
  } catch (e) {
    items.push({ key: 'db', label: dbLabel, status: 'down', detail: (e as Error).message });
  }

  // Daten-Volume beschreibbar?
  try {
    const probe = path.join(DATA_DIR, `.health-${Date.now()}.tmp`);
    await fsp.writeFile(probe, 'ok');
    await fsp.unlink(probe);
    items.push({ key: 'volume', label: 'Daten-Volume', status: 'ok', detail: 'beschreibbar' });
  } catch (e) {
    items.push({ key: 'volume', label: 'Daten-Volume', status: 'down', detail: `nicht beschreibbar: ${(e as Error).message}` });
  }

  // M365 / Graph
  try {
    const g = await graphHealth();
    if (!g.configured) items.push({ key: 'mail', label: 'E-Mail / M365 (Graph)', status: 'warn', detail: 'nicht konfiguriert' });
    else if (g.tokenOk) items.push({ key: 'mail', label: 'E-Mail / M365 (Graph)', status: 'ok', detail: 'Token ok · Versand bereit' });
    else items.push({ key: 'mail', label: 'E-Mail / M365 (Graph)', status: 'down', detail: `Token-Fehler: ${g.error || 'unbekannt'}` });
  } catch (e) {
    items.push({ key: 'mail', label: 'E-Mail / M365 (Graph)', status: 'down', detail: (e as Error).message });
  }

  // Brevo
  const brevoKey = getSettings().mail.brevo_api_key || process.env.BREVO_API_KEY;
  items.push({ key: 'brevo', label: 'Newsletter (Brevo)', status: brevoKey ? 'ok' : 'warn', detail: brevoKey ? 'konfiguriert' : 'kein API-Key' });

  // KI
  items.push({ key: 'ai', label: 'KI (Anthropic)', status: isAiConfigured() ? 'ok' : 'warn', detail: isAiConfigured() ? 'konfiguriert' : 'kein API-Key' });

  // Letzte eingehende Mail (Inbound-Poll lebt?)
  try {
    const row = await dbGet<{ last?: string }>(`SELECT MAX(created_at) AS last FROM booking_messages WHERE direction = 'in'`);
    if (row?.last) items.push({ key: 'inbound', label: 'Letzte Kundenantwort', status: 'ok', detail: row.last });
  } catch {
    /* Tabelle evtl. anders benannt – nicht kritisch */
  }

  return {
    generatedAt: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'production',
    items,
  };
}

// ─── Versions-Check ──────────────────────────────────────────────────────────

async function checkVersions(errors: string[]): Promise<VersionRow[]> {
  const pkg = readPackageJson();
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const rows: VersionRow[] = [];

  await Promise.all(
    WATCHED_PACKAGES.filter((name) => all[name]).map(async (name) => {
      const declared = all[name];
      const installed = installedVersion(name, declared);
      try {
        const j = (await fetchJson(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`)) as { version?: string };
        const latest = j.version || '';
        rows.push({ name, installed, latest, state: latest ? compareVersions(installed, latest) : 'unknown', source: 'npm' });
      } catch (e) {
        errors.push(`npm ${name}: ${(e as Error).message}`);
        rows.push({ name, installed, latest: '–', state: 'unknown', source: 'npm' });
      }
    })
  );

  // Node
  try {
    const dist = (await fetchJson('https://nodejs.org/dist/index.json')) as Array<{ version: string; lts: boolean | string }>;
    const ltsLatest = dist.find((d) => d.lts) || dist[0];
    const installedNode = process.version.replace(/^v/, '');
    const latestNode = (ltsLatest?.version || '').replace(/^v/, '');
    rows.push({ name: 'node', installed: installedNode, latest: latestNode, state: latestNode ? compareVersions(installedNode, latestNode) : 'unknown', source: 'node' });
  } catch (e) {
    errors.push(`node: ${(e as Error).message}`);
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return rows;
}

// ─── CVE-Check via OSV.dev ───────────────────────────────────────────────────

async function checkVulnerabilities(versions: VersionRow[], errors: string[]): Promise<VulnRow[]> {
  const queries = versions
    .filter((v) => v.source === 'npm' && v.installed)
    .map((v) => ({ package: { name: v.name, ecosystem: 'npm' }, version: v.installed }));
  if (queries.length === 0) return [];

  let batch: { results?: Array<{ vulns?: Array<{ id: string }> }> };
  try {
    batch = (await fetchJson('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries }),
    })) as typeof batch;
  } catch (e) {
    errors.push(`OSV batch: ${(e as Error).message}`);
    return [];
  }

  const results = batch.results || [];
  // ID -> betroffenes Paket/Version
  const idMap = new Map<string, { pkg: string; version: string }>();
  results.forEach((r, i) => {
    const q = queries[i];
    (r.vulns || []).forEach((v) => {
      if (!idMap.has(v.id)) idMap.set(v.id, { pkg: q.package.name, version: q.version });
    });
  });

  const ids = Array.from(idMap.keys()).slice(0, 40);
  const out: VulnRow[] = [];
  await Promise.all(
    ids.map(async (id) => {
      const ctx = idMap.get(id)!;
      try {
        const d = (await fetchJson(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`)) as {
          id: string; summary?: string; details?: string; aliases?: string[];
          severity?: Array<{ type: string; score: string }>;
          database_specific?: { severity?: string };
        };
        const cve = (d.aliases || []).find((a) => a.startsWith('CVE-')) || '';
        let severity = d.database_specific?.severity || '';
        const cvss = (d.severity || []).find((s) => /CVSS/i.test(s.type));
        if (!severity && cvss) severity = `CVSS ${cvss.score}`;
        out.push({
          package: ctx.pkg,
          version: ctx.version,
          id: d.id,
          cve,
          severity: severity || 'unbekannt',
          summary: (d.summary || d.details || '').slice(0, 240),
          url: `https://osv.dev/vulnerability/${d.id}`,
        });
      } catch (e) {
        errors.push(`OSV ${id}: ${(e as Error).message}`);
      }
    })
  );

  const rank: Record<string, number> = { critical: 0, high: 1, moderate: 2, medium: 2, low: 3 };
  out.sort((a, b) => (rank[a.severity.toLowerCase()] ?? 9) - (rank[b.severity.toLowerCase()] ?? 9));
  return out;
}

// ─── KI-Fix-Empfehlungen ─────────────────────────────────────────────────────

export async function generateAiFixes(versions: VersionRow[], vulns: VulnRow[]): Promise<{ generatedAt: string; text: string } | null> {
  if (!isAiConfigured()) return null;
  const outdated = versions.filter((v) => v.state === 'major' || v.state === 'minor');
  const payload = {
    veraltet: outdated.map((v) => ({ paket: v.name, installiert: v.installed, aktuell: v.latest, rueckstand: v.state })),
    schwachstellen: vulns.map((v) => ({ paket: v.package, version: v.version, id: v.cve || v.id, schwere: v.severity, beschreibung: v.summary })),
  };
  const system = [
    'Du bist ein Senior-DevOps/Security-Engineer. Antworte auf Deutsch, knapp und konkret.',
    'Du bekommst veraltete npm-Pakete und bekannte Schwachstellen einer Next.js-16/React-19-App (TypeScript, better-sqlite3, Docker, standalone).',
    'Priorisiere nach Risiko. Nenne pro Punkt: was tun (konkrete Ziel-Version / Befehl), Aufwand, und Breaking-Change-Risiko.',
    'Beginne mit den Sicherheitslücken (sofern vorhanden), dann veraltete Pakete. Keine Einleitung, keine Wiederholung der Rohdaten – nur die Handlungsempfehlung.',
    'Markdown: kurze Überschriften + Stichpunkte. Maximal ~25 Zeilen.',
  ].join(' ');
  const res = await anthropicMessage({
    system,
    userText: 'Hier die Funde als JSON:\n\n' + JSON.stringify(payload, null, 2),
    maxTokens: 1600,
  });
  if (!res.ok || !res.text) return null;
  return { generatedAt: new Date().toISOString(), text: res.text };
}

// ─── Voll-Scan + Cache ───────────────────────────────────────────────────────

export async function runScan(withAi = true): Promise<StatusReport> {
  const t0 = Date.now();
  const errors: string[] = [];
  const versions = await checkVersions(errors);
  // CVE-Scan über ALLE installierten Pakete (inkl. transitiv), nicht nur die kuratierte Liste.
  const installed = listInstalledPackages();
  const scanRows: VersionRow[] = installed.length
    ? installed.map((p) => ({ name: p.name, installed: p.version, latest: '', state: 'unknown', source: 'npm' as const }))
    : versions; // Fallback (z. B. standalone ohne node_modules)
  const scannedDeps = scanRows.filter((r) => r.source === 'npm' && r.installed).length;
  const vulnerabilities = await checkVulnerabilities(scanRows, errors);
  let ai: StatusReport['ai'] = null;
  if (withAi) {
    try { ai = await generateAiFixes(versions, vulnerabilities); }
    catch (e) { errors.push(`KI: ${(e as Error).message}`); }
  }
  const report: StatusReport = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    versions,
    vulnerabilities,
    scannedDeps,
    ai,
    errors,
  };
  await saveReport(report);
  return report;
}

async function saveReport(report: StatusReport): Promise<void> {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.writeFile(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  } catch {
    /* best effort */
  }
}

export async function readReport(): Promise<StatusReport | null> {
  try {
    const raw = await fsp.readFile(REPORT_PATH, 'utf8');
    return JSON.parse(raw) as StatusReport;
  } catch {
    return null;
  }
}

/** Wie alt ist der gespeicherte Report in Stunden? (null = keiner) */
export function reportAgeHours(report: StatusReport | null): number | null {
  if (!report?.generatedAt) return null;
  return (Date.now() - new Date(report.generatedAt).getTime()) / 3_600_000;
}
