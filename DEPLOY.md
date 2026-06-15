# Deployment – Faltin Travel Events

Die App läuft als Docker-Container auf eurem self-hosted Server (`/opt/super-bowl`).
Deployt wird **automatisch per GitHub Actions** bei jedem Push auf `main`.

## Auto-Deploy (so läuft es)

1. Push auf `main` → GitHub Actions (`.github/workflows/deploy.yml`) startet auf dem
   self-hosted Runner `docker-prod-01`.
2. Der Runner führt `/opt/super-bowl/deploy.sh` aus:
   - `git reset --hard origin/main` (holt den neuen Code)
   - `docker compose down && docker compose up -d --build` (baut & startet neu)
   - Health-Check auf Port **8085**
3. Beim Container-Start rollt `docker-entrypoint.sh` die Inhalte aus (siehe unten).

➡️ **Zum Live-gehen reicht: nach `main` pushen.** Kein manuelles Kopieren nötig.

## Wie Inhalte auf den Server kommen (Auto-Seed)

Die Website-Inhalte (Events, Serien, Kategorien, Packages, FAQs, Pins) liegen als
Seed im Repo unter **`data-seed/`** und werden beim Containerstart ins persistente
Volume `data/` kopiert – aber **nur wenn sich `data-seed/SEED_VERSION` geändert hat**.

Daraus folgt:
- **Neuer Content geht beim Deploy automatisch live** (sobald SEED_VERSION hochgezählt wurde).
- **Admin-Bearbeitungen auf dem Server bleiben erhalten** – bei gleicher SEED_VERSION wird
  nichts überschrieben.
- **`bookings.db` (echte Anfragen) und `settings.json` werden NIE angefasst** (nicht Teil des Seeds).

### Neuen lokalen Content ausrollen

Wenn du lokal Inhalte geändert hast und sie live bringen willst:

```powershell
# 1. Aktuelle Inhalte in den Seed übernehmen
cd F:\super-bowl\ft-super-bowl
Copy-Item data\events.json,data\series.json,data\category-seo.json,data\packages.json,data\faqs.json,data\pins.json,data\pin-icons.json data-seed\ -Force
# 2. SEED_VERSION hochzählen (z.B. Datum-Index)
"2026-06-08-2" | Out-File data-seed\SEED_VERSION -Encoding ascii -NoNewline
# 3. committen & pushen
git add data-seed; git commit -m "content: update seed"; git push origin main
```

> ⚠️ Beim Hochzählen der SEED_VERSION werden die Content-Dateien im Volume **überschrieben**.
> Falls zwischenzeitlich direkt im Server-Admin editiert wurde, gehen diese Änderungen für
> die geseedeten Dateien verloren. Faustregel: Content entweder **lokal** pflegen (dann seeden)
> **oder** im Server-Admin (dann SEED_VERSION in Ruhe lassen) – nicht vermischen.

## Umgebungsvariablen (`.env`, optional)

Die `docker-compose.yml` nutzt `${VAR:-default}` – die App startet **auch ohne `.env`**.
Für echte Werte (Google-Maps-Key, Mail-Secrets, andere Domain) eine Datei
`/opt/super-bowl/.env` anlegen:

```dotenv
# Build-Zeit (ins Client-JS eingebacken – bei Änderung neu deployen)
NEXT_PUBLIC_SITE_URL=https://superbowl.faltintravel.com
NEXT_PUBLIC_ADMIN_PASSWORD=faltin-admin-2025
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=DEIN_GOOGLE_MAPS_KEY
NEXT_PUBLIC_SITE_NAME=Faltin Travel Sports Events

# Laufzeit (Server-seitig) – Mail optional, sonst im Admin-Panel pflegbar
AUTH_SECRET=ein-langes-zufaelliges-geheimnis
GRAPH_TENANT_ID=
GRAPH_CLIENT_ID=
GRAPH_CLIENT_SECRET=
GRAPH_MAILBOX=request@faltintravel.com
GRAPH_FROM_NAME=Faltin Travel
BREVO_API_KEY=
INBOUND_POLL_SECRET=ein-langes-zufalls-token
```

**Defaults ohne `.env`:** Domain = `superbowl.faltintravel.com`, Admin-PW = `faltin-admin-2025`,
**Google-Maps-Key leer** → die interaktive Lageplan-Karte bleibt leer, bis der Key gesetzt ist.

## Andere/mehrere Domains

Komplett domain-agnostisch: alle eigenen Canonical-/SEO-/OG-/Sitemap-/JSON-LD-URLs
kommen aus `NEXT_PUBLIC_SITE_URL` (`src/lib/siteConfig.ts`). Für eine andere Domain
einfach diese Variable in der `.env` setzen und neu deployen (Build-Zeit-Variable!).
Externe Links (NavBar „Home/Über uns", Footer, Social) zeigen bewusst weiter auf die
WordPress-Hauptseite `faltintravel.com`.

> Falls die App unter einer fremden Domain in WordPress **eingebettet** wird: in
> `next.config.ts` ist CORS `Access-Control-Allow-Origin` für `/api/*` auf
> `https://faltintravel.com` gesetzt – dort ggf. anpassen.

## Backups

Sichern reicht der `data/`-Ordner auf dem Server (enthält `bookings.db` + ggf.
server-seitig editierten Content + `settings.json`):

```bash
cd /opt/super-bowl
tar czf backup-data-$(date +%F).tgz data/
```

## Sicherheit

- `data-seed/` enthält **nur öffentlichen Website-Content** – keine Secrets.
- `settings.json` (mit Admin-PW/Mail-Secrets) und `.env` bleiben aus dem Git heraus.
- `NEXT_PUBLIC_ADMIN_PASSWORD` ist im Client-JS sichtbar (Design der `AdminGate`).
  Für echten Schutz `/admin` zusätzlich serverseitig absichern (Basic-Auth im Reverse
  Proxy oder IP-Whitelist).
