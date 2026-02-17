# Rechnungsstellungs-System

## ✅ **Vollständiges Rechnungs-Management**

Dein Admin Dashboard hat jetzt ein komplettes Rechnungsstellungs-System eingebaut!

---

## 🎯 **Features:**

### **1. Rechnung erstellen**
- ✅ Direkt aus jeder Buchung eine Rechnung generieren
- ✅ Automatische Rechnungsnummer (Format: `RE-2027-0001`)
- ✅ Fälligkeitsdatum (Standard: 14 Tage)
- ✅ Rechnungs-Items mit Beschreibung, Menge, Preis

### **2. PDF-Generierung**
- ✅ Professionelle PDF-Rechnung mit Faltin Travel Branding
- ✅ Firmen-Informationen (Logo-Bereich, Adresse, Kontakt)
- ✅ Kunden-Adresse (aus Buchung)
- ✅ Rechnungs-Items Tabelle
- ✅ Gesamtbetrag, bezahlter Betrag, offener Betrag
- ✅ Zahlungsinformationen (IBAN, BIC, Referenz)
- ✅ Download als `Rechnung_RE-2027-0001.pdf`

### **3. Zahlungs-Tracking**
- ✅ Status: Offen, Teilweise bezahlt, Bezahlt, Storniert
- ✅ Zahlungen verbuchen (Teilzahlungen möglich)
- ✅ Automatische Status-Updates
- ✅ Offener Betrag wird live berechnet

### **4. Rechnungs-Übersicht**
- ✅ Alle Rechnungen pro Buchung sichtbar
- ✅ Status-Badges (farbcodiert)
- ✅ PDF-Download Button
- ✅ Zahlung verbuchen Button

---

## 🚀 **Wie benutzen:**

### **Schritt 1: Admin Dashboard öffnen**
```
http://localhost:3000/admin
Passwort: super-bowl-2027-admin
```

### **Schritt 2: Rechnung erstellen**
1. Bei einer Buchung auf **"Rechnung"** Button klicken
2. Modal öffnet sich
3. Klicke auf **"Neue Rechnung erstellen"**
4. ✅ Rechnung wird automatisch erstellt!

### **Schritt 3: PDF herunterladen**
1. Klicke auf **"PDF herunterladen"**
2. PDF öffnet sich in neuem Tab
3. Speichern oder direkt drucken

### **Schritt 4: Zahlung verbuchen**
1. Klicke auf **"Zahlung verbuchen"**
2. Gib Betrag ein (z.B. 10000 für Teil zahlung)
3. Status updated automatisch:
   - `Offen` → `Teilweise bezahlt` → `Bezahlt`

---

## 📄 **PDF-Rechnung enthält:**

```
┌─────────────────────────────────────────────────┐
│ Faltin Travel AG                                │
│ Limmatquai 3, 8001 Zürich                       │
│ Tel: +41 44 700 22 77                           │
├─────────────────────────────────────────────────┤
│                                                 │
│ RECHNUNG                                        │
│                                                 │
│ Rechnungsnummer: RE-2027-0001                   │
│ Rechnungsdatum: 17.02.2026                      │
│ Fälligkeitsdatum: 03.03.2026                    │
├─────────────────────────────────────────────────┤
│ Rechnungsadresse:                               │
│ Herr Max Mustermann                             │
│ max@email.de                                    │
│ +49 123 456789                                  │
├─────────────────────────────────────────────────┤
│ Beschreibung          Anz  Preis      Gesamt   │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ Super Bowl LXI         1   17900.00   17900.00 │
│ Package - Dream...                              │
├─────────────────────────────────────────────────┤
│                       Gesamtbetrag: CHF 17900.00│
│                       Bereits bezahlt: CHF 0.00 │
│                       Noch offen: CHF 17900.00  │
├─────────────────────────────────────────────────┤
│ Zahlungsinformationen:                          │
│ Bank: UBS AG                                    │
│ IBAN: CH93 0076 2011 6238 5295 7                │
│ BIC/SWIFT: UBSWCHZH80A                          │
│ Zahlungsreferenz: RE-2027-0001                  │
└─────────────────────────────────────────────────┘
```

---

## 💾 **Datenbank:**

Neue Tabellen wurden automatisch erstellt:

### **`invoices` Tabelle:**
```sql
- id (UUID)
- invoice_number (RE-2027-0001)
- booking_id (Foreign Key)
- created_at, invoice_date, due_date
- total_amount, paid_amount
- status (open, partial, paid, cancelled)
- notes
```

### **`invoice_items` Tabelle:**
```sql
- id (UUID)
- invoice_id (Foreign Key)
- description (Text)
- quantity (Integer)
- unit_price (Decimal)
- total_price (Decimal)
```

---

## 🎨 **Status-Farben:**

| Status | Farbe | Bedeutung |
|--------|-------|-----------|
| **Offen** | 🔵 Blau | Noch keine Zahlung eingegangen |
| **Teilweise bezahlt** | 🟡 Gelb | Teilzahlung erhalten |
| **Bezahlt** | 🟢 Grün | Vollständig beglichen |
| **Storniert** | 🔴 Rot | Rechnung wurde storniert |

---

## 🔧 **API Endpoints:**

### **Rechnungen erstellen**
```http
POST /api/invoices
Content-Type: application/json

{
  "bookingId": "uuid",
  "items": [
    {
      "description": "Super Bowl Package",
      "quantity": 1,
      "unit_price": 17900,
      "total_price": 17900
    }
  ],
  "dueInDays": 14
}
```

### **Rechnungen abrufen**
```http
GET /api/invoices?bookingId=uuid
```

### **Zahlung verbuchen**
```http
PATCH /api/invoices/{id}
Content-Type: application/json

{
  "payment": 5000
}
```

### **PDF herunterladen**
```http
GET /api/invoices/{id}/pdf
```

---

## 📧 **Optional: Email-Versand**

Wenn du später Rechnungen per Email verschicken willst, kann ich noch integrieren:
- ✉️ **Nodemailer** oder **SendGrid**
- 📨 PDF als Anhang
- 📝 Personalisierte Email-Vorlage
- ⏰ Automatische Erinnerungen bei Fälligkeit

---

## 🎉 **Jetzt testen!**

1. Gehe zu `/admin`
2. Öffne eine Buchung
3. Klicke auf **"Rechnung"**
4. Erstelle eine Rechnung
5. Lade das PDF herunter!

Das PDF wird professionell aussehen und alle Details enthalten! 🚀
