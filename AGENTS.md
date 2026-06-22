# AGENTS.md - ft-super-bowl

Arbeite in diesem Repo sauber und nachvollziehbar.

## Zusammenarbeit

- Änderungswünsche vom Nutzer als konkrete Tasks umsetzen, nicht nur vorschlagen.
- Vor Edits kurz Repo-Kontext lesen und bestehende Patterns übernehmen.
- Keine Secrets, `.env`-Dateien oder produktive Datenbanken committen.
- Fremde/unrelated Änderungen im Working Tree nicht zurücksetzen.

## Git-Workflow

- Für normale Arbeit einen fokussierten Branch nutzen: `feature/<kurz>` oder `fix/<kurz>`.
- Commit-Stil: `type(scope): kurze beschreibung`, z.B. `fix(deploy): correct runner status output`.
- Vor Commit nach Möglichkeit ausführen:
  - `npx tsc --noEmit`
  - `npm run build`
- Bei Content-Änderungen an Events/Serien/Packages/FAQs:
  - passende Datei in `data-seed/` aktualisieren
  - `data-seed/SEED_VERSION` hochzählen

## Deployment

- `main` ist der Deploy-Branch.
- Push/Merge auf `main` triggert `.github/workflows/deploy.yml`.
- Der self-hosted GitHub Actions Runner braucht die Labels `self-hosted`, `Linux`, `X64`, `docker-prod-01`.
- Auf dem Server liegt das Repo unter `/opt/super-bowl`; der Runner führt `/opt/super-bowl/deploy.sh` aus.
- Die App hört extern auf Port `8085` (`8085:3000` in `docker-compose.yml`).
