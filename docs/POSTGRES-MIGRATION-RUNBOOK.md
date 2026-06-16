# PostgreSQL-Migration – Runbook (Backup, Stand, Rückweg)

> Ziel: kompletter Umzug von SQLite (+ JSON-Content) auf PostgreSQL – **risikoarm und jederzeit zurückrollbar**.
> Grundprinzip: **Die SQLite-Datei wird während der gesamten Migration NIE gelöscht.** Backend ist per Env umschaltbar → Rollback = Schalter zurück.

---

## 1) Aktueller Stand (festgehalten)

- **Stabiler Commit:** `4d00a72`
- **Rollback-Git-Tag:** `pre-postgres-2026-06-15`
- **Datenhaltung heute:**
  - **SQLite** (`better-sqlite3`) → `data/bookings.db` (WAL): Tabellen `booking_requests`, `booking_messages`, `invoices`, `invoice_items`, `expenses`, `customers`, `customer_emails`, `counters`.
  - **Content als JSON** im Volume: `data/events.json`, `series.json`, `packages.json`, `faqs.json`, `category-seo.json`, `pins.json`, `pin-icons.json`, `settings.json`.
  - **Uploads** im Volume: `data/uploads/auto-reply/*.pdf`.
- **Volume:** `./data:/app/data` (persistent). `bookings.db` + `settings.json` werden vom Seed NIE überschrieben.
- **Deploy:** Push auf `main` → self-hosted Runner → `deploy.sh` (`git reset --hard origin/main` → `docker compose down` → `up -d --build`).

---

## 2) Backup – ZWINGEND vor der Migration

**A) Proxmox – der wichtigste Schritt (voller, sofortiger Rückweg):**
Auf dem Proxmox-Host (LXC-ID einsetzen, z.B. `123`):
```bash
# Snapshot (schnell, lokal) ODER PBS-Backup (off-site, besser)
pct snapshot 123 pre-postgres-2026-06-15 --description "vor PG-Migration"
# oder via PBS:
vzdump 123 --storage <pbs-storage> --mode snapshot --notes-template "vor PG-Migration"
```
→ Damit lässt sich der **gesamte Container** exakt auf den Vorzustand zurücksetzen.

**B) Daten-Tarball auf dem App-Server (granular):**
```bash
cd /opt/super-bowl
sudo tar czf data-backup-pre-pg-$(date +%F-%H%M).tar.gz data/
ls -lh data-backup-pre-pg-*.tar.gz   # prüfen, dass > 0 Bytes
```
(Enthält DB + Content + Uploads. Idealerweise zusätzlich off-site kopieren.)

---

## 3) Rückweg (3 Eskalationsstufen)

**Stufe 1 – Backend zurückschalten (Sekunden, kein Datenverlust):**
In der Server-`.env`: `DB_BACKEND=sqlite` → `docker compose up -d`. SQLite ist unangetastet → sofort wieder wie vorher.

**Stufe 2 – Code zurück (Minuten):**
```bash
# main auf den stabilen Stand zurücksetzen
git checkout main && git reset --hard pre-postgres-2026-06-15 && git push --force origin main
```
Deploy läuft automatisch → Code wie am Tag-Stand. `data/` bleibt erhalten.

**Stufe 3 – Daten/Container zurück (nuklear, voller Vorzustand):**
- Daten: Container stoppen → `data/` aus Tarball (2B) wiederherstellen → Container starten.
- Komplett: Proxmox **Snapshot-Restore** (2A) → exakt der Zustand vor der Migration.

---

## 4) Migrationsplan (staged, jede Stufe einzeln deploybar & prüfbar)

1. **Phase 1 – Postgres bereitstellen:** `postgres:16-alpine` als Service in `docker-compose.yml` (internes Netz, eigenes Volume, kein öffentlicher Port). Deploy mit **`DB_BACKEND=sqlite`** → keine Verhaltensänderung, Postgres läuft nur mit.
2. **Phase 2 – Schema + Datenmigration:** Drizzle-Schema; einmaliges Skript liest `bookings.db` → schreibt nach Postgres. SQLite bleibt unangetastet. Zeilen-Counts gegenprüfen.
3. **Phase 3 – Umschalten:** `DB_BACKEND=postgres`, deployen, alles testen (Anfrage anlegen, CRM, Rechnung-PDF, Status/SEO). **Rollback = `DB_BACKEND=sqlite`.**
4. **Phase 4 (optional, später) – Content nach Postgres:** Events/Serien/Pakete/FAQ in Tabellen → beendet die `SEED_VERSION`-Falle und den Sitemap-Build-Fallback.

**Sicherheitsnetz während allem:** SQLite-Datei + Tarball + Proxmox-Snapshot bleiben bestehen, bis Postgres mehrere Tage stabil läuft.

---

## 5) Checkliste vor „Go"
- [ ] Proxmox-Snapshot/PBS-Backup erstellt (2A)
- [ ] `data/`-Tarball erstellt & Größe geprüft (2B)
- [ ] Git-Tag `pre-postgres-2026-06-15` vorhanden (✓ gesetzt)
- [ ] Postgres-Passwort/Env festgelegt
- [ ] Wartungsfenster gewählt (kurzer 502 beim Deploy)
