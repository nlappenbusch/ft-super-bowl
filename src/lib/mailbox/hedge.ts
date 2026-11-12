/**
 * mailbox/hedge.ts — «Hedged Request» für lesende Graph-Aufrufe.
 *
 * Exchange lässt einzelne Anfragen zufällig 20–60 s hängen (am Ende 502/503/504), während die
 * gleiche Anfrage nochmals gestellt meist in 0,2 s antwortet. Kommt nach `hedgeMs` keine Antwort,
 * startet deshalb EIN zweiter gleicher Aufruf parallel; die erste brauchbare Antwort gewinnt, der
 * andere wird abgebrochen. Nie mehr als zwei gleichzeitig (Graph drosselt je Postfach ab 4).
 * Nur für idempotente Aufrufe (GET) verwenden.
 */

export type Starter = (signal: AbortSignal) => Promise<Response>;

export interface HedgeOptions {
  /** Wartezeit bis zum zweiten Aufruf. */
  hedgeMs: number;
  /** Zeitlimit je Aufruf, beim Start abgefragt (damit das Gesamtbudget des Aufrufers gilt). */
  timeoutMs: () => number;
  /** Vorübergehender Fehler (dann auf den anderen Aufruf warten bzw. dem Aufrufer überlassen). */
  transient: (status: number) => boolean;
}

/** Zeitüberschreitung, Abbruch oder Verbindungsfehler («fetch failed»). */
export const isNetError = (e: unknown): boolean =>
  e instanceof TypeError || (e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError';

const discard = (r: Response | null | undefined) => { void r?.body?.cancel().catch(() => {}); };

/**
 * Liefert die erste nicht-vorübergehende Antwort (ok oder endgültiger Fehler wie 404). Haben alle
 * Aufrufe nur vorübergehend versagt, die letzte solche Antwort bzw. null (Zeitüberschreitung /
 * Verbindungsfehler) — die Wiederholung mit Pause bleibt Sache des Aufrufers.
 */
export function hedged(start: Starter, o: HedgeOptions): Promise<Response | null> {
  return new Promise((resolve, reject) => {
    const ctrls: AbortController[] = [];
    let pending = 0;
    let launched = 0;
    let done = false;
    let last: Response | null = null;
    let failure: unknown = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (r: Response | null, winner?: AbortController) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      for (const c of ctrls) if (c !== winner) c.abort();
      if (last && last !== r) discard(last);
      resolve(r);
    };

    // Nach einem Fehlschlag: Läuft noch ein Aufruf (oder kommt der zweite noch), auf ihn warten.
    const settleIfIdle = () => {
      if (done || pending > 0) return;
      if (failure && !last) { done = true; clearTimeout(timer); reject(failure); return; }
      finish(last);
    };

    const launch = () => {
      const c = new AbortController();
      ctrls.push(c);
      pending++;
      launched++;
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(Math.max(1, o.timeoutMs()))]);
      start(signal).then(
        (res) => {
          pending--;
          if (done) { discard(res); return; }
          if (!o.transient(res.status)) { finish(res, c); return; }
          if (last) discard(last);
          last = res;
          // Vorübergehender Fehler, bevor der zweite Aufruf lief → gleich zurück an den Aufrufer
          if (launched < 2) { finish(last); return; }
          settleIfIdle();
        },
        (e) => {
          pending--;
          if (done) return;
          if (!isNetError(e)) failure = e;
          settleIfIdle();
        },
      );
    };

    launch();
    timer = setTimeout(() => { if (!done && pending > 0 && launched === 1) launch(); }, o.hedgeMs);
  });
}
