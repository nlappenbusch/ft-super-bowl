/**
 * mailbox/teams.ts — Ist der Mail-Partner in Teams erreichbar?
 *
 * Geprüft wird im Faltin-Verzeichnis (Graph /users, App-Recht User.Read(Write).All):
 *   intern  Mitglied mit Teams-Lizenz → Chat geht sicher
 *   gast    Gast im Faltin-Tenant      → Chat geht
 *   extern  nicht im Verzeichnis       → Chat über Teams-Föderation, wenn die andere Firma
 *           externe Chats erlaubt (lässt sich app-only nicht vorab prüfen)
 * Der Link öffnet einen 1:1- bzw. Gruppenchat (teams.microsoft.com/l/chat/0/0?users=…).
 */
import { graphRequest } from '../graphMailer';

export type TeamsStatus = 'intern' | 'intern_ohne_teams' | 'gast' | 'extern' | 'unbekannt';

export interface TeamsHit {
  email: string;
  name: string;
  status: TeamsStatus;
  /** UPN für den Deep-Link (bei Gästen die echte Mailadresse) */
  chatId: string;
}

const TEAMS_PLAN = 'TeamspaceAPI';
const cache = new Map<string, { at: number; hit: TeamsHit }>();
const TTL = 6 * 60 * 60 * 1000;

interface GraphUser {
  displayName: string;
  userPrincipalName: string;
  mail: string | null;
  userType: string | null;
  accountEnabled: boolean;
  assignedPlans?: Array<{ service: string; capabilityStatus: string }>;
}

const esc = (s: string) => s.replace(/'/g, "''");

async function lookup(email: string): Promise<TeamsHit> {
  const e = email.toLowerCase();
  const filter = `mail eq '${esc(e)}' or userPrincipalName eq '${esc(e)}' or proxyAddresses/any(p:p eq 'smtp:${esc(e)}') or otherMails/any(m:m eq '${esc(e)}')`;
  const res = await graphRequest(
    `/users?$filter=${encodeURIComponent(filter)}&$select=displayName,userPrincipalName,mail,userType,accountEnabled,assignedPlans&$count=true`,
    { headers: { ConsistencyLevel: 'eventual' } },
  );
  if (!res.ok) return { email: e, name: '', status: 'unbekannt', chatId: e };
  const users = ((await res.json()) as { value: GraphUser[] }).value.filter((u) => u.accountEnabled !== false);
  const u = users[0];
  if (!u) return { email: e, name: '', status: 'extern', chatId: e };
  if ((u.userType || '').toLowerCase() === 'guest') return { email: e, name: u.displayName, status: 'gast', chatId: u.mail || e };
  const teams = (u.assignedPlans || []).some((p) => p.service === TEAMS_PLAN && p.capabilityStatus === 'Enabled');
  return { email: e, name: u.displayName, status: teams ? 'intern' : 'intern_ohne_teams', chatId: u.userPrincipalName };
}

export async function teamsStatus(emails: string[]): Promise<TeamsHit[]> {
  const uniq = [...new Set(emails.map((x) => x.trim().toLowerCase()).filter((x) => /@/.test(x)))].slice(0, 20);
  return Promise.all(uniq.map(async (e) => {
    const c = cache.get(e);
    if (c && Date.now() - c.at < TTL) return c.hit;
    try {
      const hit = await lookup(e);
      if (hit.status !== 'unbekannt') cache.set(e, { at: Date.now(), hit });
      return hit;
    } catch {
      return { email: e, name: '', status: 'unbekannt' as const, chatId: e };
    }
  }));
}
