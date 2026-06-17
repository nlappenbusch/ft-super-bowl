import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { vacationPlanner, createVacationRequest, getEmployee } from '@/lib/staffStore';
import { sendGraphMail, isGraphConfigured, getNotifyTo } from '@/lib/graphMailer';

const TYPE_DE: Record<string, string> = { urlaub: 'Urlaub', krankheit: 'Krankheit', kompensation: 'Kompensation', sonstiges: 'Sonstiges' };

/** GET ?year=YYYY → Jahresplaner: alle Mitarbeiter, Abwesenheiten, ZH-Feiertage, Salden. */
export async function GET(req: Request) {
  const year = parseInt(new URL(req.url).searchParams.get('year') || '', 10) || new Date().getFullYear();
  return NextResponse.json({ success: true, data: await vacationPlanner(year) });
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
  const created = await createVacationRequest({
    employee_id: employeeId,
    start_date: body.start_date,
    end_date: body.end_date,
    type: body.type,
    comment: body.comment,
    half_day: !!body.half_day,
  });
  if (!created) return NextResponse.json({ success: false, error: 'Ungültiger Zeitraum oder Mitarbeiter' }, { status: 400 });

  // Benachrichtigung an Team/Chef (non-blocking)
  try {
    if (isGraphConfigured()) {
      const emp = await getEmployee(employeeId);
      const half = created.days === 0.5 ? ' (Halbtag)' : '';
      const typ = TYPE_DE[created.type] || created.type;
      await sendGraphMail({
        to: getNotifyTo(),
        subject: `Abwesenheitsantrag: ${emp?.name || 'Mitarbeiter'} · ${created.start_date}–${created.end_date}`,
        html: `<p>Neuer Abwesenheitsantrag zur Genehmigung:</p>
          <ul>
            <li><b>Mitarbeiter:</b> ${emp?.name || employeeId}</li>
            <li><b>Zeitraum:</b> ${created.start_date} bis ${created.end_date}${half}</li>
            <li><b>Typ:</b> ${typ}</li>
            <li><b>Arbeitstage:</b> ${created.days}</li>
            ${created.comment ? `<li><b>Kommentar:</b> ${created.comment}</li>` : ''}
          </ul>
          <p>Genehmigen/ablehnen im Admin → Urlaub.</p>`,
      });
    }
  } catch (e) {
    console.warn('[Urlaub] Benachrichtigung ans Team fehlgeschlagen:', e);
  }

  return NextResponse.json({ success: true, data: created });
}
