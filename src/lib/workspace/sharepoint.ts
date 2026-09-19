/**
 * workspace/sharepoint.ts — SharePoint/OneDrive-Inhalte für die Faltin-KI (nur lesen).
 * ─────────────────────────────────────────────────────────────────────────────
 * Nutzt dieselbe Entra-App wie der Mailversand (App-only). Dafür braucht die App
 * zusätzlich die Application-Permission **Sites.Read.All** (oder Files.Read.All)
 * mit Admin-Consent — sonst liefert Graph 403 und der Arbeitsplatz zeigt einen
 * klaren Hinweis statt Fehlern.
 *
 * Suche: Standard ist die tenant-weite Microsoft-Search (/search/query, bei
 * App-only mit `region`). Sind in den Einstellungen Site-URLs hinterlegt, wird
 * stattdessen nur in deren Dokumentbibliotheken gesucht.
 * Lesen: PDFs direkt, Office-Dateien lässt Graph als PDF rendern (?format=pdf),
 * Text als Text, Bilder als Bild.
 *
 * Zugriffsgrenzen (App-only kennt keine Rechte der einzelnen Person!):
 *   – Persönliche OneDrives werden nie gelesen oder gelistet.
 *   – Sind Site-URLs hinterlegt, gilt die Liste für Suche UND Lesen.
 *   – Empfohlen: App-Recht „Sites.Selected“ und nur die Team-Sites freigeben.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { graphRequest, graphTokenRoles, isGraphConfigured } from '../graphMailer';
import { getSettings } from '../settingsStore';

const READ_ROLES = ['Sites.Read.All', 'Sites.ReadWrite.All', 'Files.Read.All', 'Files.ReadWrite.All', 'Sites.Selected', 'Sites.FullControl.All'];

export interface SharePointStatus {
  configured: boolean;
  canRead: boolean;
  roles: string[];
  hint: string;
}

export async function sharepointStatus(): Promise<SharePointStatus> {
  if (!isGraphConfigured()) {
    return { configured: false, canRead: false, roles: [], hint: 'Microsoft 365 ist im Portal nicht eingerichtet (Admin → E-Mail / M365).' };
  }
  const roles = await graphTokenRoles().catch(() => []);
  const canRead = roles.some((r) => READ_ROLES.includes(r));
  return {
    configured: true,
    canRead,
    roles,
    hint: canRead
      ? 'SharePoint-Lesezugriff aktiv.'
      : 'Der Entra-App fehlt die Application-Permission „Sites.Read.All“ (Microsoft Graph) mit Admin-Consent. Nach der Freigabe App neu starten (Token-Cache).',
  };
}

export interface SharePointHit {
  drive_id: string;
  item_id: string;
  name: string;
  web_url: string;
  size: number;
  modified: string;
  modified_by: string;
  path: string;
  snippet: string;
}

let workingRegion: string | null = null;

function configuredSites(): string[] {
  return (getSettings().ai.sharepoint_sites || '')
    .split(/[\n,]/).map((s) => s.trim()).filter((s) => /^https:\/\//i.test(s));
}

async function graphJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await graphRequest(path, init);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    if (res.status === 403 || res.status === 401) {
      throw new Error('Kein Zugriff auf SharePoint: Der Entra-App fehlt die Berechtigung Sites.Read.All (Admin-Consent nötig).');
    }
    throw new Error(`Graph ${res.status}: ${txt.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

interface DriveItem {
  id: string; name: string; webUrl?: string; size?: number; lastModifiedDateTime?: string;
  lastModifiedBy?: { user?: { displayName?: string } };
  parentReference?: { driveId?: string; driveType?: string; path?: string; siteId?: string };
  file?: { mimeType?: string };
  folder?: unknown;
}

function hitFrom(item: DriveItem, snippet = ''): SharePointHit | null {
  if (!item.parentReference?.driveId || item.folder) return null;
  if (item.parentReference.driveType === 'personal') return null; // OneDrives bleiben privat
  return {
    drive_id: item.parentReference.driveId,
    item_id: item.id,
    name: item.name,
    web_url: item.webUrl || '',
    size: item.size || 0,
    modified: item.lastModifiedDateTime || '',
    modified_by: item.lastModifiedBy?.user?.displayName || '',
    path: (item.parentReference.path || '').replace(/^\/drives\/[^/]+\/root:?/, '') || '/',
    snippet: snippet.replace(/<\/?c0>/g, '').replace(/<ddd\/>/g, '…').replace(/\s+/g, ' ').trim(),
  };
}

async function searchTenant(query: string, size: number): Promise<SharePointHit[]> {
  const preferred = (getSettings().ai.sharepoint_region || '').trim().toUpperCase();
  const candidates = Array.from(new Set([workingRegion, preferred, 'CHE', 'EUR', 'NAM'].filter(Boolean))) as string[];
  let lastError = '';
  for (const region of candidates) {
    const res = await graphRequest('/search/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ entityTypes: ['driveItem'], query: { queryString: query }, from: 0, size, region }],
      }),
    });
    if (res.ok) {
      workingRegion = region;
      const j = (await res.json()) as {
        value?: Array<{ hitsContainers?: Array<{ hits?: Array<{ summary?: string; resource?: DriveItem }> }> }>;
      };
      const hits = j.value?.[0]?.hitsContainers?.[0]?.hits || [];
      return hits.map((h) => (h.resource ? hitFrom(h.resource, h.summary || '') : null)).filter((x): x is SharePointHit => !!x);
    }
    const txt = await res.text().catch(() => '');
    if (res.status === 403 || res.status === 401) {
      throw new Error('Kein Zugriff auf SharePoint: Der Entra-App fehlt die Berechtigung Sites.Read.All (Admin-Consent nötig).');
    }
    lastError = `Graph ${res.status}: ${txt.slice(0, 200)}`;
    // Falsche Region → nächste probieren; andere Fehler → abbrechen
    if (!/region/i.test(txt)) break;
  }
  throw new Error(`SharePoint-Suche fehlgeschlagen. ${lastError}`);
}

async function searchSites(query: string, size: number, sites: string[]): Promise<SharePointHit[]> {
  const out: SharePointHit[] = [];
  const q = query.replace(/'/g, "''");
  for (const siteUrl of sites) {
    const u = new URL(siteUrl);
    const site = await graphJson<{ id: string }>(`/sites/${u.hostname}:${u.pathname.replace(/\/$/, '') || '/'}`);
    const drives = await graphJson<{ value: Array<{ id: string }> }>(`/sites/${encodeURIComponent(site.id)}/drives?$select=id`);
    for (const d of drives.value || []) {
      const r = await graphJson<{ value: DriveItem[] }>(
        `/drives/${encodeURIComponent(d.id)}/root/search(q='${encodeURIComponent(q)}')?$top=${size}` +
          `&$select=id,name,webUrl,size,lastModifiedDateTime,lastModifiedBy,parentReference,file,folder`,
      );
      for (const item of r.value || []) {
        const hit = hitFrom(item);
        if (hit) out.push(hit);
      }
      if (out.length >= size) break;
    }
    if (out.length >= size) break;
  }
  return out.slice(0, size);
}

/** Dateien in SharePoint/OneDrive finden (Name UND Inhalt, soweit indexiert). */
export async function searchSharePoint(query: string, size = 10): Promise<SharePointHit[]> {
  if (!isGraphConfigured()) throw new Error('Microsoft 365 ist im Portal nicht eingerichtet.');
  const q = query.trim();
  if (!q) return [];
  const sites = configuredSites();
  return sites.length ? searchSites(q, size, sites) : searchTenant(q, size);
}

export interface SharePointFile {
  name: string;
  mime: string;
  bytes: Buffer;
  web_url: string;
  modified: string;
  /** true, wenn Graph eine Office-Datei für die KI in PDF umgewandelt hat. */
  converted: boolean;
}

const CONVERT_TO_PDF = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'ods', 'odp', 'msg', 'eml', 'htm', 'html'];
const MAX_READ_BYTES = 20 * 1024 * 1024;

/** Datei herunterladen — Office-Formate als PDF gerendert, damit die KI Layout und Tabellen sieht. */
/** Erlaubte Laufwerke der hinterlegten Sites (10 min zwischengespeichert). */
let allowedDrivesCache: { key: string; at: number; ids: Set<string> } | null = null;

async function allowedDriveIds(sites: string[]): Promise<Set<string>> {
  const key = sites.join('|');
  if (allowedDrivesCache && allowedDrivesCache.key === key && Date.now() - allowedDrivesCache.at < 600_000) return allowedDrivesCache.ids;
  const ids = new Set<string>();
  for (const siteUrl of sites) {
    const u = new URL(siteUrl);
    const site = await graphJson<{ id: string }>(`/sites/${u.hostname}:${u.pathname.replace(/\/$/, '') || '/'}`);
    const drives = await graphJson<{ value: Array<{ id: string }> }>(`/sites/${encodeURIComponent(site.id)}/drives?$select=id`);
    for (const d of drives.value || []) ids.add(d.id);
  }
  allowedDrivesCache = { key, at: Date.now(), ids };
  return ids;
}

/** Darf dieses Laufwerk gelesen werden? (kein OneDrive, ggf. nur hinterlegte Sites) */
async function assertDriveAllowed(driveId: string): Promise<void> {
  const drive = await graphJson<{ id: string; driveType?: string }>(`/drives/${encodeURIComponent(driveId)}?$select=id,driveType`);
  if (drive.driveType === 'personal') throw new Error('Persönliche OneDrive-Dateien kann die Faltin-KI nicht öffnen.');
  const sites = configuredSites();
  if (sites.length && !(await allowedDriveIds(sites)).has(drive.id)) {
    throw new Error('Diese Datei liegt ausserhalb der freigegebenen SharePoint-Sites.');
  }
}

export async function readSharePointFile(driveId: string, itemId: string): Promise<SharePointFile> {
  await assertDriveAllowed(driveId);
  const base = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`;
  const meta = await graphJson<DriveItem>(`${base}?$select=id,name,size,webUrl,file,folder,lastModifiedDateTime`);
  if (meta.folder) throw new Error(`„${meta.name}“ ist ein Ordner, keine Datei.`);
  if ((meta.size || 0) > MAX_READ_BYTES * 3) throw new Error(`„${meta.name}“ ist zu groß (${Math.round((meta.size || 0) / 1024 / 1024)} MB).`);
  const ext = (meta.name.split('.').pop() || '').toLowerCase();
  const convert = CONVERT_TO_PDF.includes(ext);
  const res = await graphRequest(`${base}/content${convert ? '?format=pdf' : ''}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Datei konnte nicht geladen werden (Graph ${res.status}): ${txt.slice(0, 200)}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_READ_BYTES) throw new Error(`„${meta.name}“ ist zu groß für die KI (max. 20 MB).`);
  return {
    name: convert ? `${meta.name}.pdf` : meta.name,
    mime: convert ? 'application/pdf' : meta.file?.mimeType || 'application/octet-stream',
    bytes,
    web_url: meta.webUrl || '',
    modified: meta.lastModifiedDateTime || '',
    converted: convert,
  };
}
