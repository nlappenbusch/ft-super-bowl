/**
 * mailbox/contacts.ts — Adressvorschläge für den Editor:
 * Kundenstamm, Mitarbeitende und zuletzt gesehene Absender/Empfänger (Prozessspeicher).
 */
import { dbAll } from '../dbq';
import type { MailAddress, MailSummary } from './graph';

const recent = new Map<string, Map<string, { name: string; at: string; n: number }>>();

export function rememberContacts(owner: string, messages: MailSummary[]) {
  if (!owner) return;
  if (!recent.has(owner)) recent.set(owner, new Map());
  const m = recent.get(owner)!;
  for (const msg of messages) {
    for (const a of [msg.from, ...msg.to]) {
      if (!a.address || /noreply|no-reply|mailer-daemon|postmaster/i.test(a.address)) continue;
      const cur = m.get(a.address);
      m.set(a.address, { name: a.name || cur?.name || '', at: msg.receivedAt > (cur?.at || '') ? msg.receivedAt : cur!.at, n: (cur?.n || 0) + 1 });
    }
  }
  if (m.size > 3000) {
    const keep = [...m.entries()].sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 2000);
    recent.set(owner, new Map(keep));
  }
}

export interface ContactHit extends MailAddress { source: 'kunde' | 'team' | 'zuletzt'; detail: string }

export async function searchContacts(owner: string, q: string): Promise<ContactHit[]> {
  const s = q.trim().toLowerCase();
  if (s.length < 2) return [];
  const like = `%${s}%`;
  const out = new Map<string, ContactHit>();

  const team = await dbAll<{ name: string; email: string }>(
    `SELECT name, email FROM employees WHERE active = 1 AND (lower(name) LIKE ? OR lower(email) LIKE ?) LIMIT 6`, [like, like],
  ).catch(() => [] as Array<{ name: string; email: string }>);
  for (const t of team) if (t.email) out.set(t.email.toLowerCase(), { name: t.name, address: t.email.toLowerCase(), source: 'team', detail: 'Team' });

  const rec = recent.get(owner);
  if (rec) {
    const hits = [...rec.entries()]
      .filter(([a, v]) => a.includes(s) || v.name.toLowerCase().includes(s))
      .sort((a, b) => b[1].n - a[1].n || b[1].at.localeCompare(a[1].at))
      .slice(0, 8);
    for (const [a, v] of hits) if (!out.has(a)) out.set(a, { name: v.name, address: a, source: 'zuletzt', detail: `${v.n}× im Postfach` });
  }

  const cust = await dbAll<{ email: string; first_name: string; last_name: string; name: string; company: string; city: string }>(
    `SELECT e.email, c.first_name, c.last_name, c.name, c.company, c.city
       FROM customer_emails e JOIN customers c ON c.id = e.customer_id
      WHERE lower(e.email) LIKE ? OR lower(c.name) LIKE ? OR lower(c.first_name || ' ' || c.last_name) LIKE ? OR lower(c.company) LIKE ?
      ORDER BY e.is_primary DESC LIMIT 10`,
    [like, like, like, like],
  ).catch(() => []);
  for (const c of cust) {
    const a = c.email.toLowerCase();
    if (out.has(a)) continue;
    const name = [c.first_name, c.last_name].filter(Boolean).join(' ') || c.name || '';
    out.set(a, { name, address: a, source: 'kunde', detail: ['Kunde', c.company, c.city].filter(Boolean).join(' · ') });
  }
  return [...out.values()].slice(0, 12);
}
