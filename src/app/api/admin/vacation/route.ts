import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import {
  vacationPlanner, createVacationRequest, getEmployee, getVacationApprovers,
  vacationConflicts, listPendingVacationsForActor, VACATION_TYPES, type VacationRequest,
} from '@/lib/staffStore';
import { vacationActorFromSession, notifyVacationCreated } from '@/lib/vacationWorkflow';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET ?year=YYYY → Jahresplaner (alle Mitarbeiter, Abwesenheiten, ZH-Feiertage, Salden)
 * plus `me` (wer bin ich, Admin?) und `pending_for_me` (offene Anträge, die ich
 * entscheiden darf – inkl. Überschneidungsprüfung).
 */
export async function GET(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  const actor = vacationActorFromSession(ctx);
  const year = parseInt(new URL(req.url).searchParams.get('year') || '', 10) || new Date().getFullYear();
  const planner = await vacationPlanner(year);
  const pendingForMe = await listPendingVacationsForActor(actor);
  return NextResponse.json({
    success: true,
    data: {
      ...planner,
      me: { employee_id: actor.employee_id, name: actor.name, is_admin: actor.is_admin },
      pending_for_me: pendingForMe,
    },
  });
}

/**
 * POST: Abwesenheit erfassen
 * { employee_id?, start_date, end_date, type?, comment?, half_day?, substitute_id? }
 * Für andere Mitarbeitende nur als Admin. Krankheit wird direkt als genehmigt erfasst.
 */
export async function POST(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  const actor = vacationActorFromSession(ctx);

  const body = await req.json().catch(() => ({}));
  const employeeId: string | undefined = body.employee_id || ctx.employee?.id;
  if (!employeeId || !body.start_date || !body.end_date) {
    return NextResponse.json({ success: false, error: 'start_date, end_date (und ggf. employee_id) erforderlich' }, { status: 400 });
  }
  if (employeeId !== actor.employee_id && !actor.is_admin) {
    return NextResponse.json({ success: false, error: 'Nur Admins können Abwesenheiten für andere Mitarbeitende erfassen.' }, { status: 403 });
  }
  if (!ISO_DATE.test(body.start_date) || !ISO_DATE.test(body.end_date) || body.end_date < body.start_date) {
    return NextResponse.json({ success: false, error: 'Ungültiger Zeitraum' }, { status: 400 });
  }
  const type: VacationRequest['type'] = body.type || 'urlaub';
  if (!VACATION_TYPES.includes(type)) {
    return NextResponse.json({ success: false, error: 'Ungültiger Typ' }, { status: 400 });
  }
  const requester = await getEmployee(employeeId);
  if (!requester) return NextResponse.json({ success: false, error: 'Mitarbeiter nicht gefunden' }, { status: 400 });

  const substituteId: string | null = body.substitute_id || null;
  if (substituteId) {
    if (substituteId === employeeId) {
      return NextResponse.json({ success: false, error: 'Die Stellvertretung kann nicht die abwesende Person selbst sein.' }, { status: 400 });
    }
    const sub = await getEmployee(substituteId);
    if (!sub || !sub.active) {
      return NextResponse.json({ success: false, error: 'Stellvertretung nicht gefunden oder nicht aktiv.' }, { status: 400 });
    }
  }

  const halfDay = !!body.half_day && body.start_date === body.end_date;
  // Prüfung VOR dem Anlegen, damit der neue Antrag nicht mit sich selbst kollidiert.
  const conflicts = await vacationConflicts(employeeId, body.start_date, body.end_date, { substituteId, type, halfDay });

  const created = await createVacationRequest({
    employee_id: employeeId,
    start_date: body.start_date,
    end_date: body.end_date,
    type,
    comment: typeof body.comment === 'string' ? body.comment.slice(0, 2000) : '',
    half_day: halfDay,
    substitute_id: substituteId,
  });
  if (!created) return NextResponse.json({ success: false, error: 'Ungültiger Zeitraum oder Mitarbeiter' }, { status: 400 });

  const approvers = await getVacationApprovers(employeeId);
  await notifyVacationCreated(created, { requester, actor, approvers, conflicts });

  return NextResponse.json({
    success: true,
    data: created,
    conflicts,
    approvers: approvers.map((a) => ({ id: a.id, name: a.name })),
    // Niemand ausser der Person selbst darf genehmigen (z.B. einzige Admin-Person).
    self_approval_fallback: approvers.length === 0 && created.status === 'beantragt',
  });
}
