/**
 * mcpServer.ts — MCP-Server des Portals (Streamable HTTP, JSON-only).
 * ─────────────────────────────────────────────────────────────────────────────
 * Vollausbau (TASK-00125): FT-Mitarbeiter verbinden ihre KI (Claude, ChatGPT,
 * ElevenLabs, …) per API-Key — entweder klassisch mit Authorization-Header auf
 * /api/mcp oder über die persönliche Token-URL /api/mcp/<ftk_…> (für Clients
 * ohne Header-Support). Keys werden unter /admin/mcp verwaltet; pro Key lässt
 * sich der Werkzeugumfang über Scopes einschränken.
 *
 * Tool-Gruppen (= Scopes):
 *   content   — Events, Serien, Pakete, FAQs (read-only)
 *   bookings  — Anfrage-/Buchungsstatus nachschlagen und auflisten
 *   customers — Kunden suchen, anlegen, aktualisieren
 *   offers    — Angebotskalkulationen anlegen/pflegen, Angebots-PDF, Rechnung
 *   tasks     — Aufgaben-Ticketsystem inkl. Zeitbuchung
 *
 * Bewusst ohne SDK: minimale JSON-RPC-2.0-Behandlung der MCP-Methoden
 * initialize / tools/list / tools/call / ping. Notifications (ohne id)
 * werden mit 202 quittiert.
 */
import { NextResponse } from 'next/server';
import type { ApiKey } from './apiKeyStore';
import { TOOLS, callTool, MCP_TOOL_GROUPS, type McpScopeId, type ToolContext } from './portalTools';

export { MCP_TOOL_GROUPS, type McpScopeId } from './portalTools';

const PROTOCOL_VERSION = '2025-06-18';
const SERVER_INFO = { name: 'faltin-travel-portal', version: '2.0.0' };
const INSTRUCTIONS =
  'Portal-Zugriff für Faltin Travel (Sportreisen): Website-Inhalte (Events, Pakete, FAQs), Anfrage-/Buchungsstatus, ' +
  'Kundenstamm (suchen/anlegen), Angebotskalkulationen (anlegen, PDF-Link, Rechnung erzeugen) und das Aufgaben-Ticketsystem. ' +
  'Alle Beträge in Angeboten verstehen sich pro Person. Preise sind echte Werte aus dem Buchungssystem; keine Werte erfinden. ' +
  'Vor dem Anlegen eines Angebots den Kunden per find_customers suchen oder per create_customer anlegen.';

function keyScopes(key: ApiKey): McpScopeId[] {
  const all = MCP_TOOL_GROUPS.map((g) => g.id);
  const raw = (key.scopes || 'all').trim();
  if (!raw || raw === 'all') return all;
  const parts = raw.split(',').map((x) => x.trim());
  const valid = all.filter((g) => parts.includes(g));
  return valid.length ? valid : all;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: number | string | null, result: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id, result });
}

function rpcError(id: number | string | null, code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id, error: { code, message } });
}

/** Öffentliche Basis-URL des Portals aus dem Request (Reverse-Proxy-fest). */
function baseUrl(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  try { return new URL(req.url).origin; } catch { return 'https://next.faltintravel.com'; }
}

/* ── JSON-RPC-Handling ─────────────────────────────────────────────────────── */

/**
 * Zentraler MCP-Handler. `key` ist der verifizierte API-Key-Datensatz,
 * `rawKey` der Klartext aus dem Request (für persönliche Links).
 */
export async function handleMcpRequest(req: Request, key: ApiKey, rawKey: string): Promise<NextResponse> {
  const scopes = keyScopes(key);
  const visibleTools = TOOLS.filter((t) => scopes.includes(t.group));
  const base = baseUrl(req);
  const ctx: ToolContext = {
    actor: `MCP: ${key.name}`,
    base,
    offerPdfUrl: (id) => `${base}/api/ext/offers/${id}/pdf?key=${encodeURIComponent(rawKey)}`,
    invoicePdfUrl: (id) => `${base}/api/ext/invoices/${id}/pdf?key=${encodeURIComponent(rawKey)}`,
  };

  const msg = (await req.json().catch(() => null)) as JsonRpcRequest | null;
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
    return rpcError(null, -32700, 'Parse error: einzelnes JSON-RPC-Objekt erwartet.');
  }

  const id = msg.id ?? null;
  const method = msg.method || '';

  // Notifications (ohne id) nur quittieren.
  if (msg.id === undefined && method.startsWith('notifications/')) {
    return new NextResponse(null, { status: 202 });
  }

  try {
    switch (method) {
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        });
      case 'ping':
        return rpcResult(id, {});
      case 'tools/list':
        return rpcResult(id, {
          tools: visibleTools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
        });
      case 'tools/call': {
        const name = String(msg.params?.name || '');
        const args = (msg.params?.arguments || {}) as Record<string, unknown>;
        const tool = TOOLS.find((t) => t.name === name);
        if (!tool) return rpcError(id, -32602, `Unbekanntes Tool: ${name}`);
        if (!scopes.includes(tool.group)) {
          return rpcError(id, -32602, `Tool "${name}" ist für diesen API-Key nicht freigeschaltet (Scope "${tool.group}" fehlt).`);
        }
        const result = await callTool(name, args, ctx);
        return rpcResult(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: typeof result === 'object' && result !== null && 'error' in result,
        });
      }
      default:
        return rpcError(id, -32601, `Methode nicht unterstützt: ${method}`);
    }
  } catch (e) {
    return rpcError(id, -32603, `Interner Fehler: ${(e as Error).message}`);
  }
}
