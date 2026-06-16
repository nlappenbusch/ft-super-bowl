import { NextResponse } from 'next/server';
import { updateEmployee, type EmployeeUpdate } from '@/lib/staffStore';

/** Mitarbeiter bearbeiten: Rolle, Arbeitszeiten, Urlaubsanspruch, aktiv/inaktiv. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as EmployeeUpdate;
  const updated = await updateEmployee(id, {
    role: body.role,
    active: body.active,
    weekly_hours: body.weekly_hours,
    vacation_days_per_year: body.vacation_days_per_year,
    employment_start: body.employment_start,
    notes: body.notes,
    name: body.name,
  });
  if (!updated) return NextResponse.json({ success: false, error: 'Mitarbeiter nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true, data: updated });
}
