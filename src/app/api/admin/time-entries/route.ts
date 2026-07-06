import { NextResponse } from 'next/server';
import { listTaskTimeEntries } from '@/lib/staffStore';

/**
 * GET /api/admin/time-entries?from=&to=&employee=&project=&reported=open|reported
 * → { entries, stats } — Zeitbuchungen über alle Tickets inkl. Rapport-Status.
 * stats werden über den Zeitraum-/Mitarbeiter-/Projekt-Filter berechnet (unabhängig vom
 * reported-Filter), damit die Übersicht "offen vs. rapportiert" immer stimmt.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get('from') || undefined;
  const to = url.searchParams.get('to') || undefined;
  const employee_id = url.searchParams.get('employee') || undefined;
  const project_id = url.searchParams.get('project') || undefined;
  const reported = url.searchParams.get('reported');

  const all = await listTaskTimeEntries({ from, to, employee_id, project_id });
  const open = all.filter((e) => !e.report_id);
  const done = all.filter((e) => e.report_id);
  const entries = reported === 'open' ? open : reported === 'reported' ? done : all;

  return NextResponse.json({
    success: true,
    data: {
      entries,
      stats: {
        open_count: open.length,
        open_minutes: open.reduce((s, e) => s + (e.minutes || 0), 0),
        reported_count: done.length,
        reported_minutes: done.reduce((s, e) => s + (e.minutes || 0), 0),
      },
    },
  });
}
