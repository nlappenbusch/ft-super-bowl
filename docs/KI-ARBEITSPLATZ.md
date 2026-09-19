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
   - **Wichtig:** Die App liest mit eigenen Rechten, nicht mit denen der einzelnen Person.
     Alle Mitarbeitenden sehen über die KI also, was die App lesen darf. Persönliche
     OneDrives sperrt das Portal grundsätzlich. Darüber hinaus gilt: so eng wie möglich freigeben.
   - **Empfohlen:** Anwendungsberechtigung **`Sites.Selected`** und nur die Team-Sites
     freigeben, die die KI lesen soll (Graph `POST /sites/{site-id}/permissions`, Rolle `read`).
     Zusätzlich diese Sites im Arbeitsplatz unter ⚙︎ → „Nur diese SharePoint-Sites“ eintragen.
     Die Liste gilt dann für Suche **und** Lesen.
   - Einfacher, aber breiter: Entra ID → App-Registrierung der Portal-App → *API-Berechtigungen* →
     *Microsoft Graph* → *Anwendungsberechtigungen* → **`Sites.Read.All`** hinzufügen →
     **Administratorzustimmung erteilen**. Das öffnet alle SharePoint-Sites des Tenants (ausser
     OneDrives). Auch hier die Site-Liste setzen, sonst sucht die KI überall.
   - Danach die App neu starten (der Graph-Token wird ~1 h zwischengespeichert).
   - Der Status (Fusszeile des Arbeitsplatzes, ⚙︎ *Verbindungen*) zeigt die tatsächlich
     erteilten Berechtigungen der App.
   - Optional: Suche auf bestimmte Sites beschränken (⚙︎ → „Nur diese SharePoint-Sites“)
     oder die Such-Region fest setzen (sonst automatisch `CHE`, `EUR`, `NAM`).
   - Lesen: PDFs direkt, Word/Excel/PowerPoint lässt Graph für die KI als PDF rendern.

## Hintergrund-Agent & Erinnerungen

Die Faltin-KI arbeitet auch selbständig (alle 10 Minuten, abschaltbar unter ⚙︎ *Verbindungen*):

1. **Posteingang:** neue Mails in `request@` abholen und einordnen (nur lesen).
2. **Antwortvorschläge:** für dringende Kundenmails, die eine Antwort brauchen, einen Entwurf
   vorbereiten (höchstens 2 pro Lauf) — er liegt im Posteingang bereit, gesendet wird nichts.
3. **Erinnerungen** („die KI nervt, bis es erledigt ist“) — erscheinen oben in „Heute“ mit
   Direkt-Aktionen und als Glocke (nur Mo–Fr, 7–19 Uhr):
   - **Abwesenheitsantrag offen** (Zeitraum noch nicht vorbei) → die zuständige Genehmigungsperson (Team → „Genehmigt
     Abwesenheiten“); nach 3 Tagen zusätzlich alle Admins. Genehmigen/Ablehnen direkt in der
     Karte. Solange offen: täglich Glocke + **Erinnerungsmail** (max. 5×).
   - **Aufgabe überfällig** → Zuständige:r (täglich).
   - **Aufgabe seit >24 h ohne Zuständigkeit** → Admins (nur im Arbeitsplatz, ohne Glocke).
   - **Kunde wartet >24 h auf Antwort** → Zuständige:r (täglich); ohne Zuständigkeit an die
     Admins, dann nur im Arbeitsplatz.
   - **Abwesenheit beginnt in ≤3 Tagen** und es gibt Offenes → die Person selbst
     (Übergabe mit der KI vorbereiten, Abwesenheitsnotiz).
   - **Zuständige:r heute abwesend**, Aufgabe bald fällig/hoch → Stellvertretung bzw. Admins.
   Erinnerungen schliessen sich von selbst, sobald die Bedingung wegfällt. „Später“ stellt bis
   morgen zurück, „Erledigt“ beendet sie.
4. **Protokoll:** Fusszeile in „Heute“ zeigt, was die KI in den letzten 24 h erledigt hat;
   Admins können einen Lauf sofort starten (▶).

Wichtig für den Genehmigungsweg: Neue Microsoft-Logins sind standardmässig **Admin**. Damit
Genehmigungen greifen, unter *Team & User* die Rollen setzen (Mitarbeiter:in) und je Person
eintragen, wer Abwesenheiten genehmigt.

## Technik (Kurzfassung)

- Chat: `POST /api/admin/workspace/chat` → NDJSON-Stream (`meta`, `text`, `tool`, `draft`,
  `notice`, `error`, `done`). Manuelle Tool-Schleife mit dem Anthropic-SDK (`src/lib/workspace/agent.ts`),
  max. 14 Schritte pro Nachricht, Werkzeuge laufen parallel.
- Werkzeuge: Portal-Registry `src/lib/portalTools.ts` (geteilt mit dem MCP-Server) +
  Arbeitsplatz-Werkzeuge `src/lib/workspace/tools.ts`.
- Dateien werden einmal zur Anthropic-Files-API hochgeladen und per `file_id` referenziert
  (Verlauf bleibt klein und append-only). Löschen eines Chats löscht auch diese Dateien.
- Tabellen: `ws_conversations`, `ws_messages`, `ws_files`, `ws_knowledge`, `ws_mail_triage`,
  `ws_nudges`, `ws_agent_runs` (angelegt durch `src/lib/workspace/schema.ts`).
- Agent: `src/lib/workspace/agentRunner.ts` (Scheduler in `src/instrumentation.ts`),
  Regeln in `src/lib/workspace/nudges.ts`.
