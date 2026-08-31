# FV-14: Plätze entfernen & Zeitraum-Kalender

**Status:** In Progress
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

Wird während der Umsetzung ergänzt.
