import { NextResponse } from 'next/server';
import { updateProject, deleteProject } from '@/lib/staffStore';

/** PATCH { name?, description?, status? (aktiv|archiviert) } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await updateProject(id, body);
  if (!result) return NextResponse.json({ success: false, error: 'Projekt nicht gefunden' }, { status: 404 });
  if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true, data: result });
}

/** DELETE — Tickets bleiben, ihre Projekt-Zuordnung wird entfernt. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteProject(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Projekt nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true });
}
