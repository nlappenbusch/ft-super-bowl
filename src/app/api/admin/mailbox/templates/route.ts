import { NextResponse } from 'next/server';
import { mailUser, fail, HttpError } from '@/lib/mailbox/api';
import { listTemplates, saveTemplate, deleteTemplate } from '@/lib/mailbox/templates';
import { PLACEHOLDERS } from '@/lib/mailbox/defaultTemplates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await mailUser();
    return NextResponse.json({ success: true, templates: await listTemplates(user.email || 'local'), placeholders: PLACEHOLDERS });
  } catch (e) {
    return fail(e);
  }
}

/** POST { id?, kind, title, category, lang, subject, body, description, shortcut, shared:boolean } */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const user = await mailUser();
    if (!String(b.title || '').trim() || !String(b.body || '').trim()) throw new HttpError(400, 'Titel und Text sind Pflicht.');
    const t = await saveTemplate(
      {
        id: b.id || undefined, kind: b.kind === 'vorlage' ? 'vorlage' : 'baustein', title: String(b.title).slice(0, 120),
        category: String(b.category || 'Allgemein').slice(0, 60), lang: b.lang === 'en' ? 'en' : 'de',
        subject: String(b.subject || '').slice(0, 300), body: String(b.body).slice(0, 20000),
        description: String(b.description || '').slice(0, 300), shortcut: String(b.shortcut || '').replace(/[^a-z0-9-]/gi, '').slice(0, 20).toLowerCase(),
        greeting: String(b.greeting || '').slice(0, 200),
        owner: b.shared === false ? undefined : '',
      },
      { email: user.email || 'local', name: user.name, isAdmin: user.isAdmin },
    );
    return NextResponse.json({ success: true, template: t });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await mailUser();
    const id = new URL(req.url).searchParams.get('id');
    if (!id) throw new HttpError(400, 'id fehlt');
    await deleteTemplate(id, { email: user.email || 'local', isAdmin: user.isAdmin, name: user.name });
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail(e);
  }
}
