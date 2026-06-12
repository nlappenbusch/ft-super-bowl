/**
 * serverSession.ts – aktuelle Session + zugehöriger Mitarbeiter in Route-Handlern.
 */
import { cookies } from 'next/headers';
import { verifySessionToken, SESSION_COOKIE, type Session } from './auth';
import { getEmployee, upsertEmployeeOnLogin, type Employee } from './staffStore';

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Mitarbeiter-Datensatz der aktuellen Session (nur Microsoft-Logins haben einen).
 * Sessions, die vor Einführung der Userverwaltung erstellt wurden, werden hier
 * lazy nachregistriert – kein erneuter Login nötig.
 */
export async function getSessionEmployee(): Promise<{ session: Session; employee: Employee | null } | null> {
  const session = await getSession();
  if (!session) return null;
  let employee: Employee | null = null;
  if (session.src === 'microsoft') {
    employee = getEmployee(session.sub)
      || upsertEmployeeOnLogin({ id: session.sub, name: session.name, email: session.email });
  }
  return { session, employee };
}
