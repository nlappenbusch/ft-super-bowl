import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { isWorkspaceAiConfigured, workspaceAiConfig } from '@/lib/workspace/claude';
import { isGraphConfigured, getMailbox } from '@/lib/graphMailer';
import { sharepointStatus } from '@/lib/workspace/sharepoint';
import { getSettings } from '@/lib/settingsStore';

export const dynamic = 'force-dynamic';

/** GET — Wer bin ich + welche Verbindungen stehen (KI, Postfach, SharePoint). */
export async function GET() {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const sp = await sharepointStatus().catch((e) => ({ configured: false, canRead: false, roles: [] as string[], hint: (e as Error).message }));
  const ai = getSettings().ai;
  return NextResponse.json({
    success: true,
    data: {
      person: { name: ws.personName, role: ws.personRole, is_admin: ws.isAdmin, has_profile: !!ws.employee, key: ws.employee?.id || ws.ownerKey },
      ai: { configured: isWorkspaceAiConfigured(), model: workspaceAiConfig().model },
      mail: { configured: isGraphConfigured(), mailbox: isGraphConfigured() ? getMailbox() : null },
      sharepoint: { configured: sp.configured, can_read: sp.canRead, hint: sp.hint, roles: ws.isAdmin ? sp.roles : undefined },
      agent: { enabled: ai.workspace_agent_enabled !== false },
    },
  });
}
