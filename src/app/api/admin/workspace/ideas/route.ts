import { NextResponse } from 'next/server';
import { workspaceSession, unauthorized } from '@/lib/workspace/session';
import { listStaffTasks, listTaskMessages, formatTicketNo } from '@/lib/staffStore';
import { werkstattProjectId, submitToolIdea, VOTE_MARK } from '@/lib/workspace/tools';

/** GET — Werkzeug-Ideen aus der Werkstatt (Aufgaben im Projekt „KI-Werkstatt“). */
export async function GET() {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const projectId = await werkstattProjectId();
  const tasks = projectId ? await listStaffTasks({ project_id: projectId }) : [];
  const data = [];
  for (const t of tasks.slice(0, 60)) {
    const notes = await listTaskMessages(t.id);
    const votes = notes.filter((n) => n.direction === 'note' && n.body.startsWith(VOTE_MARK));
    data.push({
      id: t.id,
      ticket_no: formatTicketNo(t.ticket_number),
      title: t.title.replace(/^Werkzeug-Idee:\s*/i, ''),
      description: t.description,
      status: t.status,
      created_at: t.created_at,
      votes: votes.length,
      voted: votes.some((v) => v.created_by === ws.personName),
    });
  }
  data.sort((a, b) => Number(a.status === 'erledigt') - Number(b.status === 'erledigt') || b.votes - a.votes || b.created_at.localeCompare(a.created_at));
  return NextResponse.json({ success: true, data });
}

/** POST { title, problem, idea, benefit? } — Idee direkt einreichen (ohne Chat). */
export async function POST(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { title?: string; problem?: string; idea?: string; benefit?: string };
  if (!body.title?.trim() || !body.idea?.trim()) {
    return NextResponse.json({ success: false, error: 'Titel und Idee sind nötig.' }, { status: 400 });
  }
  const task = await submitToolIdea(
    { title: body.title.trim(), problem: (body.problem || '').trim() || '—', idea: body.idea.trim(), benefit: body.benefit?.trim() },
    { name: ws.personName, employeeId: ws.employee?.id || null },
  );
  return NextResponse.json({ success: true, data: { id: task.id, ticket_no: formatTicketNo(task.ticket_number) } });
}
