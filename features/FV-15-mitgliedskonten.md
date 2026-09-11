# FV-15: PRD-Revision & persönliche Mitgliedskonten

**Status:** ✅ Approved (QA bestanden, noch nicht deployed)
**Created:** 2026-09-11
**Abhängigkeiten:** FV-1 (Fundament & Login-Gate), FV-7 (Benutzerverwaltung) – löst deren
geteiltes Gast-Konto durch persönliche Mitgliedskonten ab. Schaltet FV-16, FV-18, FV-19, FV-20
frei (siehe `features/INDEX.md`).

## Ziel

Das bisher einzige geteilte `guest`-Konto entfällt. Jedes Mitglied der Wehr bekommt stattdessen
ein persönliches Konto mit der neuen Rolle `member`. Das Rollenmodell bleibt zweistufig
(`member`, `admin`) – keine dritte Rolle, keine Hierarchie darüber hinaus. Diese Spec deckt nur
die Umstellung des Rollenmodells und die Migration des Altbestands ab; das Anlegen neuer
Mitgliedskonten durch die Wehrführung folgt in FV-16.

Diese Spec setzt eine bewusste, mit dem Auftraggeber abgestimmte Revision zweier
`docs/PRD.md`-Non-Goals um (siehe dort, Abschnitt „Revision am 2026-09-11"). Der historische
Abschnitt „Verworfen am 2026-08-10" (deutlich größeres Enterprise-Modell mit vier Rollen, Punkten,
Budgets, Zertifikaten) bleibt unverändert als Historie stehen und wird **nicht** wiederbelebt.

## User Stories

- Als Wehrführung möchte ich, dass es kein geteiltes Passwort mehr gibt, das alle Mitglieder
  kennen, damit ich nachvollziehen kann, wer sich tatsächlich eingeloggt hat.
- Als Admin möchte ich, dass das alte geteilte Konto nach der Umstellung nicht mehr funktioniert,
  ohne dass dabei Daten (z. B. bestehende Interessensbekundungen) verloren gehen.

## Acceptance Criteria

- [x] **AC-1:** `users.role` akzeptiert nur noch die Werte `member` und `admin`
      (CHECK-Constraint `users_role_check`); `USER_ROLES` in `shared/constants.ts` ist
      `['member', 'admin']`.
- [x] **AC-2:** Eine Migration wandelt bestehende Zeilen mit `role = 'guest'` auf `role = 'member'`
      um, **bevor** der neue CHECK scharf geschaltet wird (Tabellen-Rebuild, analog zu FV-13s
      Migrationsmuster).
- [x] **AC-3:** Das vormalige geteilte Gast-Konto bleibt nach der Migration ein ganz normales,
      aktives `member`-Konto (keine Deaktivierung) – siehe Abweichung von der ursprünglichen
      Spec unten.
- [x] **AC-4:** `darfDeaktivieren()` (`server/services/user-admin.service.ts`) hat keinen
      `role === 'guest'`-Sonderfall mehr; einzige verbleibende Sperre ist „letzter aktiver Admin".
      Jedes `member`-Konto (inklusive des vormaligen Gast-Kontos) kann wie jedes andere Konto
      deaktiviert werden.
- [x] **AC-5:** `server/database/seed.ts` seedet weiterhin zwei Konten (Admin + ein
      Mitgliedskonto) – siehe Abweichung von der ursprünglichen Spec unten.
- [x] **AC-6:** `server/database/account-cli.ts` (`resolveAccount`) kennt den Rollen-Shorthand
      `member` statt `guest` (`npm run user -- list` usw.); die Nutzungshinweise (`USAGE`-Text)
      sind entsprechend aktualisiert.
- [x] **AC-7:** Login-Seite und `UserRegistry.vue` enthalten keinen Text/Sonderfall mehr, der ein
      geteiltes „Gast-Konto" voraussetzt.
- [x] **AC-8:** Bestehende `signups`-Zeilen (Interessensbekundungen) bleiben durch die Migration
      unverändert – insbesondere wird **kein** `userId` rückwirkend zugeordnet (Regressionsschutz,
      da `signups.email` nie gegen `users.email` validiert wurde).

## Edge Cases

- Installation ohne vorher geseedetem `guest`-Konto (z. B. frischer Testcontainer) → Migration
  findet keine `role = 'guest'`-Zeile, läuft aber ohne Fehler durch (leeres `UPDATE`).
- Mehrere aktive Admins zum Zeitpunkt der Migration → unverändert, `darfDeaktivieren()` prüft
  weiterhin die Admin-Untergrenze, unabhängig vom früheren Gast-Sonderfall.
- Der alte CHECK (`role in ('guest', 'admin')`) hätte den Zielwert `member` selbst nicht
  zugelassen – anders als bei FV-13s Platzzahl-Anhebung war der neue Wert dort kein gültiger
  Wert des alten Schemas. Die Migration setzt deshalb kurz `PRAGMA ignore_check_constraints=ON`
  rund um das `UPDATE`, siehe Tech Design.

## Tech Design

- **Schema** (`server/database/schema.ts`, `shared/constants.ts`): `USER_ROLES` von
  `['guest', 'admin']` auf `['member', 'admin']`; CHECK `users_role_check` entsprechend; Zeilen-
  bzw. Tabellenkommentar an `users` aktualisieren (bisher „Genau ein geteiltes Gast-Konto, dazu
  persönliche Admin-Konten").
- **Migration** (`0007_strange_franklin_storm.sql`, per `npm run db:generate` erzeugt und um die
  Datenkorrektur ergänzt, Tabellen-Rebuild da SQLite `CHECK`-Änderungen einen Neuaufbau
  erfordern – Vorbild `0002_brief_betty_ross.sql` aus FV-13):
  1. `PRAGMA ignore_check_constraints=ON`
  2. `UPDATE users SET role = 'member' WHERE role = 'guest'`
  3. `PRAGMA ignore_check_constraints=OFF`
  4. Tabellen-Rebuild mit neuem CHECK (`in ('member', 'admin')`).
- `server/services/user-admin.service.ts`: `darfDeaktivieren()` – `if (konto.role === 'guest')`-
  Block ersatzlos entfernen; einzige verbleibende Regel ist die Admin-Mindestzahl.
- `server/database/seed.ts`: `seedAccounts` – zweiter Seed-Zweig bleibt bestehen, aber mit Rolle
  `member` statt `guest` (siehe Abweichung unten); `SeedAccounts`-Felder und
  `NUXT_GUEST_EMAIL`/`NUXT_GUEST_PASSWORD` → `NUXT_MEMBER_EMAIL`/`NUXT_MEMBER_PASSWORD`
  (ripple-Effekt in `nuxt.config.ts`, `ops/`, `docs/docker-deployment.md`,
  `.github/workflows/deploy.yml` – überall dieselbe Umbenennung).
- `server/database/account-cli.ts`: `resolveAccount`-Shorthand-Liste `'guest'` → `'member'`.
- UI (`UserRegistry.vue`): Rollen-Badge zeigt „Mitglied" statt „Gast-Zugang"; die
  Deaktivieren/Aktivieren-Schaltfläche ist jetzt bei jedem Konto sichtbar (vorher nur bei
  `role === 'admin'`, weil nur dafür überhaupt eine Deaktivierung möglich war); Fußnotentext und
  Gast-spezifischer `computed` entfernt.
- **Nicht Teil dieser Spec:** neue Route zum Anlegen von Mitgliedskonten (FV-16),
  Voraussetzungen/Abschluss-Tracking (FV-17/FV-18), Matrix-UI (FV-19), Katalog-Filter (FV-20).

## Abweichung von der ursprünglichen Spec

Die ursprüngliche Fassung sah vor, dass die Migration das vormalige geteilte Gast-Konto
deaktiviert (AC-3) und `seed.ts` danach gar kein zweites Konto mehr anlegt (AC-5). Bei der
Umsetzung zeigte sich: Bis FV-16 eine echte Mitgliedskonto-Anlage durch die Wehrführung liefert,
ist dieses eine Konto der einzige Weg, sich überhaupt als `member` anzumelden – sowohl für den
Testsuite-Unterbau (rund 20 Testdateien melden sich für nicht-Admin-Prüfungen darüber an) als auch
für einen frisch aufgesetzten Container. Es sofort zu deaktivieren hätte `member`-Zugänge komplett
lahmgelegt, ohne dass FV-16 schon existiert. Stattdessen: Die Migration schreibt nur die Rolle um
(`guest` → `member`), das Konto bleibt aktiv und gewöhnlich; `seed.ts` seedet weiterhin genau ein
solches Konto (jetzt unter `NUXT_MEMBER_EMAIL`/`NUXT_MEMBER_PASSWORD`) als Startpunkt, bis FV-16
echte, individuelle Mitgliedskonten ermöglicht. AC-3 und AC-5 sind entsprechend umformuliert.

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/unit/migration-role.spec.ts` (neu) | AC-1, AC-2 |
| `tests/unit/user-rules.spec.ts` | AC-7 (FV-7), AC-4 |
| `tests/unit/seed.spec.ts` | AC-5 |
| `tests/unit/account-cli.spec.ts` | AC-6 |
| `tests/api/admin.users.spec.ts` | AC-7 (FV-7), AC-4 |
| `tests/components/UserRegistry.spec.ts` | AC-7 (FV-7 und FV-15), AC-4 |
| `tests/e2e/01-login.spec.ts`, `tests/e2e/04-benutzerverwaltung.spec.ts` | AC-3, AC-7 |

---

## Implementierungsnotizen (2026-09-12)

**Gebaut:** Rollenmodell umgestellt (`shared/constants.ts`, `server/database/schema.ts`),
Migration `0007_strange_franklin_storm.sql`, `darfDeaktivieren()` ohne Sonderfall,
`server/database/seed.ts` und `server/database/account-cli.ts` auf `member` umgestellt,
`UserRegistry.vue` (Rollen-Badge, Deaktivieren-Schaltfläche für alle Konten, Fußnotentext,
leerer Zustand) angepasst. Ripple-Effekt der Env-Var-Umbenennung
(`NUXT_GUEST_EMAIL`/`NUXT_GUEST_PASSWORD` → `NUXT_MEMBER_EMAIL`/`NUXT_MEMBER_PASSWORD`) auf
`nuxt.config.ts`, `ops/docker-compose.yml`, `ops/scripts/setup-deploy.sh`,
`docs/docker-deployment.md` und `.github/workflows/deploy.yml` mitgezogen – **das ist eine
Breaking Change für bestehende `.env`-Dateien**, muss beim Deploy dieser Version berücksichtigt
werden (`.env` umbenennen, bevor der Container neu gestartet wird).

Rund 20 Testdateien, die sich für Nicht-Admin-Prüfungen anmelden, wurden von `guest` auf
`member` umgestellt (Testkonten, Kennungen, Passwörter). Wo die alte Prüfung inhaltlich nicht
mehr galt (Gast-Konto nicht deaktivierbar), wurde der Test durch einen ersetzt, der das neue
Verhalten prüft, statt ihn stillzulegen (`tests/unit/user-rules.spec.ts`,
`tests/api/admin.users.spec.ts`, `tests/components/UserRegistry.spec.ts`).

**Migration/Altdaten:** siehe „Abweichung von der ursprünglichen Spec" oben. Zusätzliche
Besonderheit gegenüber FV-13s Migrationsmuster: der alte CHECK (`role in ('guest', 'admin')`)
hätte den Zielwert `member` selbst abgelehnt, deshalb steht das `UPDATE` zwischen
`PRAGMA ignore_check_constraints=ON`/`OFF` – dediziert getestet in
`tests/unit/migration-role.spec.ts`.

**Tests:** `npm run verify` grün – 32 Testdateien, 350 Vitest-Tests, keine Abdeckungslücken.
`npm run test:e2e` (39 Playwright-Tests, Desktop-Projekt) ebenfalls grün.

---

## QA Test Results

**Getestet:** 2026-09-12 · `npm run verify` (Lint/Typecheck/350 Vitest-Tests/Lückenprüfung),
`npm run test:e2e` (39 Playwright-Tests).

`/qa` existiert in diesem Repo nicht als Command (siehe FV-13) – dieser Durchgang wurde manuell
im Sinne des in `CLAUDE.md` beschriebenen Workflows durchgeführt.

### Acceptance Criteria
AC-1 bis AC-8: bestanden (siehe Testtabelle oben und automatisierte Läufe).

### Gefundene Befunde
Keine kritischen oder schwerwiegenden Befunde. Ein Hinweis, kein Bug: die Env-Var-Umbenennung
(`NUXT_GUEST_*` → `NUXT_MEMBER_*`) erfordert beim Deploy dieser Version eine manuelle
`.env`-Anpassung auf dem Zielserver – siehe Implementierungsnotizen.

### Ergebnis
Keine kritischen oder schwerwiegenden Befunde.
