import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { vacationConflicts, getEmployee, VACATION_TYPES, type VacationRequest } from '@/lib/staffStore';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET ?employee_id=&start=&end=&substitute_id=&type=&half_day=1&exclude_id=
 * Überschneidungs-/Besetzungsprüfung vor dem Einreichen (Live-Vorschau im Formular).
 * employee_id fehlt → eigenes Profil.
 */
export async function GET(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const employeeId = sp.get('employee_id') || ctx.employee?.id || '';
  const start = sp.get('start') || '';
  const end = sp.get('end') || '';
  if (!employeeId) return NextResponse.json({ success: false, error: 'employee_id erforderlich' }, { status: 400 });
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || end < start) {
    return NextResponse.json({ success: false, error: 'Ungültiger Zeitraum' }, { status: 400 });
  }
  if (!(await getEmployee(employeeId))) {
    return NextResponse.json({ success: false, error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
  }
  const typeParam = sp.get('type') as VacationRequest['type'] | null;
  const type = typeParam && VACATION_TYPES.includes(typeParam) ? typeParam : 'urlaub';

  const data = await vacationConflicts(employeeId, start, end, {
    substituteId: sp.get('substitute_id') || null,
    type,
    halfDay: sp.get('half_day') === '1' || sp.get('half_day') === 'true',
    excludeRequestId: sp.get('exclude_id') || undefined,
  });
  return NextResponse.json({ success: true, data });
}
