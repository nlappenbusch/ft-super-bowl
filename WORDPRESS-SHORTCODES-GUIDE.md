# 🎯 WordPress + Next.js Integration - ALLES unter faltintravel.com

## 🌟 Ihre perfekte SEO-Strategie

```
https://faltintravel.com/
├── WordPress (Haupt-CMS, Blog, sonstige Seiten)
├── /super-bowl-2027-tickets/    → WordPress-Seite mit Shortcodes
├── /booking                      → Next.js (via Reverse Proxy)
├── /embed                        → Next.js (via Reverse Proxy)
└── /api/package & /api/faqs      → Next.js API (via Reverse Proxy)
```

**Resultat:** Alle SEO-Vorteile auf EINER Domain! 🚀

---

## 📦 Was wurde erstellt:

### 1. **Next.js API Routes**
- ✅ `/api/package` - Package Card mit Schema.org
- ✅ `/api/faqs` - FAQs mit FAQ Schema

### 2. **WordPress Plugin**
- ✅ `wordpress-plugin/superbowl-integration.php`
- ✅ 3 Shortcodes ready-to-use

### 3. **Server-Konfigurationen**
- ✅ `deployment/nginx.conf` - Nginx Reverse Proxy
- ✅ `deployment/.htaccess` - Apache Reverse Proxy

---

## 🚀 Setup: 3 Schritte

### **Schritt 1: Next.js deployen**

#### Option A: Auf eigenem Server (mit WordPress zusammen)
```bash
# Next.js bauen
npm run build

# Mit PM2 starten (Port 3000)
npm install -g pm2
pm2 start npm --name "superbowl" -- start
pm2 save
pm2 startup
```

#### Option B: Auf Vercel (dann Reverse Proxy zu Vercel)
```bash
vercel deploy --prod
```

---

### **Schritt 2: Reverse Proxy einrichten**

#### Für Nginx:
```bash
# 1. Nginx-Config kopieren
sudo cp deployment/nginx.conf /etc/nginx/sites-available/faltintravel.com

# 2. Pfade anpassen (in der Datei)
#    - root: Ihr WordPress-Ordner
#    - ssl_certificate: Ihre SSL-Zertifikate
#    - PHP-FPM Socket: Ihre PHP-Version

# 3. Aktivieren
sudo ln -s /etc/nginx/sites-available/faltintravel.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Für Apache:
```bash
# 1. Module aktivieren
sudo a2enmod proxy
sudo a2enmod proxy_http
sudo a2enmod proxy_wstunnel
sudo a2enmod rewrite
sudo a2enmod headers

# 2. .htaccess ins WordPress-Root kopieren
cp deployment/.htaccess /var/www/faltintravel.com/

# 3. Apache neustarten
sudo systemctl restart apache2
```

---

### **Schritt 3: WordPress Plugin installieren**

```bash
# 1. Plugin hochladen
cp wordpress-plugin/superbowl-integration.php /var/www/wordpress/wp-content/plugins/

# Oder per FTP in:
# wp-content/plugins/superbowl-integration.php
```

**2. In WordPress aktivieren:**
- WordPress Admin → Plugins → Installierte Plugins
- "Super Bowl Next.js Integration" aktivieren

**3. URLs anpassen (WICHTIG!):**
```php
// In superbowl-integration.php Zeile 24 & 44:
'api_url' => 'https://faltintravel.com/api/package',  // ✅ Korrekt!
'api_url' => 'https://faltintravel.com/api/faqs',     // ✅ Korrekt!
```

---

## 📝 Verwendung der Shortcodes

### **1. Package Card einbetten**

In WordPress-Seite einfügen:
```
[superbowl_package]
```

**Ergebnis:**
- ✅ Package Card mit Preis
- ✅ "Jetzt anfragen" Button
- ✅ Schema.org Product Markup
- ✅ Vollständig gestylt

**Beispiel-Seite erstellen:**
1. WordPress → Seiten → Neu
2. Titel: "Super Bowl 2027 Tickets"
3. Permalink: `super-bowl-2027-tickets`
4. Content:
```
<h1>Super Bowl LXI 2027 - Offizielles Hospitality-Package</h1>

<p>Erleben Sie das größte Sportevent der Welt live im SoFi Stadium, Los Angeles. 
Unser exklusives Package beinhaltet Hotel, Tickets und VIP-Services.</p>

[superbowl_package]

<h2>Weitere Informationen</h2>
<p>Bei Fragen kontaktieren Sie uns gerne unter...</p>

[superbowl_faqs]
```

---

### **2. FAQs einbetten**

```
[superbowl_faqs]
```

**Ergebnis:**
- ✅ Interaktive Accordion-FAQs
- ✅ Schema.org FAQ Markup (Google Rich Results!)
- ✅ Vollständig gestylt

---

### **3. Komplette Embed-Seite**

Falls Sie ALLES einbetten wollen:
```
[superbowl_embed]
```

**Parameter:**
```
[superbowl_embed url="https://faltintravel.com/embed" height="3000"]
```

---

## 🔗 URL-Struktur

### WordPress-Seiten (mit Shortcodes):
```
https://faltintravel.com/super-bowl-2027-tickets/
→ WordPress-Seite mit [superbowl_package] und [superbowl_faqs]
```

### Next.js Direkt-Routes:
```
https://faltintravel.com/booking
→ Next.js Booking-Formular (via Reverse Proxy)

https://faltintravel.com/booking?package=dream_hollywood
→ Mit Package-Parameter
```

### API Routes (für Shortcodes):
```
https://faltintravel.com/api/package
→ JSON + HTML für Package Card

https://faltintravel.com/api/faqs
→ JSON + HTML für FAQs
```

---

## 🎨 Styling anpassen

### In WordPress Custom CSS:
```css
/* Super Bowl Package Card anpassen */
.superbowl-package-card {
  max-width: 900px !important;
}

/* FAQs anpassen */
.superbowl-faqs h2 {
  color: #your-brand-color !important;
}
```

### Oder in den API Routes:
- Datei: `src/app/api/package/route.ts`
- Datei: `src/app/api/faqs/route.ts`
- Passen Sie die Inline-Styles im HTML an

---

## 🔍 SEO-Vorteile dieser Lösung

✅ **Alles auf EINER Domain** → Maximale Domain Authority
✅ **Schema.org Markup** → Google Rich Snippets
✅ **WordPress SEO-Plugins** funktionieren (Yoast, Rank Math)
✅ **Next.js Performance** → 90+ PageSpeed Score
✅ **Kein Duplicate Content** → Saubere URL-Struktur
✅ **WordPress Header/Footer** → Konsistente Navigation

---

## 📊 Google Rich Results

Nach Deployment testen:
1. https://search.google.com/test/rich-results
2. URL eingeben: `https://faltintravel.com/super-bowl-2027-tickets/`
3. Sie sollten sehen:
   - ✅ Product (Package)
   - ✅ FAQ
   - ✅ Organization

---

## 🚨 Troubleshooting

### **Problem: API-Calls schlagen fehl**

**Lösung:** CORS prüfen
```bash
# Testen:
curl -I https://faltintravel.com/api/package

# Sollte enthalten:
Access-Control-Allow-Origin: https://faltintravel.com
```

Falls nicht → `next.config.ts` und Server-Config prüfen

---

### **Problem: Shortcode zeigt nur "Lädt..."**

**Lösung 1:** API-URL im Plugin prüfen
```php
// In superbowl-integration.php:
'api_url' => 'https://faltintravel.com/api/package', // Korrekt?
```

**Lösung 2:** Browser-Console öffnen (F12)
```javascript
// Fehler sichtbar? z.B.:
// "CORS error" → next.config.ts CORS Headers prüfen
// "404 Not Found" → Reverse Proxy nicht korrekt
```

---

### **Problem: Booking-Link funktioniert nicht**

**Lösung:** Reverse Proxy für `/booking` prüfen

**Nginx Test:**
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

**Apache Test:**
```bash
sudo apache2ctl -t
sudo tail -f /var/log/apache2/error.log
```

---

### **Problem: Next.js läuft nicht**

**Lösung:** PM2 Status prüfen
```bash
pm2 status
pm2 logs superbowl

# Falls crashed:
pm2 restart superbowl
```

---

## 🔐 Sicherheit

### SSL/HTTPS erzwingen:
```bash
# Let's Encrypt installieren
sudo certbot --nginx -d faltintravel.com -d www.faltintravel.com

# Auto-Renewal testen
sudo certbot renew --dry-run
```

### WordPress absichern:
```php
// In wp-config.php:
define('FORCE_SSL_ADMIN', true);
```

---

## 📈 Performance-Optimierung

### Next.js Build optimieren:
```bash
# Production Build
npm run build

# Bundle analysieren
npm install @next/bundle-analyzer
ANALYZE=true npm run build
```

### WordPress Caching:
- Plugin: WP Rocket oder W3 Total Cache
- **WICHTIG:** `/api/*` Routes vom Cache ausschließen!

---

## ✅ Launch-Checklist

- [ ] Next.js läuft auf Port 3000 (PM2)
- [ ] Reverse Proxy konfiguriert (Nginx/Apache)
- [ ] SSL-Zertifikat aktiv (HTTPS)
- [ ] WordPress Plugin installiert & aktiviert
- [ ] Shortcodes getestet auf Test-Seite
- [ ] `/booking` Route funktioniert
- [ ] API Routes erreichbar (`/api/package`, `/api/faqs`)
- [ ] CORS Headers korrekt
- [ ] Schema.org Markup im Source Code sichtbar
- [ ] Google Rich Results Test bestanden
- [ ] PageSpeed Score > 90
- [ ] Mobile-Friendly Test bestanden

---

## 🎯 Beispiel: Komplette WordPress-Seite

**URL:** `https://faltintravel.com/super-bowl-2027-tickets/`

**Content:**
```html
<!-- Intro (WordPress Editor) -->
<h1>Super Bowl LXI 2027 Tickets & Hospitality-Packages</h1>

<p>Erleben Sie am 7. Februar 2027 das größte Sportevent der Welt live im 
SoFi Stadium in Los Angeles. Wir bieten Ihnen exklusive Hospitality-Packages 
mit Hotel, VIP-Tickets und erstklassigem Service.</p>

<!-- Package Card (Shortcode) -->
[superbowl_package]

<!-- Weitere Infos (WordPress Editor) -->
<h2>Warum Faltin Travel?</h2>
<ul>
  <li>15+ Jahre Erfahrung in Sportreisen</li>
  <li>Schweizer Reisegarantie</li>
  <li>Persönliche Betreuung vor Ort</li>
</ul>

<!-- FAQs (Shortcode) -->
[superbowl_faqs]

<!-- CTA (WordPress Editor) -->
<div style="text-align: center; margin-top: 40px;">
  <a href="/booking?package=dream_hollywood" class="button">
    Jetzt unverbindlich anfragen
  </a>
</div>
```

---

## 🚀 Das war's!

Ihre Super Bowl Next.js App ist jetzt **perfekt in WordPress integriert** - 
auf **einer Domain**, mit **maximaler SEO-Power** und **voller Flexibilität**!

**Bei Fragen:** Siehe Troubleshooting-Abschnitt oben oder Next.js Docs.
