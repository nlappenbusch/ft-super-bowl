/**
 * instrumentation.ts (Next.js Instrumentation Hook)
 * ─────────────────────────────────────────────────────────────────────────────
 * Startet in Produktion einen internen Scheduler für das Inbound-Mail-Polling
 * (alle 120 s), sodass kein externer Cron-Job auf /api/inbound/poll nötig ist.
 * Läuft nur im Node.js-Runtime-Prozess; Fehler werden geloggt, crashen aber
 * niemals den Server. runInboundPoll() beendet sich sofort billig, wenn
 * Microsoft Graph nicht konfiguriert ist.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const POLL_INTERVAL_MS = 120_000;
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
}
