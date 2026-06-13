#!/usr/bin/env bash
#
# Installiert die FT 502-Wartungsseite in Nginx Proxy Manager.
# Auf der NPM-VM ausführen (braucht Docker-Rechte, ggf. sudo):
#
#   sudo ./install-502-page.sh              # erwartet 502.html im selben Ordner
#   sudo ./install-502-page.sh /pfad/zu/502.html
#
# Macht:
#   1. Backup aller Dateien, die angefasst werden
#   2. 502.html  -> <npm-data>/error-pages/502.html
#   3. error_page-Snippet -> <npm-data>/nginx/custom/server_proxy.conf
#      (gilt fuer ALLE Proxy Hosts; Marker-Block, mehrfach ausfuehrbar)
#   4. nginx -t im Container; bei Fehler: automatisches Rollback
#
set -euo pipefail

die() { echo "FEHLER: $*" >&2; exit 1; }

SRC="${1:-$(cd "$(dirname "$0")" && pwd)/502.html}"
[ -f "$SRC" ] || die "502.html nicht gefunden: $SRC"

# ── NPM-Container finden ────────────────────────────────────────────
CID="${NPM_CONTAINER:-}"
if [ -z "$CID" ]; then
  CID=$(docker ps --format '{{.ID}} {{.Image}}' | grep -i 'nginx-proxy-manager' | awk 'NR==1{print $1}' || true)
fi
[ -n "$CID" ] || die "Kein laufender nginx-proxy-manager Container gefunden. (Override: NPM_CONTAINER=<name> $0)"
CNAME=$(docker inspect "$CID" --format '{{.Name}}' | sed 's|^/||')
echo "==> NPM-Container: $CNAME ($CID)"

# ── /data-Volume auf dem Host finden ────────────────────────────────
DATA=$(docker inspect "$CID" --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Source}}{{end}}{{end}}')
[ -n "$DATA" ] && [ -d "$DATA" ] || die "Konnte das /data-Volume nicht ermitteln."
echo "==> NPM-Datenverzeichnis: $DATA"

PAGES_DIR="$DATA/error-pages"
CUSTOM_DIR="$DATA/nginx/custom"
CONF="$CUSTOM_DIR/server_proxy.conf"
M_START="# >>> ft-502-page >>>"
M_END="# <<< ft-502-page <<<"

# ── 1. Backup ───────────────────────────────────────────────────────
BK="$DATA/backup-ft502-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BK"
[ -f "$PAGES_DIR/502.html" ] && cp -a "$PAGES_DIR/502.html" "$BK/502.html"
[ -f "$CONF" ] && cp -a "$CONF" "$BK/server_proxy.conf"
echo "==> Backup unter: $BK"

rollback() {
  echo "!! nginx-Test fehlgeschlagen – stelle Backup wieder her..." >&2
  if [ -f "$BK/server_proxy.conf" ]; then cp -a "$BK/server_proxy.conf" "$CONF"; else rm -f "$CONF"; fi
  if [ -f "$BK/502.html" ]; then cp -a "$BK/502.html" "$PAGES_DIR/502.html"; fi
  docker exec "$CID" nginx -s reload >/dev/null 2>&1 || true
  die "Rollback durchgefuehrt, nichts veraendert. nginx-Fehler siehe oben."
}

# ── 2. 502.html installieren ────────────────────────────────────────
mkdir -p "$PAGES_DIR"
cp "$SRC" "$PAGES_DIR/502.html"
chmod 644 "$PAGES_DIR/502.html"
echo "==> installiert: $PAGES_DIR/502.html"

# ── 3. Snippet in server_proxy.conf (Marker-Block ersetzen/anhaengen) ─
mkdir -p "$CUSTOM_DIR"
TMP=$(mktemp)
if [ -f "$CONF" ]; then
  # vorhandenen ft-502-Block entfernen, Rest behalten
  awk -v s="$M_START" -v e="$M_END" '
    index($0,s){skip=1; next}
    index($0,e){skip=0; next}
    !skip{print}
  ' "$CONF" > "$TMP"
else
  : > "$TMP"
fi
cat >> "$TMP" <<EOF
$M_START
# FT-Wartungsseite bei 502/503/504 (z.B. waehrend Deployment)
proxy_intercept_errors on;
error_page 502 503 504 @ft_maintenance;
location @ft_maintenance {
    root /data/error-pages;
    rewrite ^ /502.html break;
    add_header Cache-Control "no-store" always;
}
$M_END
EOF
mv "$TMP" "$CONF"
chmod 644 "$CONF"
echo "==> Snippet geschrieben: $CONF"

# ── 4. Testen & laden ───────────────────────────────────────────────
docker exec "$CID" nginx -t || rollback
docker exec "$CID" nginx -s reload
echo ""
echo "✔ Fertig. Gilt fuer ALLE Proxy Hosts dieses NPM."
echo "  Test: App-Container stoppen und Domain aufrufen."
echo "  Entfernen: Block zwischen den ft-502-Markern aus $CONF loeschen + reload,"
echo "  oder Backup zurueckspiele