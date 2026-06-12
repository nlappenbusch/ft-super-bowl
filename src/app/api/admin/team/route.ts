import { NextResponse } from 'next/server';
import { listEmployees, vacationBalance } from '@/lib/staffStore';

/** Userverwaltung: alle Mitarbeiter inkl. Urlaubssaldo des Jahres. */
export async function GET(req: Request) {
  const year = parseInt(new URL(req.url).searchParams.get('year') || '', 10) || new Date().getFullYear();
  const employees = listEmployees(true).map((e) => ({
    ...e,
    vacation: vacationBalance(e, year),
  }));
  return NextResponse.json({ success: true, data: employees });
}
