# 🌐 Deployment für SEPARATE Server

## 📋 Ihre Server-Struktur:

```
Server 1: WordPress          → faltintravel.com (bestehend)
Server 2: Next.js (Produktion) → superbowl.faltintravel.com (neu)
Server 3: Dev (lokal)        → localhost:3000
```

---

## 🚀 Deployment-Optionen

### **Option A: Next.js auf Vercel** ⭐ EINFACHSTE LÖSUNG

#### 1. Vercel Deployment
```bash
# In Ihrem Projekt-Ordner:
npm install -g vercel
vercel login
vercel --prod
```

**Ergebnis:** `https://ihr-projekt.vercel.app`

#### 2. Custom Domain hinzufügen
In Vercel Dashboard:
- Settings → Domains
- Domain hinzufügen: `superbowl.faltintravel.com`

**DNS bei Ihrem Domain-Provider:**
```
CNAME  superbowl  →  cname.vercel-dns.com
```

#### 3. WordPress Plugin URLs anpassen
```php
// In superbowl-integration.php bereits angepasst:
'api_url' => 'https://superbowl.faltintravel.com/api/package'
'url' => 'https://superbowl.faltintravel.com/embed'
```

**FERTIG!** ✅

---

### **Option B: Next.js auf eigenem Server**

#### 1. Server vorbereiten (Ubuntu/Debian)
```bash
# Node.js installieren
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 installieren
sudo npm install -g pm2
```

#### 2. Projekt deployen
```bash
# Code auf Server kopieren (z.B. via Git, FTP, SCP)
git clone https://github.com/IhrRepo/super-bowl.git
cd super-bowl

# Dependencies installieren
npm install

# Production Build
npm run build

# Mit PM2 starten
pm2 start npm --name "superbowl" -- start
pm2 save
pm2 startup
```

#### 3. Nginx Reverse Proxy (auf Next.js Server)
```nginx
server {
    listen 80;
    server_name superbowl.faltintravel.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 4. SSL Zertifikat
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d superbowl.faltintravel.com
```

#### 5. DNS-Eintrag
Bei Ihrem Domain-Provider:
```
A Record:  superbowl  →  [IP vom Next.js Server]
```

---

## 🔗 WordPress Integration

### 1. Plugin installieren
```bash
# Via FTP auf WordPress-Server:
wp-content/plugins/superbowl-integration.php
```

Oder im WordPress Admin hochladen:
- Plugins → Installieren → Plugin hochladen

### 2. Plugin aktivieren
WordPress Admin → Plugins → "Super Bowl Next.js Integration" aktivieren

### 3. WordPress-Seite erstellen
**URL:** `faltintravel.com/super-bowl-2027-tickets/`

**Content:**
```html
<h1>Super Bowl LXI 2027 Tickets</h1>

<p>Erleben Sie das größte Sportevent...</p>

[superbowl_package]

<h2>Häufige Fragen</h2>

[superbowl_faqs]
```

**URLs werden automatisch angepasst auf:**
- `https://superbowl.faltintravel.com/api/package`
- `https://superbowl.faltintravel.com/api/faqs`

---

## 🎯 URL-Struktur (Final)

### WordPress (Server 1):
```
https://faltintravel.com/
├── /                           → WordPress Home
├── /super-bowl-2027-tickets/   → WordPress-Seite mit Shortcodes ⭐
├── /sportevents/               → Andere WordPress-Seiten
└── /kontakt/                   → WordPress-Seiten
```

### Next.js (Server 2):
```
https://superbowl.faltintravel.com/
├── /                           → Standalone Next.js App
├── /embed                      → Für WordPress iFrame
├── /booking                    → Buchungsformular
├── /api/package                → Package API (für Shortcode)
└── /api/faqs                   → FAQs API (für Shortcode)
```

---

## 🔍 SEO: Canonical URLs

### WordPress-Seite SEO-Plugin (Yoast/Rank Math):
```
Canonical: https://faltintravel.com/super-bowl-2027-tickets/
```

### Interne Verlinkung:
- Hauptseite: `https://faltintravel.com/super-bowl-2027-tickets/` ⭐ **Diese für SEO!**
- Booking: Link zu `https://superbowl.faltintravel.com/booking`

**Google sieht:**
- Hauptinhalt auf `faltintravel.com` ✅
- Subdomain nur für Funktionalität ✅

---

## ✅ Vorteile dieser Lösung

✅ **Server unabhängig** - WordPress & Next.js getrennt
✅ **Einfaches Deployment** - Jeder Server eigenständig
✅ **SEO optimiert** - Canonical auf Hauptdomain
✅ **Flexibel** - Next.js kann woanders laufen (Vercel, VPS, etc.)
✅ **Wartbar** - Updates unabhängig voneinander
✅ **Skalierbar** - Next.js auf CDN (Vercel) möglich

---

## 🧪 Testing vor Deployment

### Lokal mit verschiedenen Ports:
```bash
# Terminal 1 - Next.js (simuliert Server 2)
npm run dev  # Port 3000

# Terminal 2 - Test mit externer URL
# Öffnen: http://localhost:3000/wordpress-preview
```

### CORS testen:
```bash
# Von WordPress-Server aus testen:
curl -I https://superbowl.faltintravel.com/api/package

# Sollte enthalten:
Access-Control-Allow-Origin: *
```

---

## 📊 Checkliste vor Go-Live

- [ ] Next.js deployed auf Server 2 (Vercel oder eigener Server)
- [ ] DNS: `superbowl.faltintravel.com` → Next.js Server
- [ ] SSL-Zertifikat aktiv für Subdomain
- [ ] WordPress Plugin installiert & aktiviert auf Server 1
- [ ] Plugin URLs zeigen auf `superbowl.faltintravel.com`
- [ ] CORS Headers aktiv (Test mit curl)
- [ ] WordPress-Seite erstellt mit Shortcodes
- [ ] Test: Shortcodes laden korrekt
- [ ] Booking-Link funktioniert
- [ ] Mobile-Test durchgeführt
- [ ] PageSpeed > 90

---

## 🚨 Troubleshooting

### Problem: Shortcode zeigt "Lädt..." endlos

**Diagnose:**
```javascript
// Browser Console (F12) öffnen
// Fehler sichtbar?
```

**Mögliche Ursachen:**
1. **CORS blockiert** → `next.config.ts` CORS Headers prüfen
2. **DNS noch nicht propagiert** → `nslookup superbowl.faltintravel.com`
3. **Next.js nicht erreichbar** → `curl https://superbowl.faltintravel.com/api/package`
4. **SSL-Fehler** → Zertifikat für Subdomain aktiv?

**Quick Fix:**
```bash
# Next.js Server prüfen:
pm2 status
pm2 logs superbowl

# Neu starten falls nötig:
pm2 restart superbowl
```

---

### Problem: iFrame lädt nicht

**Lösung:** X-Frame-Options Header prüfen
```bash
curl -I https://superbowl.faltintravel.com/embed

# Sollte NICHT enthalten:
X-Frame-Options: DENY
```

Falls doch → `next.config.ts` wurde bereits angepasst auf `ALLOWALL`

---

## 💰 Kosten-Übersicht

### Option A: Vercel
- ✅ **Kostenlos** bis 100GB Bandwidth
- ✅ Globales CDN inklusive
- ✅ SSL automatisch
- ✅ **Empfohlen für Start!**

### Option B: Eigener VPS
- 💰 5-10€/Monat (z.B. Hetzner, DigitalOcean)
- Mehr Kontrolle
- Mehr Wartung nötig

---

## 📞 Support-Links

- **Vercel Docs:** https://vercel.com/docs
- **Next.js Deployment:** https://nextjs.org/docs/deployment
- **PM2 Docs:** https://pm2.keymetrics.io/docs/usage/quick-start/
- **Certbot (SSL):** https://certbot.eff.org/

---

**Ready to deploy? Folgen Sie Option A (Vercel) für schnellstes Ergebnis!** 🚀
