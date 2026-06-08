# E-Mail-Konversation über Microsoft 365 (Graph) – Setup

Das CRM versendet Bestätigungs- und Antwortmails über euer echtes M365-Postfach
(`request@faltintravel.com`) und holt Kundenantworten automatisch ins CRM zurück.
Jede Anfrage bekommt eine fortlaufende Nummer **`RQ-12345`**, die im Betreff steht
und für die Zuordnung beim Antworten genutzt wird.

## 1. Shared Mailbox anlegen (empfohlen)

Microsoft 365 Admin Center → Teams & Gruppen → **Shared Mailboxes** → `request@faltintravel.com`.
Shared Mailboxes brauchen **keine** Lizenz.

## Schnellweg: Setup-Script aus dem Admin-Panel

Im Adminbereich unter **E-Mail / Microsoft 365 → „Setup-Script generieren"** kannst du
ein fertiges PowerShell-Script erzeugen (App-Name + Postfach eingeben, optional
„Zugriff auf Postfach beschränken"). Das Script legt App-Registrierung,
Berechtigungen, Admin-Consent, Client-Secret und (optional) die
ApplicationAccessPolicy automatisch an und gibt am Ende `TENANT_ID / CLIENT_ID /
CLIENT_SECRET` aus. Diese Werte trägst du anschließend **direkt im selben Panel**
unter „Konfiguration" ein (kein .env-Eintrag nötig – die Panel-Werte haben Vorrang).

Die folgenden Schritte sind die manuelle Alternative.

## 2. App-Registrierung in Entra ID (Azure AD)

1. https://entra.microsoft.com → **App registrations** → **New registration**
   - Name: z.B. `Faltin CRM Mailer` · Single tenant · keine Redirect-URI nötig.
2. Auf der Übersicht notieren:
   - **Directory (tenant) ID** → `GRAPH_TENANT_ID`
   - **Application (client) ID** → `GRAPH_CLIENT_ID`
3. **Certificates & secrets** → **New client secret** → Wert kopieren → `GRAPH_CLIENT_SECRET`
   (nur einmal sichtbar!).
4. **API permissions** → **Add a permission** → **Microsoft Graph** → **Application permissions**:
   - `Mail.Send`
   - `Mail.ReadWrite`
   → danach **Grant admin consent** klicken (Häkchen müssen grün sein).

### Optional, aber empfohlen: Zugriff einschränken

Standardmäßig dürfte die App als **jedes** Postfach senden/lesen. Per
ApplicationAccessPolicy auf `request@` beschränken (Exchange Online PowerShell):

```powershell
New-ApplicationAccessPolicy -AppId <GRAPH_CLIENT_ID> `
  -PolicyScopeGroupId request@faltintravel.com `
  -AccessRight RestrictAccess `
  -Description "Faltin CRM Mailer nur request@"
```

## 3. .env setzen

```
GRAPH_TENANT_ID=...
GRAPH_CLIENT_ID=...
GRAPH_CLIENT_SECRET=...
GRAPH_MAILBOX=request@faltintravel.com
GRAPH_FROM_NAME=Faltin Travel
INBOUND_POLL_SECRET=<ein-langes-zufalls-token>
```

Ohne diese Variablen läuft alles normal weiter – der Mailversand wird nur
stillschweigend übersprungen (wie bei Brevo ohne Key).

## 4. Inbound-Poll (Kundenantworten ins CRM)

Endpoint: `GET /api/inbound/poll?secret=<INBOUND_POLL_SECRET>`

Liest ungelesene Mails aus `request@`, matcht `RQ-…` im Betreff, hängt die Nachricht
an den passenden Lead und markiert die Mail als gelesen.

Per Cron alle paar Minuten aufrufen, z.B.:

```
*/5 * * * * curl -s "https://superbowl.faltintravel.com/api/inbound/poll?secret=DEIN_TOKEN" > /dev/null
```

(oder Vercel Cron / einen externen Scheduler.)

## 5. Brevo-Listen (Marketing) – wo pflegen?

Pro Event im Admin: **Events → Event bearbeiten → „🔗 Brevo Listen-ID"**.
Neue Anfragen werden dieser Liste **zusätzlich** zugeordnet (bestehende
Listenmitgliedschaften des Kontakts bleiben erhalten). `BREVO_API_KEY` in `.env` setzen.

## 6. Datenbank-Migration

- **Supabase:** `supabase-setup.sql` im SQL-Editor erneut ausführen (idempotent) –
  legt `request_number`, die Sequenz + RPC `next_request_number()` und die Tabelle
  `booking_messages` an.
- **SQLite (lokal):** passiert automatisch beim Start.
