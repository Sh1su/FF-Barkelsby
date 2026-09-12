# Feature Index – Lehrgangsverwaltung Freiwillige Feuerwehr

> Zentrales Tracking aller Features. Wird von den Skills automatisch aktualisiert.

## Status Legend
- **Roadmap** - Feature identifiziert im PRD, noch keine Spec-Datei
- **Planned** - `/write-spec` done, vollständige Spec geschrieben
- **Architected** - `/architecture` done, Tech-Design abgenommen
- **In Progress** - `/frontend` oder `/backend` aktiv oder abgeschlossen, noch nicht in QA
- **In Review** - `/qa` aktiv, Tests laufen
- **Approved** - `/qa` bestanden, keine kritischen Bugs
- **Deployed** - `/deploy` done, live im produktiven Container

## Features

| ID | Feature | Status | Spec | Created |
|----|---------|--------|------|---------|
| FV-1 | Fundament & Login-Gate | Approved | [FV-1-fundament-und-login.md](FV-1-fundament-und-login.md) | 2026-08-10 |
| FV-2 | Lehrgangskatalog & Detailseite | Approved | [FV-2-lehrgangskatalog.md](FV-2-lehrgangskatalog.md) | 2026-08-10 |
| FV-3 | Admin-Kalender & Lehrgangsverwaltung | Approved | [FV-3-admin-kalender.md](FV-3-admin-kalender.md) | 2026-08-10 |
| FV-4 | E-Mail-Infrastruktur | Approved | [FV-4-email-infrastruktur.md](FV-4-email-infrastruktur.md) | 2026-08-10 |
| FV-5 | Interessensbekundung & Storno | Approved | [FV-5-interessensbekundung.md](FV-5-interessensbekundung.md) | 2026-08-10 |
| FV-6 | Teilnehmer-Registratur & CSV-Export | Approved | [FV-6-registratur.md](FV-6-registratur.md) | 2026-08-10 |
| FV-7 | Benutzerverwaltung | Approved | [FV-7-benutzerverwaltung.md](FV-7-benutzerverwaltung.md) | 2026-08-11 |
| FV-8 | Datenschutz & Löschjob | Roadmap | – | – |
| FV-9 | Deployment & Backup | Roadmap | – | – |
| FV-10 | Erinnerungsmail vor Lehrgangsbeginn | Roadmap | – | – |
| FV-11 | Farbmodus hell/dunkel | Approved | [FV-11-farbmodus.md](FV-11-farbmodus.md) | 2026-08-10 |
| FV-12 | Konto-CLI (Kennung & Passwort) | In Progress | [FV-12-konto-cli.md](FV-12-konto-cli.md) | 2026-08-12 |
| FV-13 | Lehrgangsfelder reduzieren | Approved | [FV-13-lehrgangsfelder-reduzieren.md](FV-13-lehrgangsfelder-reduzieren.md) | 2026-08-31 |
| FV-14 | Plätze entfernen & Zeitraum-Kalender | Approved | [FV-14-plaetze-entfernen.md](FV-14-plaetze-entfernen.md) | 2026-09-01 |
| FV-15 | PRD-Revision & persönliche Mitgliedskonten | Approved | [FV-15-mitgliedskonten.md](FV-15-mitgliedskonten.md) | 2026-09-11 |
| FV-16 | Mitgliedskonten anlegen & Zugangsdaten verteilen | Approved | [FV-16-mitgliedskonten-anlegen.md](FV-16-mitgliedskonten-anlegen.md) | 2026-09-12 |
| FV-17 | Lehrgangs-Voraussetzungen | Approved | [FV-17-lehrgangs-voraussetzungen.md](FV-17-lehrgangs-voraussetzungen.md) | 2026-09-12 |
| FV-18 | Teilnahme-Erfassung (Abschluss-Historie) | Planned | [FV-18-abschluss-erfassung.md](FV-18-abschluss-erfassung.md) | 2026-09-12 |
| FV-19 | Admin-Matrix (Lehrgänge × Mitglieder) | Roadmap | – | – |
| FV-20 | Voraussetzungs-Engine & Katalog-Sichtbarkeit | Roadmap | – | – |

<!-- Add features above this line -->

## Abhängigkeiten
- FV-2 setzt FV-1 voraus (ohne Login-Gate ist keine Seite erreichbar)
- FV-3 setzt FV-2 voraus (Datenmodell der Lehrgänge)
- FV-5 setzt FV-2 und FV-4 voraus (Eingangsbestätigung per Mail)
- FV-6 setzt FV-5 voraus
- FV-8 setzt FV-5 voraus (Löschjob braucht Anmeldedaten)
- FV-10 setzt FV-4 und FV-6 voraus
- FV-12 setzt FV-1 voraus (Konten, Passwort-Hashing) und ergänzt FV-7 um den Weg ohne Anmeldung
- FV-13 reduziert das Datenmodell aus FV-2/FV-3 (Kategorie, Format, Uhrzeit, Ausbilder, Ort entfallen)
- FV-14 setzt FV-13 voraus und reduziert zusätzlich FV-5/FV-6 (Platzzahl entfällt)
- FV-15 setzt FV-1 und FV-7 voraus (löst das geteilte Gast-Konto durch persönliche Mitgliedskonten
  ab); schaltet FV-16, FV-18, FV-19, FV-20 frei
- FV-16 setzt FV-15 voraus (Rollenmodell `member`/`admin` muss existieren)
- FV-17 setzt FV-2 und FV-3 voraus, ist unabhängig von FV-15/FV-16
- FV-18 setzt FV-15 voraus (Abschluss braucht ein persönliches Konto)
- FV-19 setzt FV-16, FV-17 und FV-18 voraus (Matrix zeigt Mitglieder × Lehrgänge inkl. Voraussetzung/Abschluss)
- FV-20 setzt FV-15, FV-17 und FV-18 voraus (Katalog-Filter nutzt Voraussetzungs- und Abschlussdaten)

## Stand der Umsetzung (2026-08-10)

FV-1 bis FV-3 sind implementiert, getestet und durch die QA gegangen (`npm run verify` grün:
141 Vitest-Tests, 19 Playwright-Tests, keine Abdeckungslücken). Die QA hat zehn Abweichungen
gefunden – überwiegend Farb- und Formsprache gegenüber dem Entwurf –, alle sind behoben und in
den Feature-Specs dokumentiert. Offen bis **Deployed**: FV-9.

FV-4 (E-Mail) ist implementiert, getestet und mit einem echten Relay verifiziert: Gmail über
`smtp.gmail.com:587`, Testversand am 2026-08-10 erfolgreich. Die Umstellung auf IONOS mit eigener
Domain ist ein reiner Konfigurationswechsel in `.env` (plus SPF/DKIM).

FV-5 (Interessensbekundung) und FV-6 (Registratur) sind seit 2026-08-10 implementiert und durch
die QA. Damit ist der ursprünglich hier vermerkte Rückstand abgearbeitet; offen bleibt allein die
in FV-3 zurückgestellte Absage-Mail an alle Interessenten.

FV-7 (Benutzerverwaltung) ist am 2026-08-11 implementiert: dritter Verwaltungstab, drei Routen
unter `/api/admin/users`, Schutzregeln für den letzten aktiven Admin und den Gast-Zugang. Neu ist
eine Kontoprüfung in `server/middleware/auth.ts` – ein deaktiviertes Konto verliert seine laufende
Sitzung sofort statt erst nach Ablauf. `npm run verify` grün: 258 Vitest-Tests, keine
Abdeckungslücken. Die QA am 2026-08-11 fand keine kritischen oder schwerwiegenden Befunde, dafür
zwei mittlere und vier leichte – **alle sechs sind behoben und mit Tests abgesichert**
(270 Vitest-Tests, 40 Playwright-Tests). Damit ist FV-7 **Approved**.

Aus der FV-7-QA offen geblieben, weil nicht FV-7 zuzurechnen:
- `/verwaltung` scrollt bei 375 px horizontal (441 px statt 375 px). Ursache ist die Tab-Leiste,
  auf allen drei Tabs identisch – gehört zu FV-3.
- Playwright fährt projektweit nur Desktop Chrome bei 1440 px statt der drei Breakpoints und drei
  Browser aus `.claude/rules/testing.md`.
- Komponententests gibt es weiterhin nur für `CourseCard` und `UserRegistry`; unter anderem
  `SignupRegistry` (FV-6) hat keinen.

## Stand der Umsetzung (2026-09-12)

FV-15 (PRD-Revision & persönliche Mitgliedskonten) ist implementiert: Rollenmodell von
`guest`/`admin` auf `member`/`admin` umgestellt (Migration `0007_strange_franklin_storm.sql`,
inkl. `PRAGMA ignore_check_constraints` rund um die Datenkorrektur, da der alte CHECK den neuen
Rollenwert selbst nicht zugelassen hätte), `darfDeaktivieren()` ohne Gast-Sonderfall, Seed/CLI/UI
auf „Mitglied" umbenannt, `docs/PRD.md` um den Abschnitt „Revision am 2026-09-11" ergänzt (der
verworfene Entwurf vom 2026-08-10 bleibt davon unberührt als Historie stehen). `npm run verify`
grün: 350 Vitest-Tests, keine Abdeckungslücken. Abweichung von der ursprünglichen Spec: das
vormalige geteilte Gast-Konto wird nicht deaktiviert, sondern zu einem gewöhnlichen
Mitgliedskonto – Details in `FV-15-mitgliedskonten.md`. FV-7s AC-7 ist damit historisch (Hinweis
in dessen Spec ergänzt).

FV-16 (Mitgliedskonten anlegen & Zugangsdaten verteilen) ist implementiert: neue Route
`POST /api/admin/members` legt ein Mitgliedskonto an (Rolle serverseitig fest, kein
Request-Body-Feld dafür auf dieser oder der Admin-Route), ohne eigenes Passwort erzeugt der
Server eines und gibt es einmalig in der Antwort zurück (`generatePassword()` in
`server/utils/password.ts`); `GET /api/admin/users` filtert optional per `role`-Query-Parameter.
Dritter Verwaltungstab hat einen zweiten Button „Mitglied anlegen" (nur Kennung + Name) und zeigt
das erzeugte Startpasswort danach einmalig in einem nicht wegklickbaren Dialog. Keine Abweichung
von der ursprünglichen Spec. `npm run verify` grün: 366 Vitest-Tests (davon neu
`tests/api/admin.members.spec.ts`), `npm run test:e2e` grün: 40 Playwright-Tests, keine
Abdeckungslücken.

FV-17 (Lehrgangs-Voraussetzungen) ist implementiert: neue Tabelle `course_prerequisites`
(Migration `0008_cloudy_squirrel_girl.sql`, reine `CREATE TABLE`), `PUT`/`GET
/api/admin/courses/:id/prerequisites` pflegen bzw. lesen die Voraussetzungsmenge eines
Lehrgangs, Zyklen (auch über mehrere Stationen) werden per Reachability-Suche vor dem Speichern
abgelehnt (422), `deleteCourse` verweigert das Löschen eines Lehrgangs, der Voraussetzung für
einen anderen ist (409). Die Bearbeitungsseite eines Lehrgangs hat ein
Mehrfachauswahlfeld mit eigenem Speichervorgang. Keine inhaltliche Abweichung von einer
Acceptance Criterion. `npm run verify`s Einzelschritte (Lint, Typecheck, 388 Vitest-Tests,
`check:gaps` für FV-17 selbst) sind grün, `npm run test:e2e` ebenfalls; der zusammengesetzte
`npm run verify`-Befehl endet dennoch mit Exit-Code 1, weil `check:gaps` für das parallel in
einem eigenen Branch/Worktree in Arbeit befindliche **FV-18** (dessen Spec bereits im
Basis-Commit dieses Branches steht) fehlende Tests meldet – ein vorbestehender Zustand,
unabhängig von FV-17, der sich mit dessen Merge auflöst. Details in
`FV-17-lehrgangs-voraussetzungen.md`.

FV-18 bis FV-20 (Abschluss-Tracking, Matrix, Katalog-Filter) sind noch nicht begonnen.

## Historie
Die ursprünglichen Feature-IDs FV-1 bis FV-12 (Enterprise-Fortbildungsverwaltung mit Rollen,
Punkten, Budgets, Zertifikaten) wurden am 2026-08-10 nach Abgleich mit dem Design verworfen und die
Nummern neu vergeben. Begründung: `docs/PRD.md`, Abschnitt „Verworfen".

## Next Available ID: FV-21
