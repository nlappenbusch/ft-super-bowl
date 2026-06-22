# 🚀 Quick Start: Deployment Pipeline Setup

## 1. Lokale Vorbereitung (Dein Windows PC)

### Git Repo auf GitHub pushen

```powershell
# Falls noch kein Repo: Auf GitHub neues Repo erstellen
# Dann lokal:
git init
git add .
git commit -m "Initial commit mit Deployment-Pipeline"
git remote add origin https://github.com/nlappenbusch/ft-super-bowl.git
git branch -M main
git push -u origin main
```

---

## 2. Server-Setup (Einmalig)

### SSH zum Docker-Server

```bash
ssh dein-user@docker-server-ip
```

### A) Runner installieren

```bash
# Ordner erstellen
sudo mkdir -p /opt/super-bowl
cd /opt/super-bowl

# GitHub Actions Runner downloaden
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64-2.311.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.311.0/actions-runner-linux-x64-2.311.0.tar.gz
tar xzf ./actions-runner-linux-x64-2.311.0.tar.gz

# Runner Token von GitHub holen:
# → Gehe zu GitHub Repo > Settings > Actions > Runners > New self-hosted runner
# → Kopiere den Token

# Runner konfigurieren
./config.sh \
  --url https://github.com/nlappenbusch/ft-super-bowl \
  --token DEIN-GITHUB-TOKEN \
  --name docker-prod-01 \
  --labels docker-prod-01

# Als Service installieren
sudo ./svc.sh install
sudo ./svc.sh start
```

### B) Repo clonen

```bash
cd /opt/super-bowl
sudo git clone https://github.com/nlappenbusch/ft-super-bowl.git .
```

### C) User-Rechte setzen

```bash
# actions user braucht Docker-Rechte
sudo usermod -aG docker actions

# Ordner-Rechte
sudo chown -R actions:actions /opt/super-bowl

# Git Safe Directory
sudo -u actions git config --global --add safe.directory /opt/super-bowl
```

### D) Deploy-Script vorbereiten

```bash
chmod +x /opt/super-bowl/deploy.sh

# Datenbank-Ordner erstellen
mkdir -p /opt/super-bowl/data
sudo chown actions:actions /opt/super-bowl/data
```

### E) Erster Test-Build

```bash
sudo -u actions /opt/super-bowl/deploy.sh
```

Wenn das durchläuft: **✅ Server ist bereit!**

---

## 3. NPM (Nginx Proxy Manager) konfigurieren

1. NPM öffnen: `http://npm-server-ip:81`
2. **Proxy Hosts** → **Add Proxy Host**
3. Eingeben:
   - **Domain Names:** `superbowl.deine-domain.de`
   - **Scheme:** `http`
   - **Forward Hostname / IP:** `DOCKER-SERVER-IP`
   - **Forward Port:** `8085`
   - **Cache Assets:** ON
   - **Block Common Exploits:** ON
4. **SSL** Tab:
   - **SSL Certificate:** Request a new SSL Certificate
   - **Force SSL:** ON
   - **Email:** deine@email.de
5. **Save**

---

## 4. Erster Deployment-Test

### Von deinem Windows PC:

```powershell
# Kleine Änderung machen (z.B. README.md editieren)
echo "Test" >> README.md

# Committen und pushen
git add .
git commit -m "Test: Deployment Pipeline"
git push
```

### Auf GitHub prüfen:

1. Gehe zu deinem Repo auf GitHub
2. **Actions** Tab öffnen
3. Du solltest sehen: Workflow "Deploy Super Bowl App" läuft
4. Klick drauf → Details sehen

### Auf Server prüfen:

```bash
# Runner Logs
journalctl -u actions.runner.* -n 50 --no-pager

# Container Status
docker ps

# App testen
curl -I http://127.0.0.1:8085
```

### Im Browser testen:

`https://superbowl.deine-domain.de`

**Wenn das funktioniert: 🎉 Pipeline läuft!**

---

## 5. Täglicher Workflow

Ab jetzt ist es super einfach:

```powershell
# Code ändern
# (z.B. src/components/BookingForm.tsx editieren)

# Committen
git add .
git commit -m "Buchungsformular verbessert"

# Pushen → Deployment startet automatisch!
git push
```

**Das war's!** GitHub Actions deployed automatisch.

---

## 6. Troubleshooting

### Deployment failed?

```bash
# Auf Server:
docker compose logs --tail=100

# Runner Logs:
journalctl -u actions.runner.* -n 100 --no-pager

# Manuell deployen:
sudo -u actions /opt/super-bowl/deploy.sh
```

### Container startet nicht?

```bash
# Build-Fehler sehen:
docker compose up --build

# Container entfernen und neu bauen:
docker compose down
docker compose up -d --build
```

### Datenbank weg?

```bash
# Ist im Volume gemountet: /opt/super-bowl/data/
ls -la /opt/super-bowl/data/

# Falls weg: Backup einspielen
cp /backup/bookings-DATUM.db /opt/super-bowl/data/bookings.db
sudo chown actions:actions /opt/super-bowl/data/bookings.db
```

---

## 7. Wichtige Befehle (Cheatsheet)

```bash
# Runner Status
systemctl status actions.runner.*

# Runner neu starten
sudo systemctl restart actions.runner.*

# Container Status
docker compose ps

# Container Logs live
docker compose logs -f

# Manuell deployen
sudo -u actions /opt/super-bowl/deploy.sh

# Datenbank-Backup
cp /opt/super-bowl/data/bookings.db /backup/bookings-$(date +%Y%m%d).db

# Container neu starten
docker compose restart

# Container stoppen
docker compose down

# Git Status
cd /opt/super-bowl && git log -1 --oneline
```

---

## 8. Nächste Schritte (Optional)

### A) Admin-Passwort sicherer machen

Aktuell hardcoded in `src/app/admin/page.tsx`. Besser:

1. In `docker-compose.yml` einfügen:
   ```yaml
   environment:
     - ADMIN_PASSWORD=dein-sicheres-passwort
   ```

2. In `src/app/admin/page.tsx` ändern:
   ```typescript
   if (password === process.env.ADMIN_PASSWORD)
   ```

### B) Automatische Backups einrichten

```bash
# Crontab bearbeiten
sudo crontab -e

# Zeile hinzufügen (täglich um 3 Uhr nachts):
0 3 * * * cp /opt/super-bowl/data/bookings.db /backup/bookings-$(date +\%Y\%m\%d).db
```

### C) Monitoring einrichten

```bash
# Uptime Kuma oder ähnliches einrichten
# Checkt alle 5min: https://superbowl.deine-domain.de
```

---

## 🎯 Du bist fertig!

Pipeline läuft = Du kannst ab jetzt einfach `git push` machen und die App wird automatisch deployed! 🚀
