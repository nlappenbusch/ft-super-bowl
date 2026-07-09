#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Content-Seed beim Container-Start – ADDITIV (Merge nach id), nicht überschreibend.
# Rollt neue Inhalte aus data-seed/ ins persistente Volume (/app/data) – aber NUR
# wenn sich die Seed-Version geändert hat, und dann NUR die Einträge, die im Volume
# noch fehlen (nach `id` bzw. Objekt-Key). Dadurch:
#   * landet beim Deploy NEUER Content automatisch im Volume,
#   * bleiben ALLE bestehenden Einträge samt Admin-Bearbeitungen unangetastet
#     (kein Voll-Überschreiben mehr – wichtig für live gepflegten Content),
#   * werden bookings.db und settings.json NIE angefasst (nicht Teil des Seeds).
# "best effort": schlägt der Seed fehl, startet die App trotzdem (kein Crash-Loop).
# Neuen Content ausrollen: data-seed/ ergänzen UND SEED_VERSION hochzählen.
# Bestehende Einträge gezielt AKTUALISIEREN: id in data-seed/SEED_REPLACE_IDS
# eintragen (eine pro Zeile, # = Kommentar) UND SEED_VERSION hochzählen — nur
# diese Einträge werden im Volume ersetzt (Admin-Änderungen daran gehen verloren).
# ─────────────────────────────────────────────────────────────────────────────

SEED_DIR="/app/data-seed"
DATA_DIR="/app/data"

mkdir -p "$DATA_DIR" 2>/dev/null

# ─────────────────────────────────────────────────────────────────────────────
# Sicherheitsnetz (seit Vorfall 2026-07-09, Volume-Reset auf Seed-Stand):
# Bei JEDEM Container-Start werden die Content-JSONs des Volumes nach
# data/backups/ weggesichert, BEVOR der Seed-Merge irgendetwas anfasst.
# Rotation: die letzten 60 Stände bleiben liegen (~wenige MB).
# Wiederherstellen: tar xzf data/backups/content-json-<ts>.tar.gz -C data/
# ─────────────────────────────────────────────────────────────────────────────
BK_DIR="$DATA_DIR/backups"
mkdir -p "$BK_DIR" 2>/dev/null
JSON_FILES="$(cd "$DATA_DIR" 2>/dev/null && ls ./*.json 2>/dev/null)"
if [ -n "$JSON_FILES" ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  if tar czf "$BK_DIR/content-json-$TS.tar.gz" -C "$DATA_DIR" $JSON_FILES 2>/dev/null; then
    echo "[backup] Content-JSONs gesichert: backups/content-json-$TS.tar.gz"
    ls -t "$BK_DIR"/content-json-*.tar.gz 2>/dev/null | tail -n +61 | xargs rm -f 2>/dev/null || true
  else
    echo "[backup] WARNUNG: Sicherung der Content-JSONs fehlgeschlagen (Rechte?)."
  fi
else
  echo "[backup] Keine Content-JSONs im Volume gefunden — nichts zu sichern (Erstinstallation?)."
fi

WANT="$(cat "$SEED_DIR/SEED_VERSION" 2>/dev/null || echo '')"
HAVE="$(cat "$DATA_DIR/.seed_version" 2>/dev/null || echo '')"

if [ -n "$WANT" ] && [ "$WANT" != "$HAVE" ]; then
  echo "[seed] Additiver Content-Seed v$WANT (vorher: '${HAVE:-keine}')..."

  cat > /tmp/ft-seed-merge.mjs <<'MERGE_EOF'
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const SEED_DIR = process.env.SEED_DIR || '/app/data-seed';
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const FILES = ['events.json', 'series.json', 'category-seo.json', 'packages.json', 'faqs.json', 'pins.json', 'pin-icons.json'];

// Gezieltes Ersetzen bestehender Einträge: ids aus SEED_REPLACE_IDS (optional).
const REPLACE_IDS = (() => {
  try {
    return new Set(
      readFileSync(join(SEED_DIR, 'SEED_REPLACE_IDS'), 'utf8')
        .split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))
    );
  } catch { return new Set(); }
})();

let failed = false;

for (const f of FILES) {
  const sp = join(SEED_DIR, f);
  const dp = join(DATA_DIR, f);
  try {
    if (!existsSync(sp)) continue;
    if (!existsSync(dp)) {
      copyFileSync(sp, dp);
      if (process.env.SEED_HAVE) {
        // Datei weg, obwohl frueher schon geseedet wurde: das ist die Signatur
        // des Vorfalls vom 2026-07-09 (Volume-Reset) — laut melden statt still kopieren.
        console.warn(`[seed]   !! ${f} FEHLTE im Volume trotz vorherigem Seed (v${process.env.SEED_HAVE}) — Voll-Kopie aus dem Seed. Admin-Stand ggf. verloren, data/backups/ pruefen!`);
      } else {
        console.log(`[seed]   + ${f} (neu angelegt)`);
      }
      continue;
    }
    const seed = JSON.parse(readFileSync(sp, 'utf8'));
    const data = JSON.parse(readFileSync(dp, 'utf8'));
    let added = 0;
    let replaced = 0;
    if (Array.isArray(seed) && Array.isArray(data)) {
      const ids = new Set(data.map((x) => x && x.id).filter(Boolean));
      for (const item of seed) {
        if (!item || !item.id) continue;
        if (!ids.has(item.id)) { data.push(item); ids.add(item.id); added++; }
        else if (REPLACE_IDS.has(item.id)) {
          const i = data.findIndex((x) => x && x.id === item.id);
          if (i >= 0) { data[i] = item; replaced++; }
        }
      }
    } else if (seed && data && typeof seed === 'object' && typeof data === 'object' && !Array.isArray(seed) && !Array.isArray(data)) {
      for (const k of Object.keys(seed)) {
        if (!(k in data)) { data[k] = seed[k]; added++; }
        else if (REPLACE_IDS.has(k)) { data[k] = seed[k]; replaced++; }
      }
    } else {
      console.log(`[seed]   ~ ${f}: Struktur weicht ab – uebersprungen`);
      continue;
    }
    if (added > 0 || replaced > 0) {
      writeFileSync(dp, JSON.stringify(data, null, 2) + '\n');
      console.log(`[seed]   + ${f}: ${added} neu, ${replaced} ersetzt (übrige unangetastet)`);
    } else {
      console.log(`[seed]   = ${f}: nichts Neues`);
    }
  } catch (e) {
    failed = true;
    console.error(`[seed]   !! ${f}: ${e.message}`);
  }
}

process.exit(failed ? 1 : 0);
MERGE_EOF

  if SEED_DIR="$SEED_DIR" DATA_DIR="$DATA_DIR" SEED_HAVE="$HAVE" node /tmp/ft-seed-merge.mjs; then
    echo "$WANT" > "$DATA_DIR/.seed_version" 2>/dev/null || true
    echo "[seed] Fertig. bookings.db und settings.json wurden NICHT angefasst."
  else
    echo "[seed] WARNUNG: Seed unvollstaendig – App startet trotzdem. Tipp: chown -R 1001:1001 $DATA_DIR auf dem Host."
  fi
  rm -f /tmp/ft-seed-merge.mjs 2>/dev/null || true
else
  echo "[seed] Content-Seed aktuell (v${HAVE:-none}), kein Merge noetig."
fi

exec "$@"
