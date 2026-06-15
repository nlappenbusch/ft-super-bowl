# CLAUDE.md — Projektgedächtnis (Faltin Travel Sports Events)

Dieses Dokument gibt jeder KI-/Dev-Session sofort den vollen Kontext. **Bei Architektur-,
Deploy- oder Konventionsänderungen hier mitpflegen.**

## Überblick
Sportreisen-Buchungsplattform (Tickets + Hotel + Hospitality) für Faltin Travel AG.
Generische Event-/Serien-Struktur (Super Bowl, French Open, WM, EM, CL-Finale, …).

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, better-sqlite3, lucide-react.
- **Repo:** `github.com/nlappenbusch/ft-super-bowl`
- **Prod:** `https://next.faltintravel.com`

## Datenmodell (`data/` — JSON, kein DB-Server für Content)
- `series.json` — Evergreen-Hubs (intro_text, highlights, seo_text, faqs, guide_sections).
- `events.json` — datierte Events, via `series_id` an Serie gehängt. Route: `/[series]/[event]`.
- `packages.json` — Buchbare Pakete (event_id/event_slug, includes[], price, …). Nur `active:true` wird angezeigt.
- `faqs.json` — Event-FAQs (keyed by event_id).
- `settings.json` — Admin-editierbare Config (company, bank, invoice, mail, **ai**). Hat Vorrang vor `.env`.
- `bookings.db` — SQLite (Buchungen, Rechnungen, Expenses, CRM-Messages, Counter).

Laufzeit-Lesen: `src/lib/contentStore.ts` (`findPackagesByEvent` etc.). Buchungen/Mail/Settings: jeweils eigene Stores.

## Deploy & Content-Seed — WICHTIG
- Push auf **`main`** → GitHub Actions (self-hosted runner) → `deploy.sh` → `docker compose` baut neu & startet `super-bowl-app`.
- `data/` ist **gitignored** und ein **persistentes Volume** (`./data:/app/data`).
- `docker-entrypoint.sh` rollt beim Start `data-seed/*.json` ins Volume — **nur wenn `data-seed/SEED_VERSION` sich ändert**. `bookings.db` & `settings.json` werden **nie** überschrieben.
- **Daher: Content-Änderungen (events/series/packages/faqs) gehen NUR live, wenn man `data-seed/<datei>.json` aktualisiert UND `data-seed/SEED_VERSION` hochzählt.** Lokales `data/` allein reicht nicht.
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
- Nicht direkt auf `main` pushen (außer triviale Hotfixes mit Absprache).
- Offene Stränge im GitHub-Projects-Board pflegen.

## Hinweise für KI-Agenten in dieser Umgebung
- **Große bestehende Dateien** nicht blind mit dem Host-Editor überschreiben — auf dem bash-Mount kann es zu Truncation kommen. Für Edits an großen Dateien: bash + Python in-place. Neue Dateien via Write sind ok. Nach Edits `tsc` prüfen.
- **`tsc --noEmit` auf dem Mount** zeigt manchmal Fehler in `.next/dev/types/*` (Artefakte eines laufenden `next dev`) — das ist KEIN Quellcode-Fehler. Gegencheck mit tsconfig, die `.next` ausschließt.
- **git aus dem sandbox** kann `.git/index.lock` nicht entfernen → Git-Operationen über die Host-Shell (PowerShell) laufen lassen; vorher `Remove-Item .git\HEAD.lock,.git\index.lock`.
- Nach Content-Änderung immer `data-seed/` spiegeln + `SEED_VERSION` bumpen (siehe Deploy).

## Befehle
- `npm run dev` — lokaler Dev-Server
- `npm run build` — Production-Build (wie Prod)
- `npx tsc --noEmit` — Typecheck
