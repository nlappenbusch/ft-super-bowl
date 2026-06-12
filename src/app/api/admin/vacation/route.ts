import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { vacationPlanner, createVacationRequest } from '@/lib/staffStore';

/** GET ?year=YYYY → Jahresplaner: alle Mitarbeiter, Abwesenheiten, ZH-Feiertage, Salden. */
export async function GET(req: Request) {
  const year = parseInt(new URL(req.url).searchParams.get('year') || '', 10) || new Date().getFullYear();
  return NextResponse.json({ success: true, data: vacationPlanner(year) });
}

/** POST: Urlaubsantrag { employee_id?, start_date, end_date, type?, comment? } */
export async function POST(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const body = await req.json();
  const employeeId = body.employee_id || ctx.employee?.id;
  if (!employeeId || !body.start_date || !body.end_date) {
    return NextResponse.json({ success: false, error: 'start_date, end_date (und ggf. employee_id) erforderlich' }, { status: 400 });
  }
  const created = createVacationRequest({
    employee_id: employeeId,
    start_date: body.start_date,
    end_date: body.end_date,
    type: body.type,
    comment: body.comment,
  });
  if (!created) return NextResponse.json({ success: false, error: 'Ungültiger Zeitraum oder Mitarbeiter' }, { status: 400 });
  return NextResponse.json({ success: true, data: created });
}
