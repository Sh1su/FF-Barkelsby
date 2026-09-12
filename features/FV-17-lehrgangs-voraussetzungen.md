# FV-17: Lehrgangs-Voraussetzungen

**Status:** ✅ Approved (QA bestanden, noch nicht deployed)
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

- [x] **AC-1:** Neue Tabelle `course_prerequisites` (`courseId`, `requiredCourseId`, beide FK auf
      `courses.id` mit `onDelete: 'cascade'`) hält die Kanten; Unique-Index auf dem Paar
      (`courseId`, `requiredCourseId`) verhindert doppelte Einträge.
- [x] **AC-2:** Ein CHECK-Constraint verhindert `courseId = requiredCourseId` auf Datenbankebene
      (ein Lehrgang kann sich nicht direkt selbst voraussetzen).
- [x] **AC-3:** `PUT /api/admin/courses/:id/prerequisites` (nur Admin, 401/403) ersetzt die
      komplette Voraussetzungsmenge eines Lehrgangs durch die im Body übergebene Liste von
      Lehrgangs-IDs (`requiredCourseIds: string[]`); eine leere Liste entfernt alle
      Voraussetzungen.
- [x] **AC-4:** Enthält die Liste eine unbekannte Lehrgangs-ID, antwortet die Route mit 404.
- [x] **AC-5:** Würde das Setzen einen Zyklus erzeugen (z. B. A verlangt B, B verlangt bereits
      A – auch über mehrere Stationen), antwortet die Route mit 422 und ändert nichts.
- [x] **AC-6:** `GET /api/admin/courses/:id/prerequisites` (nur Admin) liefert die aktuellen
      Voraussetzungen als Liste von `{ id, title }`.
- [x] **AC-7:** Der öffentliche Lehrgangskatalog (`GET /api/courses`, `GET /api/courses/:id`) ist
      von dieser Spec **unverändert** – keine Sichtbarkeits- oder Berechtigungslogik hier (das
      ist FV-20).
- [x] **AC-8:** `deleteCourse` (`server/services/course-admin.service.ts`) lehnt das Löschen eines
      Lehrgangs mit 409 ab, wenn er Voraussetzung für einen anderen Lehrgang ist (zusätzlich zur
      bestehenden Regel bei vorhandenen Anmeldungen).
- [x] **AC-9:** Die Bearbeitungsseite eines Lehrgangs (Admin) hat ein Mehrfachauswahlfeld
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

---

## Implementierungsnotizen (2026-09-12)

**Gebaut:** wie im Tech Design beschrieben, ohne inhaltliche Abweichung von einer Acceptance
Criterion. `server/services/course-prerequisites.service.ts` exportiert die Reachability-Suche
(`canReach(edges, start, target)`) als reine Funktion ohne Datenbankzugriff, damit sie in
`tests/unit/course-prerequisites.spec.ts` isoliert getestet werden kann (Tech Design). Die
Zyklusprüfung selbst folgt der Spec wörtlich: für jede vorgeschlagene `requiredCourseId` wird
geprüft, ob sie – über die *bestehenden* Kanten aller *anderen* Lehrgänge (`loadOtherEdges`,
schließt `courseId`s eigene, gerade zu ersetzende Kanten aus) – bereits zurück zu `courseId`
findet; ein direkter Selbstbezug (`requiredCourseId === courseId`) wird zusätzlich explizit vor
der Suche abgefangen, damit dafür eine saubere 422-Antwort statt eines rohen SQLite-Fehlers am
CHECK-Constraint entsteht (der CHECK bleibt als zweite Verteidigungslinie bestehen, AC-2).

Zwei kleine, nicht spec-widersprechende Designentscheidungen, die nicht explizit in den ACs
standen: `GET`/`PUT .../prerequisites` liefern die Liste als `{ items: [...] }` statt als
nacktes Array – konsistent mit jedem anderen Listen-Endpunkt in diesem Projekt (z. B.
`GET /api/admin/courses`, `.../mails`). Und `setPrerequisites` prüft zusätzlich die Existenz des
`courseId`-Parameters selbst (404, bevor überhaupt die `requiredCourseIds` geprüft werden) –
analog zu jeder anderen schreibenden Admin-Route auf `courses/:id`. Beides ist eine Ergänzung,
kein Widerspruch zu einer AC, deshalb kein Eintrag unter „Abweichung von der ursprünglichen Spec“.

Das Mehrfachauswahlfeld (AC-9) sitzt in der Seitenleiste der bestehenden Bearbeitungsseite
(`app/pages/verwaltung/lehrgang/[id].vue`, kein Modal – die Seite editiert schon heute inline,
ohne Dialog) als eigener Kartenblock mit eigenem Speichern-Button und eigenem Fehlerzustand,
getrennt vom bestehenden „Speichern“ für Titel/Beschreibung/Zeitraum/Titelbild (Tech Design:
ein Fehler bei den Voraussetzungen darf die übrigen Feldänderungen nicht blockieren). Optionen
kommen aus `GET /api/admin/courses` (liefert ohne Zeitraumfilter alle Lehrgänge), der aktuell
bearbeitete Lehrgang wird aus der Optionsliste herausgefiltert.

**Migration:** `0008_cloudy_squirrel_girl.sql`, von `drizzle-kit generate` erzeugt – reine
`CREATE TABLE` plus drei Indizes, kein Tabellen-Rebuild nötig (anders als FV-13/FV-15).

**Tests:** `npm run verify`s Lint-, Typecheck- und Vitest-Schritte sind grün – 388 Vitest-Tests
in 35 Dateien, keine roten Tests, `check:gaps` bestätigt „FV-17: 9 Acceptance Criteria, alle
abgedeckt“. Der Gesamtbefehl `npm run verify` endet dennoch mit Exit-Code 1, weil derselbe
`check:gaps`-Lauf **FV-18** (paralleles, in einem eigenen Branch/Worktree in Arbeit befindliches
Feature) ohne Tests meldet – dessen Spec-Datei ist bereits im Basis-Commit dieses Branches
(`docs: FV-17/FV-18 specs`) enthalten, FV-18 selbst aber noch nicht implementiert. Das ist kein
Regressionsfund dieser Aufgabe: derselbe Zustand besteht unverändert am Ausgangscommit dieses
Branches, vor jeder FV-17-Änderung (geprüft mit `git show <Basis-Commit>:...` und
`npm run check:gaps` auf dem unveränderten Stand). Er betrifft ausschließlich FV-18 und löst sich
auf, sobald dessen eigener Branch gemergt ist. `npm run test:e2e` ist grün: 41 Playwright-Tests
(vorher 40, FV-16-Stand), darunter der neue AC-9-Test in `tests/e2e/02-verwaltung.spec.ts`.

---

## QA Test Results

**Getestet:** 2026-09-12 · `npm run lint`, `npm run typecheck`, `npm run test` (388 Vitest-Tests,
35 Dateien) und `npm run check:gaps` einzeln ausgeführt sowie `npm run test:e2e` (41
Playwright-Tests, alle grün).

`/qa` existiert in diesem Repo nicht als Command (siehe FV-13) – dieser Durchgang wurde manuell
im Sinne des in `CLAUDE.md` beschriebenen Workflows durchgeführt.

### Acceptance Criteria
AC-1 bis AC-9: bestanden (siehe Testtabelle oben und automatisierte Läufe).

### Gefundene Befunde
Kein kritischer oder schwerwiegender Befund in FV-17 selbst. Ein Hinweis, kein FV-17-Bug: der
zusammengesetzte Befehl `npm run verify` endet mit Exit-Code 1, weil sein letzter Schritt
(`check:gaps`) für das parallel in Arbeit befindliche FV-18 fehlende Tests meldet – siehe
Implementierungsnotizen. Alle Teilschritte, die FV-17 betreffen (Lint, Typecheck, alle
Vitest-Tests inklusive FV-17s eigener Abdeckung, `test:e2e`), sind grün.

### Ergebnis
Keine kritischen oder schwerwiegenden Befunde in FV-17.
