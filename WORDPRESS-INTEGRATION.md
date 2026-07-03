# 🔌 WordPress Integration Guide - Super Bowl Next.js App

## 📋 Übersicht

Ihre Next.js App ist jetzt in **2 Versionen** verfügbar:

1. **Standalone Version** (`/`) - Mit eigenem Header/Footer/Navigation
2. **WordPress Embed Version** (`/embed`) - **NUR Content**, perfekt für WordPress-Integration

---

## 🎯 Empfohlene Integration: `/embed` Route

### **Option 1: Iframe-Einbettung (Einfachste Methode)**

#### Schritt 1: Next.js App deployen
```bash
# Auf Vercel deployen (kostenlos)
vercel deploy

# Oder auf Ihrer Domain (z.B. superbowl.faltintravel.com)
npm run build
npm start
```

#### Schritt 2: WordPress-Seite erstellen
1. In WordPress: **Seiten → Neu hinzufügen**
2. Permalink setzen: `super-bowl-2027-tickets`
3. **Im WordPress-Editor (Gutenberg oder Classic):**

**Für Gutenberg (Block Editor):**
```
1. Block hinzufügen → "Custom HTML"
2. Folgenden Code einfügen:
```

```html
<iframe 
  src="https://superbowl.faltintravel.com/embed" 
  width="100%" 
  style="border: none; min-height: 3000px; display: block;"
  id="superbowl-iframe"
  title="Super Bowl 2027 Packages"
></iframe>

<script>
// Auto-Resize für perfekte Höhe
window.addEventListener('message', function(e) {
  if (e.data.hasOwnProperty('frameHeight')) {
    document.getElementById('superbowl-iframe').style.height = e.data.frameHeight + 'px';
  }
});
</script>
```

**Für Classic Editor:**
- Auf "Text" statt "Visuell" wechseln
- Code direkt einfügen

#### Schritt 3: Auto-Resize aktivieren (Optional, aber empfohlen)

In Ihrer Next.js App das Layout erweitern:

**Datei: `src/app/embed/layout.tsx`** (bereits erstellt)

Fügen Sie am Ende hinzu:
```tsx
<Script id="iframe-resize">
{`
  // Sendet die Höhe an das Parent-Window (WordPress)
  const sendHeight = () => {
    const height = document.body.scrollHeight;
    window.parent.postMessage({ frameHeight: height }, '*');
  };
  
  // Bei Seitenload und Resize
  window.addEventListener('load', sendHeight);
  window.addEventListener('resize', sendHeight);
  
  // Für dynamische Inhalte
  const observer = new MutationObserver(sendHeight);
  observer.observe(document.body, { childList: true, subtree: true });
`}
</Script>
```

---

### **Option 2: WordPress Custom Page Template**

Erstellen Sie in Ihrem WordPress-Theme ein Custom Template:

**Datei: `page-superbowl.php`** (in Ihrem Theme-Ordner)

```php
<?php
/**
 * Template Name: Super Bowl Next.js
 */

get_header(); 
?>

<style>
  /* WordPress-Theme-Styles zurücksetzen */
  #superbowl-content {
    margin: 0;
    padding: 0;
    max-width: 100%;
  }
  #superbowl-content * {
    margin: 0;
  }
</style>

<div id="superbowl-content">
  <iframe 
    src="<?php echo esc_url('https://superbowl.faltintravel.com/embed'); ?>" 
    width="100%" 
    style="border: none; min-height: 3000px;"
    id="superbowl-iframe"
    title="Super Bowl 2027 Packages"
  ></iframe>
</div>

<script>
window.addEventListener('message', function(e) {
  if (e.data.hasOwnProperty('frameHeight')) {
    document.getElementById('superbowl-iframe').style.height = e.data.frameHeight + 'px';
  }
});
</script>

<?php get_footer(); ?>
```

Dann in WordPress:
1. Seite erstellen: `super-bowl-2027-tickets`
2. Template auswählen: **"Super Bowl Next.js"**
3. Veröffentlichen

---

### **Option 3: Direktes Rendering (Fortgeschritten)**

Falls Sie mehr Kontrolle möchten und die WordPress-Navigation behalten wollen:

**WordPress Plugin erstellen:**

**Datei: `wp-content/plugins/superbowl-integration/superbowl-integration.php`**

```php
<?php
/**
 * Plugin Name: Super Bowl Next.js Integration
 * Description: Integriert die Next.js Super Bowl App
 * Version: 1.0
 */

function superbowl_shortcode() {
    ob_start();
    ?>
    <div id="superbowl-root"></div>
    <script>
        // Lädt Ihre Next.js App per JavaScript
        fetch('https://superbowl.faltintravel.com/embed')
            .then(response => response.text())
            .then(html => {
                document.getElementById('superbowl-root').innerHTML = html;
            });
    </script>
    <?php
    return ob_get_clean();
}
add_shortcode('superbowl', 'superbowl_shortcode');
```

Dann in WordPress-Seite:
```
[superbowl]
```

---

## 🚀 Deployment-Szenarien

### **Szenario A: Separate Subdomain**
```
WordPress:          https://faltintravel.com
Next.js App:        https://superbowl.faltintravel.com
WordPress-Seite:    https://faltintravel.com/super-bowl-2027-tickets/
                    (embedded via iframe from superbowl.faltintravel.com/embed)
```

**Vorteile:**
- ✅ Klare Trennung
- ✅ Unabhängiges Deployment
- ✅ Keine WordPress-Konflikte

**DNS-Setup:**
```
A Record:  superbowl  →  [IP Ihrer Next.js App / Vercel IP]
```

---

### **Szenario B: Gleiche Domain mit Reverse Proxy**
```
https://faltintravel.com          → WordPress
https://faltintravel.com/app/*    → Next.js App
```

**Nginx Config:**
```nginx
server {
    server_name faltintravel.com;

    # WordPress
    location / {
        proxy_pass http://wordpress:80;
    }

    # Next.js App
    location /app/ {
        proxy_pass http://nextjs:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

---

## 🎨 WordPress-Theme Styling anpassen

Falls das WordPress-Theme Ihre Next.js Styles überschreibt:

**In WordPress:** Functions.php oder Custom CSS hinzufügen:

```css
/* Verhindert WordPress-Theme-Styles für Super Bowl Content */
#superbowl-iframe {
  display: block;
  width: 100% !important;
  border: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* Falls WordPress Container zu eng ist */
.page-template-superbowl .container,
.page-template-superbowl .content {
  max-width: 100% !important;
  padding: 0 !important;
}
```

---

## 📱 Responsive Optimierung

Ihre `/embed` Route ist bereits responsive, aber stellen Sie sicher dass:

1. **WordPress Theme responsive ist**
2. **Keine max-width Beschränkungen** auf der Seite
3. **Iframe ist responsive:**

```html
<div style="position: relative; width: 100%; overflow: hidden;">
  <iframe 
    src="https://superbowl.faltintravel.com/embed"
    style="width: 100%; border: none; min-height: 3000px;"
  ></iframe>
</div>
```

---

## ✅ Testing Checkliste

Nach der Integration testen:

- [ ] Seite lädt unter `https://faltintravel.com/super-bowl-2027-tickets/`
- [ ] WordPress Header/Footer werden angezeigt (falls gewünscht)
- [ ] Next.js Content wird korrekt geladen
- [ ] Keine Style-Konflikte
- [ ] Responsive auf Mobile/Tablet
- [ ] Booking-Button funktioniert
- [ ] Bilder laden korrekt
- [ ] Google Analytics trackt (falls eingerichtet)
- [ ] SEO Meta-Tags korrekt (View Source prüfen)

---

## 🔍 SEO-Optimierung bei WordPress-Integration

### Meta-Tags in WordPress setzen:

Mit **Yoast SEO** oder **Rank Math**:

1. Seite bearbeiten
2. SEO-Titel: `Super Bowl LXI 2027 Tickets & Packages | Faltin Travel`
3. Meta-Beschreibung: `Offizielle Super Bowl LXI 2027 Packages inkl. Tickets, Hotel & VIP-Hospitality. 4 Nächte im Dream Hollywood Hotel + Premium Tickets.`
4. Focus Keyword: `Super Bowl 2027 Tickets`

### Canonical URL:
```html
<link rel="canonical" href="https://faltintravel.com/super-bowl-2027-tickets/" />
```

---

## 🚨 Troubleshooting

### Problem: Iframe lädt nicht
**Lösung:** CORS-Headers in Next.js config hinzufügen:

```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/embed',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'ALLOW-FROM https://faltintravel.com',
        },
      ],
    },
  ]
}
```

### Problem: Styles sehen anders aus
**Lösung:** WordPress-Theme-Styles zurücksetzen (siehe oben)

### Problem: Bilder laden nicht
**Lösung:** Next.js Image-Domains konfigurieren:

```typescript
// next.config.ts
images: {
  domains: ['faltintravel.com', 'superbowl.faltintravel.com'],
}
```

---

## 🎯 Empfehlung

**Beste Lösung für Sie:**

1. ✅ Next.js auf **Vercel** deployen (kostenlos)
2. ✅ Subdomain einrichten: `superbowl.faltintravel.com`
3. ✅ WordPress-Seite mit **Iframe** (Option 1)
4. ✅ WordPress Header/Footer beibehalten
5. ✅ Next.js Content embedded unter `/embed`

**Resultat:**
```
https://faltintravel.com/super-bowl-2027-tickets/
├── WordPress Header (Navigation, Logo)
├── Next.js Content (via iframe from superbowl.faltintravel.com/embed)
└── WordPress Footer (Links, Copyright)
```

---

Möchten Sie Hilfe beim Deployment oder haben Sie Fragen zur Integration? 🚀

## Package-Karten: `[faltin_packages]` (ab Plugin 1.4.0)

Zeigt die buchbaren Packages eines Events als Karten-Grid — serverseitig
gerendertes HTML aus `/api/packages-html` (Fotos, Leistungen, Preise,
Ausgebucht-Status, Product-JSON-LD, Buchungslinks auf die Faltin-Buchungsseite).

```
[faltin_packages event="super-bowl-2027"]
```

- **Fallback-Logik wie auf der Event-Seite:** Hat das Event keine aktiven
  Packages (oder ist die API nicht erreichbar), rendert der Shortcode
  automatisch das native Anfrageformular (`[faltin_anfrage]`).
- **Buchungsseite:** Die Karten-Buttons verlinken auf die menülose
  Buchungsseite (`…/booking`). Deren „Zurück"-Button führt per Browser-History
  zurück zur WordPress-Seite — kein iframe, keine Doppel-Pflege.
- Design-Änderungen am Karten-Layout passieren zentral im Faltin-System;
  WordPress muss dafür nie angefasst werden (10-Minuten-Cache via Transient).

### Auto-Logik in `[faltin_anfrage]` (ab Plugin 1.5.0)

Bestehende Einbettungen wie `[faltin_anfrage event="americas-cup-2024"
name="America's Cup 2024"]` bleiben unverändert gültig — und **upgraden
automatisch**: Sobald das Event buchbare Packages hat, liefert der Shortcode
die Package-Karten aus; sonst wie bisher das Anfrageformular. Kein Umbau
bestehender WordPress-Seiten nötig. `packages="0"` erzwingt das reine Formular.

### Embed-Modus & Affiliate-Tracking (ab Plugin 1.6.0)

Die Shortcode-Buchungslinks führen auf `…/booking?…&embed=1&ref=<host>`:

- **`embed=1`** — die Buchungsseite rendert ohne Site-Menü und Footer; sie
  beginnt mit dem orangen „Zurück"-Balken (Direktaufrufe der Buchungsseite
  auf der eigenen Domain zeigen das Menü weiterhin).
- **`ref=<host>`** — Host der einbettenden WordPress-Site (vom Plugin via
  `home_url()` gesetzt). Wird bei der Anfrage gespeichert: als
  `Quelle: <host>` in den CRM-Notizen der Buchung und in der
  Team-Benachrichtigungsmail („Eingegangen über: …"). Das native
  Anfrageformular sendet die Quelle ebenfalls mit (`source`-Feld).
