import { NextResponse } from 'next/server';
import { getCalculation } from '@/lib/calculationStore';
import { listInquiries, createInquiry, type InquiryInput } from '@/lib/inquiryStore';
import { getMailbox, isGraphConfigured } from '@/lib/graphMailer';
import { getSessionEmployee } from '@/lib/serverSession';

/** GET → Anfragen dieser Kalkulation + Absender-Postfach für den Versand. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await listInquiries(id);
  return NextResponse.json({ success: true, data, mailbox: getMailbox(), mail_ready: isGraphConfigured() });
}

/** POST { supplier, to_addr, cc_addr, subject, body, internal_note, category, item_id, status? } → neue Anfrage (Entwurf). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getCalculation(id))) return NextResponse.json({ success: false, error: 'Kalkulation nicht gefunden' }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as InquiryInput;
  const ctx = await getSessionEmployee().catch(() => null);
  const inq = await createInquiry(id, body, ctx?.employee?.name || ctx?.session?.name || '');
  return NextResponse.json({ success: !!inq, data: inq });
}
