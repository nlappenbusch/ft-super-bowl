/**
 * GET    /api/admin/belege/[id] — Beleg + Verlauf + Punkte + Zuordnungs-Bezeichnung
 * PATCH  /api/admin/belege/[id] — Felder ändern (Kontierung nur Prüfende)
 * POST   /api/admin/belege/[id] — Aktion { action: submit|question|approve|reopen|discard|restore|analyze|ai, note }
 */
import { NextResponse } from 'next/server';
import { requireBelegeUser, jsonError } from '@/lib/belege/actor';
import {
  bookingLabel, canSee, getLog, getOcrText, getReceipt, receiptAction, updateReceipt,
  setAnalysisStatus, type ReceiptAction, type ReceiptPatch,
} from '@/lib/belege/store';
import { startAnalysis } from '@/lib/belege/analyze';
import { canEdit, receiptPoints, cheerFor } from '@/lib/belege/model';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const r = await getReceipt(id);
  if (!r || !canSee(r, user)) return jsonError('Beleg nicht gefunden', 404);
  // Hängende Analyse (z. B. nach Neustart) wieder freigeben
  if (r.analysis_status === 'laeuft' && Date.now() - Date.parse(r.updated_at) > 3 * 60_000) {
    await setAnalysisStatus(id, 'fehler', 'Analyse abgebrochen – bitte neu starten');
    r.analysis_status = 'fehler';
  }
  const full = new URL(req.url).searchParams.get('full') === '1';
  const [log, booking, ocr] = await Promise.all([
    full ? getLog(id) : Promise.resolve([]),
    bookingLabel(r.booking_id),
    full && user.reviewer ? getOcrText(id) : Promise.resolve(''),
  ]);
  return NextResponse.json({
    success: true,
    data: { receipt: r, log, booking_label: booking, ocr_text: ocr, points: receiptPoints(r), cheer: cheerFor(r.id), editable: canEdit(r, user) },
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const r = await getReceipt(id);
  if (!r || !canSee(r, user)) return jsonError('Beleg nicht gefunden', 404);
  let body: ReceiptPatch;
  try { body = (await req.json()) as ReceiptPatch; } catch { return jsonError('Ungültige Daten'); }
  try {
    const next = await updateReceipt(id, body, user);
    return NextResponse.json({ success: true, data: { receipt: next, points: receiptPoints(next), booking_label: await bookingLabel(next.booking_id) } });
  } catch (e) {
    return jsonError((e as Error).message);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const user = await requireBelegeUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const r = await getReceipt(id);
  if (!r || !canSee(r, user)) return jsonError('Beleg nicht gefunden', 404);
  let body: { action?: string; note?: string };
  try { body = (await req.json()) as typeof body; } catch { return jsonError('Ungültige Daten'); }
  const action = String(body.action || '');
  try {
    if (action === 'analyze' || action === 'ai') {
      if (!canEdit(r, user)) return jsonError('Beleg ist gesperrt.');
      void startAnalysis(id, { forceAi: action === 'ai' });
      return NextResponse.json({ success: true, data: { receipt: { ...r, analysis_status: 'laeuft' } } });
    }
    const next = await receiptAction(id, action as ReceiptAction, user, body.note || '');
    return NextResponse.json({ success: true, data: { receipt: next, points: receiptPoints(next), cheer: cheerFor(next.id) } });
  } catch (e) {
    return jsonError((e as Error).message);
  }
}
