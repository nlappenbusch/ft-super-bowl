import { NextResponse } from 'next/server';
import { mailUser, fail, resolveMailboxes, HttpError } from '@/lib/mailbox/api';
import { aiSearch, extractMail, composeAssist } from '@/lib/mailbox/ai';
import { conversationMessages, getMessage } from '@/lib/mailbox/graph';
import { mailText } from '@/lib/mailbox/context';
import { isWorkspaceAiConfigured } from '@/lib/workspace/claude';
import { publicBaseUrl } from '@/lib/emailTemplates';
import type { AssistMode } from '@/lib/mailbox/prefs';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MODES: AssistMode[] = ['korrektur', 'optimieren', 'kuerzer', 'freundlicher', 'englisch'];

/**
 * POST /api/admin/mailbox/ai
 *   { action:'search', question, mb? }                      → Antwort + Quellen
 *   { action:'extract', mb, id }                            → strukturierte Infos
 *   { action:'compose', mode, text, subject, from, reference? {mb,id}, recipientName? } → überarbeiteter Text
 */
export async function POST(req: Request) {
  try {
    if (!isWorkspaceAiConfigured()) throw new HttpError(400, 'Die KI ist nicht eingerichtet (Admin → KI-Redaktion: Anthropic-Key).');
    const b = await req.json();
    const user = await mailUser();

    if (b.action === 'search') {
      const q = String(b.question || '').trim().slice(0, 1000);
      if (!q) throw new HttpError(400, 'Frage fehlt');
      const boxes = (await resolveMailboxes(user, b.mb || 'all')).filter((m) => m.canRead).map((m) => m.address);
      const person = { name: user.name, employeeId: user.employeeId, base: publicBaseUrl() };
      if (!b.stream) {
        const r = await aiSearch(q, boxes, person, undefined, req.signal);
        return NextResponse.json({ success: true, ...r });
      }
      // Live-Fortschritt als NDJSON: {type:'step'} … {type:'result'} bzw. {type:'error'}
      const enc = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(ctrl) {
          const send = (o: unknown) => { try { ctrl.enqueue(enc.encode(JSON.stringify(o) + '\n')); } catch { /* Client weg */ } };
          try {
            const r = await aiSearch(q, boxes, person, (text) => send({ type: 'step', text }), req.signal);
            send({ type: 'result', success: true, ...r });
          } catch (e) {
            if (!req.signal.aborted) {
              const res = fail(e);
              const body = (await res.json().catch(() => ({}))) as { error?: string };
              send({ type: 'error', error: body.error || 'KI-Suche fehlgeschlagen' });
            }
          } finally {
            try { ctrl.close(); } catch { /* schon zu */ }
          }
        },
      });
      return new Response(stream, {
        headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' },
      });
    }

    if (b.action === 'extract') {
      const [mb] = await resolveMailboxes(user, b.mb);
      if (!mb || !b.id) throw new HttpError(400, 'mb und id erforderlich');
      // Kurzer Verlauf als Zusatzkontext (ältere Mails im selben Verlauf, nur Vorschau)
      const m = await getMessage(mb.address, String(b.id));
      const thread = (await conversationMessages(mb.address, m.conversationId).catch(() => []))
        .filter((x) => x.id !== m.id).slice(-6)
        .map((x) => `${x.receivedAt.slice(0, 10)} ${x.from.address}: ${x.preview}`).join('\n');
      const extraction = await extractMail(mb.address, m.id, thread, user.name);
      return NextResponse.json({ success: true, extraction });
    }

    if (b.action === 'compose') {
      const mode = MODES.includes(b.mode) ? (b.mode as AssistMode) : 'korrektur';
      const text = String(b.text || '').slice(0, 30000);
      if (!text.trim()) throw new HttpError(400, 'Kein Text zum Überarbeiten.');
      const [from] = await resolveMailboxes(user, b.from || 'all');
      let replyTo = '';
      if (b.reference?.mb && b.reference?.id) {
        const [rmb] = await resolveMailboxes(user, b.reference.mb);
        if (rmb) {
          const orig = await getMessage(rmb.address, String(b.reference.id)).catch(() => null);
          if (orig) replyTo = `Von: ${orig.from.name} <${orig.from.address}>\nBetreff: ${orig.subject}\n\n${mailText(orig).slice(0, 6000)}`;
        }
      }
      const r = await composeAssist({
        mode, text, subject: String(b.subject || ''), replyTo,
        recipientName: b.recipientName ? String(b.recipientName) : undefined,
        senderName: user.name, mailbox: from?.address || user.email,
      });
      return NextResponse.json({ success: true, ...r });
    }

    throw new HttpError(400, 'Unbekannte Aktion');
  } catch (e) {
    return fail(e);
  }
}
