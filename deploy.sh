#!/bin/bash
# Wird vom self-hosted GitHub-Actions-Runner (docker-prod-01 = LXC 5003) ausgeführt.
#
# Seit 21.08.2026 läuft next.faltintravel.com als Managed Application auf dem
# Kunden-LXC von Faltin Travel (web-faltin-travel), verwaltet über
# offers.nerdag.ch. Der Runner baut nicht mehr selbst: er holt main, packt
# Repo + .env (liegt nur hier) und schickt das Paket an die Deploy-API.
# Dort wird gebaut, geprüft, bei Fehlern zurückgerollt.
#
# /opt/super-bowl/.site.env:
#   NERDAG_SITE_TOKEN=nsk_…             Token der Website
#   SITE_PORT=8084                      vom Tool zugewiesener Port
#   NERDAG_SITE_URL=http://127.0.0.1:8110  intern (kein NAT-Hairpin)
set -euo pipefail
cd /opt/super-bowl

echo "==> Hole neuesten Stand von origin/main"
if [ -n "${GITHUB_TOKEN:-}" ]; then
  git fetch --prune "https://x-access-token:${GITHUB_TOKEN}@github.com/nlappenbusch/ft-super-bowl.git" main
else
  git fetch --prune origin main
fi
git reset --hard FETCH_HEAD

# shellcheck disable=SC1091
. ./.site.env
: "${NERDAG_SITE_TOKEN:?NERDAG_SITE_TOKEN fehlt in .site.env}"
: "${SITE_PORT:?SITE_PORT fehlt in .site.env}"
API="${NERDAG_SITE_URL:-https://offers.nerdag.ch}"

echo "==> Packe Paket (Port ${SITE_PORT}, Datenbankport 5432 fürs Backup)"
PAKET=$(mktemp -d)
trap 'rm -rf "$PAKET" /tmp/next-deploy.tgz' EXIT
tar cf - --exclude=.git --exclude=node_modules --exclude=.next --exclude='*.pdf' --exclude='.claude' \
  --exclude='actions-runner-*' --exclude='*.tar.gz' --exclude='data' . | tar xf - -C "$PAKET"
# Das Daten-Verzeichnis (SQLite, Uploads, Einstellungen) lebt auf dem Zielserver
# und wird beim Deploy NICHT ersetzt - es liegt dort als ./data.
python3 - "$PAKET/docker-compose.yml" "$SITE_PORT" <<'PY'
import re, sys
p, port = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf-8').read()
s = re.sub(r'^\s*container_name:.*\n', '', s, flags=re.M)
s = s.replace('"8085:3000"', '"%s:3000"' % port)
s = re.sub(r'\n\s*- /opt/databasus/wal-queue:/opt/databasus/wal-queue', '', s)
s = re.sub(r'    command:\n(?:      - .*\n)+', '', s)
if '"5432:5432"' not in s:
    s = s.replace('    environment:\n      - POSTGRES_USER=faltin', '    ports:\n      - "5432:5432"\n    environment:\n      - POSTGRES_USER=faltin')
# Daten (SQLite, Uploads, Einstellungen) liegen in einem benannten Volume,
# das Deploys ueberlebt - ein Bind-Mount im Projektordner wuerde bei jedem
# Deploy ersetzt (so geschehen am 21.08.2026).
s = s.replace('- ./data:/app/data', '- appdaten:/app/data')
if '\n  appdaten:' not in s:
    s = s.rstrip('\n') + '\n  appdaten:\n'
open(p, 'w', encoding='utf-8').write(s)
PY
tar czf /tmp/next-deploy.tgz -C "$PAKET" .

echo "==> Deploy über ${API}"
ANTWORT=$(curl -sS -m 1500 -X POST -H "Authorization: Bearer ${NERDAG_SITE_TOKEN}" \
  -H "Content-Type: application/gzip" --data-binary @/tmp/next-deploy.tgz "${API}/api/site/deploy")
echo "$ANTWORT" | python3 -c '
import json,sys
r=json.load(sys.stdin)
if not r.get("erfolg"):
    print("DEPLOY FEHLGESCHLAGEN:", r.get("fehler")); print(r.get("logs") or r.get("ausgabe") or ""); sys.exit(1)
print("OK in %ss, Dienste %s, HTTP %s" % (r.get("dauer_s"), ",".join(r.get("dienste") or []), r.get("http")))'
echo "==> Deployed: $(git log -1 --oneline)"
