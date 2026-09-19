/**
 * workspace/session.ts — Wer arbeitet gerade am KI-Arbeitsplatz?
 * Microsoft-Login → Mitarbeiterprofil; lokaler Admin → eigener Besitzschlüssel.
 */
import { NextResponse } from 'next/server';
import { getSessionEmployee } from '../serverSession';
import type { Employee } from '../staffStore';
import type { Session } from '../auth';

export interface WorkspaceSession {
  session: Session;
  employee: Employee | null;
  personName: string;
  personRole: 'admin' | 'mitarbeiter';
  /** Besitz von Chats/Dateien: Mitarbeiter-ID bzw. „local:<sub>“ beim lokalen Admin. */
  ownerKey: string;
  isAdmin: boolean;
}

export async function workspaceSession(): Promise<WorkspaceSession | null> {
  const ctx = await getSessionEmployee();
  if (!ctx) return null;
  const { session, employee } = ctx;
  const role: 'admin' | 'mitarbeiter' = employee ? employee.role : 'admin';
  return {
    session,
    employee,
    personName: employee?.name || session.name || 'Admin',
    personRole: role,
    ownerKey: employee?.id || `local:${session.sub}`,
    isAdmin: role === 'admin',
  };
}

export function unauthorized() {
  return NextResponse.json({ success: false, error: 'Nicht angemeldet' }, { status: 401 });
}

/** Öffentliche Basis-URL aus dem Request (Reverse-Proxy-fest). */
export function requestBase(req: Request): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  try { return new URL(req.url).origin; } catch { return 'https://next.faltintravel.com'; }
}
