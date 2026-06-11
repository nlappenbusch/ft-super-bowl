# 🚀 Quick Start - WordPress Integration

## In 5 Minuten einsatzbereit!

### Schritt 1: Next.js App testen
```bash
npm run dev
```

Öffnen Sie: http://localhost:3000/embed

✅ Sie sehen jetzt die **WordPress-freundliche Version** (ohne Header/Navigation)

---

### Schritt 2: Deployen

**Option A: Vercel (Empfohlen - 2 Minuten)**
```bash
npm install -g vercel
vercel login
vercel
```

Folgen Sie den Anweisungen → Fertig!
Ihre URL: `https://ihr-projekt.vercel.app/embed`

**Option B: Eigener Server**
```bash
npm run build
npm start
```

---

### Schritt 3: In WordPress einbetten

1. **WordPress-Seite erstellen:**
   - Gehen Sie zu: Seiten → Neu hinzufügen
   - Titel: "Super Bowl 2027 Tickets"
   - Permalink: `super-bowl-2027-tickets`

2. **Code einfügen:**
   - Block hinzufügen → "Custom HTML"
   - Kopieren Sie den Inhalt von `wordpress-embed-code.html`
   - **WICHTIG:** URL anpassen:
     ```html
     src="https://IHR-DEPLOYMENT.vercel.app/embed"
     ```

3. **Veröffentlichen** → ✅ Fertig!

---

### Schritt 4: Testen

Öffnen Sie: `https://faltintravel.com/super-bowl-2027-tickets/`

**Checklist:**
- [ ] WordPress Header sichtbar
- [ ] Super Bowl Content lädt
- [ ] Bilder werden angezeigt
- [ ] Booking-Button funktioniert
- [ ] Mobile responsive

---

## 🔧 URLs ändern

**In `wordpress-embed-code.html`:**
```html
<!-- VORHER -->
src="https://superbowl.faltintravel.com/embed"

<!-- NACHHER (Ihre Vercel URL) -->
src="https://ihr-projekt.vercel.app/embed"
```

**In `next.config.ts`:**
```typescript
// Zeile mit ALLOW-FROM anpassen
value: 'ALLOW-FROM https://faltintravel.com'
// zu Ihrer WordPress URL
```

---

## 📱 Standalone vs. Embedded

| Route | Beschreibung | Verwendung |
|-------|-------------|------------|
| `/` | Vollständige App mit Header/Navigation | Standalone auf separater Domain |
| `/embed` | **Nur Content** ohne Navigation | **WordPress-Integration** ✅ |
| `/booking` | Buchungsformular | Beide Versionen |

---

## 🎯 Nächste Schritte

1. ✅ Deploy auf Vercel
2. ✅ In WordPress einbetten
3. 📊 Google Analytics hinzufügen (siehe SEO-DEPLOYMENT-GUIDE.md)
4. 🔍 Google Search Console einrichten
5. 📈 SEO optimieren

---

## 💡 Tipps

### WordPress-Theme-Styles überschreiben nicht?
Der Code in `wordpress-embed-code.html` enthält bereits CSS-Resets.

### Höhe passt nicht automatisch?
Das Auto-Resize-Script ist bereits implementiert (siehe `embed/layout.tsx`)

### CORS-Fehler?
Ihre `next.config.ts` ist bereits konfiguriert für WordPress-Embedding.

---

## 📞 Support

- Vollständige Anleitung: `WORDPRESS-INTEGRATION.md`
- SEO-Guide: `SEO-DEPLOYMENT-GUIDE.md`
- Next.js Docs: https://nextjs.org/docs

**Viel Erfolg! 🎉**
