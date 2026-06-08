# Deployment – Faltin Travel Events (Docker + persistentes Volume)

Diese Anleitung bringt die App **inklusive aller Inhalte** (Events, Serien, Kategorien,
Module, Packages, FAQs, Pins, Mail-Settings) live – und zwar so, dass der **Admin-Bereich
weiterhin live editierbar** bleibt.

## Wie die Persistenz funktioniert

Alle Inhalte liegen als Dateien im Ordner **`data/`**:

| Datei | Inhalt |
|---|---|
| `events.json` | Events + alle Modul-Inhalte |
| `series.json` | Serien / Hubs |
| `category-seo.json` | Kategorien-Texte |
| `packages.json` | Packages |
| `faqs.json` | Event-FAQs |
| `pins.json`, `pin-icons.json` | Lageplan-Pins |
| `settings.json` | Firma, Bank, Mail-Settings, Admin-Passwort |
| `bookings.db` | Buchungs-/Anfragen-Datenbank (SQLite) |

`docker-compose.yml` mountet diesen Ordner als Volume (`./data:/app/data`). Dadurch:
- liest die App beim Start die echten Inhalte,
- **schreiben Admin-Änderungen zurück auf die Server-Platte** (bleiben erhalten),
- überlebt der Inhalt Container-Neustarts und Updates.

> ⚠️ **`data/` ist bewusst NICHT im Git** (enthält u.a. das Admin-Passwort / Mail-Secrets).
> Der Ordner muss **einmalig** auf den Server kopiert werden (Schritt 3). Danach lebt er dort.

---

## Voraussetzungen (auf dem Server)

- Linux-Server / VPS (z.B. Hetzner, DigitalOcean) **oder** PaaS mit persistentem Volume (Railway, Render, Fly.io)
- **Docker** + **Docker Compose** installiert
- Eine (Sub-)Domain, z.B. `events.faltintravel.com`, die auf den Server zeigt
- Reverse Proxy mit TLS davor (nginx oder Caddy) – siehe Schritt 5

---

## Schritt 1 – Code committen & pushen (lokal)

Aktueller Stand muss auf GitHub:

```bash
git add -A
git commit -m "Deploy-Setup: Docker build-args, compose env, deploy docs"
git push origin feat/admin-redesign
```

(Optional: vorher nach `main` mergen, dann auf dem Server `main` auschecken.)

## Schritt 2 – Code auf den Server holen

```bash
ssh user@dein-server
git clone https://github.com/nlappenbusch/ft-super-bowl.git
cd ft-super-bowl
git checkout feat/admin-redesign
```

## Schritt 3 – Inhalte (`data/`) einmalig auf den Server kopieren

Vom **lokalen** Rechner aus (PowerShell / Terminal), im Projektordner:

```bash
# Variante A: scp (rekursiv)
scp -r ./data user@dein-server:/pfad/zu/ft-super-bowl/data

# Variante B: rsync (besser, überträgt nur Änderungen)
rsync -avz ./data/ user@dein-server:/pfad/zu/ft-super-bowl/data/
```

Danach liegt der komplette Inhalt auf dem Server. (Für spätere Content-Backups
genau diesen Ordner sichern – siehe unten.)

## Schritt 4 – `.env` auf dem Server anlegen

Im Projektordner auf dem Server eine Datei **`.env`** erstellen (wird von Compose
sowohl für Build-Args als auch zur Laufzeit gelesen). Vorlage:

```dotenv
# ── Build-Zeit (werden ins Client-JS eingebacken – bei Änderung NEU bauen!) ──
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=DEIN_GOOGLE_MAPS_KEY
NEXT_PUBLIC_ADMIN_PASSWORD=ein-sicheres-admin-passwort
NEXT_PUBLIC_SITE_URL=https://events.faltintravel.com
# Optional (nur falls Supabase genutzt wird):
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# ── Laufzeit-Secrets (Server-seitig, NICHT im Client) ──
# Microsoft 365 / Graph (Mail-Versand & Inbound). Alternativ im Admin-Mail-Panel pflegbar.
GRAPH_TENANT_ID=
GRAPH_CLIENT_ID=
GRAPH_CLIENT_SECRET=
GRAPH_MAILBOX=request@faltintravel.com
GRAPH_FROM_NAME=Faltin Travel

# Brevo (Marketing-Listen)
BREVO_API_KEY=

# Schutz-Token für den Inbound-Poll-Endpoint (/api/inbound/poll)
INBOUND_POLL_SECRET=ein-langes-zufalls-token

# Optional: Standard-Event/Package-Slugs
DEFAULT_EVENT_SLUG=
DEFAULT_PACKAGE_SLUG=
```

> Mail-Secrets kannst du **entweder** hier in die `.env` setzen **oder** später im
> Admin-Bereich unter *Mail-Einstellungen* eintragen (landet dann in `data/settings.json`
> auf dem Volume). Beides funktioniert.

## Schritt 5 – Bauen & starten

```bash
docker compose up -d --build
```

Die App läuft danach auf **Port 8085** des Servers (`http://SERVER_IP:8085`).
Status prüfen:

```bash
docker compose ps
docker compose logs -f super-bowl-app
```

## Schritt 6 – Reverse Proxy + HTTPS

Beispiel **Caddy** (`/etc/caddy/Caddyfile`) – kümmert sich automatisch um TLS:

```
events.faltintravel.com {
    reverse_proxy localhost:8085
}
```

Beispiel **nginx** (vereinfacht):

```nginx
server {
    server_name events.faltintravel.com;
    location / {
        proxy_pass http://localhost:8085;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
# TLS via certbot --nginx
```

Fertig – die Seite ist unter `https://events.faltintravel.com` live, der Admin unter `/admin`.

---

## Updates später einspielen

```bash
ssh user@dein-server
cd ft-super-bowl
git pull
docker compose up -d --build   # baut neu, data/ bleibt unangetastet
```

> Bei Änderung einer `NEXT_PUBLIC_*`-Variable IMMER neu bauen (`--build`), da diese
> zur Build-Zeit fest eingebacken werden.

## Content-Backups

Nur der `data/`-Ordner enthält veränderliche Inhalte. Regelmäßig sichern:

```bash
tar czf backup-data-$(date +%F).tgz data/
```

(Für die SQLite-DB ist im WAL-Modus der laufende Betrieb okay; für ein konsistentes
Backup ggf. kurz `docker compose stop` davor.)

---

## Mehrere / andere Domains

Die App ist **domain-agnostisch**. Alle eigenen Canonical-/SEO-/OG-/Sitemap-/JSON-LD-URLs
leiten sich aus **`NEXT_PUBLIC_SITE_URL`** ab (zentral in `src/lib/siteConfig.ts`).

- Pro Deployment einfach `NEXT_PUBLIC_SITE_URL` setzen, z.B.
  - `https://superbowl.faltintravel.com`
  - `https://frenchopen.faltintravel.com`
  - oder eine ganz fremde Domain.
- Da es eine `NEXT_PUBLIC_*`-Variable ist, wird sie zur **Build-Zeit** eingebacken →
  bei Domainwechsel **neu bauen** (`docker compose up -d --build`).
- Externe Links zur Hauptseite (NavBar „Home/Über uns/Kontakt", Footer, Social) zeigen
  bewusst weiter auf `faltintravel.com` (das ist die Marketing-WordPress-Seite, nicht die App-Domain).

> Optional, falls die App unter einer neuen Domain in WordPress **eingebettet** wird:
> In `next.config.ts` ist die CORS-`Access-Control-Allow-Origin` für `/api/*` fest auf
> `https://faltintravel.com` gesetzt. Bei Embedding von einer anderen Origin dort anpassen.

## Sicherheits-Hinweise

- **`NEXT_PUBLIC_ADMIN_PASSWORD`** ist im Client-JS sichtbar (Design der aktuellen
  `AdminGate`). Es schützt nur oberflächlich. Für echten Schutz sollte der Admin
  zusätzlich auf Server-Ebene (Basic-Auth im Reverse Proxy oder IP-Whitelist) abgesichert
  werden. Empfehlung: lege z.B. eine Caddy/nginx Basic-Auth über `/admin`.
- **`.env`** und **`data/`** niemals ins Git committen (beide sind in `.gitignore`).
- Mail-Secrets (Graph/Brevo) gehören in `.env` **oder** ins Admin-Panel – nie ins Repo.
