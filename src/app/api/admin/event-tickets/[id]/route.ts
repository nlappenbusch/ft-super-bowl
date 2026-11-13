import { NextResponse } from 'next/server';
import { updateTicket, deleteTicket } from '@/lib/eventTicketStore';

export const dynamic = 'force-dynamic';

/** PATCH { …Felder } → Ticket ändern (auch Status, z. B. «gesendet» nach dem Versand aus Outlook). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const t = await updateTicket(id, body);
  if (!t) return NextResponse.json({ success: false, error: 'Ticket nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: t });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteTicket(id);
  return NextResponse.json({ success: ok }, { status: ok ? 200 : 404 });
}
