# FV-13: Lehrgangsfelder reduzieren

**Status:** In Progress
**Created:** 2026-08-31
**Abhängigkeiten:** FV-2 (Lehrgangskatalog), FV-3 (Admin-Kalender) – reduziert deren Datenmodell

## Ziel

Das Datenmodell eines Lehrgangs wird verschlankt: Kategorie, Format, Uhrzeit, Ausbilder und Ort
entfallen vollständig (Formular, Anzeige, Datenbank, Ausbilder-Verwaltung, E-Mail-Texte). Die
Platzzahl (`capacity`) wird zum Pflichtfeld – „0 = unbegrenzt" entfällt.

## User Stories

- Als Wehrführung möchte ich beim Anlegen eines Lehrgangs nur noch die tatsächlich benötigten
  Angaben pflegen (Titel, Zeitraum, Plätze), ohne Kategorie, Format, Ausbilder oder Ort erfassen zu
  müssen.
- Als Angehöriger der Wehr möchte ich auf Übersicht und Detailseite keine Kategorie-/Format-Badges,
  Uhrzeit, Ausbilder oder Ort mehr sehen, da diese Angaben nicht mehr gepflegt werden.

## Acceptance Criteria

- [x] **AC-1:** Das Anlegen-Formular (`CourseQuickCreateModal`) fragt Kategorie, Format, Uhrzeit,
      Ausbilder und Ort nicht mehr ab; „Plätze" ist ein Pflichtfeld ohne „0 = unbegrenzt"-Hinweis.
- [x] **AC-2:** Das Bearbeiten-Formular zeigt dieselben Felder nicht mehr an.
- [x] **AC-3:** Kurskarten, Filterleiste, Detailseite und Titelbild-Beschriftung zeigen keine
      Kategorie/Format/Uhrzeit/Ausbilder/Ort mehr; die Kategoriefilterleiste entfällt vollständig.
- [x] **AC-4:** E-Mail-Vorlagen (Absage, Verschiebung, Anmeldebestätigung usw.) enthalten keine
      Uhrzeit- oder Ortsangabe mehr.
- [x] **AC-5:** `POST /api/admin/courses` und `PATCH /api/admin/courses/:id` akzeptieren keine
      der fünf Felder mehr (werden ignoriert, sofern mitgeschickt) und lehnen `capacity <= 0` mit
      422 ab.
- [x] **AC-6:** Die Ausbilder-Verwaltung (`/api/admin/instructors`, Tabelle `instructors`) entfällt
      vollständig.
- [x] **AC-7:** Eine neue Migration entfernt `category`, `format`, `time_label`, `location`,
      `instructor_id` aus `courses` sowie die Tabelle `instructors`; bestehende Lehrgänge mit
      `capacity = 0` werden dabei auf `capacity = 1` angehoben, damit die verschärfte
      `capacity > 0`-Regel nicht an Altdaten scheitert.

## Edge Cases

- Bestehender Lehrgang mit `capacity = 0` vor der Migration → wird auf `1` gesetzt, keine
  automatische Benachrichtigung (reine Datenkorrektur, kein fachlicher Vorgang).
- Bestehender Lehrgang mit gesetztem Ausbilder → Zuordnung geht mit der Migration verloren
  (Tabelle `instructors` entfällt).

## Tech Design

Betroffene Spalten aus `courses`: `category`, `format`, `time_label`, `location`,
`instructor_id`. Tabelle `instructors` entfällt komplett. `capacity` bleibt `NOT NULL`, der
CHECK wechselt von `>= 0` auf `> 0`. Migration per `npm run db:generate` (Tabellen-Neuaufbau, da
SQLite `ALTER TABLE ... DROP COLUMN` mit CHECK-Neuaufbau kombiniert werden muss), mit einem
vorgeschalteten `UPDATE courses SET capacity = 1 WHERE capacity <= 0`.

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/api/admin.courses.spec.ts` | AC-1, AC-5, AC-6 |
| `tests/api/courses.list.spec.ts` | AC-3 |
| `tests/api/courses.detail.spec.ts` | AC-3 |
| `tests/components/CourseCard.spec.ts` | AC-3 |
| `tests/unit/cover.spec.ts` | AC-3 |
| `tests/unit/mail-templates.spec.ts` | AC-4 |
| `tests/e2e/02-verwaltung.spec.ts` | AC-1, AC-2 |

---

## Implementierungsnotizen (2026-08-31)

**Gebaut:** Kategorie, Format, Uhrzeit, Ausbilder und Ort vollständig entfernt – Datenbankschema
(Migration `0002_brief_betty_ross.sql`, Tabelle `instructors` gedroppt), Validierung
(`shared/validation/course.ts`), Services (`course.service.ts`, `course-admin.service.ts`,
`mail.service.ts`, `signup.service.ts`, `signup-admin.service.ts`), API-Routen
(`server/api/admin/instructors/*` gelöscht), E-Mail-Vorlagen sowie alle betroffenen Komponenten
und Seiten (`CourseQuickCreateModal`, `CourseCard`, `CourseFilterBar`, `CourseInstructor` gelöscht,
Detail- und Bearbeitungsseite). „Plätze" ist jetzt Pflichtfeld (`capacity > 0`, Zod `min(1)`).

**Migration/Altdaten:** `0002_brief_betty_ross.sql` hebt vor dem Tabellen-Neuaufbau bestehende
Lehrgänge mit `capacity <= 0` auf `capacity = 1` an (`UPDATE courses SET capacity = 1 WHERE
capacity <= 0`), damit der verschärfte CHECK (`capacity > 0`) nicht an Altdaten scheitert.
Ausbilder-Zuordnungen gehen mit dem Drop der Tabelle `instructors` unwiderruflich verloren.

**Abweichung von der ursprünglichen Spec:** FV-2 und FV-3 dokumentierten diese Felder als Teil des
Designs (siehe dortige Hinweis-Boxen). Diese Spec-Abschnitte sind jetzt historisch.

**Tests:** `npm run verify` grün – 30 Testdateien, 285 Vitest-Tests, keine Abdeckungslücken (alle
7 Acceptance Criteria von FV-13 abgedeckt, u. a. eine dedizierte Migrationsprobe für AC-7). E2E
(`npm run test:e2e`) angepasst (`02-verwaltung.spec.ts`, `03-anmeldung.spec.ts`,
`katalog.layout.spec.ts`, `tests/qa/screenshots.spec.ts`).
