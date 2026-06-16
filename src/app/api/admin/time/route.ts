import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { getEmployee, timeSummary, addManualEntry, getRunningEntry } from '@/lib/staffStore';

function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

/**
 * GET ?employee=<id>&month=YYYY-MM → Zeitübersicht (Soll/Ist/Saldo + Einträge).
 * Ohne employee-Param: eigener Datensatz.
 */
export async function GET(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const url = new URL(req.url);
  const empId = url.searchParams.get('employee') || ctx.employee?.id;
  if (!empId) {
    return NextResponse.json({ success: false, error: 'Kein Mitarbeiterprofil (lokaler Admin) – employee-Parameter angeben' }, { status: 400 });
  }
  const employee = await getEmployee(empId);
  if (!employee) return NextResponse.json({ success: false, error: 'Mitarbeiter nicht gefunden' }, { status: 404 });

  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
  const { from, to } = monthRange(month);
  const summary = await timeSummary(employee, from, to);
  const running = await getRunningEntry(employee.id);
  return NextResponse.json({
    success: true,
    data: {
      employee: { id: employee.id, name: employee.name },
      month,
      running,
      ...summary,
    },
  });
}

/** POST: manueller Zeiteintrag { employee_id?, date, start_time, end_time, break_minutes?, note? } */
export async function POST(req: Request) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const body = await req.json();
  const employeeId = body.employee_id || ctx.employee?.id;
  if (!employeeId || !body.date || !body.start_time || !body.end_time) {
    return NextResponse.json({ success: false, error: 'date, start_time, end_time (und ggf. employee_id) erforderlich' }, { status: 400 });
  }
  const entry = await addManualEntry({
    employee_id: employeeId,
    date: body.date,
    start_time: body.start_time,
    end_time: body.end_time,
    break_minutes: body.break_minutes || 0,
    note: body.note || '',
  });
  return NextResponse.json({ success: true, data: entry });
}
