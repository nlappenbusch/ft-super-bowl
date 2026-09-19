import { NextResponse } from 'next/server';
import { getEmployee, updateEmployee, type EmployeeUpdate } from '@/lib/staffStore';
import { getSessionEmployee } from '@/lib/serverSession';
import { vacationActorFromSession } from '@/lib/vacationWorkflow';

/** Mitarbeiter bearbeiten: Rolle, Arbeitszeiten, Urlaubsanspruch, Genehmiger:in, aktiv/inaktiv. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
  const { id } = await params;
  const body = (await req.json()) as EmployeeUpdate;
  const cur = await getEmployee(id);
  if (!cur) return NextResponse.json({ success: false, error: 'Mitarbeiter nicht gefunden' }, { status: 404 });

  // Nicht-Admins: nur den eigenen Datensatz und dort nur die Briefing-Einstellung
  // (Arbeitszeiten, Urlaubsanspruch, Name, Notizen usw. pflegen Admins).
  if (!vacationActorFromSession(ctx).is_admin) {
    if (ctx.employee?.id !== id) {
      return NextResponse.json({ success: false, error: 'Stammdaten anderer Personen können nur Admins ändern.' }, { status: 403 });
    }
    const other = (Object.keys(body) as Array<keyof EmployeeUpdate>).filter((k) => {
      if (k === 'briefing_opt_out' || body[k] === undefined) return false;
      if (k === 'approver_id') return (body.approver_id || null) !== (cur.approver_id || null);
      return JSON.stringify(body[k]) !== JSON.stringify((cur as unknown as Record<string, unknown>)[k]);
    });
    if (other.length) {
      return NextResponse.json({ success: false, error: 'Deine Stammdaten (Arbeitszeit, Urlaubsanspruch, Rolle …) pflegen Admins.' }, { status: 403 });
    }
  }

  // Rolle, Aktiv-Status und Genehmigungsweg bestimmen, wer Abwesenheiten genehmigt →
  // nur Admins dürfen sie ändern (sonst könnte man sich selbst die Genehmigung zuschanzen).
  const approverId = body.approver_id !== undefined ? (body.approver_id || null) : undefined;
  const changesAccess =
    (body.role !== undefined && body.role !== cur.role)
    || (body.active !== undefined && body.active !== cur.active)
    || (approverId !== undefined && approverId !== cur.approver_id);
  if (changesAccess && !vacationActorFromSession(ctx).is_admin) {
    return NextResponse.json({ success: false, error: 'Rolle, Status und Genehmiger:in können nur Admins ändern.' }, { status: 403 });
  }
  if (approverId && approverId !== cur.approver_id) {
    if (approverId === id) {
      return NextResponse.json({ success: false, error: 'Niemand kann die eigenen Abwesenheiten genehmigen – bitte eine andere Person wählen.' }, { status: 400 });
    }
    const approver = await getEmployee(approverId);
    if (!approver || !approver.active) {
      return NextResponse.json({ success: false, error: 'Genehmiger:in nicht gefunden oder nicht aktiv.' }, { status: 400 });
    }
  }

  const updated = await updateEmployee(id, {
    role: body.role,
    active: body.active,
    weekly_hours: body.weekly_hours,
    vacation_days_per_year: body.vacation_days_per_year,
    employment_start: body.employment_start,
    notes: body.notes,
    name: body.name,
    briefing_opt_out: body.briefing_opt_out,
    approver_id: approverId,
  });
  if (!updated) return NextResponse.json({ success: false, error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: updated });
}
