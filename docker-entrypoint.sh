#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Content-Seed beim Container-Start.
# Kopiert die mitgelieferten Inhalte (data-seed/) ins persistente Volume (/app/data)
# – aber NUR wenn sich die Seed-Version geändert hat. Dadurch:
#   * landet beim Deploy der neue Content automatisch im Volume,
#   * bleiben spätere Admin-Bearbeitungen auf dem Server erhalten (kein Überschreiben
#     bei gleicher Version),
#   * werden bookings.db und settings.json NIE angefasst (nicht Teil des Seeds).
# Neuen Content ausrollen: data-seed/ aktualisieren UND SEED_VERSION hochzählen.
# ─────────────────────────────────────────────────────────────────────────────
set -e

SEED_DIR="/app/data-seed"
DATA_DIR="/app/data"
CONTENT_FILES="events.json series.json category-seo.json packages.json faqs.json pins.json pin-icons.json"

mkdir -p "$DATA_DIR"

WANT="$(cat "$SEED_DIR/SEED_VERSION" 2>/dev/null || echo '')"
HAVE="$(cat "$DATA_DIR/.seed_version" 2>/dev/null || echo '')"

if [ -n "$WANT" ] && [ "$WANT" != "$HAVE" ]; then
  echo "[seed] Content-Seed v$WANT (vorher: '${HAVE:-keine}') wird ausgerollt..."
  for f in $CONTENT_FILES; do
    if [ -f "$SEED_DIR/$f" ]; then
      cp -f "$SEED_DIR/$f" "$DATA_DIR/$f"
      echo "[seed]   -> $f"
    fi
  done
  echo "$WANT" > "$DATA_DIR/.seed_version"
  echo "[seed] Fertig. bookings.db und settings.json wurden NICHT angefasst."
else
  echo "[seed] Content-Seed aktuell (v${HAVE:-none}), kein Überschreiben."
fi

exec "$@"
