/**
 * workspace/inboundKind.ts — Ist die letzte „Kundenantwort“ wirklich eine?
 * Unzustellbarkeitsmeldungen (Bounces) und Abwesenheitsnotizen landen im CRM als
 * eingehende Mail und liessen Anfragen fälschlich als „Kunde wartet“ erscheinen —
 * teils monatelang. Hier werden sie erkannt, damit „Heute“ und die Erinnerungen
 * sie getrennt behandeln (anrufen bzw. später nachfassen statt antworten).
 */
import { dbAll } from '../dbq';

export type InboundKind = 'kunde' | 'bounce' | 'abwesend';

const BOUNCE_FROM = /(mailer-daemon|postmaster|mail delivery (sub)?system|microsoftexchange\w*@|no-?reply@.*(bounce|mail))/i;
const BOUNCE_SUBJECT = /(undeliverable|unzustellbar|nicht zustellbar|delivery status notification|returned mail|mail delivery failed|failure notice|delivery has failed|zustellung.{0,30}fehlgeschlagen|non remis|undelivered|message not delivered|nachricht konnte nicht zugestellt)/i;
const AWAY_SUBJECT = /(automatische antwort|abwesenheit|out of (the )?office|auto-?reply|automatic reply|réponse automatique|risposta automatica|abwesend|im urlaub|ooo\b)/i;
const AWAY_BODY = /(abwesenheitsnotiz|bin ich (derzeit|zurzeit|momentan) nicht|ich bin (derzeit|zurzeit|momentan|bis) .{0,40}(abwesend|nicht im büro|im urlaub|nicht erreichbar)|out of (the )?office|i am (currently )?out of)/i;

export function classifyInbound(m: { from_email?: string; subject?: string; body?: string }): InboundKind {
  const from = m.from_email || '';
  const subject = m.subject || '';
  if (BOUNCE_FROM.test(from) || BOUNCE_SUBJECT.test(subject)) return 'bounce';
  const head = (m.body || '').replace(/<[^>]+>/g, ' ').slice(0, 800);
  if (AWAY_SUBJECT.test(subject) || AWAY_BODY.test(head)) return 'abwesend';
  return 'kunde';
}

/** Art der jeweils neuesten eingehenden Mail je Anfrage. */
export async function lastInboundKinds(bookingIds: string[]): Promise<Map<string, InboundKind>> {
  const out = new Map<string, InboundKind>();
  const ids = Array.from(new Set(bookingIds)).slice(0, 200);
  if (!ids.length) return out;
  const rows = await dbAll<{ booking_id: string; from_email: string; subject: string; body: string; created_at: string }>(
    `SELECT booking_id, from_email, subject, body, created_at FROM booking_messages
     WHERE direction = 'in' AND booking_id IN (${ids.map(() => '?').join(', ')})
     ORDER BY created_at DESC`,
    ids,
  );
  for (const r of rows) {
    if (!out.has(r.booking_id)) out.set(r.booking_id, classifyInbound(r));
  }
  return out;
}
