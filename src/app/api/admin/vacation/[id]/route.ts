import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import {
  decideVacation, deleteVacationRequest, getVacationRequest, getVacationApprovers, vacationDecisionRight,
} from '@/lib/staffStore';
import { vacationActorFromSession, notifyVacationDecided, notifyVacationWithdrawn } from '@/lib/vacationWorkflow';

/**
 * PATCH { status: 'genehmigt' | 'abgelehnt', comment? } – Antrag entscheiden.
 * Nur zuständige Genehmiger:innen oder Admins; nie der eigene Antrag – ausser es gibt
 * sonst niemanden, der genehmigen könnte (self_approval_fallback).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  const actor = vacationActorFromSession(ctx);

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.status !== 'genehmigt' && body.status !== 'abgelehnt') {
    return NextResponse.json({ success: false, error: "status muss 'genehmigt' oder 'abgelehnt' sein" }, { status: 400 });
  }
  const current = await getVacationRequest(id);
  if (!current) return NextResponse.json({ success: false, error: 'Antrag nicht gefunden' }, { status: 404 });

  const right = await vacationDecisionRight(actor, current.employee_id);
  if (!right.allowed) {
    return NextResponse.json({ success: false, error: right.reason || 'Keine Berechtigung für diesen Antrag.' }, { status: 403 });
  }

  const comment = typeof body.comment === 'string' ? body.comment : '';
  const updated = await decideVacation(id, body.status, actor.name, comment);
  if (!updated) return NextResponse.json({ success: false, error: 'Antrag nicht gefunden' }, { status: 404 });

  await notifyVacationDecided(updated, { actor });

  return NextResponse.json({ success: true, data: updated, self_approval_fallback: right.self_fallback });
}

/**
 * DELETE – eigener Antrag kann zurückgezogen werden, solange er 'beantragt' ist;
 * Admins dürfen jederzeit löschen.
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  const actor = vacationActorFromSession(ctx);

  const { id } = await params;
  const current = await getVacationRequest(id);
  if (!current) return NextResponse.json({ success: false, error: 'Antrag nicht gefunden' }, { status: 404 });

  const own = !!actor.employee_id && actor.employee_id === current.employee_id;
  if (!actor.is_admin) {
    if (!own) {
      return NextResponse.json({ success: false, error: 'Nur Admins können Abwesenheiten anderer löschen.' }, { status: 403 });
    }
    if (current.status !== 'beantragt') {
      return NextResponse.json({
        success: false,
        error: `Der Antrag ist bereits ${current.status} und kann nicht mehr zurückgezogen werden – bitte an eine Admin-Person wenden.`,
      }, { status: 403 });
    }
  }

  const approvers = await getVacationApprovers(current.employee_id);
  const ok = await deleteVacationRequest(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Antrag nicht gefunden' }, { status: 404 });
  await notifyVacationWithdrawn(current, { actor, approvers });
  return NextResponse.json({ success: true });
}
