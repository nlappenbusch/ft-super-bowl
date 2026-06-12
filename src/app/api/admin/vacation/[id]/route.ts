import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { decideVacation, deleteVacationRequest } from '@/lib/staffStore';

/** PATCH { status: 'genehmigt' | 'abgelehnt' } – Antrag entscheiden. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  if (body.status !== 'genehmigt' && body.status !== 'abgelehnt') {
    return NextResponse.json({ success: false, error: "status muss 'genehmigt' oder 'abgelehnt' sein" }, { status: 400 });
  }
  const updated = decideVacation(id, body.status, ctx.session.name);
  if (!updated) return NextResponse.json({ success: false, error: 'Antrag nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = deleteVacationRequest(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Antrag nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true });
}
