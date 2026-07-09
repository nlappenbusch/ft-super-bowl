/**
 * instrumentation.ts (Next.js Instrumentation Hook)
 * ─────────────────────────────────────────────────────────────────────────────
 * Startet in Produktion interne Scheduler:
 *   – Inbound-Mail-Polling (alle 120 s), kein externer Cron auf /api/inbound/poll nötig
 *   – Tägliches Team-Briefing (Check alle 5 min; Versand einmal pro Tag ab der
 *     konfigurierten Stunde, dedupliziert über data/briefing-state.json)
 *   – Release-Notes-Mail (einmalig ~90 s nach Start = nach jedem Deploy;
 *     kündigt seit dem letzten Lauf gemergte PRs an, ohne neue Merges keine Mail)
 * Läuft nur im Node.js-Runtime-Prozess; Fehler werden geloggt, crashen aber
 * niemals den Server. Alle Jobs beenden sich sofort billig, wenn Microsoft
 * Graph nicht konfiguriert bzw. das Feature deaktiviert ist.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const POLL_INTERVAL_MS = 120_000;
const BRIEFING_CHECK_MS = 300_000;
const RELEASE_NOTES_DELAY_MS = 90_000;
const CONTENT_DRIFT_DELAY_MS = 30_000;
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

  // Release-Notes einmalig nach dem Start (= nach jedem Deploy, der Container
  // startet neu). Verzögert, damit der Server erst sauber hochgefahren ist.
  const releaseTimer = setTimeout(async () => {
    try {
      const { runReleaseNotes } = await import('./lib/releaseNotes');
      const result = await runReleaseNotes();
      if (result.sent > 0 || result.errors > 0 || result.prs.length > 0) {
        console.log(`[release-notes] sent=${result.sent} errors=${result.errors} prs=${result.prs.join(',')}`);
      } else if (result.reason) {
        console.log(`[release-notes] Übersprungen: ${result.reason}`);
      }
    } catch (err) {
      console.error('[release-notes] Lauf fehlgeschlagen:', err);
    }
  }, RELEASE_NOTES_DELAY_MS);
  (releaseTimer as unknown as { unref?: () => void }).unref?.();

  console.log(`[release-notes] Check ${RELEASE_NOTES_DELAY_MS / 1000}s nach Start geplant.`);

  // Content-Drift-Check einmalig nach dem Start (= nach jedem Deploy): vergleicht
  // den Content-Bestand mit dem letzten Stand und alarmiert bei verdächtigem
  // Schwund per Mail (Konsequenz aus dem Wipe vom 01.07., blieb 8 Tage unbemerkt).
  const driftTimer = setTimeout(async () => {
    try {
      const { runContentDriftCheck } = await import('./lib/contentDriftCheck');
      const result = await runContentDriftCheck();
      console.log(
        result.alarms.length
          ? `[content-drift] ${result.alarms.length} Alarm(e) — Mail an notify_to versendet.`
          : `[content-drift] Bestand OK${result.checked ? '' : ' (erster Lauf, Referenz gespeichert)'}.`
      );
    } catch (err) {
      console.error('[content-drift] Check fehlgeschlagen:', err);
    }
  }, CONTENT_DRIFT_DELAY_MS);
  (driftTimer as unknown as { unref?: () => void }).unref?.();
}
