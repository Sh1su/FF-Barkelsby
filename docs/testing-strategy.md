# Teststrategie – Regressionsnetz für KI-gestützte Entwicklung

Diese Anwendung wird überwiegend durch Prompting weiterentwickelt. Änderungen an einer Stelle können
unbemerkt eine andere zerstören. Die Tests sind deshalb nicht "Qualitätssicherung am Ende", sondern
**das Frühwarnsystem**: Jede Funktion, jede API-Route und jede bewusste Design-Entscheidung ist als
ausführbare Zusicherung hinterlegt. Bricht etwas, meldet es sich beim nächsten `npm run verify`.

## Testpyramide

| Ebene | Werkzeug | Was wird geprüft | Laufzeit |
|-------|----------|------------------|----------|
| **Unit** | Vitest | Fachlogik: Punkteberechnung, Statusübergänge, Budgetprüfung, Fristen | < 5 s |
| **Integration (API)** | Vitest + `@nuxt/test-utils` | jede Route in `server/api/**` gegen eine echte SQLite-Testdatenbank | < 30 s |
| **Komponenten** | Vitest + `@nuxt/test-utils/runtime` | Zustände einer Komponente: leer, ladend, Fehler, gefüllt | < 20 s |
| **E2E** | Playwright | Nutzerpfade über die echte App: Antrag stellen → genehmigen → Nachweis hochladen | 1–3 min |
| **Visuell / Layout** | Playwright Screenshots + Layout-Assertions | Design-Entscheidungen: Positionen, Abstände, Breakpoints | 1–2 min |
| **Zugänglichkeit** | `@axe-core/playwright` | Kontrast, Labels, Fokusreihenfolge je Seite | < 1 min |
| **Betrieb** | Shell/CI | Migrationen, Docker-Build, Backup + Restore | 2–5 min |

Faustregel: Fachlogik wird als Unit getestet, Berechtigungen als Integration, Nutzerpfade als E2E.
Ein Bug wird immer auf der **untersten** Ebene abgesichert, auf der er reproduzierbar ist.

## Rückverfolgbarkeit: Akzeptanzkriterium → Test

Jedes Acceptance Criterion aus der Feature-Spec hat genau eine Testentsprechung, benannt nach seiner ID:

```ts
// tests/unit/points.spec.ts
describe('FV-5 Teilnahmen & Nachweise', () => {
  it('AC-3: schreibt die Fortbildungspunkte erst nach Statuswechsel auf "completed" gut', () => { … })
  it('AC-4: bucht Punkte bei Stornierung wieder aus', () => { … })
})
```

Damit lässt sich ein roter Test sofort auf eine Anforderung zurückführen – und umgekehrt zeigt
`npm run test -- --grep "FV-5"`, ob ein Feature noch vollständig funktioniert.
Der QA Engineer trägt in die Spec ein, welche Testdatei welches AC abdeckt.

## Vollständigkeit erzwingen (die eigentliche Absicherung)

Tests, die niemand schreibt, fangen nichts ab. Deshalb prüft CI die Abdeckung strukturell:

```ts
// scripts/check-coverage-gaps.ts  (läuft in CI)
// 1. Jede Datei in server/api/** braucht eine passende Datei in tests/api/**
// 2. Jeder Service in server/services/** braucht eine Datei in tests/unit/**
// 3. Jede Seite in app/pages/** muss in mindestens einem E2E-Spec vorkommen
// 4. Jedes AC in features/FV-*.md muss als it('AC-n: …') in tests/ auftauchen
// Fehlt etwas -> Exit-Code 1 mit Auflistung der Lücken.
```

Zusätzlich Schwellenwerte für die Codeabdeckung:

| Bereich | Mindestabdeckung |
|---------|------------------|
| `server/services/**` (Fachlogik) | 90 % |
| `server/api/**` | 85 % |
| `server/utils/authorization.ts` | 100 % |
| Gesamt | 75 % |

Die 100 % bei der Autorisierung sind bewusst: SQLite hat kein Row Level Security, jeder Zweig dort
ist eine potenzielle Datenlücke.

## API-Routen testen

Für **jede** Route mindestens diese vier Fälle:

```ts
// tests/api/participations.post.spec.ts
describe('POST /api/participations', () => {
  it('AC-1: legt einen Antrag für die eigene Person an', async () => { /* 201 */ })
  it('lehnt ungültige Eingaben ab', async () => { /* 400, Zod */ })
  it('lehnt nicht angemeldete Aufrufe ab', async () => { /* 401 */ })
  it('verhindert Anträge im Namen einer anderen Person', async () => { /* 403 – IDOR */ })
  it('verhindert den doppelten Antrag zur selben Fortbildung', async () => { /* 409 */ })
})
```

**Autorisierungsmatrix als Test:** Eine tabellengetriebene Suite prüft jede Route gegen jede Rolle
(`employee`, `manager`, `hr`, `admin`, anonym) und gegen fremde Datensätze. Neue Route ohne Eintrag
in der Matrix → Test schlägt fehl. Das ist der wirksamste Schutz gegen versehentlich geöffnete
Endpunkte beim Umbauen durch ein Sprachmodell.

Testdatenbank: eine frische SQLite-Datei pro Testlauf (`:memory:` oder `tmp/test-<n>.db`), Migrationen
werden angewendet, Seed-Daten kommen aus `tests/factories/`. Keine Tests gegen die Entwicklungsdatenbank.

## Design-Entscheidungen testbar machen

Design ist hier kein Bauchgefühl, sondern eine Menge überprüfbarer Zusicherungen. Drei Werkzeuge:

**1. Design-Tokens als Single Source of Truth**
Farben, Abstände und Radien werden nur aus den Tokens (`app/assets/css/tokens.css` bzw. Nuxt-UI-Theme)
verwendet. Ein Lint-Test verbietet Hardcoding:
```ts
it('verwendet keine hartcodierten Hex-Farben in Komponenten', () => { /* grep über app/components */ })
```

**2. Layout-Invarianten statt Pixelvergleich**
Robuster als reine Screenshots – prüft die tatsächliche *Position*, ohne bei jeder Farbänderung rot zu werden:
```ts
// tests/visual/training-card.spec.ts
test('Punkte-Badge sitzt oben rechts in der Karte und überlappt den Titel nicht', async ({ page }) => {
  const card  = page.getByTestId('training-card').first()
  const badge = card.getByTestId('points-badge')
  const title = card.getByTestId('training-title')

  const c = await card.boundingBox()
  const b = await badge.boundingBox()
  const t = await title.boundingBox()

  expect(b!.y).toBeLessThan(c!.y + 56)                 // im oberen Bereich der Karte
  expect(b!.x + b!.width).toBeCloseTo(c!.x + c!.width - 16, 0)  // rechtsbündig mit 16px Abstand
  expect(b!.x).toBeGreaterThan(t!.x + t!.width)        // keine Überlappung mit dem Titel
})
```
Solche Invarianten eignen sich für alles, was fachlich wichtig ist: Reihenfolge der Statusanzeige,
Sichtbarkeit des Genehmigen-Buttons nur für Führungskräfte, Position des Punktestands im Dashboard,
Touch-Ziele ≥ 44 px auf Mobil.

**3. Visuelle Snapshots je Breakpoint**
```ts
for (const [name, width] of [['mobile', 375], ['tablet', 768], ['desktop', 1440]] as const) {
  test(`Fortbildungsübersicht ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/fortbildungen')
    await expect(page).toHaveScreenshot(`trainings-${name}.png`, { maxDiffPixelRatio: 0.01 })
  })
}
```
Damit Snapshots stabil bleiben: feste Seed-Daten, fixierte Systemzeit, Animationen abschalten
(`animations: 'disabled'`), lokale Schriften, Screenshots im Linux-Container erzeugen (auch lokal
über `npx playwright test --update-snapshots` im Docker-Image), sonst weichen Font-Renderings ab.

Ein geänderter Snapshot ist kein Fehler, sondern eine **Entscheidung**: Das Diff erscheint im Pull
Request und muss bewusst freigegeben werden. Genau so wird eine ungewollte Design-Änderung durch
einen Prompt sichtbar.

## Fachlogik "Fortbildungspunkte"

Die Punktelogik ist der fehleranfälligste Teil (Rundung, Teilnahmeabbruch, Storno, Jahreswechsel) und
wird ausschließlich in einer reinen Funktion berechnet, die ohne Datenbank testbar ist:

```ts
// tests/unit/points.spec.ts
it.each([
  { hours: 8,   category: 'fachlich',  expected: 8 },
  { hours: 1.5, category: 'fachlich',  expected: 2 },   // kaufmännisch gerundet
  { hours: 8,   category: 'freiwillig', expected: 0 },  // zählt nicht auf die Pflichtpunkte
])('berechnet $expected Punkte für $hours h ($category)', ({ hours, category, expected }) => {
  expect(calculatePoints({ hours, category })).toBe(expected)
})
```

## Deterministik (Voraussetzung für alles)

- Zeit fixieren: `vi.setSystemTime()` bzw. Playwright-Clock – Fristen- und Ablauftests dürfen nicht
  im nächsten Jahr rot werden
- Keine Zufalls-IDs in Assertions; Factories vergeben feste IDs
- Keine Netzwerkzugriffe im Test (die App muss ohnehin offline laufen)
- Jeder Test räumt seine Datenbank auf bzw. bekommt eine frische

## Befehle

```bash
npm run test          # Unit + Integration + Komponenten (Vitest)
npm run test:watch    # während der Entwicklung
npm run test:e2e      # Playwright inkl. Layout-Assertions
npm run test:visual   # nur die Snapshot-Suite
npm run test:a11y     # Zugänglichkeitsprüfung
npm run typecheck     # nuxi typecheck
npm run lint          # ESLint
npm run verify        # lint + typecheck + test + Lückenprüfung  <- vor jedem Commit
```

## Wann welche Tests laufen

| Zeitpunkt | Umfang | Zweck |
|-----------|--------|-------|
| Beim Speichern (Watch) | betroffene Unit-Tests | sofortiges Feedback |
| Pre-Commit-Hook | Lint + Typecheck + Unit | nichts offensichtlich Kaputtes committen |
| Pre-Push-Hook | `npm run verify` | keine roten Branches pushen |
| Pull Request (CI) | alles inkl. E2E, Visual, a11y, Docker-Build, Restore-Test | Merge-Gate |
| Nächtlich | volle Suite + `npm audit` + Restore-Übung | schleichende Regressionen |

## Regel für KI-gestützte Änderungen

Ein Feature gilt erst als fertig, wenn `npm run verify` grün ist – **nicht**, wenn der Code plausibel
aussieht. Schlägt ein Test fehl, der nichts mit der aktuellen Aufgabe zu tun hat, ist das ein
Regressionsfund und wird gemeldet, nicht durch Anpassen des Tests "repariert". Ein Test darf nur
geändert werden, wenn sich die Anforderung in der Feature-Spec nachweislich geändert hat.
