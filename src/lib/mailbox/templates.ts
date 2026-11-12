/**
 * mailbox/templates.ts — Vorlagen und Textbausteine.
 * owner = '' → für alle sichtbar (Team), sonst persönliche (E-Mail der Person).
 * Beim ersten Zugriff werden die Standard-Vorlagen aus defaultTemplates.ts eingespielt.
 */
import { dbAll, dbGet, dbRun } from '../dbq';
import { ensureMailSchema } from './schema';
import { DEFAULT_TEMPLATES } from './defaultTemplates';

export interface MailTemplate {
  id: string;
  kind: 'vorlage' | 'baustein';
  title: string;
  category: string;
  lang: string;
  subject: string;
  body: string;
  description: string;
  shortcut: string;
  /** Grussformel, die beim Einfügen über der Signatur gesetzt wird (leer = unverändert). */
  greeting: string;
  owner: string;
  sort: number;
  uses: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

let seeded: Promise<void> | null = null;

async function seed(): Promise<void> {
  await ensureMailSchema();
  const row = await dbGet<{ n: number }>('SELECT COUNT(*) AS n FROM mail_templates');
  if (Number(row?.n || 0) > 0) return;
  const now = new Date().toISOString();
  let i = 0;
  for (const t of DEFAULT_TEMPLATES) {
    await dbRun(
      `INSERT INTO mail_templates (id, kind, title, category, lang, subject, body, description, shortcut, greeting, owner, sort, uses, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, 0, 'System', ?, ?)`,
      [t.id, t.kind, t.title, t.category, t.lang || 'de', t.subject || '', t.body, t.description || '', t.shortcut || '', t.greeting || '', i++, now, now],
    );
  }
}

function ensureSeeded() {
  if (!seeded) seeded = seed().catch((e) => { seeded = null; throw e; });
  return seeded;
}

export async function listTemplates(owner: string): Promise<MailTemplate[]> {
  await ensureSeeded();
  return dbAll<MailTemplate>(
    `SELECT * FROM mail_templates WHERE owner = '' OR owner = ? ORDER BY kind, category, sort, title`,
    [owner.toLowerCase()],
  );
}

export async function saveTemplate(
  input: Partial<MailTemplate> & { title: string; body: string },
  by: { email: string; name: string; isAdmin: boolean },
): Promise<MailTemplate> {
  await ensureSeeded();
  const now = new Date().toISOString();
  const owner = input.owner === '' ? '' : by.email.toLowerCase();
  if (input.id) {
    const cur = await dbGet<MailTemplate>('SELECT * FROM mail_templates WHERE id = ?', [input.id]);
    if (!cur) throw new Error('Vorlage nicht gefunden.');
    if (cur.owner && cur.owner !== by.email.toLowerCase()) throw new Error('Das ist eine persönliche Vorlage einer anderen Person.');
    await dbRun(
      `UPDATE mail_templates SET kind = ?, title = ?, category = ?, lang = ?, subject = ?, body = ?, description = ?, shortcut = ?, greeting = ?, owner = ?, updated_at = ? WHERE id = ?`,
      [input.kind || cur.kind, input.title, input.category ?? cur.category, input.lang || cur.lang, input.subject ?? cur.subject,
        input.body, input.description ?? cur.description, input.shortcut ?? cur.shortcut, input.greeting ?? cur.greeting, owner, now, input.id],
    );
    return (await dbGet<MailTemplate>('SELECT * FROM mail_templates WHERE id = ?', [input.id]))!;
  }
  const id = crypto.randomUUID();
  await dbRun(
    `INSERT INTO mail_templates (id, kind, title, category, lang, subject, body, description, shortcut, greeting, owner, sort, uses, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 999, 0, ?, ?, ?)`,
    [id, input.kind || 'baustein', input.title, input.category || 'Allgemein', input.lang || 'de', input.subject || '', input.body,
      input.description || '', input.shortcut || '', input.greeting || '', owner, by.name, now, now],
  );
  return (await dbGet<MailTemplate>('SELECT * FROM mail_templates WHERE id = ?', [id]))!;
}

export async function deleteTemplate(id: string, by: { email: string; isAdmin: boolean; name: string }): Promise<void> {
  const cur = await dbGet<MailTemplate>('SELECT * FROM mail_templates WHERE id = ?', [id]);
  if (!cur) return;
  if (cur.owner && cur.owner !== by.email.toLowerCase()) throw new Error('Persönliche Vorlage einer anderen Person.');
  if (!cur.owner && !by.isAdmin && cur.created_by !== by.name) throw new Error('Team-Vorlagen dürfen nur Admins oder die erstellende Person löschen.');
  await dbRun('DELETE FROM mail_templates WHERE id = ?', [id]);
}

export async function countTemplateUse(id: string): Promise<void> {
  await dbRun('UPDATE mail_templates SET uses = uses + 1 WHERE id = ?', [id]).catch(() => undefined);
}
