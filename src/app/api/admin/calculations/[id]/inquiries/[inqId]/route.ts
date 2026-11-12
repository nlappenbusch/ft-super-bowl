import { NextResponse } from 'next/server';
import { getInquiry, updateInquiry, deleteInquiry, type InquiryInput } from '@/lib/inquiryStore';
import { getSessionEmployee } from '@/lib/serverSession';

type Ctx = { params: Promise<{ id: string; inqId: string }> };

async function load(ctx: Ctx) {
  const { id, inqId } = await ctx.params;
  const inq = await getInquiry(inqId);
  return inq && inq.calc_id === id ? inq : null;
}

/** PATCH { …Felder, status } — nach dem Versand sind Text und Empfänger gesperrt. */
export async function PATCH(req: Request, ctx: Ctx) {
  const inq = await load(ctx);
  if (!inq) return NextResponse.json({ success: false, error: 'Anfrage nicht gefunden' }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as InquiryInput;
  const s = await getSessionEmployee().catch(() => null);
  const data = await updateInquiry(inq.id, body, s?.employee?.name || s?.session?.name || '');
  return NextResponse.json({ success: !!data, data });
}

/** DELETE — gesendete Anfragen bleiben als Nachweis erhalten. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const inq = await load(ctx);
  if (!inq) return NextResponse.json({ success: false, error: 'Anfrage nicht gefunden' }, { status: 404 });
  if (inq.sent_at) {
    return NextResponse.json({ success: false, error: 'Gesendete Anfragen können nicht gelöscht werden — Status auf „Erledigt" setzen.' }, { status: 400 });
  }
  return NextResponse.json({ success: await deleteInquiry(inq.id) });
}
