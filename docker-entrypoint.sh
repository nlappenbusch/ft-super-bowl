#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Content-Seed beim Container-Start.
# Kopiert die mitgelieferten Inhalte (data-seed/) ins persistente Volume (/app/data)
# – aber NUR wenn sich die Seed-Version geändert hat. Dadurch:
#   * landet beim Deploy der neue Content automatisch im Volume,
#   * bleiben spätere Admin-Bearbeitungen auf dem Server erhalten (kein Überschreiben
#     bei gleicher Version),
#   * werden bookings.db und settings.json NIE angefasst (nicht Teil des Seeds).
# WICHTIG: Der Seed ist "best effort" – schlägt er fehl (z.B. Rechte), startet die App
# trotzdem (kein set -e ums Kopieren), damit nie ein 502-Crash-Loop entsteht.
# Neuen Content ausrollen: data-seed/ aktualisieren UND SEED_VERSION hochzählen.
# ─────────────────────────────────────────────────────────────────────────────

SEED_DIR="/app/data-seed"
DATA_DIR="/app/data"
CONTENT_FILES="events.json series.json category-seo.json packages.json faqs.json pins.json pin-icons.json"

mkdir -p "$DATA_DIR" 2>/dev/null

WANT="$(cat "$SEED_DIR/SEED_VERSION" 2>/dev/null || echo '')"
HAVE="$(cat "$DATA_DIR/.seed_version" 2>/dev/null || echo '')"

if [ -n "$WANT" ] && [ "$WANT" != "$HAVE" ]; then
  echo "[seed] Content-Seed v$WANT (vorher: '${HAVE:-keine}') wird ausgerollt..."
  seed_failed=0
  for f in $CONTENT_FILES; do
    if [ -f "$SEED_DIR/$f" ]; then
      if cp -f "$SEED_DIR/$f" "$DATA_DIR/$f" 2>/dev/null; then
        echo "[seed]   -> $f"
      else
        echo "[seed]   !! konnte $f NICHT schreiben (Rechte auf $DATA_DIR?)"
        seed_failed=1
      fi
    fi
  done
  if [ "$seed_failed" -eq 0 ]; then
    echo "$WANT" > "$DATA_DIR/.seed_version" 2>/dev/null || true
    echo "[seed] Fertig. bookings.db und settings.json wurden NICHT angefasst."
  else
    echo "[seed] WARNUNG: Seed unvollständig – App startet trotzdem. Tipp: chown -R 1001:1001 $DATA_DIR auf dem Host."
  fi
else
  echo "[seed] Content-Seed aktuell (v${HAVE:-none}), kein Überschreiben."
fi

exec "$@"
