# KI-Arbeitsplatz `/working-dashboard`

Der Arbeitsplatz für alle Mitarbeitenden von Faltin Travel. Nach dem Login landet man hier.
Kern ist die **persönliche Faltin-KI**: ein Chat, der die Werkzeuge des Portals selbst benutzt.

## Was man damit tun kann

| Bereich | Was passiert |
|---|---|
| **Chat** | Fragen stellen, Dateien hineinziehen (PDF, Word, Excel, PowerPoint, Bilder, Text/CSV). Die KI sucht Kunden und Anfragen, liest Mailverläufe, baut Kalkulationen und **Angebotsentwürfe**, legt Aufgaben an, sucht in SharePoint und im Teamwissen. Jeder Arbeitsschritt erscheint als Chip; Änderungen sind orange markiert und verlinkt. |
| **Check-in** | Beim Öffnen schaut die KI über den Tag und fragt nach („Hast du an … gedacht?“) – ein Klick übernimmt den Vorschlag in den Chat. |
| **Heute** | Kunden, die auf Antwort warten, eigene Aufgaben (überfällig zuerst), neue unverteilte Anfragen, ruhende Anfragen, Angebotsentwürfe, Stand Posteingang. Jeder Eintrag hat einen Knopf „Mit der KI angehen“. |
| **Posteingang** | Die neuesten Mails aus `request@` werden von der KI eingeordnet (Kategorie, Priorität, Kurzfassung, nächster Schritt). „Antwort vorschlagen“ erzeugt einen Entwurf mit Kontext aus Anfrage, Verlauf und Teamwissen. |
| **Wissen** | Gemeinsames Teamwissen (Abläufe, Regeln, Antwortbausteine). Entsteht von Hand oder im Chat („Soll ich das fürs Team festhalten?“). Angeheftete Einträge kennt die KI in jedem neuen Chat. |
| **Werkstatt** | Ideen für neue Werkzeuge. Jede Idee wird eine Aufgabe „KI-Umsetzung angefragt“ im Projekt *KI-Werkstatt (Werkzeug-Ideen)*; Kolleg:innen stimmen mit „Brauche ich auch“ ab. |

## Leitplanken

- Die KI **versendet nie selbst**. Antworten kommen als Entwurfskarte: der Mensch prüft und
  klickt „Prüfen & senden“ (über das CRM, mit Rückfrage) oder „Als Outlook-Entwurf ablegen“.
- **Keine Rechnungen** durch die KI – das bleibt im Kalkulationsmodul beim Menschen.
- Das Postfach wird **nur gelesen**: Gelesen-Status, Ordner und Inhalte bleiben unverändert
  (das Inbound-Polling arbeitet mit dem Ungelesen-Status).
- Inhalte aus Mails, Dateien und SharePoint gelten als Daten, nicht als Anweisungen.
- Chats gehören der jeweiligen Person. Teamwissen, Posteingang-Status und Werkstatt sind geteilt.

## Einrichtung

1. **KI:** Anthropic API-Key unter *Admin → KI-Redaktion* (derselbe Key). Modell für die
   Faltin-KI im Arbeitsplatz unter ⚙︎ *Verbindungen* (Standard `claude-opus-5`).
2. **Postfach:** nutzt die bestehende M365-Anbindung (*Admin → E-Mail / M365*), keine neuen Rechte.
   Antwort-Entwürfe landen in den Entwürfen von `request@` (Graph `createReply`, Recht `Mail.ReadWrite` ist vorhanden).
3. **SharePoint (einmalig durch eine:n M365-Admin):**
   - Entra ID → App-Registrierung der Portal-App → *API-Berechtigungen* →
     *Microsoft Graph* → *Anwendungsberechtigungen* → **`Sites.Read.All`** hinzufügen →
     **Administratorzustimmung erteilen**.
   - Danach die App neu starten (der Graph-Token wird ~1 h zwischengespeichert).
   - Der Status (Fusszeile des Arbeitsplatzes, ⚙︎ *Verbindungen*) zeigt die tatsächlich
     erteilten Berechtigungen der App.
   - Optional: Suche auf bestimmte Sites beschränken (⚙︎ → „Nur diese SharePoint-Sites“)
     oder die Such-Region fest setzen (sonst automatisch `CHE`, `EUR`, `NAM`).
   - Lesen: PDFs direkt, Word/Excel/PowerPoint lässt Graph für die KI als PDF rendern.

## Technik (Kurzfassung)

- Chat: `POST /api/admin/workspace/chat` → NDJSON-Stream (`meta`, `text`, `tool`, `draft`,
  `notice`, `error`, `done`). Manuelle Tool-Schleife mit dem Anthropic-SDK (`src/lib/workspace/agent.ts`),
  max. 14 Schritte pro Nachricht, Werkzeuge laufen parallel.
- Werkzeuge: Portal-Registry `src/lib/portalTools.ts` (geteilt mit dem MCP-Server) +
  Arbeitsplatz-Werkzeuge `src/lib/workspace/tools.ts`.
- Dateien werden einmal zur Anthropic-Files-API hochgeladen und per `file_id` referenziert
  (Verlauf bleibt klein und append-only). Löschen eines Chats löscht auch diese Dateien.
- Tabellen: `ws_conversations`, `ws_messages`, `ws_files`, `ws_knowledge`, `ws_mail_triage`
  (angelegt durch `src/lib/workspace/schema.ts`).
