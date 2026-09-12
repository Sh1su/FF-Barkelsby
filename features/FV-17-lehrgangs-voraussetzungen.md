# FV-17: Lehrgangs-Voraussetzungen

**Status:** 📋 Planned
**Created:** 2026-09-12
**Abhängigkeiten:** FV-2 (Lehrgangskatalog-Datenmodell), FV-3 (Admin-Kalender/Lehrgangsverwaltung).
Unabhängig von FV-15/FV-16 (Rollenmodell). Schaltet FV-19 (Admin-Matrix) und FV-20
(Voraussetzungs-Engine & Katalog-Sichtbarkeit) mit frei – die Auswertung „ist ein Mitglied
berechtigt" gehört bewusst nicht hierher, siehe „Nicht Teil dieser Spec".

## Ziel

Ein Lehrgang kann andere Lehrgänge als Voraussetzung verlangen. Diese Spec legt nur die
**Beziehung** zwischen Lehrgängen fest (welcher Lehrgang braucht welchen anderen) und ihre
Pflege durch die Wehrführung. Ob ein *Mitglied* eine Voraussetzung erfüllt, hängt von FV-18
(Abschluss-Historie) ab und wird erst in FV-20 ausgewertet.

## User Stories

- Als Wehrführung möchte ich beim Anlegen/Bearbeiten eines Lehrgangs festlegen können, welche
  anderen Lehrgänge vorher abgeschlossen sein müssen.
- Als Wehrführung möchte ich keinen Widerspruch erzeugen können (ein Lehrgang, der sich selbst
  oder sich über Umwege selbst voraussetzt).
- Als Wehrführung möchte ich einen Lehrgang, der Voraussetzung für einen anderen ist, nicht aus
  Versehen löschen können.

## Acceptance Criteria

- [ ] **AC-1:** Neue Tabelle `course_prerequisites` (`courseId`, `requiredCourseId`, beide FK auf
      `courses.id` mit `onDelete: 'cascade'`) hält die Kanten; Unique-Index auf dem Paar
      (`courseId`, `requiredCourseId`) verhindert doppelte Einträge.
- [ ] **AC-2:** Ein CHECK-Constraint verhindert `courseId = requiredCourseId` auf Datenbankebene
      (ein Lehrgang kann sich nicht direkt selbst voraussetzen).
- [ ] **AC-3:** `PUT /api/admin/courses/:id/prerequisites` (nur Admin, 401/403) ersetzt die
      komplette Voraussetzungsmenge eines Lehrgangs durch die im Body übergebene Liste von
      Lehrgangs-IDs (`requiredCourseIds: string[]`); eine leere Liste entfernt alle
      Voraussetzungen.
- [ ] **AC-4:** Enthält die Liste eine unbekannte Lehrgangs-ID, antwortet die Route mit 404.
- [ ] **AC-5:** Würde das Setzen einen Zyklus erzeugen (z. B. A verlangt B, B verlangt bereits
      A – auch über mehrere Stationen), antwortet die Route mit 422 und ändert nichts.
- [ ] **AC-6:** `GET /api/admin/courses/:id/prerequisites` (nur Admin) liefert die aktuellen
      Voraussetzungen als Liste von `{ id, title }`.
- [ ] **AC-7:** Der öffentliche Lehrgangskatalog (`GET /api/courses`, `GET /api/courses/:id`) ist
      von dieser Spec **unverändert** – keine Sichtbarkeits- oder Berechtigungslogik hier (das
      ist FV-20).
- [ ] **AC-8:** `deleteCourse` (`server/services/course-admin.service.ts`) lehnt das Löschen eines
      Lehrgangs mit 409 ab, wenn er Voraussetzung für einen anderen Lehrgang ist (zusätzlich zur
      bestehenden Regel bei vorhandenen Anmeldungen).
- [ ] **AC-9:** Die Bearbeitungsseite eines Lehrgangs (Admin) hat ein Mehrfachauswahlfeld
      „Voraussetzungen" mit allen anderen Lehrgängen; Speichern ruft AC-3 auf.

## Edge Cases

- Voraussetzung auf einen bereits abgesagten Lehrgang (`status = 'abgesagt'`) → technisch erlaubt,
  keine Sonderregel (Bewertung, ob das sinnvoll ist, bleibt der Wehrführung überlassen).
- Zyklus über drei oder mehr Stationen (A→B→C→A) → muss genauso erkannt werden wie der direkte
  Fall (A→B→A). Reachability-Prüfung, nicht nur Prüfung der direkten Kante.
- Lehrgang mit Voraussetzungen wird gelöscht → durch `onDelete: 'cascade'` verschwinden seine
  *eigenen* Kanten (`courseId = gelöschter Lehrgang`) automatisch mit; Kanten, in denen er als
  `requiredCourseId` auftaucht (er ist Voraussetzung *für andere*), blockieren das Löschen
  überhaupt erst (AC-8) – dieser Fall darf also nie zum Cascade kommen.

## Tech Design

- **Schema** (`server/database/schema.ts`): neue Tabelle `coursePrerequisites`
  (`course_prerequisites`), Struktur wie oben. Migration additiv per `npm run db:generate`
  (reine `CREATE TABLE`, kein Rebuild nötig, anders als FV-15).
- `server/services/course-prerequisites.service.ts` (neu):
  - `getPrerequisites(courseId): { id: string, title: string }[]`
  - `setPrerequisites(courseId: string, requiredCourseIds: string[]): void` – prüft Existenz
    aller IDs (404 sonst), prüft Zyklusfreiheit über eine Reachability-Suche (BFS/DFS ausgehend
    von jeder vorgeschlagenen `requiredCourseId`, ob sie `courseId` erreicht – bezieht die
    *bestehenden* Kanten anderer Lehrgänge mit ein, nicht nur die neu gesetzten), 422 bei Zyklus.
    Ersetzt danach in einer Transaktion: alte Kanten für `courseId` löschen, neue einfügen.
  - `assertNotRequiredByOthers(courseId)` – wirft 409, wenn `courseId` als `requiredCourseId`
    einer bestehenden Kante auftaucht; aufgerufen von `deleteCourse` (AC-8).
- `shared/validation/course-prerequisites.ts` (neu): `setPrerequisitesSchema = z.object({
  requiredCourseIds: z.array(z.string().min(1).max(64)).max(50) })`.
- `server/api/admin/courses/[id]/prerequisites.get.ts`, `.put.ts` (neu): `requireAdmin`,
  delegieren an den Service.
- `server/services/course-admin.service.ts`: `deleteCourse` ruft vor der bestehenden
  Signup-Prüfung zusätzlich `assertNotRequiredByOthers(id)` auf.
- UI: Bearbeitungsseite eines Lehrgangs (unter `app/pages/verwaltung/...` bzw. der Komponente, die
  das bestehende Bearbeiten-Formular rendert – vor der Implementierung mit
  `git ls-files app/pages app/components/admin` genau lokalisieren) bekommt ein Nuxt-UI-Feld für
  Mehrfachauswahl (z. B. `USelectMenu` mit `multiple`), das beim Laden `GET .../prerequisites`
  abruft und beim Speichern `PUT .../prerequisites` aufruft – getrennt vom bestehenden
  `PATCH /api/admin/courses/:id` (eigener Speichervorgang, eigener Fehlerzustand), damit ein
  Fehler bei den Voraussetzungen nicht die übrigen Feldänderungen blockiert.
- **Nicht Teil dieser Spec:** Auswertung, ob ein *Mitglied* eine Voraussetzung erfüllt (FV-20),
  Abschluss-Erfassung (FV-18), Matrix-UI (FV-19).

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/unit/course-prerequisites.spec.ts` (neu) | AC-2, AC-5 (Zyklus-Erkennung als reine Funktion, ohne Datenbank, falls sinnvoll isolierbar) |
| `tests/api/admin.course-prerequisites.spec.ts` (neu) | AC-1, AC-3 bis AC-6 |
| `tests/api/admin.courses.spec.ts` | AC-8 (Löschschutz, Erweiterung des bestehenden Tests) |
| `tests/api/authorization.matrix.spec.ts` | Selbst-Check: neue Routen müssen in der Matrix stehen |
| `tests/e2e/02-verwaltung.spec.ts` oder neue Datei | AC-9 |
