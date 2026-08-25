import { NextResponse } from 'next/server';
import { verifyApiKey, extractApiKey } from '@/lib/apiKeyStore';
import { handleMcpRequest } from '@/lib/mcpServer';

/**
 * /api/mcp — MCP-Server (Streamable HTTP, JSON-only), Auth per Header
 * (Authorization: Bearer ftk_… oder x-api-key). Vollausbau und Tool-Registry
 * liegen in src/lib/mcpServer.ts; Keys werden unter /admin/mcp verwaltet.
 * Für Clients ohne Header-Support gibt es die Token-URL /api/mcp/<ftk_…>.
 */
export async function POST(req: Request) {
  const raw = extractApiKey(req);
  const key = await verifyApiKey(raw);
  if (!key || !raw) {
    return NextResponse.json({ success: false, error: 'Ungültiger oder fehlender API-Key' }, { status: 401 });
  }
  return handleMcpRequest(req, key, raw);
}

/** Kein SSE-Stream — Clients nutzen reine POST-Requests (Streamable HTTP, JSON-Antworten). */
export async function GET() {
  return NextResponse.json(
    { error: 'MCP-Endpoint: POST mit JSON-RPC verwenden (Authorization: Bearer <API-Key>) — oder die persönliche Token-URL /api/mcp/<key> nutzen.' },
    { status: 405 }
  );
}
