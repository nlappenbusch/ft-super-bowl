import { NextResponse } from 'next/server';
import { listProjects, createProject } from '@/lib/staffStore';

/** GET /api/admin/projects → Projektliste mit Aufgaben-/Zeitsummen. */
export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ success: true, data: projects });
}

/** POST /api/admin/projects { name, description? } */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = await createProject({ name: String(body?.name || ''), description: body?.description });
  if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: result });
}
