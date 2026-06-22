# Super Bowl App – Deployment Pipeline Doku

## Ziel

Lokale Entwicklung auf dem PC, Code liegt zentral in GitHub, Deployment passiert automatisch auf einem internen Docker-Server.

**Trigger:** `git push` auf Branch `main`

**Resultat:** Container wird auf dem internen Server neu gebaut und neu gestartet.

---

## Architektur

**Komponenten**

1. **GitHub Repo**
   - Enthält Website-Content + Dockerfile + docker-compose.yml + GitHub Workflow
   
2. **Docker-Server (intern)**
   - Repo liegt unter: `/opt/super-bowl`
   - Deployment Script: `/opt/super-bowl/deploy.sh`
   - Docker Compose baut Image und recreated Container
   - Website ist intern erreichbar auf Port **8085** (`8085:3000`)
   - SQLite Datenbank wird via Volume gemountet: `./data:/app/data`

3. **GitHub Actions Self-hosted Runner (intern)**
   - Läuft als systemd service
   - Holt Jobs von GitHub ab (outbound), kein inbound SSH nötig
   - Führt Deploy Script lokal aus

4. **Nginx Proxy Manager (separate VM)**
   - Forward/Proxy von Domain → Docker-Server-IP:8085
   - TLS via Let's Encrypt

---

## Setup auf dem Docker-Server

### 1. Runner installieren (falls noch nicht vorhanden)

```bash
# Als root oder sudo
cd /opt
mkdir -p super-bowl
cd super-bowl

# GitHub Runner downloaden (Version anpassen!)
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Runner konfigurieren
./config.sh --url https://github.com/nlappenbusch/ft-super-bowl --token DEIN-TOKEN --labels docker-prod-01

# Als Service installieren
sudo ./svc.sh install
sudo ./svc.sh start
```

### 2. Repo clonen

```bash
cd /opt/super-bowl
git clone https://github.com/nlappenbusch/ft-super-bowl.git .
```

### 3. Deploy-Script ausführbar machen

```bash
chmod +x /opt/super-bowl/deploy.sh
```

### 4. Git Safe Directory

```bash
sudo -u actions git config --global --add safe.directory /opt/super-bowl
```

### 5. User-Rechte

```bash
# actions user muss Docker nutzen können
sudo usermod -aG docker actions

# Ordner-Rechte
sudo chown -R actions:actions /opt/super-bowl
```

### 6. Datenbank-Ordner erstellen

```bash
mkdir -p /opt/super-bowl/data
chmod 755 /opt/super-bowl/data
```

---

## Next.js für Production Build konfigurieren

**Wichtig:** Next.js braucht `output: 'standalone'` für Docker!

Die `next.config.ts` muss angepasst werden:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',  // Wichtig für Docker!
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
```

---

## Deployment Flow

1. Du änderst Dateien lokal (z.B. `src/components/...`)
2. Du commitest und pushst nach GitHub:
   ```powershell
   git add .
   git commit -m "Feature XYZ hinzugefügt"
   git push
   ```
3. GitHub Actions startet Workflow `Deploy`
4. Der interne self-hosted Runner nimmt den Job an
5. Runner führt `/opt/super-bowl/deploy.sh` aus:
   - `git fetch/reset` auf `origin/main`
   - `docker compose up -d --build`
6. Container wird aktualisiert, App läuft auf Port 8085

---

## Wichtige Befehle

### Status prüfen

```bash
# Runner Service Status
systemctl status 'actions.runner.nlappenbusch-ft-super-bowl.*.service'

# Container Status
docker compose ps

# Container Logs
docker compose logs -f

# Git Status
cd /opt/super-bowl && git log -1 --oneline
```

### Manuelles Deployment

```bash
cd /opt/super-bowl
./deploy.sh
```

### Container neu starten

```bash
docker compose restart
```

### Container stoppen

```bash
docker compose down
```

### Datenbank sichern

```bash
cp /opt/super-bowl/data/bookings.db /backup/bookings-$(date +%Y%m%d).db
```

---

## Troubleshooting

### Problem: "Build failed - better-sqlite3"

Better-sqlite3 braucht native Builds. Dockerfile hat bereits:
```dockerfile
RUN apk add --no-cache python3 make g++
```

### Problem: "Database locked"

SQLite kann nur eine schreibende Verbindung haben. Lösung:
- WAL-Mode aktivieren (bereits in database.ts)
- Busy Timeout erhöhen

### Problem: "Port 8085 not responding"

```bash
# Container läuft?
docker ps | grep super-bowl

# Firewall?
sudo ufw status

# Port-Mapping richtig?
docker compose ps
```

### Problem: "GitHub Actions hängt"

```bash
# Runner neu starten
sudo systemctl restart actions.runner.*
```

---

## NPM Forward Konfiguration

1. In NPM: **Proxy Hosts** → **Add Proxy Host**
2. **Domain Names:** `superbowl.deine-domain.de`
3. **Scheme:** `http`
4. **Forward Hostname / IP:** `DOCKER-SERVER-IP`
5. **Forward Port:** `8085`
6. **SSL:** Let's Encrypt aktivieren

---

## Backup-Strategie

### Datenbank-Backup (täglich)

```bash
# Crontab erstellen
crontab -e

# Zeile hinzufügen (jeden Tag um 3 Uhr nachts)
0 3 * * * cp /opt/super-bowl/data/bookings.db /backup/bookings-$(date +\%Y\%m\%d).db
```

### Git-Backup

Alles läuft über GitHub → Repo ist automatisch Backup

---

## Sicherheit

### Secrets NICHT committen!

`.gitignore` prüfen:
```
.env
.env.local
.env.production
*.db
data/
node_modules/
```

### Admin-Passwort ändern

**WICHTIG:** Aktuell ist das Admin-Passwort hardcoded in `src/app/admin/page.tsx`:

```typescript
if (password === 'super-bowl-2027-admin')
```

**TODO:** Auf Environment Variable umstellen:
```typescript
if (password === process.env.ADMIN_PASSWORD)
```

Dann in `docker-compose.yml`:
```yaml
environment:
  - ADMIN_PASSWORD=DEIN-SICHERES-PASSWORT
```

---

## Rollback

Falls ein Deployment schiefgeht:

```bash
# Auf Server
cd /opt/super-bowl
git log --oneline -10  # Letzten funktionierenden Commit finden
git reset --hard COMMIT-HASH
./deploy.sh
```

Oder auf lokalem PC:
```powershell
git revert HEAD
git push
# → Pipeline deployed automatisch den Revert
```

---

## Monitoring

### Container läuft?

```bash
watch -n 5 'docker compose ps'
```

### App erreichbar?

```bash
watch -n 30 'curl -I http://127.0.0.1:8085'
```

### Logs live verfolgen

```bash
docker compose logs -f --tail=100
```

---

## Cheatsheet

```bash
# Deployment Status
systemctl status actions.runner.*
docker compose ps
curl -I http://127.0.0.1:8085

# Manuell deployen
cd /opt/super-bowl && ./deploy.sh

# Container neu bauen
docker compose down && docker compose up -d --build

# Datenbank-Backup
cp data/bookings.db backup/bookings-$(date +%Y%m%d).db

# Logs
docker compose logs -f
journalctl -u actions.runner.* -f
```
