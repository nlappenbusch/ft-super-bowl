# Supabase Setup Anleitung

## Schritt 1: Supabase Projekt erstellen

1. Gehe zu [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Klicke auf "New Project"
3. Wähle deine Organisation (oder erstelle eine neue)
4. Fülle aus:
   - **Project Name**: `super-bowl-bookings` (oder ein anderer Name)
   - **Database Password**: Wähle ein sicheres Passwort (gut aufbewahren!)
   - **Region**: `Europe (Frankfurt)` (oder näher an deinem Standort)
5. Klicke auf "Create new project"
6. Warte 1-2 Minuten bis das Projekt bereit ist

## Schritt 2: API Credentials kopieren

1. In deinem Supabase Dashboard, gehe zu **Settings** (Zahnrad-Icon links unten)
2. Klicke auf **API**
3. Du siehst nun:
   - **Project URL** (z.B. `https://abcdefghijkl.supabase.co`)
   - **anon public** Key (lange Zeichenkette)

4. Kopiere diese Werte in deine `.env.local` Datei:

```env
NEXT_PUBLIC_SUPABASE_URL=https://DEIN-PROJEKT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key-hier
ADMIN_PASSWORD=super-bowl-2027-admin
```

**Wichtig:** Die `.env.local` Datei sollte NIE ins Git committed werden (ist bereits in `.gitignore`)!

## Schritt 3: Datenbank Schema erstellen

1. In deinem Supabase Dashboard, gehe zu **SQL Editor** (links im Menü)
2. Klicke auf **New Query**
3. Öffne die Datei `supabase-setup.sql` in deinem Projekt
4. Kopiere den GESAMTEN Inhalt dieser Datei
5. Füge ihn in den Supabase SQL Editor ein
6. Klicke auf **RUN** (oder Ctrl/Cmd + Enter)
7. Du solltest sehen: "Success. No rows returned"

### Was wurde erstellt?

- ✅ Tabelle `booking_requests` mit allen Feldern
- ✅ Indexes für schnelle Suche (created_at, status, email)
- ✅ Auto-Update Trigger für `updated_at` Feld
- ✅ Row Level Security (RLS) Policies
- ✅ Test-Daten (1 Beispiel-Buchung)

## Schritt 4: Verifizierung

1. Gehe zu **Table Editor** in Supabase
2. Wähle die Tabelle `booking_requests`
3. Du solltest 1 Zeile sehen (Test-Buchung von Max Mustermann)
4. Wenn ja: **Alles funktioniert!** ✅

Du kannst die Test-Zeile löschen oder behalten.

## Schritt 5: Next.js App neu starten

Da wir neue Environment Variables hinzugefügt haben:

```powershell
# Stoppe den Dev Server (Ctrl+C)
# Starte ihn neu:
npm run dev
```

## Schritt 6: Testen

### Test 1: Buchung abschicken
1. Öffne [http://localhost:3000/booking](http://localhost:3000/booking)
2. Fülle das Formular aus
3. Klicke auf "Buchung abschließen"
4. Gehe zu Supabase → Table Editor → `booking_requests`
5. Du solltest deine neue Buchung sehen!

### Test 2: Admin Dashboard
1. Öffne [http://localhost:3000/admin](http://localhost:3000/admin)
2. Passwort: `super-bowl-2027-admin`
3. Du solltest alle Buchungen sehen können
4. Teste Status-Änderungen
5. Teste Notizen speichern
6. Teste CSV Export

## Troubleshooting

### Problem: "Failed to fetch"
- ✅ Überprüfe dass `.env.local` die richtigen Werte hat
- ✅ Starte den Dev Server neu (`npm run dev`)
- ✅ Überprüfe dass die Supabase URL mit `https://` beginnt

### Problem: "Policy violation" oder "RLS policy"
- ✅ Stelle sicher dass du das komplette SQL Script ausgeführt hast
- ✅ Die RLS Policies sollten automatisch erstellt worden sein
- ✅ Gehe zu **Authentication** → **Policies** und prüfe ob Policies existieren

### Problem: "relation does not exist"
- ✅ Du hast wahrscheinlich das SQL Script nicht ausgeführt
- ✅ Gehe zu SQL Editor und führe `supabase-setup.sql` aus

## Sicherheitshinweise für Production

Wenn du live gehst, solltest du:

1. **Admin Passwort ändern**: Setze `ADMIN_PASSWORD` in `.env.local` auf einen sicheren Wert
2. **RLS Policies verschärfen**: Die aktuellen Policies erlauben öffentlichen Zugriff (für Development ok)
3. **Rate Limiting**: Füge Rate Limiting zur API Route hinzu
4. **CORS**: Passe CORS in `next.config.ts` an (nur von WordPress Domain erlauben)
5. **Session Management**: Ersetze `sessionStorage` durch echte Session-Cookies

## Support

Bei Problemen:
- Supabase Docs: [https://supabase.com/docs](https://supabase.com/docs)
- Next.js Docs: [https://nextjs.org/docs](https://nextjs.org/docs)
