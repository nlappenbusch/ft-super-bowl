# Databasus PostgreSQL-Backup — Runbook (Agent-Modus, PITR, Hetzner)

> Ziel: physische Backups + WAL-Archivierung + **Point-in-Time-Recovery** für die Prod-Postgres
> (`super-bowl-db`), off-site auf eine **Hetzner Storage Box** (SFTP), professionell gehärtet.

## Architektur
- **Control-Plane:** `databasus`-Container auf dem Docker-Host, nur `127.0.0.1:4005` (Zugriff per SSH-Tunnel).
- **Agent:** läuft auf dem Host, macht `pg_basebackup` (Voll-Backup) + lädt WAL-Segmente hoch → **PITR**.
- **Storage:** Hetzner Storage Box via **SFTP** (EU, off-site). Plus bestehende Proxmox-Snapshots + SQLite-Datei als zusätzliche Netze.

---

## TEIL A — Dein Part (Server, Hetzner, UI)

### A1 · Databasus-Server (einmalig)
```bash
sudo mkdir -p /opt/databasus && cd /opt/databasus
# docs/databasus-server-compose.yml als docker-compose.yml ablegen
docker compose up -d
sleep 90 && docker logs databasus --tail 15
```
Vom Laptop: `ssh -L 4005:127.0.0.1:4005 root@<server-ip>` → `http://localhost:4005` → Admin-Account anlegen.

### A2 · Hetzner Storage Box vorbereiten
- Storage Box bestellen (Hetzner-Konsole). Host hat die Form `uXXXXXX.your-storagebox.de`.
- In den Box-Einstellungen **SSH-Support / externe Erreichbarkeit aktivieren** (SFTP läuft auf **Port 23**).
- **SSH-Key** hinterlegen (key-basiert > Passwort). Optional: **Sub-Account** mit eigenem Unterordner (Least-Privilege).
- Optional Härtung: **Snapshots** der Box aktivieren (Schutz gegen versehentliches Löschen/Ransomware).

### A3 · In der Databasus-UI
1. **Storage → New → SFTP**: Host `uXXXXXX.your-storagebox.de`, Port `23`, User, SSH-Key, Zielordner. **Verbindung testen.**
2. **Database → New → Agent-Modus**, Postgres 16. Databasus zeigt dann **vorausgefüllte Agent-Befehle** (mit `--token`, `--db-id`, `--databasus-host`).

➡️ **Schick mir die vorausgefüllten Agent-Befehle** (oder Token + db-id + Host). Dann läuft Teil B.

---

## TEIL B — Mein Part (nach Token): Postgres scharf machen

> ⚠️ **WAL-Pileup-Regel:** `archive_mode=on` wird **als LETZTES** aktiviert — erst wenn der Agent läuft und die
> `wal-queue` leert. Sonst stapeln sich WAL-Dateien und können die Platte volllaufen lassen.

### B1 · wal-queue-Verzeichnis (Host)
```bash
sudo mkdir -p /opt/databasus/wal-queue
```

### B2 · `docker-compose.yml` (`db`-Service) — Volume ergänzen (kommt in git, ich mache das)
```yaml
  db:
    # ...
    volumes:
      - pgdata:/var/lib/postgresql/data
      - /opt/databasus/wal-queue:/wal-queue        # NEU
```
Deploy → danach Ownership setzen, damit Postgres (uid 70 in alpine) schreiben darf:
```bash
docker exec super-bowl-db chown postgres:postgres /wal-queue
```

### B3 · Replikations-Rolle + pg_hba (für pg_basebackup)
```bash
docker exec -it super-bowl-db psql -U faltin -d faltin -c "ALTER ROLE faltin WITH REPLICATION;"
# pg_hba.conf im pgdata-Volume um die Zeile ergänzen (Adresse ggf. an Agent-Quelle anpassen):
#   host    replication   all   127.0.0.1/32   md5
docker exec super-bowl-db sh -lc 'echo "host replication all 127.0.0.1/32 md5" >> /var/lib/postgresql/data/pg_hba.conf'
docker exec super-bowl-db psql -U faltin -d faltin -c "SELECT pg_reload_conf();"
```

### B4 · Agent starten (Docker-Modus) — DRAINT die wal-queue
```bash
cd /opt/databasus
curl -L -o databasus-agent "http://127.0.0.1:4005/api/v1/system/agent?arch=amd64" && chmod +x databasus-agent
./databasus-agent start \
  --databasus-host=http://127.0.0.1:4005 \
  --db-id=<DB_ID> --token=<TOKEN> \
  --pg-host=localhost --pg-port=5432 \
  --pg-user=faltin --pg-password=<PG_PASSWORT> \
  --pg-type=docker --pg-docker-container-name=super-bowl-db \
  --pg-wal-dir=/opt/databasus/wal-queue
./databasus-agent status
```
> Genaue Flags = die **vorausgefüllten Befehle aus der UI** (haben Vorrang).

### B5 · ERST JETZT archive_mode aktivieren (Agent läuft + drainst)
```bash
docker exec super-bowl-db psql -U faltin -d faltin -c "ALTER SYSTEM SET wal_level='replica';"
docker exec super-bowl-db psql -U faltin -d faltin -c "ALTER SYSTEM SET archive_mode='on';"
docker exec super-bowl-db psql -U faltin -d faltin -c "ALTER SYSTEM SET archive_command='cp %p /wal-queue/%f.tmp && mv /wal-queue/%f.tmp /wal-queue/%f';"
docker compose -f /opt/super-bowl/docker-compose.yml restart db    # archive_mode/wal_level brauchen Neustart (kurzer App-Blip)
# danach: wal-queue beobachten — sollte NICHT dauerhaft wachsen (Agent lädt hoch):
watch -n5 'ls -1 /opt/databasus/wal-queue | wc -l'
```

---

## TEIL C — Härtung (= macht es erst „professionell")
- [ ] **Restore-Verification** in Databasus aktivieren (automatischer Test-Restore). Ohne getesteten Restore ist es kein Backup.
- [ ] **Alerting**: Notifier → **Microsoft Teams** (wir haben M365) für Backup-OK/-Fehler.
- [ ] **Verschlüsselung**: prüfen ob Databasus die Backups verschlüsselt; sonst Box-seitige Verschlüsselung/zusätzliche Schicht. (PII!)
- [ ] **Retention** festlegen (z.B. 30 Tage WAL/PITR + tägliches Base-Backup, 90 Tage Aufbewahrung) + DSGVO-Löschkonzept.
- [ ] **Zweites Ziel/Immutability** erwägen (Storage-Box-Snapshots) gegen Ransomware/Versehen.

## TEIL D — Restore-Test (PFLICHT vor „fertig")
1. Test-Restore in ein **leeres** Verzeichnis (Doku: Agent `restore --target-dir=...`).
2. **PITR** auf einen Zeitpunkt testen (`--target-time=<RFC3339>`).
3. Restored-Instanz hochfahren, Stichprobe: Buchungen/Rechnungen vorhanden?
4. Ablauf dokumentieren (RTO/RPO notieren).

## TEIL E — Notfall / Rollback
- Backups sind auch **ohne** Databasus-Server wiederherstellbar (Doku „Manual recovery without Databasus").
- DB-Backend bleibt umschaltbar: `DB_BACKEND=sqlite` als allerletztes Netz (siehe POSTGRES-MIGRATION-RUNBOOK.md).
