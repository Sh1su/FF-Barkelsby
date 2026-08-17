# FV-3: Admin-Kalender & Lehrgangsverwaltung

**Status:** ✅ Approved (QA bestanden, noch nicht deployed)
**Created:** 2026-08-10
**Last Updated:** 2026-08-10 (Implementierung)
**Abhängigkeiten:** FV-1 (Login-Gate), FV-2 (Datenmodell der Lehrgänge)

## Ziel

Der Verwaltungsbereich aus dem Design: ein Monatskalender mit Schnellanlage per Klick auf einen Tag,
eine ausführliche Detail-Bearbeitung für Inhalte, Programm und Ausbilder sowie das Absagen und
Löschen von Lehrgängen.

## User Stories

- Als Wehrführung möchte ich im Monatskalender sehen, wann Lehrgänge stattfinden, um Termine nicht zu
  doppeln.
- Als Wehrführung möchte ich mit einem Klick auf einen Tag einen Lehrgang in wenigen Feldern anlegen,
  um den Termin sofort sichtbar zu machen.
- Als Wehrführung möchte ich Beschreibung, Themen, Programmtage und Ausbilder nachträglich ergänzen,
  ohne dass die Schnellanlage dadurch länger wird.
- Als Wehrführung möchte ich einen Lehrgang absagen können, ohne ihn zu löschen, damit die
  Interessenten die Absage sehen und später nachvollziehbar bleibt.

## Acceptance Criteria

- [x] **AC-1:** `/verwaltung` ist nur für Rolle `admin` erreichbar; ein Gast erhält 403 bzw. wird
      umgeleitet.
- [x] **AC-2:** Der Kalender zeigt den aktuellen Monat mit sieben Spalten ab Montag; „Heute" springt
      zurück auf den laufenden Monat, Vor/Zurück wechseln den Monat.
- [x] **AC-3:** Jeder Tag zeigt die an diesem Tag laufenden Lehrgänge als Eintrag; mehrtägige
      Lehrgänge erscheinen an jedem betroffenen Tag.
- [x] **AC-4:** Ein Klick auf einen Tag öffnet die Schnellanlage mit diesem Datum als Zeitraumbeginn.
- [x] **AC-5:** Die Schnellanlage enthält genau die Felder des Designs: Titel, Zeitraum (von/bis),
      Ausbilder, Uhrzeit, Plätze, Format, Kategorie, Motivauswahl.
- [x] **AC-6:** Ein Enddatum vor dem Startdatum wird mit 400 abgelehnt und im Formular als Fehler
      angezeigt.
- [x] **AC-7:** Nach dem Anlegen erscheint der Lehrgang ohne Neuladen im Kalender und ist in der
      Gast-Übersicht sichtbar.
- [x] **AC-8:** Die Detail-Bearbeitung speichert Beschreibung, Themenliste, Programmtage (Datum,
      Uhrzeit, Titel, Stichpunkte) und die Ausbilderzuordnung.
- [x] **AC-9:** Programmtage lassen sich hinzufügen, umsortieren und entfernen; die Reihenfolge bleibt
      nach dem Neuladen erhalten.
- [x] **AC-10:** „Absagen" setzt den Status auf `abgesagt`; der Lehrgang bleibt in Kalender und
      Gast-Übersicht sichtbar und ist dort als abgesagt markiert.
- [x] **AC-11:** Ein abgesagter Lehrgang kann wieder auf `geplant` gesetzt werden.
- [x] **AC-12:** Löschen ist nur möglich, solange keine Anmeldung am Lehrgang hängt; sonst antwortet
      die API mit 409 und dem Hinweis, stattdessen abzusagen.
- [x] **AC-13:** Alle Schreibrouten unter `/api/admin/**` weisen Gast-Sessions mit 403 und
      nicht angemeldete Aufrufe mit 401 ab.
- [x] **AC-14:** Die Kapazität kann nicht unter die Zahl der bereits bestätigten Anmeldungen gesenkt
      werden (422 mit Erklärung).

## Edge Cases

- Klick auf einen Tag in der Vergangenheit → Anlage möglich (Nachpflege alter Lehrgänge), aber Hinweis
- Zeitraum über einen Monatswechsel → Eintrag erscheint in beiden Monatsansichten
- Zwei Admins bearbeiten denselben Lehrgang → letzter Schreibvorgang gewinnt; `updatedAt` wird
  mitgeschickt und bei Abweichung mit 409 abgelehnt
- Ausbilder wird gelöscht, während er zugeordnet ist → Zuordnung wird auf `null` gesetzt, Lehrgang
  bleibt erhalten
- Absage eines Lehrgangs ohne Interessenten → keine Mails, kein Fehler
- Löschversuch bei stornierten Anmeldungen → zählt als vorhandene Anmeldung, also 409

## Tech Design

### API Routes (Nitro)

| Route | Auth | Zweck |
|-------|------|-------|
| `GET /api/admin/courses` | admin | Kalenderdaten, Query `von`, `bis` |
| `POST /api/admin/courses` | admin | Schnellanlage |
| `PATCH /api/admin/courses/:id` | admin | Detail-Bearbeitung inkl. Programmtage |
| `POST /api/admin/courses/:id/cancel` | admin | Absagen / Absage zurücknehmen |
| `DELETE /api/admin/courses/:id` | admin | Löschen (409 bei Anmeldungen) |
| `GET /api/admin/instructors` | admin | Auswahlliste |
| `POST /api/admin/instructors` | admin | Ausbilder anlegen |

Fachlogik in `server/services/course.service.ts`; Statusübergänge (`geplant ↔ abgesagt`) laufen
ausschließlich über `transitionCourse()` mit Prüfung erlaubter Übergänge.

**Bewusst zurückgestellt:** Die Absage-Mails an alle Interessenten (PRD, E-Mail-Matrix) werden erst
in FV-4/FV-6 verschickt. FV-3 setzt nur den Status; der Versand hängt sich später an denselben
Service-Aufruf.

### Component Architecture (Nuxt)

```
app/pages/verwaltung/index.vue          – Tabs: Kalender | Registratur | Benutzerverwaltung
├── admin/CourseCalendar.vue            – Monatsraster
│   └── admin/CalendarDayCell.vue
├── admin/CourseQuickCreateModal.vue    – Schnellanlage (UModal + UForm)
│   └── admin/MotifPicker.vue           – 8 Motive × 4 Paletten
└── admin/CourseEditor.vue              – Detail-Bearbeitung
    ├── admin/TopicListEditor.vue
    ├── admin/CourseDayEditor.vue
    └── admin/InstructorSelect.vue
```

Die Tabs „Registratur" und „Benutzerverwaltung" sind in FV-3 nur als leere Platzhalter angelegt und
werden in FV-6 bzw. FV-7 gefüllt.

### Validierung (`shared/validation/course.ts`)

Ein Zod-Schema für die Schnellanlage, eines für die Detail-Bearbeitung. Beide listen ausschließlich
erlaubte Felder auf – `status`, `createdAt` und Kapazitätsprüfungen kommen nie aus dem Request-Body.

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/api/admin.courses.spec.ts` | AC-3, AC-5 bis AC-14 |
| `tests/api/authorization.matrix.spec.ts` | AC-1, AC-13 |
| `tests/unit/course-transitions.spec.ts` | AC-10, AC-11 |
| `tests/unit/calendar-grid.spec.ts` | AC-2, AC-3 |
| `tests/e2e/verwaltung.spec.ts` | AC-1, AC-4, AC-7, AC-10 |

Die Komponentenstruktur weicht leicht von der Planung ab: `CalendarDayCell`, `TopicListEditor`,
`CourseDayEditor` und `InstructorSelect` sind in `CourseCalendar.vue` bzw. der Editor-Seite
`app/pages/verwaltung/lehrgang/[id].vue` aufgegangen, statt eigene Dateien zu werden.

---

## Implementierungsnotizen (2026-08-10)

**Gebaut:** Monatskalender mit Schnellanlage per Tagesklick, Detail-Bearbeitung (Beschreibung,
Themen, Programmtage, Ausbilder, Motiv), Absagen und Zurücknehmen, Löschsperre, Ausbilder-Verwaltung.

**Abweichungen gegenüber der Spec:**

1. **Absage-Mails fehlen noch.** `transitionCourse()` setzt nur den Status; der Versand an alle
   Interessenten hängt sich in FV-4/FV-6 an dieselbe Stelle (im Code markiert).
2. **Tabelle `signups` wurde vorgezogen.** Ohne sie wären AC-12 (Löschsperre) und AC-14
   (Kapazitätsuntergrenze) nicht prüfbar. Nur lesend genutzt; Testdaten schreiben die Factories
   direkt in die Testdatenbank.
3. **Zusätzliche Route `/api/admin/cover-preview.svg`** für die Motivauswahl im Anlege-Dialog –
   nutzt denselben Generator wie FV-2, ist in der Autorisierungsmatrix eingetragen.
4. **Optimistisches Sperren über `updatedAt`** (409 bei zwischenzeitlicher Änderung).
5. **Registratur und Benutzerverwaltung sind sichtbare Platzhalter-Tabs** (FV-6 bzw. FV-7).

**Tests:** 17 API-Tests, 10 Unit-Tests (Kalenderraster, Statusübergänge), 6 E2E-Tests.

---

## QA Test Results

**Getestet:** 2026-08-10 · Bildstrecke Kalender, Bearbeitung, Schnellanlage.

### Acceptance Criteria
AC-1 bis AC-14: bestanden (17 API-Tests, 10 Unit-Tests, 6 E2E-Tests).

### Gefundene und behobene Fehler

**BUG-9: Monatszähler zählte falsch · Severity: Medium**
- Die Zusammenfassung zählte nur Lehrgänge, die am 15. liefen oder im Monat begannen – ein
  Lehrgang über den Monatswechsel fiel heraus. Behoben: gezählt wird jede Überschneidung
  mit dem angezeigten Monat.

**BUG-10: Uneinheitliches Datumsformat · Severity: Low**
- Die Liste unter dem Kalender zeigte „22.8.2026", die Karten „22.08.2026".
- Behoben: beide nutzen jetzt `useCourseFormat.dateRange`.

### Beobachtung ohne Fehlerstatus
Die nativen Datumsfelder werden vom Browser in dessen Sprache dargestellt; im Testbrowser
erschien MM/TT/JJJJ. Auf einem deutschsprachigen System ist die Anzeige TT.MM.JJJJ. Keine
Änderung nötig, aber beim Abnahmetest auf dem Zielsystem zu prüfen.

### Ergebnis
Keine offenen Fehler.
