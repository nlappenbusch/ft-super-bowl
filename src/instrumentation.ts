/**
 * instrumentation.ts (Next.js Instrumentation Hook)
 * ─────────────────────────────────────────────────────────────────────────────
 * Startet in Produktion interne Scheduler:
 *   – Inbound-Mail-Polling (alle 120 s), kein externer Cron auf /api/inbound/poll nötig
 *   – Tägliches Team-Briefing (Check alle 5 min; Versand einmal pro Tag ab der
 *     konfigurierten Stunde, dedupliziert über data/briefing-state.json)
 * Läuft nur im Node.js-Runtime-Prozess; Fehler werden geloggt, crashen aber
 * niemals den Server. Beide Jobs beenden sich sofort billig, wenn Microsoft
 * Graph nicht konfiguriert bzw. das Feature deaktiviert ist.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const POLL_INTERVAL_MS = 120_000;
const BRIEFING_CHECK_MS = 300_000;
const GLOBAL_KEY = Symbol.for('faltin.inboundPollTimer');

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;

  // Doppelte Registrierung verhindern (z.B. bei mehrfachem register()-Aufruf).
  const g = globalThis as Record<symbol, unknown>;
  if (g[GLOBAL_KEY]) return;
  g[GLOBAL_KEY] = true;

  const { runInboundPoll } = await import('./lib/inboundPoll');

  const timer = setInterval(async () => {
    try {
      const result = await runInboundPoll();
      if (result.configured && (result.matched > 0 || result.created > 0)) {
        console.log(
          `[inbound-poll] scanned=${result.scanned} matched=${result.matched} created=${result.created} skipped=${result.skipped}`
        );
      }
    } catch (err) {
      console.error('[inbound-poll] Automatischer Abruf fehlgeschlagen:', err);
    }
  }, POLL_INTERVAL_MS);

  // Timer soll ein sauberes Beenden des Prozesses nicht blockieren.
  (timer as unknown as { unref?: () => void }).unref?.();

  console.log(`[inbound-poll] Interner Poll-Scheduler aktiv (alle ${POLL_INTERVAL_MS / 1000}s).`);

  const { runDailyBriefing } = await import('./lib/dailyBriefing');
  const briefingTimer = setInterval(async () => {
    try {
      const result = await runDailyBriefing();
      if (result.sent > 0 || result.errors > 0) {
        console.log(`[daily-briefing] sent=${result.sent} skippedEmpty=${result.skippedEmpty} errors=${result.errors}`);
      }
    } catch (err) {
      console.error('[daily-briefing] Lauf fehlgeschlagen:', err);
    }
  }, BRIEFING_CHECK_MS);
  (briefingTimer as unknown as { unref?: () => void }).unref?.();

  console.log(`[daily-briefing] Scheduler aktiv (Check alle ${BRIEFING_CHECK_MS / 1000}s).`);
}
