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

<!-- Add features above this line -->

## Abhängigkeiten
- FV-2 setzt FV-1 voraus (ohne Login-Gate ist keine Seite erreichbar)
- FV-3 setzt FV-2 voraus (Datenmodell der Lehrgänge)
- FV-5 setzt FV-2 und FV-4 voraus (Eingangsbestätigung per Mail)
- FV-6 setzt FV-5 voraus
- FV-8 setzt FV-5 voraus (Löschjob braucht Anmeldedaten)
- FV-10 setzt FV-4 und FV-6 voraus
- FV-12 setzt FV-1 voraus (Konten, Passwort-Hashing) und ergänzt FV-7 um den Weg ohne Anmeldung

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

## Historie
Die ursprünglichen Feature-IDs FV-1 bis FV-12 (Enterprise-Fortbildungsverwaltung mit Rollen,
Punkten, Budgets, Zertifikaten) wurden am 2026-08-10 nach Abgleich mit dem Design verworfen und die
Nummern neu vergeben. Begründung: `docs/PRD.md`, Abschnitt „Verworfen".

## Next Available ID: FV-13
