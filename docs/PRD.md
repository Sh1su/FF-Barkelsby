# Product Requirements Document – Lehrgangsverwaltung Freiwillige Feuerwehr

**Status:** Abgestimmt · **Letzte Aktualisierung:** 2026-08-10
**Grundlage:** Design `Fortbildungsverwaltung.dc.html` (Claude Design Projekt `57c88b5d`) sowie die
Abstimmungsrunden Q1–Q27 vom 2026-08-10.

## Vision

Eine selbst gehostete Webanwendung, mit der eine Freiwillige Feuerwehr ihre Lehrgänge veröffentlicht
und die Teilnehmerlisten verwaltet. Angehörige der Wehr melden sich mit einem gemeinsamen
Gast-Zugang an, sehen die kommenden Lehrgänge und bekunden mit drei Feldern ihr Interesse – ohne
persönliches Benutzerkonto. Die Wehrführung legt Lehrgänge im Kalender an, bestätigt oder lehnt
Anmeldungen ab und verwaltet die Zugänge.

Die Anwendung ersetzt Aushang, WhatsApp-Rundruf und handschriftliche Teilnehmerlisten durch eine
nachvollziehbare Übersicht. Sie läuft vollständig on-premise als Docker-Container mit SQLite-Datei
auf einem Volume; einziger externer Dienst ist ein SMTP-Relay für den Mailversand.

## Zielgruppe

| Rolle | Zugang | Bedürfnisse |
|-------|--------|-------------|
| **Angehörige der Wehr** | geteiltes Gast-Konto | Kommende Lehrgänge sehen, Details und Programm lesen, Interesse bekunden, sich wieder abmelden |
| **Wehrführung / Verwaltung** | persönliches Admin-Konto | Lehrgänge anlegen und pflegen, Anmeldungen bestätigen oder ablehnen, Teilnehmerliste ausdrucken, Zugänge verwalten |

Es gibt **kein** persönliches Konto für Teilnehmer und **kein** abgestuftes Rollenmodell darüber
hinaus. Wer sich anmeldet, hinterlässt Vorname, Nachname und E-Mail – mehr nicht.

## Core Features (Roadmap)

| Priorität | ID | Feature | Status |
|-----------|----|---------|--------|
| P0 | FV-1 | Fundament & Login-Gate (Gast + Admin, Sessions, Rate-Limit) | Planned |
| P0 | FV-2 | Lehrgangskatalog: Datenmodell, Übersicht, Detailseite, Motiv-Generator | Planned |
| P0 | FV-3 | Admin: Monatskalender, Schnellanlage, Detail-Bearbeitung, Absage | Planned |
| P0 | FV-4 | E-Mail-Infrastruktur (SMTP-Relay, Vorlagen, Fehlerprotokoll) | Roadmap |
| P0 | FV-5 | Interessensbekundung inkl. Storno per Token-Link | Roadmap |
| P0 | FV-6 | Teilnehmer-Registratur: Statusworkflow, Zu-/Absagen, CSV-Export | Roadmap |
| P1 | FV-7 | Benutzerverwaltung (dritter Admin-Tab) | Roadmap |
| P1 | FV-8 | Datenschutz: Einwilligung, Datenschutzseite, Löschjob | Roadmap |
| P1 | FV-9 | Deployment & Backup: Dockerfile, Compose, Litestream, Restore-Test | Roadmap |
| P2 | FV-10 | Erinnerungsmail 3 Tage vor Lehrgangsbeginn (zeitgesteuerter Job) | Roadmap |

Reihenfolge: FV-1 bis FV-3 werden am Stück gebaut (vorher ist nichts Lauffähiges zu sehen), ab FV-4
je ein Branch, ein Pull Request und eine Abnahme pro Feature.

## Domänenmodell

```
users (guest | admin)            – Zugang zum System, geteiltes Gast-Konto + persönliche Admins
instructors                      – Ausbilder mit Porträt, Rolle, Vita
courses ──< course_days          – Lehrgang mit Programm je Tag
   │
   └──< signups                  – Interessensbekundung (Vorname, Nachname, E-Mail, Storno-Token)
mail_log                         – versendete und fehlgeschlagene Mails
```

**Statusmaschine `signups`:** `offen → bestätigt | abgelehnt`, dazu `storniert` (durch Teilnehmer
per Token-Link). „Rückgängig" in der Registratur setzt auf `offen` zurück.

**Statusmaschine `courses`:** `geplant → abgesagt`; Absage hält den Lehrgang sichtbar (durchgestrichen
mit Hinweis) und löst Absage-Mails an alle Interessenten aus. Hartes Löschen nur, solange keine
Anmeldung existiert.

**Kapazität:** `belegt` zählt ausschließlich **bestätigte** Anmeldungen. Ist ein Lehrgang ausgebucht,
bleibt die Interessensbekundung möglich (faktische Warteliste nach Eingangsreihenfolge), die Karte
trägt das Badge „ausgebucht".

## Feste Stammdaten (Enums, v1 nicht pflegbar)

- **Kategorien:** Grundausbildung · Atemschutz · Technische Hilfeleistung · Führung & Organisation ·
  Erste Hilfe / Sanitätsdienst
- **Formate:** Standortausbildung · Kreisausbildung

Die Filterleiste der Übersicht besteht aus „Alle" plus diesen fünf Kategorien.

## E-Mail-Matrix

| Auslöser | Empfänger | Inhalt |
|----------|-----------|--------|
| Interessensbekundung eingegangen | Teilnehmer | Eingangsbestätigung + Storno-Link |
| Interessensbekundung eingegangen | Wehrführung | Hinweis auf neue Anmeldung in der Registratur |
| Anmeldung bestätigt | Teilnehmer | Zusage mit Termin und Ort + Storno-Link |
| Anmeldung abgelehnt | Teilnehmer | Absage für diese Anmeldung |
| Lehrgang abgesagt | alle Interessenten | Absage des gesamten Lehrgangs |
| Termin geändert | alle Interessenten | neuer Zeitraum |

Ohne konfiguriertes SMTP-Relay läuft die Anwendung vollständig weiter; Mails werden dann nur in
`mail_log` protokolliert und nicht versendet. Kein Double-Opt-in – hinter dem Login-Gate sitzen
Angehörige der Wehr, kein offenes Internet.

## Success Metrics

- Ein Lehrgang ist in unter 60 Sekunden angelegt und sichtbar
- Eine Interessensbekundung dauert unter 15 Sekunden (drei Felder, kein Konto)
- Jede bestätigte Anmeldung hat eine zugestellte Zusagemail
- Die Anwesenheitsliste eines Lehrgangs ist mit einem Klick als CSV exportierbar
- Keine Teilnehmerdaten älter als 12 Monate nach Lehrgangsende in der Datenbank

## Constraints

- **Betrieb:** self-hosted, öffentlich erreichbar hinter einem Reverse Proxy mit TLS; der Container
  spricht HTTP auf einem internen Port
- **Build:** Das Repository wird auf den Zielserver gepullt und dort gebaut (`build:` statt `image:`
  im Compose); kein Buildschritt, der zur Laufzeit Internetzugang braucht
- **Datenbank:** SQLite auf einem Docker-Volume, WAL-Modus, Single-Instance
- **Stack:** Nuxt 4 (Frontend + Nitro-Backend), TypeScript strict, Nuxt UI mit Theme aus den
  Design-Tokens, Drizzle ORM, nuxt-auth-utils
- **Schriften:** IBM Plex Sans wird lokal als woff2 ausgeliefert – kein Google-Fonts-Abruf
  (Offline-Betrieb und DSGVO)
- **Bilder:** ausschließlich serverseitig generierte SVG-Motive (8 Motive × 4 Farbvarianten), keine
  Bilddateien, keine Uploads in v1
- **Backup:** Litestream repliziert auf ein lokales Volume (Zweitziel als vorbereitete Konfigzeile)
- **Datenschutz:** personenbezogene Daten nur Vorname, Nachname, E-Mail; Einwilligungs-Checkbox mit
  Link auf eine statische Datenschutzseite; automatische Löschung 12 Monate nach Lehrgangsende
- **Sprache:** Oberfläche und Mails auf Deutsch, Code und Bezeichner auf Englisch

## Non-Goals

- Kein persönliches Teilnehmerkonto, kein Rollenmodell über guest/admin hinaus
- Keine Punktekonten, Budgets, Zertifikatsverwaltung oder Pflichtfortbildungsüberwachung
- Kein Learning-Management-System, keine Kursinhalte
- Keine Mandantenfähigkeit (eine Wehr pro Installation)
- Keine native Mobile-App (Web ist responsiv)
- Keine Bilduploads in v1 (nachrüstbar, ohne bestehende Strukturen zu ändern)
- Keine pflegbaren Taxonomien für Kategorien und Formate in v1

## Offene Angaben

| Angabe | Benötigt für | Zwischenlösung |
|--------|--------------|----------------|
| SMTP-Host, Port, Benutzer, Absenderadresse | FV-4 | Mailversand deaktiviert, nur `mail_log` |
| Domainname des Servers | FV-9 | Platzhalter in `.env.example` |
| Echter Name der Wehr | jederzeit | „Freiwillige Feuerwehr Musterstadt" in `app.config.ts` |

## Verworfen am 2026-08-10

Der ursprüngliche Entwurf dieses PRD beschrieb eine interne Enterprise-Fortbildungsverwaltung mit
vier Rollen (Mitarbeitende / Führungskraft / Verwaltung / Admin), Antrags- und
Genehmigungs-Workflow, Punktekonto, Abteilungsbudgets, Zertifikats-Upload mit Ablaufüberwachung,
Reporting und Audit-Log. Er entstand, weil das Design zum Zeitpunkt des Projekt-Setups nicht
abrufbar war (siehe `SETUP.md`). Der Abgleich mit dem tatsächlichen Design hat gezeigt, dass keines
dieser Konzepte Teil des Produkts ist. Die alten Feature-IDs FV-1 bis FV-12 sind ersatzlos entfallen;
die Nummern wurden neu vergeben.
