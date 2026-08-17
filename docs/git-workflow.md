# Git- und GitHub-Workflow

Modell: **Trunk-Based mit kurzlebigen Feature-Branches.** Ein Branch pro Feature-ID, ein Pull Request,
Squash-Merge nach `main`. `main` ist immer deploybar – der Stand von `main` ist das, was als
Docker-Image gebaut wird.

## 1. Repository initialisieren

```bash
# Lokal
git init -b main
printf 'node_modules\n.nuxt\n.output\n.env\n.env.*\n!.env.example\ndata/\n*.db\n*.db-wal\n*.db-shm\nbackups/\ntest-results/\nplaywright-report/\ncoverage/\n' > .gitignore
git add -A
git commit -m "chore: initiales Projektgerüst (Nuxt 4, Drizzle/SQLite, Docker)"

# GitHub-Repository anlegen (privat!) und pushen
gh repo create fortbildungsverwaltung --private --source=. --remote=origin --push
```

**Privat**, weil die Feature-Specs fachliche Interna und die Konfiguration Hinweise auf die
Infrastruktur enthalten. Vor dem ersten Push prüfen, dass keine `.env` und keine `*.db` im Index liegen:
`git ls-files | grep -Ei '\.env$|\.db$'` muss leer sein.

## 2. Branch-Schutz für `main` einrichten (einmalig)

```bash
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -F required_status_checks.strict=true \
  -F 'required_status_checks.contexts[]=verify' \
  -F 'required_status_checks.contexts[]=e2e' \
  -F enforce_admins=true \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

Wirkung: kein direkter Push auf `main`, kein Merge mit roter CI, mindestens ein Review,
lineare Historie (passt zum Squash-Merge).

Zusätzlich in den Repository-Einstellungen: *Allow squash merging* aktivieren, *merge commits* und
*rebase merging* deaktivieren, *Automatically delete head branches* aktivieren.

## 3. Branch-Namen

```
feat/FV-3-fortbildungskatalog
fix/FV-5-doppelter-antrag
refactor/FV-4-genehmigungs-service
docs/FV-0-backup-strategie
chore/ci-playwright-cache
```

Immer `<type>/<Feature-ID>-<kurzbeschreibung>`, klein, mit Bindestrichen. Die Feature-ID im Branch-Namen
verbindet Code, Spec und Pull Request.

## 4. Arbeitszyklus

```bash
git switch main && git pull --ff-only
git switch -c feat/FV-3-fortbildungskatalog

# ... arbeiten, oft und klein committen ...
npm run verify                       # Pflicht vor jedem Push
git add -A
git commit -m "feat(FV-3): Fortbildungskatalog mit Filter und Pagination"
git push -u origin feat/FV-3-fortbildungskatalog

gh pr create --fill --base main
```

Commit-Format (Conventional Commits mit Feature-ID):
`type(FV-X): beschreibung` · Typen: `feat`, `fix`, `refactor`, `test`, `docs`, `deploy`, `chore`

Regeln:
- Branches leben maximal 2–3 Tage. Länger → Feature ist zu groß geschnitten, aufteilen
- Täglich `git fetch origin && git rebase origin/main`, damit der Merge klein bleibt
- Migrationen niemals in einem Branch ändern, der schon gepusht ist – neue Migration erzeugen

## 5. Parallel arbeitende Agents: Worktrees

Wenn Frontend- und Backend-Agent gleichzeitig laufen, nicht im selben Arbeitsverzeichnis arbeiten
lassen – sonst überschreiben sie sich gegenseitig:

```bash
git worktree add ../fv-backend  feat/FV-3-api
git worktree add ../fv-frontend feat/FV-3-ui
# ... zwei getrennte Verzeichnisse, zwei Branches, zwei PRs ...
git worktree remove ../fv-backend
```

## 6. Pull Request und Review

Jeder PR enthält (Vorlage: `.github/pull_request_template.md`):
- Feature-ID und Link zur Spec
- Abhaken der Acceptance Criteria mit Verweis auf die zugehörigen Tests
- Screenshots bzw. Snapshot-Diffs bei UI-Änderungen
- ausdrücklichen Hinweis auf Migrationen, neue Env-Variablen oder Berechtigungsänderungen

Review-Checkliste:
1. **Autorisierung:** Ist jede neue Route abgesichert? Steht sie in der Autorisierungsmatrix?
   (SQLite hat kein RLS – hier entstehen die gefährlichsten Fehler)
2. **Migration:** Reversibel? Datenverlust möglich? Vorher-Backup nötig?
3. **Tests:** Gibt es zu jedem AC einen Test? Wurde ein bestehender Test abgeschwächt oder gelöscht?
4. **Snapshot-Diffs:** Ist die Design-Änderung gewollt?
5. **Secrets:** Keine Zugangsdaten im Diff, neue Variablen in `.env.example` und `docs/docker-deployment.md`
6. **Umfang:** Betrifft der PR nur ein Feature?

Ein PR, der einen Test abschwächt oder entfernt, wird nur mit ausdrücklicher Begründung in der
Beschreibung genehmigt.

`CODEOWNERS` sorgt dafür, dass Änderungen an `server/utils/authorization.ts`,
`server/database/migrations/`, `Dockerfile` und `.github/` immer die Review der verantwortlichen
Person anfordern.

## 7. Merge

- **Squash-Merge**, Titel im Commit-Format: `feat(FV-3): Fortbildungskatalog`
- Branch danach löschen (passiert automatisch)
- `main` bleibt linear und lesbar: `git log --oneline` ergibt die Feature-Historie
- Alle Änderungen zu einem Feature finden: `git log --grep="FV-3"`

## 8. Release und Deployment

```bash
git switch main && git pull --ff-only
npm version minor                       # erzeugt Commit + Tag, z. B. v1.2.0
git push --follow-tags
gh release create v1.2.0 --generate-notes
```

Der Tag löst in GitHub Actions den Image-Build aus; das Image wird mit derselben Version getaggt
(`fortbildungsverwaltung:1.2.0`). Auf dem Server:

```bash
docker compose pull && docker compose up -d
```

Damit ist jederzeit nachvollziehbar, welcher Commit in Produktion läuft.

## 9. Rückabwicklung

```bash
# Fehlerhaften PR sauber zurücknehmen (Historie bleibt erhalten)
gh pr view 42 --json mergeCommit
git revert -m 1 <merge-commit>
git push

# Oder: vorheriges Image weiterlaufen lassen
APP_VERSION=1.1.0 docker compose up -d
```

Achtung: Ein Revert nimmt **keine** bereits angewendete Datenbank-Migration zurück. Bei destruktiven
Migrationen ist der Weg zurück das Backup (siehe `docs/backup-strategy.md`), nicht Git.

## 10. Was nie ins Repository gehört
`.env` · `*.db`, `*.db-wal`, `*.db-shm` · `data/`, `backups/` · hochgeladene Nachweise ·
echte Personendaten in Seeds oder Fixtures · Zugangsdaten in Test-Skripten

CI prüft das zusätzlich mit einem Secret-Scan (`gitleaks`). Ist doch einmal ein Secret gelandet:
Wert sofort rotieren – Löschen aus der Historie allein reicht nicht.
