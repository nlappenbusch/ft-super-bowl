# SQLite Lokale Datenbank Setup

## ✅ **Vorteil: Keine Cloud-Anbieter nötig!**

Die Datenbank läuft direkt auf deinem Server als einfache Datei. Keine externe Registrierung, keine API-Keys, komplett unter deiner Kontrolle.

---

## 📁 **Was wurde automatisch erstellt:**

Bei der ersten Buchung wird automatisch erstellt:
```
/data/
  └── bookings.db          # SQLite Datenbank-Datei
  ├── bookings.db-shm      # Shared Memory (temporär)
  └── bookings.db-wal      # Write-Ahead Log (temporär)
```

Das `/data` Verzeichnis ist in `.gitignore` - wird also **nicht** ins Git committed.

---

## 🚀 **Sofort einsatzbereit!**

Kein Setup nötig! Einfach:

1. ✅ **Dev Server läuft**: `npm run dev`
2. ✅ **Teste Buchung**: http://localhost:3000/booking
3. ✅ **Öffne Admin**: http://localhost:3000/admin (Passwort: `super-bowl-2027-admin`)

Die Datenbank wird beim ersten `POST /api/bookings` automatisch initialisiert!

---

## 📊 **Datenbank Schema:**

```sql
CREATE TABLE booking_requests (
  id TEXT PRIMARY KEY,                    -- UUID
  created_at TEXT NOT NULL,               -- ISO Timestamp
  updated_at TEXT NOT NULL,               -- Auto-Update
  package_id TEXT NOT NULL,
  package_title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  number_of_persons INTEGER NOT NULL,
  double_rooms INTEGER NOT NULL,
  single_rooms INTEGER NOT NULL,
  travelers TEXT NOT NULL,                -- JSON Array
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  status TEXT CHECK(status IN 
    ('new', 'in_progress', 'booked', 'rejected')),
  total_price REAL NOT NULL,
  notes TEXT
);

-- Indexes für schnelle Suche
CREATE INDEX idx_created_at ON booking_requests(created_at DESC);
CREATE INDEX idx_status ON booking_requests(status);
CREATE INDEX idx_email ON booking_requests(email);
```

---

## 🔍 **Datenbank direkt öffnen (optional):**

Wenn du die Datenbank manuell durchsuchen willst:

### **Option 1: VS Code Extension**
- Installiere: "SQLite Viewer" Extension
- Öffne `data/bookings.db` in VS Code

### **Option 2: DB Browser for SQLite**
- Download: https://sqlitebrowser.org/
- Öffne `data/bookings.db`

### **Option 3: Kommandozeile**
```powershell
# SQLite CLI installieren (optional)
winget install SQLite.SQLite

# Datenbank öffnen
sqlite3 data/bookings.db

# Alle Buchungen anzeigen
SELECT * FROM booking_requests;

# Beenden
.exit
```

---

## 📦 **Backup erstellen:**

Die Datenbank ist nur **eine Datei** - einfach kopieren!

```powershell
# Manuelles Backup
copy data\bookings.db backups\bookings-2027-02-17.db

# Automatisches Backup (täglich)
# In Task Scheduler oder cron job eintragen
```

---

## 🚀 **Production Deployment:**

### **Auf deinem Server:**
1. Lade das Projekt hoch
2. Installiere Dependencies: `npm install`
3. Build: `npm run build`
4. Start: `npm start`
5. Die `/data` Ordner wird automatisch erstellt

### **Wichtig für Production:**
```env
# .env.local (auf Server)
ADMIN_PASSWORD=dein-sicheres-passwort-hier
NODE_ENV=production
```

### **Datei-Berechtigungen:**
```bash
# Stelle sicher dass der Node-Prozess schreiben kann
chmod 755 data/
chmod 644 data/bookings.db
```

---

## 🔄 **Migration zu anderer DB (später):**

Falls du später z.B. zu PostgreSQL wechseln willst:

```powershell
# Daten exportieren
sqlite3 data/bookings.db .dump > backup.sql

# In PostgreSQL importieren
psql -U user -d database -f backup.sql
```

---

## 💡 **Performance:**

SQLite ist **sehr schnell** für diese Anwendung:
- ✅ Bis zu 100.000+ Buchungen kein Problem
- ✅ Keine Netzwerk-Latenz (lokale Datei)
- ✅ Automatisches Caching
- ✅ ACID-Transaktionen

---

## 🎉 **Das war's!**

Keine Registrierung, keine Cloud, keine Kosten - alles läuft lokal auf deinem Server! 🚀
