import { workspaceSession, unauthorized, requestBase } from '@/lib/workspace/session';
import { isWorkspaceAiConfigured, describeAiError } from '@/lib/workspace/claude';
import { runChatTurn, ConversationBusyError, type ChatEvent } from '@/lib/workspace/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * POST /api/admin/workspace/chat — eine Chat-Runde mit der Faltin-KI.
 * Body: { text, conversation_id?, file_ids?: string[], page_context? }
 * Antwort: NDJSON-Stream (eine JSON-Zeile je Ereignis, siehe ChatEvent).
 */
export async function POST(req: Request) {
  const ws = await workspaceSession();
  if (!ws) return unauthorized();
  if (!isWorkspaceAiConfigured()) {
    return Response.json({ success: false, error: 'Kein Anthropic API-Key hinterlegt (Admin → KI-Redaktion).' }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    text?: string; conversation_id?: string | null; file_ids?: unknown; page_context?: string;
  };
  const text = String(body.text || '').slice(0, 20000);
  const fileIds = Array.isArray(body.file_ids) ? body.file_ids.filter((x): x is string => typeof x === 'string') : [];
  if (!text.trim() && !fileIds.length) {
    return Response.json({ success: false, error: 'Nachricht fehlt.' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const base = requestBase(req);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit = (ev: ChatEvent) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`)); } catch { closed = true; }
      };
      try {
        await runChatTurn({
          employee: ws.employee,
          personName: ws.personName,
          personRole: ws.personRole,
          ownerKey: ws.ownerKey,
          base,
          conversationId: body.conversation_id || null,
          text,
          fileIds,
          pageContext: typeof body.page_context === 'string' ? body.page_context.slice(0, 500) : undefined,
          emit,
          signal: req.signal,
        });
      } catch (e) {
        emit({ t: 'error', message: e instanceof ConversationBusyError ? e.message : describeAiError(e) });
      }
      emit({ t: 'done' });
      closed = true;
      try { controller.close(); } catch { /* bereits geschlossen */ }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
