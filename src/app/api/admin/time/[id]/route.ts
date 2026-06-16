import { NextResponse } from 'next/server';
import { updateTimeEntry, deleteTimeEntry } from '@/lib/staffStore';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const updated = await updateTimeEntry(id, body);
  if (!updated) return NextResponse.json({ success: false, error: 'Eintrag nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteTimeEntry(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Eintrag nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true });
}
