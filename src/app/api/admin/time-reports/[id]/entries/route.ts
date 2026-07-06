import { NextResponse } from 'next/server';
import { updateTimeReportEntries } from '@/lib/staffStore';

/** POST { add?: string[], remove?: string[] } — Einträge im Entwurf umhängen. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await updateTimeReportEntries(id, {
    add: Array.isArray(body?.add) ? body.add.map(String) : [],
    remove: Array.isArray(body?.remove) ? body.remove.map(String) : [],
  });
  if ('error' in result) return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  return NextResponse.json({ success: true });
}
