import { NextResponse } from 'next/server';
import { apiKeyOr401 } from '@/lib/extAuth';
import { listProjects, createProject } from '@/lib/staffStore';

/** GET /api/ext/projects → Projektliste (API-Key-Auth). */
export async function GET(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const projects = await listProjects();
  return NextResponse.json({ success: true, data: projects });
}

/** POST /api/ext/projects { name, description? } — legt ein Projekt an (idempotent per Name: 400 bei Duplikat). */
export async function POST(req: Request) {
  const a = await apiKeyOr401(req); if ('res' in a) return a.res;
  const body = await req.json().catch(() => ({}));
  const result = await createProject({ name: String(body?.name || ''), description: body?.description });
  if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: result });
}
