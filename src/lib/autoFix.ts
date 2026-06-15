/**
 * autoFix.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * "Auto-Fix" für das Status-Modul. Da sich der Prod-Container nicht selbst per
 * npm updaten kann, bereitet Auto-Fix die Updates vor und stellt sie bereit:
 *   - berechnet den Fix-Plan aus dem Scan (welche Pakete auf welche Version),
 *   - erzeugt eine aktualisierte package.json + ein ausführbares Upgrade-Skript,
 *   - optional KI-Hinweise (Breaking-Risiko, Reihenfolge),
 *   - optional automatischen GitHub-PR (CI baut & deployt nach dem Merge).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync } from 'fs';
import path from 'path';
import type { StatusReport } from './statusCheck';
import { isAiConfigured, anthropicMessage } from './aiAssist';
import { getSettings } from './settingsStore';

/** Pakete, deren Updates als sicherheitsrelevant (Welle 1) gelten. */
export const SECURITY_PACKAGES = ['next', 'eslint-config-next', 'jspdf', 'jspdf-autotable', 'react', 'react-dom'];

export type FixScope = 'security' | 'minor' | 'all';

export interface FixItem {
  name: string;
  from: string;
  to: string;
  type: string;        // patch | minor | major
  dev: boolean;
  security: boolean;
}

export interface FixPlan {
  scope: FixScope;
  items: FixItem[];
  updatedPackageJson: string;
  script: string;
  summary: { total: number; security: number; major: number; minor: number; patch: number };
  nodeHint: string | null;
}

interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [k: string]: unknown;
}

function readPackageJson(): PkgJson {
  return JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')) as PkgJson;
}

/** Berechnet den Fix-Plan + aktualisierte package.json + Upgrade-Skript. */
export function computeFixPlan(report: StatusReport | null, scope: FixScope = 'all'): FixPlan {
  const json = readPackageJson();
  const deps = json.dependencies || {};
  const dev = json.devDependencies || {};
  const versions = (report?.versions || []).filter((v) => v.source === 'npm' && v.latest && v.latest !== '–');

  const items: FixItem[] = [];
  for (const v of versions) {
    if (v.state === 'current' || v.state === 'unknown') continue;
    const inDeps = v.name in deps;
    const inDev = v.name in dev;
    if (!inDeps && !inDev) continue;
    const security = SECURITY_PACKAGES.includes(v.name);
    if (scope === 'security' && !security) continue;
    if (scope === 'minor' && v.state === 'major' && !security) continue;
    items.push({ name: v.name, from: v.installed, to: v.latest, type: v.state, dev: inDev, security });
  }
  // sicherheits-/risikobasiert sortieren: Security zuerst, dann patch->minor->major
  const rank: Record<string, number> = { patch: 0, minor: 1, major: 2 };
  items.sort((a, b) => (a.security === b.security ? (rank[a.type] ?? 3) - (rank[b.type] ?? 3) : a.security ? -1 : 1));

  // aktualisierte package.json (Prefix-Stil beibehalten)
  for (const it of items) {
    const bag = it.dev ? json.devDependencies! : json.dependencies!;
    const cur = String(bag[it.name] || '');
    const prefix = cur.startsWith('^') ? '^' : cur.startsWith('~') ? '~' : '';
    bag[it.name] = prefix + it.to;
  }
  const updatedPackageJson = JSON.stringify(json, null, 2) + '\n';

  // Upgrade-Skript
  const depInstalls = items.filter((i) => !i.dev).map((i) => `${i.name}@${i.to}`);
  const devInstalls = items.filter((i) => i.dev).map((i) => `${i.name}@${i.to}`);
  const nodeRow = (report?.versions || []).find((v) => v.name === 'node' && v.state !== 'current');
  const nodeHint = nodeRow ? `Node ${nodeRow.installed} -> ${nodeRow.latest} (LTS): Dockerfile auf node:22-alpine setzen (separater Schritt, native Module werden neu gebaut).` : null;

  const script = [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '# ─────────────────────────────────────────────────────────────',
    '# Auto-Fix: Abhaengigkeits-Updates fuer ft-super-bowl',
    '# Erzeugt aus dem Status-Modul (/admin/status). VOR dem Merge testen!',
    `# Umfang: ${scope} · ${items.length} Pakete`,
    '# ─────────────────────────────────────────────────────────────',
    '',
    'git checkout -b "fix/auto-updates-$(date +%Y%m%d-%H%M)"',
    depInstalls.length ? `npm install ${depInstalls.join(' ')}` : '# (keine Runtime-Dependencies zu aktualisieren)',
    devInstalls.length ? `npm install -D ${devInstalls.join(' ')}` : '# (keine Dev-Dependencies zu aktualisieren)',
    '',
    'npm run build      # Production-Build pruefen',
    'npx tsc --noEmit   # Typecheck',
    '',
    'git add package.json package-lock.json',
    `git commit -m "chore(deps): Auto-Fix Updates (${items.length} Pakete, Umfang ${scope})"`,
    'git push -u origin HEAD',
    nodeHint ? `# Hinweis: ${nodeHint}` : '',
    'echo "Fertig. Jetzt PR oeffnen, CI gruen abwarten und nach main mergen -> Deploy."',
    '',
  ].filter((l) => l !== '').join('\n') + '\n';

  return {
    scope,
    items,
    updatedPackageJson,
    script,
    summary: {
      total: items.length,
      security: items.filter((i) => i.security).length,
      major: items.filter((i) => i.type === 'major').length,
      minor: items.filter((i) => i.type === 'minor').length,
      patch: items.filter((i) => i.type === 'patch').length,
    },
    nodeHint,
  };
}

/** KI-Hinweise zum Plan: Reihenfolge, Breaking-Change-Risiko, Test-Fokus. */
export async function aiFixGuidance(plan: FixPlan, report: StatusReport | null): Promise<string | null> {
  if (!isAiConfigured()) return null;
  const payload = {
    updates: plan.items.map((i) => ({ paket: i.name, von: i.from, auf: i.to, sprung: i.type, security: i.security })),
    offene_schwachstellen: (report?.vulnerabilities || []).slice(0, 30).map((v) => ({ paket: v.package, id: v.cve || v.id, schwere: v.severity })),
    node_hinweis: plan.nodeHint,
  };
  const system = [
    'Du bist Senior-DevOps/Release-Engineer. Antworte auf Deutsch, knapp, konkret, in Markdown.',
    'Du bekommst eine Liste geplanter npm-Updates (Next.js 16 / React 19 / TypeScript / Docker-standalone, better-sqlite3 nativ).',
    'Gib eine knappe Umsetzungs-Anleitung: 1) empfohlene Reihenfolge (Sicherheit zuerst), 2) je Major-Update das konkrete Breaking-Change-Risiko + worauf beim Test zu achten ist, 3) ein kurzer Hinweis zu better-sqlite3 (nativ) und Node-LTS.',
    'Keine Wiederholung der Rohdaten, keine Einleitung. Maximal ~22 Zeilen. Kurze Überschriften + Stichpunkte.',
  ].join(' ');
  const res = await anthropicMessage({ system, userText: 'Geplante Updates als JSON:\n\n' + JSON.stringify(payload, null, 2), maxTokens: 1400 });
  return res.ok && res.text ? res.text : null;
}

// ─── GitHub-PR ────────────────────────────────────────────────────────────────

export interface GithubConfig { token: string; owner: string; repo: string; base: string; configured: boolean; }

export function getGithubConfig(): GithubConfig {
  const g = getSettings().github || ({} as Partial<GithubConfig>);
  const token = (g as { token?: string }).token || process.env.GITHUB_TOKEN || '';
  return {
    token,
    owner: (g as { owner?: string }).owner || 'nlappenbusch',
    repo: (g as { repo?: string }).repo || 'ft-super-bowl',
    base: (g as { base_branch?: string }).base_branch || 'main',
    configured: !!token,
  };
}

async function gh(cfg: GithubConfig, method: string, endpoint: string, body?: unknown): Promise<{ ok: boolean; status: number; json: any }> {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'ft-status-autofix',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, json };
}

/**
 * Erzeugt einen Branch mit der aktualisierten package.json und öffnet einen PR.
 * package-lock.json wird im CI-Build (npm install) neu aufgelöst.
 */
export async function createFixPr(plan: FixPlan): Promise<{ success: boolean; url?: string; branch?: string; error?: string }> {
  const cfg = getGithubConfig();
  if (!cfg.configured) return { success: false, error: 'Kein GitHub-Token konfiguriert.' };
  if (plan.items.length === 0) return { success: false, error: 'Keine Updates im Plan.' };

  const base = cfg.base;
  const branch = `fix/auto-updates-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`;

  // 1) Base-SHA
  const ref = await gh(cfg, 'GET', `/repos/${cfg.owner}/${cfg.repo}/git/ref/heads/${encodeURIComponent(base)}`);
  if (!ref.ok) return { success: false, error: `Base-Branch nicht gefunden (${ref.status}): ${ref.json?.message || ''}` };
  const baseSha = ref.json.object.sha;

  // 2) Branch anlegen
  const cre = await gh(cfg, 'POST', `/repos/${cfg.owner}/${cfg.repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: baseSha });
  if (!cre.ok) return { success: false, error: `Branch anlegen fehlgeschlagen (${cre.status}): ${cre.json?.message || ''}` };

  // 3) aktuelle package.json (sha) holen
  const cur = await gh(cfg, 'GET', `/repos/${cfg.owner}/${cfg.repo}/contents/package.json?ref=${encodeURIComponent(base)}`);
  if (!cur.ok) return { success: false, error: `package.json nicht gefunden (${cur.status})` };

  // 4) package.json auf dem Branch aktualisieren
  const content = Buffer.from(plan.updatedPackageJson, 'utf8').toString('base64');
  const put = await gh(cfg, 'PUT', `/repos/${cfg.owner}/${cfg.repo}/contents/package.json`, {
    message: `chore(deps): Auto-Fix Updates (${plan.items.length} Pakete, Umfang ${plan.scope})`,
    content,
    sha: cur.json.sha,
    branch,
  });
  if (!put.ok) return { success: false, error: `package.json aktualisieren fehlgeschlagen (${put.status}): ${put.json?.message || ''}` };

  // 5) PR öffnen
  const bodyLines = [
    '**Automatisch erzeugt vom Status-Modul (Auto-Fix).**',
    '',
    `Umfang: \`${plan.scope}\` · ${plan.summary.total} Pakete (${plan.summary.security} sicherheitsrelevant, ${plan.summary.major} Major).`,
    '',
    '| Paket | von | auf | Sprung |',
    '|---|---|---|---|',
    ...plan.items.map((i) => `| ${i.name} | ${i.from} | ${i.to} | ${i.type}${i.security ? ' 🔒' : ''} |`),
    '',
    '_package-lock.json wird im CI-Build (npm install) neu aufgelöst. Bitte CI-Grün abwarten und testen, bevor gemergt wird._',
    plan.nodeHint ? `\n> Hinweis: ${plan.nodeHint}` : '',
  ].join('\n');
  const pr = await gh(cfg, 'POST', `/repos/${cfg.owner}/${cfg.repo}/pulls`, {
    title: `Auto-Fix: ${plan.summary.total} Abhängigkeits-Updates`,
    head: branch,
    base,
    body: bodyLines,
  });
  if (!pr.ok) return { success: false, error: `PR öffnen fehlgeschlagen (${pr.status}): ${pr.json?.message || ''}`, branch };

  return { success: true, url: pr.json.html_url, branch };
}
