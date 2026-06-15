# Zusammenarbeit & Workflow

Kurzleitfaden für die gemeinsame Arbeit am Repo. Details zur Architektur: siehe `CLAUDE.md`.

## Branch-Flow
```
feature/<kurz>  oder  fix/<kurz>
        │
        ▼   Pull Request  (CI muss grün sein)
      main  ───────────────►  Deploy auf Prod (next.faltintravel.com)
```
- **Nie direkt auf `main`** pushen (außer triviale, abgesprochene Hotfixes).
- Pro Aufgabe ein Branch + ein PR. Klein & fokussiert halten.
- Merge erst, wenn **CI grün** ist (`tsc` + `build`).
- `main`-Merge löst automatisch das Prod-Deploy aus.

## Commit-Stil
`typ(scope): kurze beschreibung` — z.B. `feat(packages): French-Open-Pakete`, `fix(mail): Token-Cache`.
Typen: `feat`, `fix`, `chore`, `refactor`, `docs`.

## Vor jedem PR
- `npx tsc --noEmit` läuft sauber.
- `npm run build` läuft durch.
- Bei UI-Änderungen: Screenshot in den PR.
- **Content geändert** (events/series/packages/faqs)? → `data-seed/<datei>.json` spiegeln **und** `data-seed/SEED_VERSION` hochzählen (sonst geht es nicht live — siehe `CLAUDE.md` → Deploy & Content-Seed).

## Secrets
Keine Keys/Passwörter in den Code. Mail-/KI-Keys werden im Admin (`settings.json`) gepflegt, nicht committet.

## Backlog
Aufgaben & Status laufen über das GitHub-Projects-Board (Issues mit Labels `feature`/`bug`).
