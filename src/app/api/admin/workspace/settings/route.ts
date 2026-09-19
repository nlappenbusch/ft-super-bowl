import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { getSettings, saveSettings, type AiSettings } from '@/lib/settingsStore';

const MODELS = ['claude-opus-5', 'claude-sonnet-5', 'claude-opus-4-8', 'claude-sonnet-4-6'];

/** GET — Einstellungen des KI-Arbeitsplatzes. */
export async function GET() {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const a = getSettings().ai;
  return NextResponse.json({
    success: true,
    data: {
      workspace_model: a.workspace_model || 'claude-opus-5',
      workspace_agent_enabled: a.workspace_agent_enabled !== false,
      sharepoint_region: a.sharepoint_region || '',
      sharepoint_sites: a.sharepoint_sites || '',
      models: MODELS,
      can_edit: ws.isAdmin,
    },
  });
}

/** POST — nur Admins. */
export async function POST(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  if (!ws.isAdmin) return NextResponse.json({ success: false, error: 'Nur Admins dürfen das ändern.' }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Partial<AiSettings>;
  const updates: Partial<AiSettings> = {};
  if (typeof body.workspace_model === 'string' && MODELS.includes(body.workspace_model)) updates.workspace_model = body.workspace_model;
  if (typeof body.workspace_agent_enabled === 'boolean') updates.workspace_agent_enabled = body.workspace_agent_enabled;
  if (typeof body.sharepoint_region === 'string') updates.sharepoint_region = body.sharepoint_region.trim().toUpperCase().slice(0, 8);
  if (typeof body.sharepoint_sites === 'string') updates.sharepoint_sites = body.sharepoint_sites.trim().slice(0, 4000);
  saveSettings({ ai: updates as AiSettings });
  return NextResponse.json({ success: true });
}
