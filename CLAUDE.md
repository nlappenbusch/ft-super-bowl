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
- **Der Seed ist ADDITIV (Merge nach `id`):** bestehende Volume-Einträge werden NIE überschrieben (schützt Admin-Bearbeitungen). **Updates an bestehenden Einträgen:** id in `data-seed/SEED_REPLACE_IDS` listen (eine pro Zeile, `#` = Kommentar) + `SEED_VERSION` bumpen → genau diese Einträge werden ersetzt (Admin-Stand daran geht verloren).
- Build läuft ohne `data/` (Fallback auf Seed/Defaults), daher baut CI/Docker auch ohne Volume.

## Mail / SSO (Microsoft 365 Graph, App-only)
- Config in `settings.json.mail` (tenant_id, client_id, client_secret, mailbox, …), ENV-Fallback.
- **Prod nutzt App `fd6880b3-…`** (Mail UND SSO teilen dieselbe App via `mailConfig()`).
- **Token-Cache** in `graphMailer.ts` (~1h): nach Credential-Wechsel **Container-Restart/Redeploy** nötig.
- **Exchange Application Access Policy (RAOP):** App braucht Freigabe aufs Postfach (`request@`), sonst `403 ErrorAccessDenied … RAOP`. Policy via `New-ApplicationAccessPolicy` (RestrictAccess auf Scope-Gruppe). Nur EINE Policy pro App — Doppel-Policies → Schnittmengen-Sperre.
- **SSO-Redirect-URI** `https://next.faltintravel.com/api/auth/microsoft/callback` muss bei der aktiven App registriert sein (sonst `AADSTS500113`). Basis-URL kommt aus `settings.mail.login_base_url` bzw. Request-Host.
- **Lokaler Admin-Login:** User `localadmin`, PW `LOCAL_ADMIN_PASSWORD` (Default `faltin-localadmin-2026`).

## KI-Redaktion
- Config: `settings.json.ai` (anthropic_api_key, model; Default `claude-sonnet-4-6`).
- `src/lib/aiAssist.ts` (Anthropic Messages API, multimodal), `src/lib/urlFetch.ts` (HTML→Text).
- Endpoints: `/api/admin/ai/{config,status,import,fetch}`. Admin-Seite: `/admin/ai`.
- Modul-Registry (`MODULE_SPECS`) definiert Ziel-JSON pro Modul (intro/highlights/seo/leistungen/wissenswertes/faq).

## Wichtige Komponenten
- `src/components/event/EventPageView.tsx` — rendert alle Event-Module (live-editierbar via `EventLiveEditor`).
- `src/components/PackageCardPro.tsx` — professionelle Paketkarte (Leistungs-Checkliste).
- `src/components/admin/AdminShell.tsx` — Admin-Layout + Nav (NAV ist hardcoded).
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
