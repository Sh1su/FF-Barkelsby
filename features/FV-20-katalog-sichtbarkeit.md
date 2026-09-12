# FV-20: Voraussetzungs-Engine & Katalog-Sichtbarkeit

**Status:** ✅ Approved (QA bestanden, noch nicht deployed)
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

- [x] **AC-1:** `server/services/eligibility.service.ts` (neu) exportiert `isEligible(userId,
      courseId): boolean` – `true`, wenn **jede** Zeile in `course_prerequisites` für diesen
      Lehrgang (`courseId` = der zu prüfende Lehrgang) eine passende Zeile in `course_completions`
      für dieses `userId` hat. Ein Lehrgang ohne jede Voraussetzung ist für jedes Mitglied
      automatisch berechtigt (leere Menge ⇒ Bedingung trivial erfüllt).
- [x] **AC-2:** Dieselbe Datei exportiert `hasCompleted(userId, courseId): boolean` – `true`, wenn
      eine Zeile in `course_completions` für dieses Paar existiert.
- [x] **AC-3:** `GET /api/courses` (`listUpcomingCourses` in `server/services/course.service.ts`)
      filtert für Sessions mit `role === 'member'` zusätzlich zu den bestehenden Kriterien (Datum,
      Suche): ein Lehrgang erscheint nur, wenn `isEligible(userId, courseId) ||
      hasCompleted(userId, courseId)`.
- [x] **AC-4:** `GET /api/courses` bleibt für Sessions mit `role === 'admin'` **unverändert**
      ungefiltert (Admins sehen immer alles, wie vor dieser Spec).
- [x] **AC-5:** `GET /api/courses/:id` (`getCourseDetail`) liefert für ein `member`, das weder
      berechtigt ist noch den Lehrgang abgeschlossen hat, **404** (nicht 403 – ein nicht sichtbarer
      Lehrgang soll für das Mitglied nicht einmal als „existiert, aber gesperrt" erkennbar sein,
      dieselbe Begründung wie bei anderen 404-vor-403-Entscheidungen im Projekt, siehe
      `.claude/rules/security.md`, falls vorhanden, sonst analog zu bestehenden 404-Mustern).
      Für `admin` unverändert.
- [x] **AC-6:** Ein Lehrgang ohne jede Voraussetzung ist für jedes Mitglied sichtbar (Normalfall,
      keine Regression für die überwiegende Mehrheit der heutigen Lehrgänge, die keine
      Voraussetzung haben).
- [x] **AC-7:** Die Performance bleibt vertretbar: `listUpcomingCourses` darf nicht pro Lehrgang
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
| `tests/api/eligibility.spec.ts` (neu, **nicht** `tests/unit/...` – siehe Abweichung unten) | AC-1, AC-2, AC-6, Edge Cases |
| `tests/api/courses.list.spec.ts` | AC-3, AC-4, AC-6, AC-7 (Erweiterung um Member-mit-Voraussetzung-Fälle) |
| `tests/api/courses.detail.spec.ts` | AC-2, AC-5 |
| `tests/api/admin.course-prerequisites.spec.ts` | FV-17s AC-7 wurde angepasst (siehe Abweichung unten) |

---

## Abweichung von der ursprünglichen Spec

**1. Testdatei liegt unter `tests/api/`, nicht unter `tests/unit/` wie im Tech Design vorgesehen.**
Beim Lesen des bestehenden Codes zeigte sich ein echter Widerspruch zwischen dem Tech Design
(„`tests/unit/eligibility.spec.ts`") und der tatsächlichen Testarchitektur dieses Projekts:
`vitest.config.ts` beschreibt das `unit`-Projekt ausdrücklich als „reine Fachlogik, kein Nuxt,
kein HTTP" und startet dafür **keinen** Nitro-Server. `isEligible`, `hasCompleted` und
`visibleCourseIds` rufen – wie jeder andere Service in `server/services/**` (`course.service.ts`,
`course-prerequisites.service.ts`, `course-completion.service.ts`) – das global
auto-importierte `useDatabase()` auf, ohne es zu importieren. Dieser Auto-Import ist eine
Nitro-Buildtransformation; sie greift nur, wenn der Code tatsächlich durch einen laufenden
Nitro-Server läuft. Ein direkter Import der Service-Funktionen in einen plain-node
`tests/unit/**`-Test wurde probeweise ausgeführt und schlägt mit
`ReferenceError: useDatabase is not defined` fehl (verifiziert vor der Implementierung).
Einzige bisherige `tests/unit/**`-Ausnahme im Projekt ist `canReach` aus
`course-prerequisites.service.ts` – laut dessen eigenem Kommentar *bewusst* eine reine Funktion
ohne Datenbankzugriff, „damit sie isoliert testbar bleibt". Für DB-lesende Funktionen gibt es in
diesem Projekt kein Präzedenzbeispiel für einen direkten Import in `tests/unit/**`; jede
Service-Funktion, die `useDatabase()` aufruft, wird ausschließlich über das `api`-Projekt (echter
Nitro-Server, `startTestServer` + `fetch`) getestet. Lösung: `tests/api/eligibility.spec.ts`
(neu) prüft AC-1, AC-2, AC-6 und den UND-Verknüpfungs-Edge-Case end-to-end über
`GET /api/courses/:id`, mit denselben Verwaltungs-Routen (`.../prerequisites`,
`.../completions`) wie die übrigen API-Tests. Funktional keine Abweichung von einer Acceptance
Criterion – nur vom im Tech Design skizzierten Dateiort.

**2. `tests/api/admin.course-prerequisites.spec.ts`s FV-17-AC-7-Test musste inhaltlich angepasst
werden.** FV-17s AC-7 lautete wörtlich: „Der öffentliche Lehrgangskatalog … ist von dieser Spec
unverändert – keine Sichtbarkeits- oder Berechtigungslogik hier (das ist FV-20)." Der zugehörige
Test prüfte genau das end-to-end: ein Mitglied ohne erfüllte Voraussetzung sah den Lehrgang
trotzdem im Katalog. Das ist mit dieser Spec – erwartungsgemäß, es ist ja ihr Zweck – nicht mehr
wahr: FV-20 blendet genau diesen Lehrgang für dieses Mitglied jetzt aus. Kein Regressionsfund
(`.claude/rules`: „ein roter Bestandstest ist ein Regressionsfund" gilt nicht, wenn eine spätere,
bewusst nachgelagerte Spec das Verhalten einer früheren Spec wörtlich ersetzt – FV-17s eigener
Text benennt FV-20 als die Stelle, an der das passiert). Der Test wurde nicht geschwächt, sondern
umformuliert: er verifiziert weiterhin den unveränderten Teil von AC-7 (der Admin-Katalog bleibt
ungefiltert, das reine Setzen einer Voraussetzung über `PUT .../prerequisites` löst selbst keine
Filterung aus) und zusätzlich explizit die neue, von FV-20 überschriebene Konsequenz für ein
Mitglied – mit Kommentar und Verweis auf diesen Abschnitt.

---

## Implementierungsnotizen (2026-09-12)

**Gebaut:** wie im Tech Design beschrieben (bis auf die zwei oben dokumentierten Abweichungen).
`server/services/eligibility.service.ts` (neu) exportiert `hasCompleted(userId, courseId)`,
`isEligible(userId, courseId)` und zusätzlich `visibleCourseIds(userId, courseIds): Set<string>`
als batch-taugliche Variante für AC-7 – genau zwei Abfragen (alle Voraussetzungs-Kanten der
übergebenen `courseIds`, alle Abschlüsse des `userId`), danach reiner Prozessspeicher-Abgleich,
Vorbild `confirmedCounts` in `course.service.ts`.

`listUpcomingCourses` und `getCourseDetail` bekommen beide einen neuen zweiten Parameter
`viewer: SessionUser` (importiert aus `server/utils/authorization.ts`, kein neuer Typ). In
`listUpcomingCourses` wird die Sichtbarkeit erst **nach** der bestehenden
Datum/Such-Filterung und **nach** `LIMIT`/`OFFSET` angewendet – auf genau der Kandidatenseite,
die ohnehin schon geladen ist (dieselbe Stelle, an der `confirmedCounts` ansetzt). Das ist eine
bewusste, im Tech Design nicht explizit entschiedene Detailfrage, kein Widerspruch zu einer AC:
`total` zählt weiterhin alle datums-/suchpassenden Lehrgänge unabhängig von der
Mitglieds-Berechtigung (wie zuvor), nur `items` wird zusätzlich gefiltert. Eine Alternative
(Filterung direkt in der SQL-`WHERE`-Klausel per Existenz-Unterabfrage) wäre ebenfalls AC-7-
konform gewesen, hätte aber vom im Tech Design ausdrücklich vorgegebenen
Prozessspeicher-Batch-Muster abgewichen; nicht gewählt. `getCourseDetail` wirft nach der
bestehenden 404-Prüfung (Lehrgang existiert nicht) eine zweite, identische 404, wenn
`viewer.role === 'member'` und weder `isEligible` noch `hasCompleted` zutrifft – bewusst
derselbe Statuscode und derselbe Text wie beim „existiert nicht"-Fall (AC-5).
`getCourseCoverInput` (Titelbild) und `signups.post.ts` (Anmeldung) bleiben unverändert – beide
sind nicht Teil dieser Spec (Tech Design nennt nur `GET /api/courses` und
`GET /api/courses/:id`).

Beim Schreiben der Tests fiel auf, dass ein `beforeAll` innerhalb eines verschachtelten
`describe`-Blocks (in `courses.list.spec.ts`/`courses.detail.spec.ts`) den
`@nuxt/test-utils`-Testkontext nicht findet (`useTestContext`: „No context is available. (Forgot
calling setup or createContext?)") – im ganzen Projekt gibt es dafür kein Präzedenzbeispiel, jede
bestehende Datei lädt ihre Fixtures in genau einem `beforeAll` auf oberster Ebene. Behoben, indem
`memberId` (die Konto-ID des Test-Mitglieds, über `GET /api/_auth/session` aufgelöst) im
bestehenden obersten `beforeAll` der jeweiligen Datei mitgeladen wird, wie im Rest des Projekts
üblich; die neuen `describe`-Blöcke selbst definieren nur noch reine Hilfsfunktionen, keine
eigenen Hooks. Keine inhaltliche Abweichung von einer Acceptance Criterion, nur eine
Testinfrastruktur-Erkenntnis.

**Edge Case „Lehrgang verlangt einen gelöschten Lehrgang":** wie in der Spec vermerkt kurz
verifiziert statt gesondert getestet. `course_prerequisites.requiredCourseId` hat
`onDelete: 'cascade'` (FV-17), und `deleteCourse` weist das Löschen eines Lehrgangs, der
`requiredCourseId` einer bestehenden Kante ist, bereits mit 409 ab
(`assertNotRequiredByOthers`, FV-17 AC-8). Ein Lehrgang, der Voraussetzung für einen anderen ist,
kann also gar nicht gelöscht werden – der Cascade-Fall für *diese* Richtung tritt nie ein. Löscht
man stattdessen den Lehrgang, der die Voraussetzung *hat* (`courseId`-Seite der Kante), löscht
die Cascade nur dessen eigene, jetzt gegenstandslose Kante – unproblematisch, kein Sonderfall
nötig.

**Tests:** `npm run verify` grün – 37 Testdateien, 424 Vitest-Tests, keine roten Tests,
`check:gaps` bestätigt „FV-20: 7 Acceptance Criteria, alle abgedeckt". Der Gesamtbefehl
`npm run verify` endet dennoch mit Exit-Code 1, weil derselbe `check:gaps`-Lauf **FV-19**
(paralleles, in einem eigenen Branch/Worktree in Arbeit befindliches Feature) ohne Tests meldet –
dessen Spec-Datei ist bereits im gemeinsamen Basis-Commit dieses Branches enthalten, FV-19 selbst
aber dort noch nicht implementiert. Verifiziert (dasselbe Vorgehen wie in FV-17s
Implementierungsnotizen): `npm run check:gaps` auf dem unveränderten Ausgangscommit
(`cf55571`, vor jeder FV-20-Änderung) meldet exakt denselben FV-19-Befund plus zusätzlich FV-20
selbst (dort naturgemäß noch ganz ohne Tests) – kein Regressionsfund dieser Aufgabe, betrifft
ausschließlich FV-19 und löst sich auf, sobald dessen eigener Branch gemergt ist. `npm run
test:e2e` ist grün: unverändert 41 Playwright-Tests (kein neuer e2e-Test nötig – FV-20 hat keine
eigene UI, „Nicht Teil dieser Spec" im Tech Design).

---

## QA Test Results

**Getestet:** 2026-09-12 · `npm run lint`, `npm run typecheck`, `npm run test` (424 Vitest-Tests,
37 Dateien) und `npm run check:gaps` einzeln ausgeführt sowie `npm run test:e2e` (41
Playwright-Tests, alle grün).

`/qa` existiert in diesem Repo nicht als Command (siehe FV-13) – dieser Durchgang wurde manuell
im Sinne des in `CLAUDE.md` beschriebenen Workflows durchgeführt.

### Acceptance Criteria
AC-1 bis AC-7: bestanden (siehe Testtabelle oben und automatisierte Läufe). Zusätzlich verifiziert:
bestehende Katalog-Regressionstests (`tests/api/courses.list.spec.ts`,
`tests/api/courses.detail.spec.ts`, `tests/api/courses.cover.spec.ts`,
`tests/api/admin.courses.spec.ts`, `tests/api/authorization.matrix.spec.ts`) bleiben grün, da
deren Test-Lehrgänge durchweg ohne Voraussetzung angelegt sind (AC-6-Regressionsschutz).

### Gefundene Befunde
Kein kritischer oder schwerwiegender Befund in FV-20 selbst. Zwei Hinweise, kein FV-20-Bug:
(1) `npm run verify` endet mit Exit-Code 1 wegen des parallel in Arbeit befindlichen FV-19 – siehe
Implementierungsnotizen, betrifft nicht FV-20s eigene Abdeckung. (2) FV-17s AC-7-Test musste an
das jetzt eingeführte Filterverhalten angepasst werden – dokumentiert unter „Abweichung von der
ursprünglichen Spec", kein FV-20-Bug, sondern die erwartete Konsequenz aus FV-17s eigenem
Verweis auf FV-20.

### Ergebnis
Keine kritischen oder schwerwiegenden Befunde in FV-20.
