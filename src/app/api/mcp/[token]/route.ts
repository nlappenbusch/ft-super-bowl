import { NextResponse } from 'next/server';
import { verifyApiKey } from '@/lib/apiKeyStore';
import { handleMcpRequest } from '@/lib/mcpServer';

/**
 * /api/mcp/[token] — MCP-Endpoint mit Token in der URL (TASK-00125).
 * Für MCP-Clients, die keine eigenen Auth-Header setzen können (claude.ai-
 * Connectoren, ChatGPT-Connectoren): Mitarbeiter tragen einfach ihre
 * persönliche URL https://next.faltintravel.com/api/mcp/ftk_… ein.
 * Der Token ist ein regulärer API-Key aus /admin/mcp — widerrufbar, mit
 * Scopes einschränkbar. URL vertraulich behandeln (wirkt wie ein Passwort).
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const key = await verifyApiKey(token);
  if (!key) {
    return NextResponse.json({ success: false, error: 'Ungültiger oder widerrufener API-Key in der URL' }, { status: 401 });
  }
  return handleMcpRequest(req, key, token);
}

/** GET → kurze Selbstauskunft (hilft beim Einrichten, verrät nichts über den Key). */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const key = await verifyApiKey(token);
  if (!key) {
    return NextResponse.json({ success: false, error: 'Ungültiger oder widerrufener API-Key in der URL' }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    server: 'faltin-travel-portal',
    transport: 'streamable-http (JSON-only, POST)',
    key_name: key.name,
    hint: 'Diese URL als MCP-Server in Claude/ChatGPT eintragen — Anleitung unter /admin/mcp.',
  });
}
