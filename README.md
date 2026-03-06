# 🏈 Super Bowl LXI 2027 - WordPress Integration

Moderne Next.js App perfekt integriert in WordPress - **alles unter faltintravel.com**

✅ **Auto-Deployment aktiv** - Push to main = Live Deployment!

## 🎯 Integration-Methoden

### **1. WordPress Shortcodes** ⭐ EMPFOHLEN
Einzelne Komponenten flexibel in WordPress-Seiten einbetten:

```php
[superbowl_package]  // Package Card + Schema.org
[superbowl_faqs]     // FAQs + Schema.org  
[superbowl_embed]    // Komplette Seite
```

**Setup:** Siehe `WORDPRESS-SHORTCODES-GUIDE.md`

---

## 🧾 Changelog

- Shortcode-HTML wird serverseitig gerendert (SEO-freundlicher), mit Client-Fallback.
- Advanced Package Card: Auswahl-Styles (Orange), bessere Sichtbarkeit, ID-Kollisionen behoben.
- CTA-Text angepasst und Hinweis klarer formuliert.
- Shortcode-Testseite unter `/shortcode-test`.

---

## 🚀 Quick Start

### Lokaler Test:



- ✅ **Landing Page** mit Paketübersicht```bash

- ✅ **Interaktives Buchungsformular** mit Live-Preisberechnungnpm run dev

- ✅ **Paketauswahl** (3*, 4*, 5* Hotels - 3 oder 4 Nächte)# or

- ✅ **Personenauswahl** (Erwachsene & Kinder)yarn dev

- ✅ **Datumsauswahl** für Reisebeginn# or

- ✅ **FAQ-Bereich** (interaktiv aufklappbar)pnpm dev

- ✅ **Responsive Design** (Mobile, Tablet, Desktop)# or

- ✅ **Live-Zusammenfassung** mit Gesamtpreisbun dev

- ✅ **Formular-Validierung** mit React Hook Form```



## 🚀 Tech StackOpen [http://localhost:3000](http://localhost:3000) with your browser to see the result.



- **Next.js 16** (App Router)You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

- **TypeScript** 

- **Tailwind CSS** für StylingThis project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

- **React Hook Form** für Formulare

- **Lucide React** für Icons## Learn More

- **date-fns** für Datums-Handling

To learn more about Next.js, take a look at the following resources:

## 📦 Installation & Start

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.

```bash- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

# Dependencies installieren (bereits erledigt)

npm installYou can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!



# Development Server starten## Deploy on Vercel

npm run dev

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

# Production Build erstellen

npm run buildCheck out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


# Production Server starten
npm start
```

## 🌐 URL

- **Local**: http://localhost:3000
- **Landing Page**: http://localhost:3000
- **Buchungsseite**: http://localhost:3000/booking

## 📁 Projekt-Struktur

```
src/
├── app/
│   ├── layout.tsx           # Root Layout
│   ├── page.tsx             # Landing Page
│   ├── globals.css          # Global Styles
│   └── booking/
│       └── page.tsx         # Buchungsseite
└── components/
    ├── PackageCard.tsx      # Paket-Karte Komponente
    ├── FAQ.tsx              # FAQ Akkordeon Komponente
    └── BookingForm.tsx      # Haupt-Buchungsformular
```

## 🎨 Design-Highlights

- **Modernes UI** mit Farbverlauf-Headern
- **Hover-Effekte** und Animationen
- **Sticky Sidebar** mit Live-Preisberechnung
- **Card-basiertes Design**
- **Professional Formular-Styling**

## 📋 Verfügbare Pakete

### 3-Nächte Pakete
- **3* Paket**: ab 8.550 € p.P.
- **4* Paket**: ab 9.375 € p.P. (Beliebteste Wahl)
- **5* Paket**: ab 10.025 € p.P.

### 4-Nächte Pakete
- **3* Paket**: ab 8.975 € p.P.
- **4* Paket**: ab 10.025 € p.P.
- **5* Paket**: ab 10.925 € p.P.

## 🎯 Eingeschlossene Leistungen

- 3-4 Nächte in der ausgewählten Hotelkategorie in Los Angeles
- Eintrittskarte für den Super Bowl LXI
- Pre-Game Tailgate Event
- Matchday Transfer zum Stadion
- Onsite-Assistance
- Sicherungsschein der Reiseversicherung

## 🛠️ Anpassungen & Erweiterungen

### Farben anpassen
Bearbeite `tailwind.config.ts` oder die entsprechenden Klassen in den Komponenten.

### Pakete hinzufügen/ändern
Bearbeite das `packages` Array in:
- `src/app/page.tsx` (für Landing Page)
- `src/components/BookingForm.tsx` (für Buchungsformular)

### FAQ ändern
Bearbeite das `faqData` Array in `src/components/FAQ.tsx` oder `faqItems` in `BookingForm.tsx`.

### Formular-Submission
Aktuell wird eine Alert-Nachricht angezeigt. Implementiere in `BookingForm.tsx` die `onSubmit` Funktion mit deinem Backend/API.

## 📱 Responsive Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## 🎨 Farb-Schema

- **Primary Blue**: `#1e40af` (blue-800)
- **Dark Blue**: `#1e3a8a` (blue-900)
- **Red CTA**: `#dc2626` (red-600)
- **Gray Background**: `#f9fafb` (gray-50)

## 📞 Kontakt

Telefon: +49 6151 - 660 847-1

## 📝 Lizenz

Dieses Projekt ist für private/kommerzielle Nutzung.

---

**Erstellt mit ❤️ für das größte Sport-Event des Jahres!** 🏈
