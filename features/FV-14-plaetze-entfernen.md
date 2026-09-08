# FV-14: Plätze entfernen & Zeitraum-Kalender

**Status:** ✅ Approved (verifiziert über `npm run verify`, e2e und QA-Bildstrecke, noch nicht deployed)
**Created:** 2026-09-01
**Abhängigkeiten:** FV-2 (Lehrgangskatalog), FV-3 (Admin-Kalender), FV-5 (Anmeldungen),
FV-6 (Registratur) – reduziert deren Datenmodell weiter (nach [FV-13](FV-13-lehrgangsfelder-reduzieren.md))

## Ziel

Die feste Platzzahl (`capacity`) entfällt vollständig. Ein Lehrgang nimmt beliebig viele
Interessenten an – begrenzt wird die Anmeldung ausschließlich durch zwei Ereignisse: die
Wehrführung sagt den Lehrgang ab, oder der Starttag ist erreicht. Für den Zeitraum (Beginn/Ende)
beim Anlegen und Bearbeiten wird zusätzlich der Kalender aus der Nuxt-UI-MCP-Dokumentation
(`UCalendar` im Bereichsmodus, Button+Popover-Muster) statt zweier einzelner Datumsfelder
eingesetzt.

## User Stories

- Als Wehrführung möchte ich beim Anlegen keine Platzzahl mehr abschätzen müssen – ein Lehrgang
  ist offen für alle Interessenten, bis er beginnt oder ich ihn vorher absage.
- Als Wehrführung möchte ich den Zeitraum eines Lehrgangs bequem in einem Kalender auswählen
  statt zwei Datumsfelder einzeln auszufüllen.
- Als Angehöriger der Wehr möchte ich mich für jeden noch nicht begonnenen Lehrgang anmelden
  können, ohne an eine Platzzahl gebunden zu sein.

## Acceptance Criteria

- [x] **AC-1:** Das Anlegen- und Bearbeiten-Formular fragen keine Platzzahl mehr ab; eine
      mitgeschickte `capacity` wird von der API ignoriert (keine Fehlermeldung, kein Effekt).
- [x] **AC-2:** Beginn und Ende werden über einen Nuxt-UI-Kalender im Bereichsmodus
      (`UCalendar range` hinter `UButton`/`UPopover`) gewählt statt über zwei
      `<input type="date">`-Felder. Ein einzelner Klick wählt einen eintägigen Lehrgang.
- [x] **AC-3:** Kurskarten, Detailseite und Admin-Kalender zeigen keine Platzzahl, kein
      „X von Y Plätzen" und kein Badge „ausgebucht" mehr; bestätigte Anmeldungen werden weiterhin
      als Zahl angezeigt, wenn es welche gibt.
- [x] **AC-4:** Ein Lehrgang nimmt Anmeldungen an, solange er weder abgesagt ist noch der
      Starttag erreicht ist; ab dem Starttag (inklusive) meldet die API 422 und die Oberfläche
      zeigt „Anmeldung geschlossen" statt der Schaltfläche „Interesse bekunden".
- [x] **AC-5:** Die „über Kapazität"-Kennzeichnung in der Registratur (FV-6, AC-6) entfällt; jede
      Bestätigung ist uneingeschränkt möglich.

## Edge Cases

- Lehrgang beginnt heute → keine Anmeldung mehr möglich, auch wenn er (mehrtägig) noch bis zum
  Enddatum im Katalog sichtbar bleibt.
- Lehrgang wird abgesagt und die Absage zurückgenommen, bevor der Starttag erreicht ist →
  Anmeldung ist wieder offen.
- Im Zeitraum-Kalender wird nur der Starttag angeklickt (kein zweiter Klick) → Ende übernimmt
  automatisch den Starttag (eintägiger Lehrgang), analog zum bisherigen Verhalten der
  Schnellanlage.

## Tech Design

`courses.capacity` entfällt aus dem Schema (Migration `0003_breezy_moonstone.sql`, einfacher
Spaltendrop – anders als bei FV-13 gibt es hier keine Altdaten-Korrektur, da jeder Wert gültig
war). `isFullyBooked`/`freeSeats` (`course.service.ts`) werden durch `isSignupOpen(status,
startsOn, now)` ersetzt: offen, solange `status !== 'abgesagt'` und `startsOn` nach dem
Tagesbeginn von `now` liegt. `signup.service.ts` prüft `isSignupOpen` zusätzlich zur bisherigen
Abgesagt-Prüfung, bevor eine neue Interessensbekundung angelegt wird.

Neue Komponente `app/components/admin/CourseDateRangeField.vue` kapselt den Nuxt-UI-Kalender im
Bereichsmodus (`@internationalized/date` für die Umwandlung zwischen `CalendarDate` und den
ISO-Datumsstrings, die `shared/validation/course.ts` erwartet) und wird in
`CourseQuickCreateModal.vue` und der Bearbeiten-Seite per `v-model:starts-on`/`v-model:ends-on`
eingesetzt.

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/api/admin.courses.spec.ts` | AC-1 |
| `tests/api/courses.list.spec.ts` | AC-3 |
| `tests/api/courses.detail.spec.ts` | AC-3, AC-4 |
| `tests/api/signups.spec.ts` | AC-1, AC-4 |
| `tests/api/admin.signups.spec.ts` | AC-5 |
| `tests/components/CourseCard.spec.ts` | AC-3, AC-4 |
| `tests/e2e/02-verwaltung.spec.ts` | AC-1, AC-2 |

---

## Implementierungsnotizen (2026-09-01)

**Gebaut:** `capacity` vollständig aus Schema, Migration, Validierung, Services und Oberfläche
entfernt. Anmeldeschluss automatisch zum Starttag (`isSignupOpen` in `course.service.ts`),
zusätzlich zur bestehenden Absage-Sperre. Neue `CourseDateRangeField.vue`-Komponente auf Basis
des Nuxt-UI-Kalenders im Bereichsmodus (Doku über den neu installierten `nuxt-ui`-MCP-Server
bzw. `ui.nuxt.com/docs/components/calendar` recherchiert) ersetzt die bisherigen zwei
`<input type="date">`-Felder in Schnellanlage und Bearbeiten-Seite.

**Werkzeug:** `nuxt-ui`-MCP-Server via `claude mcp add --transport http nuxt-ui
https://ui.nuxt.com/mcp` installiert. Die frisch hinzugefügten Tools standen in der laufenden
Session erst nach einem Reconnect zur Verfügung; die Kalender-Dokumentation wurde deshalb direkt
von `ui.nuxt.com` abgerufen (inhaltlich identische Quelle).

**Tests:** `npm run verify` grün (Lint, Typecheck, 289 Vitest-Tests, keine Abdeckungslücken – alle
5 Acceptance Criteria von FV-14 abgedeckt). `npm run test:e2e` grün (39 Tests, inklusive einer
Prüfung, dass der Kalender-Button das gewählte Datum korrekt anzeigt). QA-Bildstrecke
(`tests/qa/screenshots.spec.ts`) visuell geprüft: Schnellanlage, Bearbeiten-Seite, Kurskarten und
Detailseite zeigen weder Platzzahl noch die frühere Ausgebucht-Kennzeichnung.

**Abweichung von der ursprünglichen Spec:** FV-2, FV-3, FV-5 und FV-6 dokumentierten die Platzzahl
als Teil des Designs. Die betroffenen Acceptance Criteria (FV-2 AC-6, FV-3 AC-14, FV-5 AC-5,
FV-6 AC-6) sind in den jeweiligen Specs als historisch markiert statt mit Tests für entfernte
Funktionalität künstlich grün gehalten zu werden.

## Bugfix (2026-09-08)

**Gemeldet:** Der Zeitraum-Kalender aus `CourseDateRangeField.vue` (AC-2) konnte nur den Starttag
darstellen – ein zweiter Klick auf ein späteres Datum eröffnete immer einen neuen eintägigen
Bereich, statt das bestehende Ende zu erweitern.

**Ursache:** `range` war ein `computed({ get, set })` direkt auf `startsOn`/`endsOn`. Der
`set()`-Handler spiegelte nach dem ersten Klick sofort `endsOn = startsOn` zurück (gewollt: "ein
Klick = ein Tag"). Dadurch sah `UCalendar` bei jedem Lesezugriff bereits einen abgeschlossenen
Bereich (`start` und `end` beide gesetzt) und behandelte den nächsten Klick als neue Auswahl statt
als Erweiterung des bestehenden Endes.

**Fix:** eigener `shallowRef` als Kalenderzustand, der `end: undefined` zwischen erstem und
zweitem Klick tatsächlich haelt; die Ein-Klick-ein-Tag-Regel spiegelt nur noch einwegig nach
`startsOn`/`endsOn` (mit Schutz gegen Rückkopplung der eigenen Schreibvorgänge). Verhalten von
AC-2 unveraendert, jetzt aber auch für mehrtägige Bereiche per zweitem Klick nutzbar.

**Regressionsfund dabei:** `isSignupOpen`/`listUpcomingCourses` in `course.service.ts` berechneten
den Tagesbeginn über `setHours(0, 0, 0, 0)` – das rundet in der lokalen Zeitzone des Servers,
während `startsOn`/`endsOn` laut `parseDate` (`course-admin.service.ts`) grundsätzlich in UTC
gespeichert werden. In Zeitzonen mit positivem UTC-Offset (z. B. Europe/Berlin im Sommer) lag der
lokale Tagesbeginn dadurch vor dem UTC-Termin des Starttags selbst – der Anmeldeschluss aus AC-4
griff am Starttag nicht (`tests/api/signups.spec.ts`, "am Starttag selbst nimmt der Lehrgang keine
Anmeldung mehr an" schlug fehl: 201 statt 422). Behoben durch einen gemeinsamen
`startOfUtcDay()`-Helfer, der wie `parseDate` in UTC rechnet statt in lokaler Zeit.

**Tests:** `npm run verify` grün (Lint, Typecheck, 289 Vitest-Tests, keine Abdeckungslücken).
`npx playwright test tests/e2e/` grün (20 Tests).
