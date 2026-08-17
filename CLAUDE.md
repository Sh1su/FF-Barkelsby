# Fortbildungsverwaltung

Selbst gehostete Webanwendung zur Verwaltung von Fortbildungen (Anträge, Genehmigungen, Nachweise,
Punktekonto). Fachliche Grundlage: `docs/PRD.md`.

## Stack
- **Nuxt 4** – Frontend (`app/`) und Backend (`server/`, Nitro) in einem Projekt, TypeScript strict
- **Nuxt UI + Tailwind** – keine eigenen Basiskomponenten
- **SQLite + Drizzle ORM** – Datei auf einem Docker-Volume, Migrationen via drizzle-kit
- **nuxt-auth-utils** – Session-Cookie, lokale Passwort-Hashes
- **Vitest + Playwright** – Unit, API, Komponenten, E2E, Layout/Visual, a11y
- **Docker** – Auslieferung als Container, `docker compose up`
- **Git + GitHub** – Trunk-Based mit Feature-Branches und Pull Requests

Keine externen SaaS-Dienste zur Laufzeit. Die Anwendung muss offline im Container laufen.

## Regeln – welche Datei wann lesen (verbindlich)

| Wenn du daran arbeitest | Lies zuerst |
|-------------------------|-------------|
| **immer, vor jeder Aufgabe** | `.claude/rules/general.md` |
| `app/components/**`, `app/pages/**`, `app/composables/**` | `.claude/rules/frontend.md` |
| `server/**`, API-Routen, Services | `.claude/rules/backend.md` |
| `server/database/**`, Schema, Migrationen | `.claude/rules/database.md` |
| Auth, Berechtigungen, `.env`, `nuxt.config.ts`, Dockerfile | `.claude/rules/security.md` |
| `tests/**`, alles mit `.spec.ts` | `.claude/rules/testing.md` |
| committen, branchen, Pull Requests | `.claude/rules/git.md` |

Vertiefende Betriebs-Dokumentation in `docs/`: `testing-strategy.md`, `git-workflow.md`,
`backup-strategy.md`, `docker-deployment.md`, `database-optimization.md`, `security-headers.md`,
`rate-limiting.md`, `performance.md`, `error-tracking.md`.

## Die fünf wichtigsten Regeln

1. **SQLite hat kein Row Level Security.** Jede API-Route beginnt mit `requireUserSession(event)`,
   jede Abfrage auf personenbezogene Daten ist auf den Eigentümer oder eine geprüfte Rolle
   eingeschränkt. Berechtigungslogik zentral in `server/utils/authorization.ts`.
2. **Kein Feature ohne Tests.** Jedes Acceptance Criterion hat einen Test mit seiner ID im Namen
   (`it('AC-3: …')`). Fertig ist eine Aufgabe erst, wenn `npm run verify` grün ist.
3. **Ein roter Test außerhalb der aktuellen Aufgabe ist ein Regressionsfund** – melden und beheben,
   niemals den Test abschwächen, um grün zu werden.
4. **Nie direkt auf `main`.** Ein Branch pro Feature (`feat/FV-3-…`), Pull Request, Squash-Merge.
5. **Tracking-Dateien wirklich schreiben.** Nach jeder Aufgabe `features/FV-X-*.md` und
   `features/INDEX.md` per Edit aktualisieren und danach erneut lesen, um die Änderung zu prüfen.

## Arbeitsablauf

```
/init            Projekt aufsetzen (nur einmal)
/write-spec      Feature-Spec aus einem Roadmap-Eintrag erzeugen  -> Status: Planned
/architecture    Tech-Design ergänzen                             -> Status: Architected
/frontend        UI implementieren                                -> Status: In Progress
/backend         API + Datenbank implementieren                   -> Status: In Progress
/qa              testen, Bugs dokumentieren                       -> Status: In Review/Approved
/deploy          Image bauen und ausrollen                        -> Status: Deployed
```

Handoffs sind immer nutzergesteuert: nach Abschluss den nächsten Schritt vorschlagen, nie automatisch
weiterlaufen.

## Befehle

```bash
npm run dev            # Entwicklung
npm run verify         # Lint + Typecheck + Tests + Lückenprüfung  <- vor jedem Commit
npm run test:e2e       # Playwright inkl. Layout-Invarianten
npm run db:generate    # Migration aus dem Schema erzeugen
npm run db:migrate     # Migrationen anwenden
npm run user -- list   # Konten: Kennung/Passwort ohne Anmeldung ändern (FV-12)
docker compose up -d   # Produktions-Stack inkl. Backup-Service
```

## Vor jeder Implementierung prüfen
- `features/INDEX.md` lesen – existiert das Feature und in welchem Status ist es?
- Gibt es die Komponente/Route schon? `git ls-files app/components/`, `git ls-files server/api/`
- Datei immer erst lesen, bevor du sie änderst – nie aus dem Gedächtnis arbeiten
- `git status` und `git diff`, um den aktuellen Stand zu kennen

## Niemals
- Ein Feature implementieren, das nicht in `features/INDEX.md` steht (erst `/write-spec`)
- Secrets, `.env`, `*.db` oder Backups committen
- Bereits gemergte Migrationen ändern (immer eine neue erzeugen)
- Rolle, Status oder Budget aus dem Request-Body übernehmen
- Behaupten, eine Datei aktualisiert zu haben, ohne das Edit-Tool aufgerufen zu haben
