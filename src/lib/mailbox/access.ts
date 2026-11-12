/**
 * mailbox/access.ts — Welche Postfächer darf die angemeldete Person sehen und
 * aus welchen darf sie senden?
 *
 * Quelle der Wahrheit ist Exchange selbst („ohne Kopfschmerzen“: wer in Outlook
 * ein freigegebenes Postfach sieht, sieht es auch hier):
 *   - eigenes Postfach (E-Mail des Mitarbeiterprofils / UPN)
 *   - FullAccess (Get-MailboxPermission)      → lesen
 *   - SendAs     (Get-RecipientPermission)    → senden
 * Zusätzlich lassen sich in den Mail-Einstellungen Freigaben ergänzen oder
 * Postfächer ausblenden (mail_prefs, owner "__global__").
 *
 * Die App selbst darf technisch auf alle Postfächer zugreifen (app-only). Deshalb
 * prüft JEDE Mail-API vor dem Zugriff `assertMailbox()`.
 */
import { exchangeGet, ExchangeError } from './exchange';
import { getGlobalMailConfig } from './prefs';

export interface MailboxInfo {
  address: string;
  name: string;
  kind: 'own' | 'shared' | 'user';
  canRead: boolean;
  canSend: boolean;
  /** Woher die Berechtigung stammt (für die Anzeige). */
  via: string;
}

interface MbRow { PrimarySmtpAddress?: string; DisplayName?: string; RecipientTypeDetails?: string; UserPrincipalName?: string; HiddenFromAddressListsEnabled?: boolean }
interface PermRow { User?: string; AccessRights?: string[] | string; IsInherited?: boolean; Deny?: boolean | string }
interface RecipPermRow { Trustee?: string; AccessRights?: string[] | string; IsInherited?: boolean; AccessControlType?: string }

interface Directory {
  loadedAt: number;
  mailboxes: Array<{ address: string; name: string; type: string; upn: string }>;
  /** person (lowercase UPN/SMTP) → Postfach-Adressen mit FullAccess */
  fullAccess: Map<string, Set<string>>;
  /** person → Postfach-Adressen mit SendAs */
  sendAs: Map<string, Set<string>>;
  error: string | null;
  /** HTTP-Status des Exchange-Fehlers (401/403 = Rechte, sonst meist Störung). */
  errorStatus?: number;
}

const TTL_MS = 15 * 60 * 1000;
let dir: Directory | null = null;
let loading: Promise<Directory> | null = null;

const lc = (s: string | undefined | null) => (s || '').trim().toLowerCase();
const rights = (r: string[] | string | undefined) => (Array.isArray(r) ? r : String(r || '').split(/[,\s]+/)).map((x) => x.trim());

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]).catch(() => undefined);
  }));
}

async function loadDirectory(): Promise<Directory> {
  const d: Directory = { loadedAt: Date.now(), mailboxes: [], fullAccess: new Map(), sendAs: new Map(), error: null };
  try {
    const rows = await exchangeGet<MbRow>('Get-Mailbox', { ResultSize: 'Unlimited', RecipientTypeDetails: ['UserMailbox', 'SharedMailbox'] });
    d.mailboxes = rows
      .filter((r) => r.PrimarySmtpAddress)
      .map((r) => ({ address: lc(r.PrimarySmtpAddress), name: r.DisplayName || r.PrimarySmtpAddress || '', type: r.RecipientTypeDetails || '', upn: lc(r.UserPrincipalName) }));
    const upnToSmtp = new Map(d.mailboxes.filter((m) => m.upn).map((m) => [m.upn, m.address]));
    const add = (map: Map<string, Set<string>>, person: string, mb: string) => {
      const keys = new Set([lc(person), upnToSmtp.get(lc(person)) || '']);
      for (const k of keys) {
        if (!k || !k.includes('@')) continue;
        if (!map.has(k)) map.set(k, new Set());
        map.get(k)!.add(mb);
      }
    };
    await pool(d.mailboxes, 6, async (mb) => {
      const [perms, recip] = await Promise.all([
        exchangeGet<PermRow>('Get-MailboxPermission', { Identity: mb.address }).catch(() => [] as PermRow[]),
        exchangeGet<RecipPermRow>('Get-RecipientPermission', { Identity: mb.address }).catch(() => [] as RecipPermRow[]),
      ]);
      for (const p of perms) {
        if (p.IsInherited || String(p.Deny) === 'true' || p.Deny === true) continue;
        if (!rights(p.AccessRights).includes('FullAccess')) continue;
        if (!p.User || /^NT AUTHORITY|^S-1-/i.test(p.User)) continue;
        add(d.fullAccess, p.User, mb.address);
      }
      for (const r of recip) {
        if (r.IsInherited || (r.AccessControlType && r.AccessControlType !== 'Allow')) continue;
        if (!rights(r.AccessRights).includes('SendAs')) continue;
        if (!r.Trustee || /^NT AUTHORITY|^S-1-/i.test(r.Trustee)) continue;
        add(d.sendAs, r.Trustee, mb.address);
      }
    });
  } catch (e) {
    d.error = (e as Error).message;
    d.errorStatus = e instanceof ExchangeError ? e.status : 0;
    console.error('[Mail] Postfachberechtigungen aus Exchange nicht lesbar:', d.error);
  }
  return d;
}

async function directory(force = false): Promise<Directory> {
  const fresh = dir && Date.now() - dir.loadedAt < TTL_MS && !dir.error;
  if (!force && fresh) return dir!;
  if (!loading) {
    loading = loadDirectory().then((d) => {
      // Fehler nicht für 15 min festhalten: bei Fehler nach 1 min erneut versuchen.
      if (d.error && dir && !dir.error) { dir.loadedAt = Date.now() - TTL_MS + 60_000; return dir; }
      if (d.error) d.loadedAt = Date.now() - TTL_MS + 60_000;
      dir = d;
      return d;
    }).finally(() => { loading = null; });
  }
  // Veralteten Stand sofort liefern, im Hintergrund auffrischen.
  if (!force && dir) return dir;
  return loading;
}

export function invalidateMailboxDirectory() {
  if (dir) dir.loadedAt = 0;
}

/** Alle Postfächer, auf die die Person (E-Mail/UPN) Zugriff hat. Eigenes zuerst. */
export async function mailboxesFor(personEmail: string | null | undefined): Promise<{ mailboxes: MailboxInfo[]; warning: string | null }> {
  const me = lc(personEmail);
  const [d, cfg] = await Promise.all([directory(), getGlobalMailConfig()]);
  const byAddr = new Map(d.mailboxes.map((m) => [m.address, m]));
  const own = me ? (d.mailboxes.find((m) => m.upn === me || m.address === me)?.address || me) : '';
  const out = new Map<string, MailboxInfo>();
  const nameOf = (a: string) => byAddr.get(a)?.name || a;
  const kindOf = (a: string): MailboxInfo['kind'] => (byAddr.get(a)?.type === 'SharedMailbox' ? 'shared' : 'user');

  if (own && (byAddr.has(own) || d.error || !d.mailboxes.length)) {
    out.set(own, { address: own, name: nameOf(own), kind: 'own', canRead: true, canSend: true, via: 'Eigenes Postfach' });
  }
  for (const key of [me, own]) {
    for (const a of d.fullAccess.get(key) || []) {
      if (out.has(a)) continue;
      out.set(a, { address: a, name: nameOf(a), kind: kindOf(a), canRead: true, canSend: false, via: 'Vollzugriff (Exchange)' });
    }
  }
  for (const key of [me, own]) {
    for (const a of d.sendAs.get(key) || []) {
      const m = out.get(a);
      if (m) { m.canSend = true; m.via += ' · Senden als'; }
    }
  }
  // Freigegebene Postfächer: Wer Vollzugriff hat, darf in Outlook i. d. R. auch daraus
  // antworten. Ohne „Senden als“ in Exchange bleibt es hier trotzdem lesend,
  // ausser die Einstellungen erlauben das Senden mit Vollzugriff ausdrücklich.
  if (cfg.send_with_full_access) {
    for (const m of out.values()) if (m.kind === 'shared' && !m.canSend) { m.canSend = true; m.via += ' · Senden erlaubt (Einstellung)'; }
  }
  // Manuelle Ergänzungen aus den Einstellungen
  for (const g of cfg.extra_access?.[me] || cfg.extra_access?.[own] || []) {
    const a = lc(g.mailbox);
    if (!a) continue;
    const m = out.get(a);
    if (m) { if (g.send) m.canSend = true; continue; }
    out.set(a, { address: a, name: nameOf(a), kind: kindOf(a), canRead: true, canSend: !!g.send, via: 'Freigabe in den Mail-Einstellungen' });
  }
  for (const h of cfg.hidden || []) if (lc(h) !== own) out.delete(lc(h));

  const list = [...out.values()].sort((a, b) =>
    (a.kind === 'own' ? 0 : 1) - (b.kind === 'own' ? 0 : 1) || a.name.localeCompare(b.name, 'de'));
  const rightsProblem = d.errorStatus === 401 || d.errorStatus === 403;
  const warning = !d.error
    ? null
    : /nicht konfiguriert/.test(d.error)
      ? 'Microsoft 365 ist in den Einstellungen (Mail/SSO) nicht eingerichtet, freigegebene Postfächer lassen sich deshalb nicht lesen.'
    : rightsProblem
      ? 'Freigegebene Postfächer konnten nicht aus Exchange gelesen werden: Der App fehlt die Berechtigung (Rolle Exchange-Administrator bzw. Exchange.ManageAsApp). Es werden nur das eigene Postfach und manuelle Freigaben angezeigt.'
      : 'Exchange Online antwortet gerade nicht (Störung bei Microsoft), deshalb fehlen die freigegebenen Postfächer vorübergehend. Der Client versucht es jede Minute selbst neu; sofort geht es über das Neu-laden-Symbol neben «Postfächer».';
  return { mailboxes: list, warning };
}

/** Alle Postfächer des Tenants (für die Einstellungen der Admins). */
export async function allMailboxes(): Promise<Array<{ address: string; name: string; type: string }>> {
  const d = await directory();
  return d.mailboxes.map(({ address, name, type }) => ({ address, name, type })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export class MailAccessError extends Error {
  status = 403;
}

/** Wirft, wenn die Person das Postfach nicht lesen (bzw. nicht daraus senden) darf. */
export async function assertMailbox(personEmail: string | null | undefined, mailbox: string, need: 'read' | 'send' = 'read'): Promise<MailboxInfo> {
  const { mailboxes } = await mailboxesFor(personEmail);
  const m = mailboxes.find((x) => x.address === lc(mailbox));
  if (!m) throw new MailAccessError(`Kein Zugriff auf das Postfach ${mailbox}.`);
  if (need === 'send' && !m.canSend) throw new MailAccessError(`Aus ${mailbox} darfst du nicht senden (Exchange: „Senden als“ fehlt).`);
  return m;
}
