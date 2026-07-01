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
# ─────────────────────────────────────────────────────────────────────────────

SEED_DIR="/app/data-seed"
DATA_DIR="/app/data"

mkdir -p "$DATA_DIR" 2>/dev/null

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

let failed = false;

for (const f of FILES) {
  const sp = join(SEED_DIR, f);
  const dp = join(DATA_DIR, f);
  try {
    if (!existsSync(sp)) continue;
    if (!existsSync(dp)) {
      copyFileSync(sp, dp);
      console.log(`[seed]   + ${f} (neu angelegt)`);
      continue;
    }
    const seed = JSON.parse(readFileSync(sp, 'utf8'));
    const data = JSON.parse(readFileSync(dp, 'utf8'));
    let added = 0;
    if (Array.isArray(seed) && Array.isArray(data)) {
      const ids = new Set(data.map((x) => x && x.id).filter(Boolean));
      for (const item of seed) {
        if (item && item.id && !ids.has(item.id)) { data.push(item); ids.add(item.id); added++; }
      }
    } else if (seed && data && typeof seed === 'object' && typeof data === 'object' && !Array.isArray(seed) && !Array.isArray(data)) {
      for (const k of Object.keys(seed)) {
        if (!(k in data)) { data[k] = seed[k]; added++; }
      }
    } else {
      console.log(`[seed]   ~ ${f}: Struktur weicht ab – uebersprungen`);
      continue;
    }
    if (added > 0) {
      writeFileSync(dp, JSON.stringify(data, null, 2) + '\n');
      console.log(`[seed]   + ${f}: ${added} neue Eintraege ergaenzt (bestehende unangetastet)`);
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

  if SEED_DIR="$SEED_DIR" DATA_DIR="$DATA_DIR" node /tmp/ft-seed-merge.mjs; then
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
