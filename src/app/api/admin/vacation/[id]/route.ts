import { NextResponse } from 'next/server';
import { getSessionEmployee } from '@/lib/serverSession';
import { decideVacation, deleteVacationRequest, getEmployee } from '@/lib/staffStore';
import { sendGraphMail, isGraphConfigured } from '@/lib/graphMailer';

/** PATCH { status: 'genehmigt' | 'abgelehnt' } – Antrag entscheiden. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionEmployee();
  if (!ctx) return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  if (body.status !== 'genehmigt' && body.status !== 'abgelehnt') {
    return NextResponse.json({ success: false, error: "status muss 'genehmigt' oder 'abgelehnt' sein" }, { status: 400 });
  }
  const updated = await decideVacation(id, body.status, ctx.session.name);
  if (!updated) return NextResponse.json({ success: false, error: 'Antrag nicht gefunden' }, { status: 404 });

  // Mitarbeiter über die Entscheidung informieren (non-blocking)
  try {
    if (isGraphConfigured()) {
      const emp = await getEmployee(updated.employee_id);
      if (emp?.email) {
        const ok = body.status === 'genehmigt';
        await sendGraphMail({
          to: emp.email,
          toName: emp.name,
          subject: `Abwesenheitsantrag ${ok ? 'genehmigt' : 'abgelehnt'}: ${updated.start_date}–${updated.end_date}`,
          html: `<p>Hallo ${emp.name},</p>
            <p>dein Antrag für <b>${updated.start_date} bis ${updated.end_date}</b> (${updated.days} Arbeitstage) wurde
            <b style="color:${ok ? '#15803d' : '#b91c1c'}">${ok ? 'genehmigt' : 'abgelehnt'}</b>.</p>
            ${updated.comment ? `<p>Kommentar: ${updated.comment}</p>` : ''}
            <p>Viele Grüße<br/>Faltin Travel</p>`,
        });
      }
    }
  } catch (e) {
    console.warn('[Urlaub] Benachrichtigung an Mitarbeiter fehlgeschlagen:', e);
  }

  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await deleteVacationRequest(id);
  if (!ok) return NextResponse.json({ success: false, error: 'Antrag nicht gefunden' }, { status: 404 });
  return NextResponse.json({ success: true });
}
