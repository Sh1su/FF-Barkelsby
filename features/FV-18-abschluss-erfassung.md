# FV-18: Teilnahme-Erfassung (Abschluss-Historie)

**Status:** 📋 Planned
**Created:** 2026-09-12
**Abhängigkeiten:** FV-15 (persönliche Mitgliedskonten – ein Abschluss ist nur an einem
persönlichen Konto sinnvoll nachvollziehbar). Schaltet FV-19 (Admin-Matrix) und FV-20
(Voraussetzungs-Engine & Katalog-Sichtbarkeit) mit frei.

## Ziel

Für jedes Mitglied wird festgehalten, welche Lehrgänge es bereits abgeschlossen hat – unabhängig
von der Interessensbekundung (`signups`, FV-5), die nur den aktuellen Anmeldezyklus abbildet und
keine Personen-Konten kennt. Diese Spec liefert Datenmodell und API für die Erfassung; eine
eigene Bedienoberfläche kommt bewusst erst mit FV-19 (Admin-Matrix) – dort ist der natürliche Ort,
Abschlüsse pro Mitglied und Lehrgang zu pflegen.

## User Stories

- Als Wehrführung möchte ich eintragen können, dass ein Mitglied einen Lehrgang abgeschlossen
  hat – auch rückwirkend, für Lehrgänge, die vor der Umstellung auf dieses System stattfanden.
- Als Wehrführung möchte ich einen versehentlichen Eintrag wieder entfernen können.
- Als Wehrführung möchte ich nicht zweimal denselben Abschluss für dasselbe Mitglied und denselben
  Lehrgang anlegen können.

## Acceptance Criteria

- [ ] **AC-1:** Neue Tabelle `course_completions` (`courseId` FK `courses.id` cascade, `userId`
      FK `users.id` cascade, `completedAt`, optional `note`) hält je Zeile einen Abschluss.
      Unique-Index auf (`courseId`, `userId`) verhindert Doppelerfassung.
- [ ] **AC-2:** `POST /api/admin/courses/:id/completions` (nur Admin, 401/403) trägt einen
      Abschluss ein; Body `{ userId: string, completedAt?: string (JJJJ-MM-TT), note?: string }`.
      Fehlt `completedAt`, gilt das heutige Datum.
- [ ] **AC-3:** Unbekannte `courseId` oder `userId` → 404. Bereits vorhandener Abschluss für
      dasselbe Paar → 409, kein zweiter Eintrag.
- [ ] **AC-4:** `completedAt` darf beliebig in der Vergangenheit liegen (rückwirkende Erfassung
      historischer Lehrgänge ist ausdrücklich der Zweck); ein Datum in der Zukunft wird mit 400
      abgelehnt.
- [ ] **AC-5:** `DELETE /api/admin/courses/:id/completions/:userId` (nur Admin) entfernt einen
      Abschluss wieder; unbekanntes Paar → 404.
- [ ] **AC-6:** `GET /api/admin/courses/:id/completions` (nur Admin) liefert alle Abschlüsse eines
      Lehrgangs als Liste von `{ userId, displayName, email, completedAt, note }`.
- [ ] **AC-7:** `deleteCourse` (`server/services/course-admin.service.ts`) lehnt das Löschen eines
      Lehrgangs mit 409 ab, wenn Abschlüsse dafür existieren (permanenter Ausbildungsnachweis,
      zusätzlich zur bestehenden Regel bei Anmeldungen und zur FV-17-Regel bei Voraussetzungen).
- [ ] **AC-8:** Diese Spec ändert **nichts** an `signups` (FV-5/FV-6) – Interessensbekundung und
      Abschluss-Historie bleiben getrennte Tabellen mit getrennter Lebensdauer (Regressionsschutz:
      bestehende `signups`-Tests bleiben unverändert grün).

## Edge Cases

- Ein deaktiviertes Mitgliedskonto hat einen Abschluss → bleibt bestehen, wird bei der Anzeige
  nicht ausgeblendet (Ausbildungsnachweis ist personenbezogene Historie, keine Zugriffsberechtigung).
- Ein Lehrgang wird gelöscht, für den es Abschlüsse gibt → Löschung wird abgelehnt (AC-7), niemals
  stiller Cascade-Verlust eines Ausbildungsnachweises.
- Zwei Admins tragen nahezu gleichzeitig denselben Abschluss ein → der Unique-Index entscheidet,
  der zweite Versuch bekommt 409.

## Tech Design

- **Schema** (`server/database/schema.ts`): neue Tabelle `courseCompletions`
  (`course_completions`): `id`, `course_id` (FK cascade), `user_id` (FK cascade),
  `completed_at` (`integer`, `mode: 'timestamp'`, `NOT NULL`), `note` (`text`, nullable),
  Timestamps. `uniqueIndex('course_completions_course_user_unique').on(courseId, userId)`,
  `index('course_completions_user_idx').on(userId)`. Migration additiv (`CREATE TABLE`, kein
  Rebuild).
- `shared/validation/completion.ts` (neu): `createCompletionSchema = z.object({ userId:
  z.string().min(1).max(64), completedAt: isoDate.optional(), note: z.string().trim().max(300).
  optional() })` (dieselbe `isoDate`-Regel wie in `shared/validation/course.ts` – dorthin
  auslagern oder duplizieren, je nachdem was beim Lesen des bestehenden Codes konsistenter wirkt).
- `server/services/course-completion.service.ts` (neu):
  - `listCompletions(courseId): { userId, displayName, email, completedAt, note }[]` (Join gegen
    `users`)
  - `createCompletion(courseId, input)`: prüft Lehrgang und Konto existieren (404), prüft
    `completedAt <= heute` (400), prüft Unique-Verletzung selbst vorab oder fängt den
    DB-Fehler ab und wirft 409 (siehe bestehendes Muster `assertEmailFrei` in
    `user-admin.service.ts` als Vorbild für die Vorab-Prüfung statt Exception-Handling).
  - `deleteCompletion(courseId, userId)`: 404, wenn keine Zeile existiert.
  - `hasCompletions(courseId): boolean` – fuer den Loeschschutz.
- `server/services/course-admin.service.ts`: `deleteCourse` ruft zusätzlich
  `assertNoCompletions(id)` auf (analog zur bestehenden `countSignups`-Prüfung).
- `server/api/admin/courses/[id]/completions/index.get.ts`, `index.post.ts`,
  `[userId].delete.ts` (neu): `requireAdmin`, delegieren an den Service.
- **Nicht Teil dieser Spec:** eigene Bedienoberfläche (kommt mit FV-19s Matrix), Auswertung von
  Berechtigung/Voraussetzung (FV-20), Verknüpfung mit `signups` (bewusst getrennt, siehe AC-8 und
  die Begründung in `features/FV-15-mitgliedskonten.md`/Plan-Dokumentation zu FV-18).

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/api/admin.course-completions.spec.ts` (neu) | AC-1 bis AC-6 |
| `tests/api/admin.courses.spec.ts` | AC-7 (Löschschutz, Erweiterung des bestehenden Tests) |
| `tests/api/signups.spec.ts`, `tests/api/admin.signups.spec.ts` | AC-8 (bestehende Tests müssen unverändert grün bleiben – Regressionsschutz, keine neuen Tests nötig) |
| `tests/api/authorization.matrix.spec.ts` | Selbst-Check: neue Routen müssen in der Matrix stehen |
