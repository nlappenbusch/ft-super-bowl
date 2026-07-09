import fs from 'fs';
import path from 'path';

/**
 * Content-Drift-Check (Konsequenz aus dem Wipe vom 01.07.2026, TASK-00104/00106):
 * Merkt sich je Content-Datei pro Eintrag die Feldanzahl (data/backups/.content-stats.json)
 * und vergleicht beim App-Start mit dem letzten Stand. Verschwinden Einträge oder
 * verlieren viele Einträge auf einmal Felder (Wipe-Signatur: Seed-Einträge sind viel
 * "ärmer" als admin-gepflegte), geht eine Alarm-Mail an notify_to raus.
 *
 * Der letzte Wipe blieb 8 Tage unbemerkt — dieser Check macht daraus Minuten.
 */

const DATA_DIR = path.join(process.cwd(), 'data');
const STATS_PATH = path.join(DATA_DIR, 'backups', '.content-stats.json');

/** id-basiert verglichene Dateien. faqs.json bewusst nur per Gesamtzahl (FAQ-Saves regenerieren ids). */
const ID_FILES = ['events.json', 'series.json', 'packages.json', 'pins.json', 'pin-icons.json'];
const COUNT_FILES = ['faqs.json', 'category-seo.json'];

/** Ab wie vielen verlorenen Feldern ein Eintrag als "ausgedünnt" gilt. */
const FIELD_LOSS_PER_ENTRY = 3;
/** Ab wie vielen ausgedünnten Einträgen (je Datei) alarmiert wird. */
const THINNED_ALARM_COUNT = 3;
/** Relative Schrumpfung der Eintragszahl, ab der COUNT_FILES alarmieren. */
const COUNT_SHRINK_RATIO = 0.8;

interface FileStats {
  count: number;
  /** nur für ID_FILES: id → Anzahl Felder */
  entries?: Record<string, number>;
}
type Stats = Record<string, FileStats>;

function computeStats(): Stats {
  const stats: Stats = {};
  for (const file of [...ID_FILES, ...COUNT_FILES]) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'));
      if (Array.isArray(raw)) {
        const s: FileStats = { count: raw.length };
        if (ID_FILES.includes(file)) {
          s.entries = {};
          for (const item of raw) {
            if (item && typeof item === 'object' && item.id) s.entries[String(item.id)] = Object.keys(item).length;
          }
        }
        stats[file] = s;
      } else if (raw && typeof raw === 'object') {
        stats[file] = { count: Object.keys(raw).length };
      }
    } catch {
      // fehlend/unlesbar → taucht nicht in den Stats auf; der Vergleich meldet das
    }
  }
  return stats;
}

export interface DriftResult {
  checked: boolean;
  alarms: string[];
}

/**
 * Vergleicht den aktuellen Content-Bestand mit dem letzten gespeicherten Stand.
 * Schreibt danach IMMER den aktuellen Stand (ein Alarm feuert einmal, nicht dauerhaft).
 */
export async function runContentDriftCheck(): Promise<DriftResult> {
  const current = computeStats();
  let previous: Stats | null = null;
  try {
    previous = JSON.parse(fs.readFileSync(STATS_PATH, 'utf-8')) as Stats;
  } catch {
    previous = null;
  }

  const alarms: string[] = [];
  if (previous) {
    for (const [file, prev] of Object.entries(previous)) {
      const cur = current[file];
      if (!cur) {
        alarms.push(`${file}: Datei fehlt oder ist unlesbar (vorher ${prev.count} Einträge).`);
        continue;
      }
      if (prev.entries && cur.entries) {
        const lost = Object.keys(prev.entries).filter((id) => !(id in cur.entries!));
        if (lost.length > 0) {
          alarms.push(`${file}: ${lost.length} Einträge verschwunden (z.B. ${lost.slice(0, 5).join(', ')}).`);
        }
        const thinned = Object.entries(prev.entries)
          .filter(([id, keys]) => id in cur.entries! && keys - cur.entries![id] >= FIELD_LOSS_PER_ENTRY)
          .map(([id, keys]) => `${id} (${keys}→${cur.entries![id]} Felder)`);
        if (thinned.length >= THINNED_ALARM_COUNT) {
          alarms.push(
            `${file}: ${thinned.length} Einträge haben massiv Felder verloren (Wipe-Signatur!) — z.B. ${thinned.slice(0, 5).join(', ')}.`
          );
        }
      } else if (cur.count < prev.count * COUNT_SHRINK_RATIO) {
        alarms.push(`${file}: Eintragszahl von ${prev.count} auf ${cur.count} geschrumpft.`);
      }
    }
  }

  // Aktuellen Stand festhalten (auch beim ersten Lauf).
  try {
    fs.mkdirSync(path.dirname(STATS_PATH), { recursive: true });
    fs.writeFileSync(STATS_PATH, JSON.stringify(current, null, 2), 'utf-8');
  } catch (e) {
    console.error('[content-drift] Stats konnten nicht gespeichert werden:', e);
  }

  if (alarms.length > 0) {
    console.error('[content-drift] ⚠️ ALARM:\n  ' + alarms.join('\n  '));
    try {
      const { sendGraphMail, getNotifyTo, isGraphConfigured } = await import('./graphMailer');
      if (isGraphConfigured()) {
        const items = alarms.map((a) => `<li style="margin:0 0 8px;">${a.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('');
        await sendGraphMail({
          to: getNotifyTo(),
          subject: `⚠️ Content-Drift-Alarm — möglicher Datenverlust in data/*.json`,
          html: `<p>Beim App-Start wurde verdächtiger Content-Schwund festgestellt:</p><ul>${items}</ul>
<p>Wiederherstellen: <code>/api/admin/content-history</code> (Snapshot-Historie) bzw. <code>data/backups/</code> auf dem Server
(Start-Backups <code>content-json-*.tar.gz</code>, ersetzte Einträge unter <code>replaced/</code>).</p>
<p>Hintergrund: Vorfall vom 01.07.2026 (TASK-00104) — dieser Alarm existiert, damit so etwas nie wieder tagelang unbemerkt bleibt.</p>`,
        });
      }
    } catch (e) {
      console.error('[content-drift] Alarm-Mail fehlgeschlagen:', e);
    }
  }

  return { checked: previous !== null, alarms };
}
