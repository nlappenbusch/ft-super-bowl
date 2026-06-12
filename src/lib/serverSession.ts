/**
 * serverSession.ts – aktuelle Session + zugehöriger Mitarbeiter in Route-Handlern.
 */
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE, type Session } from './auth';
import { getEmployee, type Employee } from './staffStore';

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/** Mitarbeiter-Datensatz der aktuellen Session (nur Microsoft-Logins haben einen). */
export async function getSessionEmployee(): Promise<{ session: Session; employee: Employee | null } | null> {
  const session = await getSession();
  if (!session) return null;
  const employee = session.src === 'microsoft' ? getEmployee(session.sub) : null;
  return { session, employee };
}
