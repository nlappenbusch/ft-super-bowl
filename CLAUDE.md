# CLAUDE.md — Projektgedächtnis (Faltin Travel Sports Events)

Dieses Dokument gibt jeder KI-/Dev-Session sofort den vollen Kontext. **Bei Architektur-,
Deploy- oder Konventionsänderungen hier mitpflegen.**

## Überblick
Sportreisen-Buchungsplattform (Tickets + Hotel + Hospitality) für Faltin Travel AG.
Generische Event-/Serien-Struktur (Super Bowl, French Open, WM, EM, CL-Finale, …).

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, **PostgreSQL (`pg`)** mit umschaltbarem SQLite-Fallback (`better-sqlite3`), lucide-react.
- **Repo:** `github.com/nlappenbusch/ft-super-bowl`
- **Prod:** `https://next.faltintravel.com`

## Datenmodell (`data/` — JSON, kein DB-Server für Content)
- `series.json` — Evergreen-Hubs (intro_text, highlights, seo_text, faqs, guide_sections).
- `events.json` — datierte Events, via `series_id` an Serie gehängt. Route: `/[series]/[event]`.
- `packages.json` — Buchbare Pakete (event_id/event_slug, includes[], price, …). Nur `active:true` wird angezeigt.
- `faqs.json` — Event-FAQs (keyed by event_id).
- `settings.json` — Admin-editierbare Config (company, bank, invoice, mail, **ai**). Hat Vorrang vor `.env`.
- **Transaktionsdaten (Buchungen, Rechnungen, Expenses, CRM-Messages, Counter, HR, Tippspiel, Kunden): PostgreSQL** (Container `db`, Volume `pgdata`). `data/bookings.db` (SQLite) bleibt als Fallback/Rollback erhalten, ist aber im Normalbetrieb inaktiv.

Laufzeit-Lesen Content: `src/lib/contentStore.ts` (`findPackagesByEvent` etc.).

## Datenbank-Backend (umschaltbar) — WICHTIG
- **`src/lib/dbq.ts`** ist die zentrale Abstraktion: `dbGet/dbAll/dbRun/withTx` laufen je nach `DB_BACKEND` über `pg` (Postgres) ODER `better-sqlite3` (SQLite). **Alle Stores sind async** (`database.ts`, `customerStore.ts`, `staffStore.ts`, `tippspielStore.ts`, `tippspielAuth.ts`, Wrapper `bookingStore/invoiceStore/expenseStore`). SQL weiterhin im SQLite-Dialekt mit `?`-Platzhaltern schreiben — `dbq` übersetzt für pg (`?`→`$n`, `datetime('now')`, `INSERT OR IGNORE`→`ON CONFLICT DO NOTHING`). `instr()`/`COLLATE NOCASE` vermeiden (JS-Fallback bzw. `lower()`).
- **Connection (pg):** diskrete Parameter (`PGHOST/PGPORT/POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB`), NICHT `DATABASE_URL` — ein `/` o.ä. im Passwort bricht sonst das URL-Parsing. `pg.ts` setzt Type-Parser (bigint/numeric → JS-Zahl).
- **pg-Schema:** Tabellen+Daten kommen aus der Migration (`pgMigrate.ts`, introspektiert SQLite → kopiert). `dbq.applyPgSchemaEnhancements()` ergänzt Defaults (Timestamp-Spalten), Unique-Constraints (für `ON CONFLICT`), Indizes und den `updated_at`-Trigger — wird vom Migrator und beim pg-Start (`ensurePgSchema`) aufgerufen.
- **Flip auf Postgres:** in `/opt/super-bowl/.env` `DB_BACKEND=postgres` setzen → `docker compose up -d` (rekreiert App-Container in Sekunden, kein Rebuild). **Rollback:** `DB_BACKEND=sqlite` + `docker compose up -d` (SQLite bleibt unberührt).
- **Daten-(Re)Migration SQLite→PG:** POST `/api/admin/db/migrate` (admin-gated, im Browser-Console ausführen). Non-destruktiv für SQLite (nur lesend), TRUNCATE+Copy in PG. Details: `docs/POSTGRES-MIGRATION-RUNBOOK.md`.

## Deploy & Content-Seed — WICHTIG
- Push auf **`main`** → GitHub Actions (self-hosted runner) → `deploy.sh` → `docker compose` baut neu & startet `super-bowl-app`.
- `data/` ist **gitignored** und ein **persistentes Volume** (`./data:/app/data`).
- `docker-entrypoint.sh` rollt beim Start `data-seed/*.json` ins Volume — **nur wenn `data-seed/SEED_VERSION` sich ändert**. `bookings.db` & `settings.json` werden **nie** überschrieben.
- **Daher: Content-Änderungen (events/series/packages/faqs) gehen NUR live, wenn man `data-seed/<datei>.json` aktualisiert UND `data-seed/SEED_VERSION` hochzählt.** Lokales `data/` allein reicht nicht.
- **Der Seed ist ADDITIV (Merge nach `id`):** bestehende Volume-Einträge werden NIE überschrieben (schützt Admin-Bearbeitungen). **Updates an bestehenden Einträgen:** id in `data-seed/SEED_REPLACE_IDS` listen (eine pro Zeile, `#` = Kommentar) + `SEED_VERSION` bumpen → genau diese Einträge werden ersetzt. Der Replace ist **verlustarm**: nur-live-Felder (z.B. `auto_reply_*`) bleiben erhalten, der alte Eintrag landet in `data/backups/replaced/`, das Feld-Diff im Container-Log. Seed-Werte überschreiben aber gleichnamige live geänderte Felder — **daher gilt: Updates an bestehendem Content bevorzugt über die Admin-API einspielen** (additiv, wie beim Monaco-Streckenplan-Link); `SEED_REPLACE_IDS` nur mit dokumentiertem Prod-Diff im PR.
- **Content-Sicherheitsnetze (seit Vorfall 01.07./09.07.):** (1) Bei jedem Container-Start werden die Content-JSONs nach `data/backups/content-json-<ts>.tar.gz` gesichert (Rotation 60). (2) Bei jedem Speichern über den `contentStore` entsteht ein gzip-Snapshot in `data/backups/history/` (Rotation 100/Datei) — auflisten/ansehen/wiederherstellen über `GET|POST /api/admin/content-history`. (3) Beim App-Start läuft ein Drift-Check, der bei verdächtigem Content-Schwund eine Alarm-Mail an `notify_to` schickt. Writes sind atomar; unlesbare JSON-Dateien blockieren Writes statt still den Fallback zu persistieren.
- Build läuft ohne `data/` (Fallback auf Seed/Defaults), daher baut CI/Docker auch ohne Volume.

## Mail / SSO (Microsoft 365 Graph, App-only)
- Config in `settings.json.mail` (tenant_id, client_id, client_secret, mailbox, …), ENV-Fallback.
- **Prod nutzt App `fd6880b3-…`** (Mail UND SSO teilen dieselbe App via `mailConfig()`).
- **Token-Cache** in `graphMailer.ts` (~1h): nach Credential-Wechsel **Container-Restart/Redeploy** nötig.
- **Exchange Application Access Policy (RAOP):** App braucht Freigabe aufs Postfach (`request@`), sonst `403 ErrorAccessDenied … RAOP`. Policy via `New-ApplicationAccessPolicy` (RestrictAccess auf Scope-Gruppe). Nur EINE Policy pro App — Doppel-Policies → Schnittmengen-Sperre.
- **SSO-Redirect-URI** `https://next.faltintravel.com/api/auth/microsoft/callback` muss bei der aktiven App registriert sein (sonst `AADSTS500113`). Basis-URL kommt aus `settings.mail.login_base_url` bzw. Request-Host.
- **Lokaler Admin-Login:** User `localadmin`, PW `LOCAL_ADMIN_PASSWORD` (Default `faltin-localadmin-2026`).

## API-Auth (Routen außerhalb von /api/admin) — WICHTIG
- Die Middleware schützt NUR `/admin/*` + `/api/admin/*`. Sensible Routen außerhalb
  (z.B. `/api/bookings` GET, `/api/invoices*`, `/api/expenses*`, `/api/settings`,
  `/api/bookings/[id]/messages|reply`) prüfen selbst per `requireAdminSession()` aus
  `src/lib/apiGuard.ts` (401 ohne Session). **Neue Routen außerhalb `/api/admin`:
  Guard einbauen**, außer bewusst öffentlich (POST `/api/bookings` = Buchungsformular/
  WordPress-CORS; Content-Routen events/series/faqs/package*; `/api/health`;
  Portal/Tippspiel/`/api/ext` haben eigene Auth).
- Interne Loopback-Calls (Portal → Rechnungs-PDF) authentifizieren sich mit
  `internalApiKey()` (Header `x-internal-key`, aus `AUTH_SECRET` abgeleitet).
- Cron-Endpoints `/api/inbound/poll` + `/api/status/scan`: Secret ODER Admin-Session,
  fail-closed (Mail-Polling läuft ohnehin in-process via `instrumentation.ts`).

## KI-Redaktion
- Config: `settings.json.ai` (anthropic_api_key, model; Default `claude-sonnet-4-6`).
- `src/lib/aiAssist.ts` (Anthropic Messages API, multimodal), `src/lib/urlFetch.ts` (HTML→Text).
- Endpoints: `/api/admin/ai/{config,status,import,fetch}`. Admin-Seite: `/admin/ai`.
- Modul-Registry (`MODULE_SPECS`) definiert Ziel-JSON pro Modul (intro/highlights/seo/leistungen/wissenswertes/faq).

## KI-Arbeitsplatz `/working-dashboard` (persönliche Faltin-KI)
Arbeitsplatz für alle Mitarbeitenden (Startseite nach dem Login): Chat mit der persönlichen
Faltin-KI, „Heute“-Übersicht, KI-sortierter Posteingang, Teamwissen, Werkstatt. Details und
Einrichtung (SharePoint-Berechtigung): `docs/KI-ARBEITSPLATZ.md`.

- **Code:** `src/lib/workspace/*` (Server), `src/components/workspace/*` (UI),
  `src/app/api/admin/workspace/*` (API, durch die Middleware geschützt), Seite
  `src/app/working-dashboard/page.tsx` (Middleware-Matcher + NavBar/Footer-Ausnahme).
- **Werkzeuge:** `src/lib/portalTools.ts` ist die gemeinsame Werkzeug-Registry für den
  MCP-Server UND die Faltin-KI (nur `ToolContext` unterscheidet sich). Neues Portal-Werkzeug =
  dort eintragen → steht beiden zur Verfügung. Arbeitsplatz-eigene Werkzeuge (Posteingang,
  SharePoint, Teamwissen, Werkstatt, Entwürfe) in `src/lib/workspace/tools.ts`.
- **KI-Regeln (hart):** versendet NIE selbst Mails (nur `prepare_reply_draft` → Mensch sendet
  per Klick bzw. Outlook-Entwurf), erzeugt keine Rechnungen (`create_invoice_from_offer`
  ausgeschlossen). Postfach wird nur gelesen — Gelesen-Status bleibt unberührt (Inbound-Poll!).
- **Modell/SDK:** `@anthropic-ai/sdk`, Modell aus `settings.ai.workspace_model` (Standard
  `claude-opus-5`), Server-Fallback bei Ablehnungen (`fallbacks: 'default'`). Chatverlauf ist
  **append-only** (System-Prompt pro Chat eingefroren, Dateien per Files-API-`file_id`) — nie
  frühere Nachrichten umschreiben, sonst werden Prompt-Cache und Thinking-Blöcke ungültig.
- **Tabellen** `ws_*` legt `src/lib/workspace/schema.ts` selbst an (SQLite und Postgres,
  einmal pro Prozess) — bewusst getrennt von `database.ts`/`dbq.ts`.
- **Hintergrund-Agent** (`agentRunner.ts`, alle 10 min via `instrumentation.ts`, Schalter
  `settings.ai.workspace_agent_enabled`): Mails sortieren, Antwortvorschläge für dringende
  Mails, Erinnerungen (`nudges.ts`: Urlaub genehmigen, überfällige/unverteilte Aufgaben,
  wartende Kunden, Übergabe vor Abwesenheit, Vertretung) → Glocke + „Heute“, Genehmigende
  zusätzlich täglich per Mail. Neue Erinnerungsart = Regel in `computeDesiredNudges()`.

## Faltin Mail (`/mail`, mail.faltintravel.com)
Eigener Mail-Client für alle Mitarbeitenden: eigenes Postfach + freigegebene Postfächer,
Geschäftskontext (Kunde, CRM-Anfragen, Tickets, verwandte Mails), KI-Suche, KI-Auswertung
mit Übernahme in Prozesse, Vorlagen/Textbausteine und Schreib-Assistent.

- **Code:** `src/lib/mailbox/*` (Server), `src/components/mail/*` (UI), `src/app/api/admin/mailbox/*`
  (API, durch die Middleware geschützt), Seite `src/app/mail/page.tsx` (eigenes Vollbild-Layout,
  NavBar/Footer-Ausnahme).
- **Host:** `mail.faltintravel.com` (bzw. `MAIL_CLIENT_HOST`) — die Middleware leitet dort `/` auf
  `/mail` um; Login/SSO-Callback bleiben auf dem Mail-Host (`src/lib/mailHost.ts`). Die
  Redirect-URI `https://mail.faltintravel.com/api/auth/microsoft/callback` muss bei der SSO-App
  registriert sein.
- **Rechte kommen aus Exchange:** `access.ts` liest per Exchange-REST (`exchange.ts`, nur `Get-*`)
  Vollzugriff (lesen) und «Senden als» (senden), Cache 15 min, Knopf «neu laden» in der Sidebar.
  Admin-Einstellungen (Senden mit Vollzugriff, ausgeblendete Postfächer, Zusatzfreigaben) in
  `mail_prefs` (`__global__`). Jede Route prüft das Postfach über `resolveMailboxes()`.
- **Versand** immer als Entwurf → `send` (createReply/createReplyAll/createForward, eigener Text vor
  dem Zitat). Die KI sendet NIE. Mails mit RQ-/TASK-Nummer im Betreff landen zusätzlich im
  CRM-Verlauf bzw. in den Ticket-Nachrichten.
- **Signatur hängt an der Person** (wie bisher in Outlook): Faltin-Vorlage in `prefs.ts`
  (`DEFAULT_SIGNATURE_TEMPLATE`, DE + EN), Funktion/Mobil je Person, eigene HTML-Signatur möglich.
  Grussformel ist eine eigene Zeile im Editor (Vorlagen setzen sie über das Feld `greeting`).
  Bei Mails nur an @faltintravel.com fällt die Signatur automatisch weg.
- **Vorlagen/Bausteine:** Tabelle `mail_templates`, Startbestand `defaultTemplates.ts` (aus den
  gesendeten Faltin-Mails abgeleitet, wird nur bei leerer Tabelle eingespielt). Platzhalter
  `{{key}}`, fehlende Werte werden im Editor als gelbe Lücke `[[key]]` markiert und vor dem
  Senden angemahnt. Tonalität für die KI: `tone.ts`.
- **Teams-Wechsel:** `teams.ts` prüft je Beteiligtem im Verzeichnis (intern mit Teams-Lizenz `TeamspaceAPI`, Gast, extern) und baut Deep-Links `teams.microsoft.com/l/chat/0/0?users=…` (1:1 bzw. Gruppenchat mit Betreff als Thema). Externe sind nur per Föderation erreichbar — app-only nicht vorab prüfbar.
- **KI-Suche** (`ai.ts → aiSearch`): eigenes Modell `settings.ai.mail_search_model` (Standard
  `claude-sonnet-5-5`, Tempo), Werkzeuge laufen pro Runde parallel, liest zusätzlich Portal-Daten
  (Events, Anfragen/Buchungen, Kunden aus `portalTools`). Fortschritt kommt als NDJSON-Stream
  (`{action:'search', stream:true}`), der Client zeigt die Schritte live und kann abbrechen.
  Keine erzwungene Werkzeugwahl (`tool_choice: tool` lehnen neuere Modelle ab).
- **Zeitlimits:** Einzelne Postfächer hängen bei Exchange sporadisch 20–60 s. `gjson()` hat je
  Versuch ein Zeitlimit und ein Gesamtbudget; die Sammelansicht gibt hängende Postfächer als `slow`
  zurück, der Client zeigt die übrigen sofort und lädt still nach. Listen werden je Ansicht im Client
  zwischengespeichert (sofortige Anzeige, Aktualisierung im Hintergrund).
- **Mail öffnen:** `open()` in `MailApp.tsx` hat eine Reihenfolge-Sperre (`openSeq` + Abort), nur die
  zuletzt angeklickte Mail füllt den Leser. Inhalt (`&thread=0`) und Verlauf (`part=thread&cid=`)
  laden getrennt und parallel. Geöffnete Mails liegen im Client-Cache (60), die Nachbarn werden
  vorgeladen. Zeitlimits: Inhalt 12/20 s, Verlauf 6/9 s.
- **Spiegel (`src/lib/mailbox/mirror.ts`):** Listen kommen aus der eigenen DB statt live von
  Microsoft. Gespiegelt werden NUR Kopfdaten (Tabellen `mail_sync_msgs`, `mail_sync_folders`), je
  Postfach einmal, Fenster 12 Monate, ca. 1–2 KB je Mail. Ordner werden beim ersten Anzeigen
  registriert und per Graph-Delta abgeglichen (Takt in `instrumentation.ts` alle 30 s: Posteingang
  nach 60 s, andere Ordner nach 3 min fällig; beim Anzeigen zusätzlich, wenn älter als 15 s).
  Erstabgleich in Etappen (15 Seiten à 100 je Lauf). Ordner, die 30 Tage niemand ansieht, fliegen
  raus. Lesen/Markieren/Verschieben schreiben sofort durch. Suche und Verlauf laufen live, mit dem
  Spiegel als Ersatz bei Hängern. Inhalte und Anhänge kommen immer live. Diagnose:
  `GET /api/admin/mailbox/mirror` (Admins). Notbremse: `MAIL_MIRROR=off` (dann alles live).
- **Exchange-Ausfall:** Graph und Exchange wiederholen auch bei Verbindungsfehlern («fetch failed»;
  einzelne Microsoft-Frontends sind zeitweise unerreichbar). Der letzte vollständige Stand der
  Freigaben liegt in `mail_prefs` (`__state__:exchange_directory`) und springt ein, wenn Exchange
  nicht antwortet. Scheitert eine einzelne Rechteabfrage, gilt der ganze Lauf als Fehler (lieber alt
  als unvollständig).
- **Tabellen** `mail_templates`, `mail_prefs`, `mail_links` legt `src/lib/mailbox/schema.ts` selbst
  an (wie `ws_*`).

## Präsentations-Builder (TASK-00126)
Folienbasierte Kundendecks im Faltin-Design (16:9, dunkler Grund, Textspalte links,
Bildspalte rechts) — Vorlage ist das gedruckte Ryder-Cup-Deck.

- **Admin:** `/admin/praesentationen` (Übersicht, Anlegen) und `/admin/praesentationen/[id]`
  (Folienliste, massstabsgetreue Vorschau, Inspector). Speichert automatisch 1.2 s nach
  der letzten Eingabe.
- **Datenmodell:** Tabelle `presentations` (Folien + Metadaten als JSON in der Zeile).
  **Neue Tabellen müssen in `database.ts` UND in `dbq.applyPgSchemaEnhancements()` stehen** —
  die pg-Migration introspektiert nur Bestandstabellen.
- **Eine Geometrie, drei Ausgaben:** `lib/presentation/theme.ts` (normierte Flächen 0..1,
  Schriftgrössen als Anteil der Folienhöhe) und `blocks.ts` (linearer Inhaltsplan je Folie)
  sind die gemeinsame Quelle für Web (`components/presentation/SlideCanvas.tsx`, feste Bühne
  1280×720 px + `scale()`), PDF (`pdf.ts`, 960×540 pt) und PPTX (`pptx.ts`, 13.333×7.5 in).
  Folienhöhe PDF = PPTX = 540 pt, daher sind Schriftgrössen 1:1 übertragbar.
- **Bilder:** `assets.ts` schneidet serverseitig per sharp auf das Zielverhältnis zu
  (jsPDF/PPTX können kein „cover"), rendert den Verlauf als Bild und stellt das
  Reisegarantie-Siegel frei. Nur den weissen RAND trimmen — das Logo hat schwarze Schrift
  auf weissem Feld, ein Freistellen aller weissen Flächen radiert sie aus.
- **jsPDF kann nur WinAnsi:** Zeichen wie ★ oder ✓ werden in `pdf.ts` ersetzt (`winAnsi()`),
  Haken/Kreuze zeichnet der Renderer als Vektor. Fett-Auszeichnung `**…**` wird in allen
  drei Ausgaben unterstützt; im PDF hält `glue` Satzzeichen ohne Leerzeichen am fetten Wort.
- **Export:** `GET /api/admin/presentations/[id]/export?format=pdf|pptx`.
- **Teil-Link:** `/p/[token]` + `GET /api/p/[token]` (PDF) sind bewusst ohne Session — der
  Token ist die Berechtigung, `getDeckByToken` liefert nur freigegebene Decks. `robots.ts`
  sperrt `/p/`, die Seite setzt zusätzlich `noindex`.
- **KI:** `POST /api/admin/presentations/[id]/ai` — Text überarbeiten/kürzen/ausformulieren,
  Bildsuche (`incentive/images.ts`) und Übersetzung des ganzen Decks (de/en/fr).
- **Übernahme aus dem Incentive-Planer:** `templates.ts → slidesFromIncentive()`.

## DERTOUR-Suche (Traffics Connector API v3) in der Kalkulation
- **Code:** `src/lib/trafficsModel.ts` (reine Logik: Parameter, Query, Antwort → Treffer, Treffer → Positionen; Tests in `tests/`, `npm test`), `src/lib/traffics.ts` (Server: Fetch, Cache, Drossel), Routen `/api/admin/traffics/{config,search,verify}`, Panel `components/admin/TrafficsSearchPanel.tsx` im Kalkulations-Editor.
- **Endpunkte:** Suche über `GET /offers` (bzw. `/offers/flight`), weil nur dort Zimmer, Verpflegung und Flugzeiten in EINER Anfrage kommen; `/hotels` bräuchte Folgeanfragen. `/offers/{code}` geht live bis zum Veranstalter und läuft nur per Klick auf „Verfügbarkeit prüfen“.
- **Key:** `settings.json → traffics.auth_key`, gepflegt nur über das Panel („Zugang“) bzw. `POST /api/admin/traffics/config`. `/api/settings` gibt den Abschnitt `traffics` nie heraus und nimmt ihn nicht an. Wert `mock` = Beispieldaten ohne Netzwerk.
- **Sparsam (DERTOUR-Beschwerde 22.09.2026):** kein Polling, keine Suche beim Tippen; Cache identischer Suchen (Standard 60 min) und Zusammenlegen paralleler Anfragen; Obergrenze `max_requests_per_hour` (Standard 30).
- **Vergleich:** Modus „Vergleich“ ruft `POST /api/admin/traffics/compare` auf: Pauschal, Nur Flug und Nur Hotel laufen parallel (bis zu 3 Anfragen), dazu je Hotel günstigste Pauschale gegen günstigstes Hotel plus günstigsten Flug (`compareOffers()`).
- **Kalkulation:** `offer_calculations.pax` (Teilnehmer, Gesamtsummen = p.P. × Pax); jede Position hat `service_from`/`service_to` (Leistungsdatum, im Items-JSON). Beides in UI, PDF und MCP (`create_offer`/`update_offer`/`get_offer`).

## Positionsdetails & Programm (Kalkulation)
- Positionen (`CalcItem`, JSON in `offer_calculations.items`) haben optional: `time_from`/`time_to` (HH:MM), Anbieter `supplier_name`/`supplier_contact`/`supplier_ref`, `price_status` (vorgabe | listenpreis | richtwert | annahme | angebot | bestaetigt), `source_url` und für Transfers `route_from`/`route_to`/`distance_km`/`duration_min`/`vehicle`/`pickup_point`. `sanitizeItems()` übernimmt nur gesetzte Felder.
- **Tagesablauf:** `buildProgram()` in `calcModel.ts` (Tag aus `service_from`, sortiert nach Uhrzeit; mehrtägige Leistungen am ersten und letzten Tag). UI `components/admin/ProgramView.tsx`, Details-Eingabe `CalcItemDetails.tsx`.
- **PDF:** Das interne PDF zeigt immer eine Programmseite (mit Anbieter/Preisstatus), das Angebots-PDF nur bei `offer_calculations.program_in_offer = 1` und dann ohne Anbieter, Kontakt, Code und Preisstatus.
- MCP `create_offer`/`update_offer`/`get_offer` kennen alle Felder. `update_offer.items` ersetzt die Liste — vorher `get_offer` lesen.

## Reiseplanung je Kalkulation (Programm, DMC, Belege)
- `offer_calculations.planning` (JSON, `src/lib/planningModel.ts`, Tests in `tests/`): `days[]` (date, title, entries[] mit time_from/time_to, title, kind programm|transfer|essen|freizeit|hotel|flug, location, supplier, item_id, route_from/to, distance_km, duration_min, vehicle, price_note, status, note), `suppliers[]` (DMC/Anbieter: name, type, contact, coverage, source, status kandidat|angefragt|angebot|gewaehlt|abgelehnt, inquiry_ids), `sources[]` (Belege: nr, ref, what, kind, item_ids), `not_included`.
- UI `components/admin/PlanningPanel.tsx` (Reiter Ablauf, Schema = Timeline je Tag mit farbigen Blöcken und Transfer-Pfeilen, DMC & Anbieter, Belege). Gespeichert über den normalen Speichern-Knopf.
- PDF: Liegt eine Reiseplanung vor, ersetzt sie das Positions-Programm. Intern zusätzlich Schema (A4 quer), DMC und Belege; im Angebots-PDF (nur mit `program_in_offer`) nur Zeiten, Programmpunkte, Orte und Strecken — keine Anbieter, Preise oder Status.
- MCP: `get_offer_planning`, `set_offer_planning` (übergebene Listen ersetzen die bisherigen).

## Anfragen an Leistungsträger (je Kalkulation)
- **Code:** `src/lib/inquiryModel.ts` (reine Logik, Tests in `tests/`), `src/lib/inquiryStore.ts` (Tabelle `calc_inquiries`, in `database.ts` UND `dbq.applyPgSchemaEnhancements()`), Routen `/api/admin/calculations/[id]/inquiries[/[inqId][/send]]`, UI `components/admin/InquiriesPanel.tsx` im Kalkulations-Editor.
- **Ablauf:** Entwurf → „Senden" (Klick + Bestätigung) über Graph aus dem Portal-Postfach (`getMailbox()`, i. d. R. request@) → Status `gesendet`, Zeitpunkt/Absender/Empfänger im Verlauf. Danach sind Text und Empfänger gesperrt, gelöscht werden kann nur ein Entwurf. Statuswerte: entwurf, gesendet, beantwortet, angebot, abgelehnt, erledigt.
- **Schutz:** Text mit `[INTERN` wird nicht gesendet; interne Hinweise gehören ins Feld `internal_note` (geht nie raus).
- **PDF/MCP:** Das interne PDF (`?variant=intern`) hängt alle Anfragen mit vollem Text an, das Kunden-PDF nie. MCP: `list_offer_inquiries`, `add_offer_inquiry`, `update_offer_inquiry` — Senden gibt es bewusst NICHT per MCP/KI.

## Wichtige Komponenten
- `src/components/event/EventPageView.tsx` — rendert alle Event-Module (live-editierbar via `EventLiveEditor`).
- `src/components/PackageCardPro.tsx` — professionelle Paketkarte (Leistungs-Checkliste).
- `src/components/admin/AdminShell.tsx` — Admin-Layout (Sidebar mit einklappbaren Gruppen, Topbar mit Faltin-KI-Button, `fullBleed` für Vollhöhen-Seiten).
- `src/components/admin/adminNav.tsx` — **einzige Quelle der Admin-Navigation** (Gruppen, Einträge, Such-Stichworte). Neue Admin-Seite = hier eintragen; Sidebar, Mobile-Drawer und Schnellsuche (`AdminCommandPalette.tsx`, Cmd/Strg+K) ziehen daraus.
- `src/components/admin/ui.tsx` — Admin-UI-Kit (SectionCard, InputField, SelectInput, Button, Field, Badge…).

## Branch-Flow / Zusammenarbeit
- `feature/*` oder `fix/*` → Pull Request → **CI muss grün sein** → Merge nach `main` → Prod-Deploy.
- **Auto-Merge (seit 2026-07-03):** Repo hat `allow_auto_merge` + Branch-Protection auf `main` (Pflicht-Check: CI-Job `verify`, keine Review-Pflicht, Admins ausgenommen). Bei fertigen PRs `gh pr merge --auto --merge` setzen → merged automatisch, sobald CI grün ist.
- Nicht direkt auf `main` pushen (außer triviale Hotfixes mit Absprache).
- Offene Stränge im GitHub-Projects-Board pflegen.

## Ticket- & Zeiterfassungs-Pflicht (für alle KI-/Dev-Sessions) — WICHTIG
**Jede PR-würdige Änderung** (neue Funktion, Fix, Refactoring — alles, was zu einem PR führt)
bekommt ein Ticket im Admin-Aufgabensystem, und darauf werden **realistische Zeiten gebucht**.
Zweck: Zeiterfassung/Nachvollziehbarkeit im Admin-Panel (`/admin/aufgaben`).

Ablauf pro PR (externe API, Basis `https://next.faltintravel.com`, Auth-Header
`Authorization: Bearer ftk_…` — Key wird unter `/admin/api-keys` erstellt und liegt lokal in
`~/.config/faltin-travel/ext-api-key`, NIEMALS ins Repo committen):

1. **Ticket anlegen** (bei Arbeitsbeginn): `POST /api/ext/tasks`
   `{ "title": "<Kurzbeschreibung>", "description": "<Kontext/Anforderung>", "priority": "normal" }`
   — optional `"project_id"` zur Projekt-Zuordnung (Projekte: `GET/POST /api/ext/projects`;
   Zeiten werden im Rapport nach Projekt → Ticket gruppiert).
2. **Status pflegen**: `PATCH /api/ext/tasks/<id>` `{ "status": "in_arbeit" }` —
   Werte: `offen | in_arbeit | warten_requester | warten_dritte | erledigt`.
3. **PR verlinken**: `POST /api/ext/tasks/<id>/messages` `{ "kind": "note", "body": "PR: <url> – Claude" }`
   (Notizen mit „– Claude" signieren; `kind:"note"` verwenden, sonst geht eine Mail raus!)
4. **Zeit buchen**: `POST /api/ext/tasks/<id>/time` `{ "minutes": <n>, "note": "<was>" }` —
   gebucht wird die **ungefähre reale Dauer der KI-Session** (Wall-Clock von Arbeitsbeginn
   bis fertigem PR, inkl. Verifikation; typisch 15–45 min pro PR). **KEINE**
   Menschen-Äquivalent-Schätzungen buchen und **kein** „menschl. Äquivalent ~Xh" o. ä.
   in die Notiz schreiben — Zeit-Notizen landen 1:1 im Kunden-Rapport-PDF.
   Gern mehrere Buchungen bei mehreren Arbeitsblöcken.
5. **`erledigt` erst, wenn der PR gemerged UND deployed ist** — nicht beim PR-Erstellen.

Ticket-Nummern (`TASK-XXXXX`) im PR-Text erwähnen. Kein Ticket nötig für reine
Konversation/Analysen ohne Code-Änderung.

**Abrechnung:** Gebuchte Zeiten werden unter `/admin/rapporte` zu Rapporten (RAP-XXXX)
zusammengefasst und als PDF abgerechnet — Zeit-Notizen daher aussagekräftig formulieren
(was wurde getan, nicht nur "Arbeit"). Rapportierte Einträge sind gesperrt und können
nicht mehr gelöscht werden.

## Hinweise für KI-Agenten in dieser Umgebung
- **Große bestehende Dateien** nicht blind mit dem Host-Editor überschreiben — auf dem bash-Mount kann es zu Truncation kommen. Für Edits an großen Dateien: bash + Python in-place. Neue Dateien via Write sind ok. Nach Edits `tsc` prüfen.
- **`tsc --noEmit` auf dem Mount** zeigt manchmal Fehler in `.next/dev/types/*` (Artefakte eines laufenden `next dev`) — das ist KEIN Quellcode-Fehler. Gegencheck mit tsconfig, die `.next` ausschließt.
- **git aus dem sandbox** kann `.git/index.lock` nicht entfernen → Git-Operationen über die Host-Shell (PowerShell) laufen lassen; vorher `Remove-Item .git\HEAD.lock,.git\index.lock`.
- Nach Content-Änderung immer `data-seed/` spiegeln + `SEED_VERSION` bumpen (siehe Deploy).

## Befehle
- `npm run dev` — lokaler Dev-Server
- `npm run build` — Production-Build (wie Prod)
- `npx tsc --noEmit` — Typecheck

## Roadmap / Backlog
- **GEO / KI-Lesbarkeit** (offen, hoch): Paket-/Preis-Fakten serverseitig rendern (oder JSON-LD `Product`/`Offer`), strukturierte Daten breit ausspielen (`Event`, `Product`/`Offer`, `FAQPage`, `BreadcrumbList`), `llms.txt` ergänzen, FAQ & SEO-Texte konsequent pflegen. Details: `docs/backlog/geo-ai-readability.md`.
