import { NextResponse } from 'next/server';
import { getEvents } from '@/lib/contentStore';
import { listTickets, createTicket } from '@/lib/eventTicketStore';
import { parseTicketTable } from '@/lib/eventTicketModel';
import { getSessionEmployee } from '@/lib/serverSession';

export const dynamic = 'force-dynamic';

async function who(): Promise<string> {
  const ctx = await getSessionEmployee().catch(() => null);
  return ctx?.employee?.name || ctx?.session?.name || '';
}

/** GET → alle E-Tickets + Events (für die Verknüpfung und die Vorgaben). */
export async function GET() {
  const data = await listTickets();
  const events = getEvents()
    .filter((e) => e.status !== 'archived')
    .map((e) => ({
      id: e.id, name: e.name, title: e.title, start_date: e.start_date || '', venue: e.venue || '',
      location_name: e.location_name || '', location_city: e.location_city || '',
      spielplan: (e.spielplan || []).slice(0, 60),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return NextResponse.json({ success: true, data, events });
}

/**
 * POST { ticket: {…} } → ein Ticket anlegen
 * POST { import: "<eingefügte Liste>", defaults: { event_id, event_title, match_title, … branding } }
 *      → je erkannter Zeile ein Ticket (Spielangaben aus `defaults`).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { ticket?: Record<string, unknown>; import?: string; defaults?: Record<string, unknown> };
  const by = await who();
  if (typeof body.import === 'string') {
    const rows = parseTicketTable(body.import);
    if (!rows.length) return NextResponse.json({ success: false, error: 'In der eingefügten Liste wurde kein Ticket erkannt (Name, dann Wallet-Links, Area, Row, Seat, E-Mail).' }, { status: 400 });
    if (rows.length > 200) return NextResponse.json({ success: false, error: 'Höchstens 200 Tickets auf einmal.' }, { status: 400 });
    const defaults = { ...(body.defaults || {}) };
    const created = [];
    for (const r of rows) created.push(await createTicket({ ...defaults, ...r }, by));
    return NextResponse.json({ success: true, data: created.filter(Boolean), count: created.length });
  }
  const t = await createTicket(body.ticket || {}, by);
  return NextResponse.json({ success: !!t, data: t });
}
