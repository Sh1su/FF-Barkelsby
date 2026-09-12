# FV-19: Admin-Matrix (Lehrgänge × Mitglieder)

**Status:** 📋 Planned
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

- [ ] **AC-1:** `GET /api/admin/matrix` (nur Admin, 401/403) liefert alle aktiven und inaktiven
      Mitgliedskonten (`role = 'member'`) und alle Lehrgänge sowie zu jedem Mitglied-Lehrgang-Paar,
      ob ein Abschluss existiert (`completedAt` falls ja, sonst `null`).
- [ ] **AC-2:** Ein neuer Tab „Matrix" im dritten... eigentlich vierten Reiter der Verwaltung
      (`app/pages/verwaltung/index.vue`, neben Kalender/Registratur/Benutzerverwaltung/
      Einstellungen) zeigt die Daten aus AC-1 als Tabelle: Zeilen Mitglieder, Spalten Lehrgänge.
- [ ] **AC-3:** Ein Klick auf eine leere Zelle (kein Abschluss) trägt über
      `POST /api/admin/courses/:id/completions` (FV-18, bereits vorhanden) einen Abschluss mit dem
      heutigen Datum ein und aktualisiert die Zelle, ohne die ganze Matrix neu zu laden.
- [ ] **AC-4:** Ein Klick auf eine ausgefüllte Zelle (Abschluss vorhanden) entfernt ihn über
      `DELETE /api/admin/courses/:id/completions/:userId` (FV-18, bereits vorhanden).
- [ ] **AC-5:** Die Matrix ist bei vielen Lehrgängen/Mitgliedern horizontal scrollbar innerhalb
      ihres eigenen Containers (kein horizontales Scrollen der gesamten Seite,
      `.claude/rules/testing.md`-Konvention aus bestehenden Tabellen wie `UserRegistry.vue`
      übernehmen).
- [ ] **AC-6:** Deaktivierte Mitgliedskonten erscheinen weiterhin in der Matrix (ein Abschluss ist
      personenbezogene Historie, unabhängig vom aktuellen Kontostatus – siehe FV-18, Edge Cases),
      aber optisch als deaktiviert erkennbar markiert (z. B. wie in `UserRegistry.vue`).
- [ ] **AC-7:** Ohne Mitglieder oder ohne Lehrgänge zeigt die Matrix einen Leerzustand statt einer
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
| `tests/components/CompletionMatrix.spec.ts` (neu) | AC-2, AC-6, AC-7 |
| `tests/e2e/05-matrix.spec.ts` (neu, oder Erweiterung von `04-benutzerverwaltung.spec.ts`) | AC-3, AC-4, AC-5 |
| `tests/api/authorization.matrix.spec.ts` | Selbst-Check: neue Route muss in der Matrix stehen |
