import { NextResponse } from 'next/server';
import { revokeApiKey, deleteApiKey, updateApiKeyScopes, normalizeScopes } from '@/lib/apiKeyStore';
import { MCP_TOOL_GROUPS } from '@/lib/mcpServer';

/** PATCH { scopes } → Werkzeugumfang (MCP-Tool-Gruppen) des Keys ändern. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const scopes = normalizeScopes(body?.scopes, MCP_TOOL_GROUPS.map((g) => g.id));
  const ok = await updateApiKeyScopes(id, scopes);
  if (!ok) return NextResponse.json({ success: false, error: 'Key nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: { scopes } });
}

/** DELETE ?hard=1 → Key löschen, sonst widerrufen (revoked=1). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hard = new URL(req.url).searchParams.get('hard') === '1';
  const ok = hard ? await deleteApiKey(id) : await revokeApiKey(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Key nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true });
}
