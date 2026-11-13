/** belege/actor.ts — aktuelle Person aus der Session. Prüfende = Admins (Team & User) bzw. localadmin. */
import { NextResponse } from 'next/server';
import { getSessionEmployee } from '../serverSession';
import type { BelegeUser } from './store';

export async function currentBelegeUser(): Promise<BelegeUser | null> {
  const s = await getSessionEmployee();
  if (!s) return null;
  const { session, employee } = s;
  return {
    id: session.sub,
    name: employee?.name || session.name || session.email || 'Unbekannt',
    email: (employee?.email || session.email || '').toLowerCase(),
    reviewer: session.src === 'local' || employee?.role === 'admin',
  };
}

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

export async function requireBelegeUser(): Promise<BelegeUser | NextResponse> {
  const u = await currentBelegeUser();
  return u || jsonError('Nicht angemeldet', 401);
}
