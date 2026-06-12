import { NextResponse } from 'next/server';
import { listEmployees, vacationBalance } from '@/lib/staffStore';
import { getSessionEmployee } from '@/lib/serverSession';

/** Userverwaltung: alle Mitarbeiter inkl. Urlaubssaldo des Jahres. */
export async function GET(req: Request) {
  // Sorgt dafür, dass der aktuell angemeldete M365-User registriert ist
  // (auch bei Sessions, die vor dem Team-Modul erstellt wurden).
  await getSessionEmployee();
  const year = parseInt(new URL(req.url).searchParams.get('year') || '', 10) || new Date().getFullYear();
  const employees = listEmployees(true).map((e) => ({
    ...e,
    vacation: vacationBalance(e, year),
  }));
  return NextResponse.json({ success: true, data: employees });
}
