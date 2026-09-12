# FV-20: Voraussetzungs-Engine & Katalog-Sichtbarkeit

**Status:** 📋 Planned
**Created:** 2026-09-12
**Abhängigkeiten:** FV-15 (Rollenmodell `member`/`admin`), FV-17 (Voraussetzungs-Kanten
`course_prerequisites`), FV-18 (Abschluss-Historie `course_completions`). **Bewusst unabhängig
von FV-19** (siehe Scope-Entscheidung dort) – kann parallel zu FV-19 gebaut werden.

## Ziel

Setzt die ursprüngliche Anforderung um: ein Mitglied sieht einen Lehrgang im Katalog nur, wenn es
entweder die Voraussetzungen erfüllt (alle in `course_prerequisites` verknüpften Lehrgänge
abgeschlossen) **oder** ihn bereits selbst abgeschlossen hat. Weder das eine noch das andere ⇒
der Lehrgang wird für dieses Mitglied nicht mehr angezeigt. Admins sehen weiterhin uneingeschränkt
alle Lehrgänge (wie heute).

## User Stories

- Als Mitglied möchte ich im Katalog nur Lehrgänge sehen, die für mich gerade relevant sind – nicht
  solche, für die mir noch die Voraussetzung fehlt.
- Als Mitglied möchte ich einen Lehrgang, den ich schon abgeschlossen habe, trotzdem weiterhin im
  Katalog finden (z. B. um die Beschreibung nachzulesen), auch wenn ich die Voraussetzung für einen
  *neuen* Durchlauf davon eigentlich nicht mehr bräuchte.
- Als Wehrführung möchte ich, dass sich an meiner (Admin-)Sicht auf den Katalog nichts ändert.

## Acceptance Criteria

- [ ] **AC-1:** `server/services/eligibility.service.ts` (neu) exportiert `isEligible(userId,
      courseId): boolean` – `true`, wenn **jede** Zeile in `course_prerequisites` für diesen
      Lehrgang (`courseId` = der zu prüfende Lehrgang) eine passende Zeile in `course_completions`
      für dieses `userId` hat. Ein Lehrgang ohne jede Voraussetzung ist für jedes Mitglied
      automatisch berechtigt (leere Menge ⇒ Bedingung trivial erfüllt).
- [ ] **AC-2:** Dieselbe Datei exportiert `hasCompleted(userId, courseId): boolean` – `true`, wenn
      eine Zeile in `course_completions` für dieses Paar existiert.
- [ ] **AC-3:** `GET /api/courses` (`listUpcomingCourses` in `server/services/course.service.ts`)
      filtert für Sessions mit `role === 'member'` zusätzlich zu den bestehenden Kriterien (Datum,
      Suche): ein Lehrgang erscheint nur, wenn `isEligible(userId, courseId) ||
      hasCompleted(userId, courseId)`.
- [ ] **AC-4:** `GET /api/courses` bleibt für Sessions mit `role === 'admin'` **unverändert**
      ungefiltert (Admins sehen immer alles, wie vor dieser Spec).
- [ ] **AC-5:** `GET /api/courses/:id` (`getCourseDetail`) liefert für ein `member`, das weder
      berechtigt ist noch den Lehrgang abgeschlossen hat, **404** (nicht 403 – ein nicht sichtbarer
      Lehrgang soll für das Mitglied nicht einmal als „existiert, aber gesperrt" erkennbar sein,
      dieselbe Begründung wie bei anderen 404-vor-403-Entscheidungen im Projekt, siehe
      `.claude/rules/security.md`, falls vorhanden, sonst analog zu bestehenden 404-Mustern).
      Für `admin` unverändert.
- [ ] **AC-6:** Ein Lehrgang ohne jede Voraussetzung ist für jedes Mitglied sichtbar (Normalfall,
      keine Regression für die überwiegende Mehrheit der heutigen Lehrgänge, die keine
      Voraussetzung haben).
- [ ] **AC-7:** Die Performance bleibt vertretbar: `listUpcomingCourses` darf nicht pro Lehrgang
      eine eigene Datenbankabfrage für Voraussetzungen/Abschlüsse auslösen (N+1); stattdessen
      einmal alle relevanten Voraussetzungs-Kanten und Abschlüsse des Mitglieds laden und in
      Prozessspeicher gegen die Kandidatenliste prüfen (Vorbild: `confirmedCounts` in
      `server/services/course.service.ts`, das genau dieses Muster für Anmeldezahlen schon nutzt).

## Edge Cases

- Ein Lehrgang verlangt einen Lehrgang, den es nicht mehr gibt (sollte durch FK-Cascade in
  `course_prerequisites` gar nicht vorkommen können – kurz verifizieren, nicht extra behandeln).
- Ein Mitglied hat den vorausgesetzten Lehrgang abgeschlossen, aber unter einem *anderen*, längst
  gelöschten Konto (z. B. Konto wurde neu angelegt) → aus Sicht der Datenbank ein anderes `userId`,
  zählt nicht. Kein Sonderfall dieser Spec (Kontenmigration ist außerhalb des Scopes).
- Zwei Voraussetzungen, eine erfüllt, eine nicht → nicht berechtigt (UND-Verknüpfung, siehe FV-17).

## Tech Design

- `server/services/eligibility.service.ts` (neu):
  - `isEligible(userId, courseId)`: liest Voraussetzungs-`requiredCourseId`s für `courseId` aus
    `course_prerequisites`; leer ⇒ `true`. Sonst: liest `course_completions`-Zeilen des `userId`
    für genau diese `requiredCourseId`s; `true`, wenn die Anzahl der Treffer der Anzahl der
    Voraussetzungen entspricht.
  - `hasCompleted(userId, courseId)`: einfache Existenzabfrage auf `course_completions`.
  - Für AC-7 zusätzlich eine batch-taugliche Variante, die für eine Liste von `courseId`s in
    höchstens zwei Abfragen (alle Kanten + alle Abschlüsse des Mitglieds) das Ergebnis liefert –
    von `listUpcomingCourses` genutzt statt der Einzelfunktionen in einer Schleife.
- `server/services/course.service.ts`: `listUpcomingCourses` bekommt einen zusätzlichen Parameter
  für den aufrufenden Nutzer (Rolle + ID); Signatur so anpassen, dass die aufrufende Route
  (`server/api/courses/index.get.ts`) die Session (`event.context.user` bzw. das, was
  `requireAuth(event)` zurückgibt) durchreicht. Filterung nur anwenden, wenn `role === 'member'`.
- `server/services/course.service.ts`: `getCourseDetail` bekommt denselben zusätzlichen Kontext,
  wirft 404 statt das Ergebnis zurückzugeben, wenn `member` und weder eligible noch completed.
- `server/api/courses/index.get.ts`, `server/api/courses/[id]/index.get.ts`: die von
  `requireAuth(event)` zurückgegebene Session an die Service-Funktionen weiterreichen.
- **Nicht Teil dieser Spec:** Admin-Matrix (FV-19), Anzeige von „warum nicht sichtbar" gegenüber
  dem Mitglied (ein ausgeblendeter Lehrgang bleibt unsichtbar, keine Erklärung nötig – das war
  schon die ursprüngliche Anforderung).

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/unit/eligibility.spec.ts` (neu) | AC-1, AC-2, AC-6, Edge Cases |
| `tests/api/courses.list.spec.ts` | AC-3, AC-4, AC-7 (Erweiterung um Member-mit-Voraussetzung-Fälle) |
| `tests/api/courses.detail.spec.ts` | AC-5 |
