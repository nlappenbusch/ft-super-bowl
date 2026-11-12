import { NextResponse } from 'next/server';
import { mailUser, fail, HttpError } from '@/lib/mailbox/api';
import { savePersonalPrefs, saveGlobalMailConfig, type AssistMode } from '@/lib/mailbox/prefs';
import { invalidateMailboxDirectory } from '@/lib/mailbox/access';

export const dynamic = 'force-dynamic';

const MODES: AssistMode[] = ['korrektur', 'optimieren', 'kuerzer', 'freundlicher', 'englisch'];

/** POST { personal?: {...}, global?: {...} (nur Admins) } */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const user = await mailUser();
    const out: Record<string, unknown> = {};
    if (b.personal) {
      const p = b.personal;
      const patch: Record<string, unknown> = {};
      if (MODES.includes(p.assist_mode)) patch.assist_mode = p.assist_mode;
      if (typeof p.title === 'string') patch.title = p.title.slice(0, 120);
      if (typeof p.title_en === 'string') patch.title_en = p.title_en.slice(0, 120);
      if (typeof p.phone === 'string') patch.phone = p.phone.slice(0, 60);
      if (typeof p.default_from === 'string') patch.default_from = p.default_from.toLowerCase();
      if (typeof p.load_images === 'boolean') patch.load_images = p.load_images;
      if (p.signatures && typeof p.signatures === 'object') {
        patch.signatures = Object.fromEntries(
          Object.entries(p.signatures as Record<string, string>)
            .map(([k, v]) => [k.toLowerCase(), String(v || '').trim().slice(0, 20000)])
            .filter(([, v]) => v),
        );
      }
      out.prefs = await savePersonalPrefs(user.email || 'local', patch);
    }
    if (b.global) {
      if (!user.isAdmin) throw new HttpError(403, 'Nur Admins können die globale Mail-Konfiguration ändern.');
      const g = b.global;
      const patch: Record<string, unknown> = {};
      if (typeof g.send_with_full_access === 'boolean') patch.send_with_full_access = g.send_with_full_access;
      if (Array.isArray(g.hidden)) patch.hidden = g.hidden.map((x: string) => String(x).toLowerCase()).slice(0, 200);
      if (g.extra_access && typeof g.extra_access === 'object') patch.extra_access = g.extra_access;
      if (typeof g.signature_template === 'string') patch.signature_template = g.signature_template.slice(0, 20000);
      if (g.mailbox_signatures && typeof g.mailbox_signatures === 'object') patch.mailbox_signatures = g.mailbox_signatures;
      out.global = await saveGlobalMailConfig(patch);
      invalidateMailboxDirectory();
    }
    return NextResponse.json({ success: true, ...out });
  } catch (e) {
    return fail(e);
  }
}
