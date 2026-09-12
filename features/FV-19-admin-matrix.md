# FV-19: Admin-Matrix (Lehrgänge × Mitglieder)

**Status:** ✅ Approved (QA bestanden, noch nicht deployed)
**Created:** 2026-09-12
**Abhängigkeiten:** FV-16 (Mitgliedskonten anlegen), FV-18 (Abschluss-Historie). **Bewusst
unabhängig von FV-17 und FV-20** (siehe Scope-Entscheidung unten) – kann parallel zu FV-20 gebaut
werden.

## Scope-Entscheidung (wichtig, bitte nicht erweitern)

Der ursprüngliche Plan sah vor, dass die Matrix pro Zelle auch anzeigt, ob ein Mitglied für einen
Lehrgang *berechtigt* ist (Voraussetzungen erfüllt, FV-17/FV-20). Das würde diese Spec von der
Voraussetzungs-Engine aus FV-20 abhängig machen, die **parallel** in einem anderen Branch entsteht
– zwei parallele Features dürften dann nicht gleichzeitig fertig werden, ohne dass eines auf das
andere wartet. Deshalb **v1 der Matrix zeigt nur den Abschluss-Status** (abgeschlossen /
nicht abgeschlossen) aus FV-18, **keine Berechtigungs-Auswertung**. Das Verknüpfen mit
FV-20s Berechtigungslogik ist ausdrücklich ein späterer, eigener Schritt (nicht Teil dieser Spec) –
nicht vorgreifen.

## Ziel

Ein Admin sieht auf einen Blick, welches Mitglied welchen Lehrgang bereits abgeschlossen hat, und
kann das direkt in der Matrix pflegen (statt einzeln über die API-Routen aus FV-18).

## User Stories

- Als Wehrführung möchte ich eine Tabelle sehen: Zeilen = Mitglieder, Spalten = Lehrgänge,
  Zellen = abgeschlossen oder nicht.
- Als Wehrführung möchte ich einen Abschluss direkt in der Matrix an- und abhaken können, ohne
  auf eine andere Seite zu wechseln.

## Acceptance Criteria

- [x] **AC-1:** `GET /api/admin/matrix` (nur Admin, 401/403) liefert alle aktiven und inaktiven
      Mitgliedskonten (`role = 'member'`) und alle Lehrgänge sowie zu jedem Mitglied-Lehrgang-Paar,
      ob ein Abschluss existiert (`completedAt` falls ja, sonst `null`).
- [x] **AC-2:** Ein neuer Tab „Matrix" im dritten... eigentlich vierten Reiter der Verwaltung
      (`app/pages/verwaltung/index.vue`, neben Kalender/Registratur/Benutzerverwaltung/
      Einstellungen) zeigt die Daten aus AC-1 als Tabelle: Zeilen Mitglieder, Spalten Lehrgänge.
- [x] **AC-3:** Ein Klick auf eine leere Zelle (kein Abschluss) trägt über
      `POST /api/admin/courses/:id/completions` (FV-18, bereits vorhanden) einen Abschluss mit dem
      heutigen Datum ein und aktualisiert die Zelle, ohne die ganze Matrix neu zu laden.
- [x] **AC-4:** Ein Klick auf eine ausgefüllte Zelle (Abschluss vorhanden) entfernt ihn über
      `DELETE /api/admin/courses/:id/completions/:userId` (FV-18, bereits vorhanden).
- [x] **AC-5:** Die Matrix ist bei vielen Lehrgängen/Mitgliedern horizontal scrollbar innerhalb
      ihres eigenen Containers (kein horizontales Scrollen der gesamten Seite,
      `.claude/rules/testing.md`-Konvention aus bestehenden Tabellen wie `UserRegistry.vue`
      übernehmen).
- [x] **AC-6:** Deaktivierte Mitgliedskonten erscheinen weiterhin in der Matrix (ein Abschluss ist
      personenbezogene Historie, unabhängig vom aktuellen Kontostatus – siehe FV-18, Edge Cases),
      aber optisch als deaktiviert erkennbar markiert (z. B. wie in `UserRegistry.vue`).
- [x] **AC-7:** Ohne Mitglieder oder ohne Lehrgänge zeigt die Matrix einen Leerzustand statt einer
      leeren oder kaputten Tabelle.

## Edge Cases

- Sehr viele Lehrgänge (z. B. > 30) → Tabelle wird breit, siehe AC-5 (Scroll-Container, keine
  Paginierung in v1 – bei einer Freiwilligen Feuerwehr ist die Datenmenge klein, siehe
  Vorbild-Kommentar zu `listAccounts` in `server/services/user-admin.service.ts`).
- Ein Mitglied wird gelöscht/deaktiviert, während die Matrix offen ist → nächster Refresh zeigt den
  aktuellen Stand, kein Realtime-Sync nötig.

## Tech Design

- `server/services/matrix.service.ts` (neu): `getMatrix(): { members: {id, displayName, email,
  active}[], courses: {id, title}[], completions: Record<string /* memberId */,
  Record<string /* courseId */, string /* completedAt als ISO */>> }` – oder eine flachere Form,
  wie es sich beim Lesen von `course-completion.service.ts` (FV-18) am saubersten anfühlt; Ziel ist
  eine Struktur, die sich im Frontend ohne N+1-Lookups rendern lässt. Wiederverwenden:
  `listCompletions`-Idee aus `server/services/course-completion.service.ts`, aber über *alle*
  Lehrgänge hinweg statt nur einen (ggf. dortige Bausteine extrahieren/exportieren statt zu
  duplizieren).
- `server/api/admin/matrix.get.ts` (neu): `requireAdmin`, ruft `getMatrix()`.
- UI: neue Komponente `app/components/admin/CompletionMatrix.vue`, eingebunden als neuer Tab in
  `app/pages/verwaltung/index.vue` (Vorbild für Tab-Einbindung: wie `benutzer` dort verdrahtet ist).
  Zellen-Klick ruft direkt die bestehenden FV-18-Routen auf (`$fetch('/api/admin/courses/:id/
  completions', { method: 'POST', body: { userId } })` bzw. `DELETE .../completions/:userId`).
- **Nicht Teil dieser Spec:** Berechtigungs-/Voraussetzungs-Anzeige in der Matrix (kommt evtl.
  später, nach FV-20, als eigener Nachschlag – siehe Scope-Entscheidung oben), Katalog-Filter
  (FV-20).

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/api/admin.matrix.spec.ts` (neu) | AC-1 |
| `tests/components/CompletionMatrix.spec.ts` (neu) | AC-2, AC-6, AC-7 (zusätzlich auch AC-3/AC-4 als schneller Komponenten-Roundtrip) |
| `tests/e2e/05-matrix.spec.ts` (neu) | AC-3, AC-4, AC-5 |
| `tests/api/authorization.matrix.spec.ts` | Selbst-Check: neue Route muss in der Matrix stehen |

## Abweichung von der ursprünglichen Spec

**Datenform der Antwort (kein echter Widerspruch, sondern von der Spec selbst offen gelassen):**
Das Tech Design erlaubte ausdrücklich „eine flachere Form, wie es sich beim Lesen des bestehenden
Codes am saubersten anfühlt". `getMatrix()` liefert `completions` deshalb als **sparse Map**
(`Record<memberId, Record<courseId, isoDatum>>`) statt eines vollen Gitters mit einem expliziten
`null`-Eintrag für jedes Mitglied-Lehrgang-Paar, wie AC-1 wörtlich nahelegt. Bei mehreren Dutzend
Mitgliedern und Lehrgängen wäre das volle Gitter unnötig große Nutzlast; ein fehlender Schlüssel
bedeutet „kein Abschluss" und wird im Frontend genauso behandelt wie ein `null`-Wert
(`completions[memberId]?.[courseId]`). Funktional identisch zu AC-1, nur eine andere Kodierung von
„kein Abschluss".

**Fehlendes Icon im Client-Bundle (echter Fund, kein Spec-Widerspruch, aber erwähnenswert):**
Der neue Tab „Matrix" nutzt `i-lucide-grid-3x3`. `nuxt.config.ts` pflegt aus betrieblichen Gründen
(offline-fähiger Container, kein Nachladen von Icons zur Laufzeit) eine explizite Liste aller
verwendeten Icon-Namen für das Client-Bundle – ein neues Icon, das nur in einem JS-Objekt (nicht als
`icon="..."`-Template-Attribut) auftaucht, wird vom Quellcode-Scan zuverlässig übersehen (siehe
Kommentar dort). `grid-3x3` wurde ergänzt; ohne diese Ergänzung blieb das Tab-Icon leer und die
Playwright-Konsole zeigte `[Icon] failed to load icon 'lucide:grid-3x3'` bei jedem Rendern der
Verwaltungsseite. Kein Acceptance Criterion verlangt ein bestimmtes Icon – reine technische
Notwendigkeit, keine inhaltliche Abweichung.

**AC-5-Test misst nicht gegen `document.documentElement.scrollWidth`:** Ein erster Testentwurf tat
das (analog zu `tests/visual/katalog.layout.spec.ts`) und schlug bei 375px zuverlässig fehl – nicht
wegen der Matrix, sondern wegen eines bereits bekannten, nicht dieser Spec zuzurechnenden Fundes:
„`/verwaltung` scrollt bei 375px horizontal (441px statt 375px). Ursache ist die Tab-Leiste, auf
allen Tabs identisch – gehört zu FV-3" (siehe `features/INDEX.md`, FV-7-QA-Historie). Der Test misst
stattdessen – exakt wie der bestehende Layout-Test für `UserRegistry.vue` in
`tests/visual/verwaltung.layout.spec.ts` es für dasselbe, vorbestehende Problem bereits tut – dass
die Matrix-Tabelle ihren eigenen Abschnitt nicht sprengt. Das entspricht dem Wortlaut von AC-5
(„horizontal scrollbar innerhalb ihres eigenen Containers") genauer als ein Seiten-weiter Scroll-Test
und macht keine Aussage über das vorbestehende, nicht-FV-19-Problem der Tab-Leiste.

---

## Implementierungsnotizen (2026-09-12)

**Gebaut:** Neuer, rein lesender `server/services/matrix.service.ts` (`getMatrix()`): liest alle
Mitgliedskonten (`role = 'member'`, inkl. deaktivierter) und alle Lehrgänge sowie – in einer
einzigen zusätzlichen Abfrage über `course_completions` – den Abschluss-Status je Paar, ohne
N+1-Lookups. Keine Schema-Änderung, keine neue Migration (reine Leseabfrage über bestehende
Tabellen aus FV-15/FV-16/FV-18). Neue Route `GET /api/admin/matrix`
(`server/api/admin/matrix.get.ts`), `requireAdmin` zuerst.

Neue Komponente `app/components/admin/CompletionMatrix.vue` (vierter Tab „Matrix" in
`app/pages/verwaltung/index.vue`, zwischen „Benutzerverwaltung" und „Einstellungen"; die
`v-else`-Kette dort wurde auf explizite `v-else-if`-Zweige pro Tab umgestellt, weil ein reines
`v-else` sonst sowohl „benutzer" als auch „matrix" auf `AdminUserRegistry` gemappt hätte). Tabelle:
Zeilen = Mitglieder (deaktivierte mit `UBadge` „Deaktiviert" und reduzierter Deckkraft markiert,
AC-6), Spalten = Lehrgänge, Zellen = Button mit Haken-Icon bei vorhandenem Abschluss. Ein Klick
ruft direkt `POST`/`DELETE /api/admin/courses/:id/completions[/:userId]` (FV-18) auf und
aktualisiert nur die eigene, von `useFetch` entkoppelte reaktive Kopie der Abschluss-Map (AC-3/
AC-4, kein `refresh()` der ganzen Matrix). Lade-, Fehler- und Leerzustand (AC-7: keine Mitglieder
oder keine Lehrgänge) und das `overflow-x-auto`-Container-Muster (AC-5) folgen `UserRegistry.vue`.

`nuxt.config.ts`: `grid-3x3` zur expliziten Icon-Liste ergänzt (siehe Abweichungs-Abschnitt).

**Tests:** neue `tests/api/admin.matrix.spec.ts` (AC-1: Autorisierung, Datenform inkl. sparse Map,
deaktiviertes Konto bleibt sichtbar), neue `tests/components/CompletionMatrix.spec.ts` (AC-2, AC-6,
AC-7 sowie AC-3/AC-4 als schneller Roundtrip mit `registerEndpoint`-Mocks, Gotchas aus
`UserRegistry.spec.ts` übernommen), neue `tests/e2e/05-matrix.spec.ts` (AC-3/AC-4 als echter
Klick-Roundtrip inkl. Server-Neuladen zur Bestätigung, AC-5 an drei Breakpoints).
`tests/api/authorization.matrix.spec.ts` um den Eintrag `GET /api/admin/matrix` ergänzt.

**Testlauf:** `npm run verify` – Lint 0 Fehler (9 bestehende Warnungen, keine neu), Typecheck grün,
alle 423 Vitest-Tests (38 Dateien) grün, `check:gaps` meldet für FV-19 selbst „7 Acceptance
Criteria, alle abgedeckt", schlägt aber insgesamt fehl: FV-20
(`features/FV-20-katalog-sichtbarkeit.md`) existiert bereits als Spec-Datei ohne Implementierung
(Commit `docs: FV-19/FV-20 specs`, Basis dieses Branches) – 7 Acceptance Criteria ohne Test, alle
FV-20, keines FV-19. Das ist kein Regressionsfund dieser Aufgabe (identisches Muster wie FV-17 zur
Zeit von FV-18, siehe dortige Implementierungsnotizen): FV-20 entsteht parallel in einem eigenen
Branch/PR; sobald der gemergt ist, verschwindet die Lücke. `npm run test:e2e`: alle 45
Playwright-Tests grün (neu: 4 in `tests/e2e/05-matrix.spec.ts`).

---

## QA Test Results

**Getestet:** 2026-09-12 · `npm run verify` (Lint/Typecheck/423 Vitest-Tests/Lückenprüfung) und
`npm run test:e2e` (45 Playwright-Tests), manuell im Sinne des in `CLAUDE.md` beschriebenen
Workflows durchgeführt (`/qa` existiert in diesem Repo nicht als eigener Command, siehe FV-13).

### Acceptance Criteria
AC-1 bis AC-7: bestanden (siehe Testtabelle oben und automatisierte Läufe, 423/423 Vitest-Tests und
45/45 Playwright-Tests grün).

### Gefundene Befunde
Ein Fund während der Umsetzung, direkt behoben (siehe „Abweichung von der ursprünglichen Spec"):
das neue Tab-Icon `grid-3x3` fehlte in der expliziten Icon-Liste in `nuxt.config.ts` und blieb im
SSR-Rendering leer (`[Icon] failed to load icon`) – ergänzt, Playwright-Konsole danach sauber.

Kein kritischer oder schwerwiegender Befund für FV-19. Ein Hinweis, kein Bug: `npm run check:gaps`
(Teil von `npm run verify`) schlägt insgesamt fehl, weil die bereits vorhandene FV-20-Spec noch
keine Tests hat – das betrifft ausschließlich FV-20 (paralleler, unabhängiger Branch/PR) und keines
der sieben FV-19-Kriterien.

### Ergebnis
Keine kritischen oder schwerwiegenden Befunde für FV-19.
