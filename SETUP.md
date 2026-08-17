# Projekt-Kit: Fortbildungsverwaltung

Angepasstes Dokumentations-, Rules-, Agents- und Ops-Set für das Projekt **Fortbildungsverwaltung**.

**Stack:** Nuxt 4 (Frontend + Nitro-Backend in einem Projekt) · TypeScript · Nuxt UI ·
SQLite via Drizzle ORM · Docker · Vitest/Playwright · Git + GitHub

## Ablage im Repository

```
dein-projekt/
├── CLAUDE.md                     # Einstiegspunkt: wird von Claude Code automatisch gelesen
├── .claude/
│   ├── agents/
│   │   ├── frontend-dev.md
│   │   ├── backend-dev.md
│   │   ├── test-engineer.md
│   │   └── qa-engineer.md
│   └── rules/
│       ├── general.md
│       ├── frontend.md
│       ├── backend.md
│       ├── database.md
│       ├── security.md
│       ├── testing.md
│       └── git.md
├── .github/
│   ├── workflows/ci.yml          # verify, secret-scan, migrations, e2e, container+backup, release
│   ├── workflows/nightly.yml     # volle Suite, npm audit, Issue bei Fehlschlag
│   ├── pull_request_template.md
│   ├── CODEOWNERS
│   └── dependabot.yml
├── docs/
│   ├── PRD.md
│   ├── testing-strategy.md
│   ├── git-workflow.md
│   ├── backup-strategy.md
│   ├── docker-deployment.md
│   ├── database-optimization.md
│   ├── performance.md
│   ├── error-tracking.md
│   ├── rate-limiting.md
│   └── security-headers.md
├── features/
│   ├── INDEX.md
│   └── README.md
└── ops/
    ├── docker-compose.yml        # → gehört nach ./docker-compose.yml
    ├── litestream.yml
    ├── backup/Dockerfile
    └── scripts/{backup.sh,restore.sh}
```

## Zielstruktur der Anwendung

```
app/                      # Nuxt Frontend (Nuxt 4 App-Verzeichnis)
├── components/
├── composables/
├── layouts/
├── middleware/
└── pages/
server/                   # Nitro Backend
├── api/
├── database/
│   ├── schema.ts
│   ├── migrations/
│   └── seed.ts
├── middleware/
├── plugins/              # migrate.ts (inkl. Pre-Migration-Snapshot), error-logging.ts
├── services/
└── utils/                # db.ts, authorization.ts, rate-limit.ts
shared/                   # von Frontend + Backend geteilte Typen/Zod-Schemas
tests/
├── unit/                 # Fachlogik (Punkte, Statusübergänge, Budget)
├── api/                  # jede Route + authorization.matrix.spec.ts
├── components/
├── e2e/
├── visual/               # Layout-Invarianten + Snapshots je Breakpoint
└── factories/
scripts/check-coverage-gaps.ts
Dockerfile
docker-compose.yml
drizzle.config.ts
nuxt.config.ts
```

## Erste Schritte

```bash
# 1. Dateien ins Repository kopieren, ops/docker-compose.yml nach ./docker-compose.yml
# 2. Git initialisieren und GitHub-Repo anlegen  ->  docs/git-workflow.md
git init -b main && git add -A && git commit -m "chore: Projektgerüst"
gh repo create fortbildungsverwaltung --private --source=. --remote=origin --push

# 3. Branch-Schutz aktivieren (Kommando in docs/git-workflow.md, Abschnitt 2)
# 4. Erstes Feature spezifizieren
#    /write-spec FV-1 Authentifizierung & Rollen
```

## Benötigte npm-Skripte

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "lint": "eslint .",
    "typecheck": "nuxi typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:visual": "playwright test tests/visual",
    "test:a11y": "playwright test tests/a11y",
    "verify": "npm run lint && npm run typecheck && npm run test && tsx scripts/check-coverage-gaps.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx server/database/migrate.ts",
    "db:seed": "tsx server/database/seed.ts"
  }
}
```

## Feature-ID-Präfix

Alle Feature-IDs verwenden das Präfix `FV-` (Fortbildungsverwaltung), z. B. `FV-1-authentifizierung.md`.

## Offen

Der Design-Entwurf (`Fortbildungsverwaltung.dc.html`) war nicht abrufbar. PRD und Feature-Roadmap sind ein
fachlich plausibler Erstentwurf – bitte gegen das Design prüfen und Vision, Zielgruppe, Rollenmodell und
Feature-Priorisierung korrigieren.
