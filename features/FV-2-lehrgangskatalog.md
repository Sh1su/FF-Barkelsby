# FV-2: Lehrgangskatalog & Detailseite

**Status:** ✅ Approved (QA bestanden, noch nicht deployed)
**Created:** 2026-08-10
**Last Updated:** 2026-08-10 (Implementierung)
**Abhängigkeiten:** FV-1 (Login-Gate)

> **Hinweis (2026-08-31):** [FV-13](FV-13-lehrgangsfelder-reduzieren.md) hat Kategorie, Format,
> Uhrzeit, Ausbilder und Ort entfernt. Alle Stellen unten, die diese Felder erwähnen (AC-2, AC-3,
> AC-5, AC-8, Tech Design, Tabelle `instructors`), sind historisch und spiegeln nicht mehr den
> aktuellen Stand.
>
> **Hinweis (2026-09-01):** [FV-14](FV-14-plaetze-entfernen.md) hat zusätzlich die Platzzahl
> entfernt – AC-6 (Badge „ausgebucht") ist damit ebenfalls historisch.

## Ziel

Die Gast-Ansicht aus dem Design: eine Übersicht der kommenden Lehrgänge mit Suche und
Kategoriefiltern sowie eine Detailseite mit Programm, Ausbilder und Fakten. Titelbilder werden
serverseitig als SVG erzeugt – es gibt keine Bilddateien.

## User Stories

- Als Angehöriger der Wehr möchte ich alle kommenden Lehrgänge auf einen Blick sehen, um zu erkennen,
  was für mich in Frage kommt.
- Als Angehöriger der Wehr möchte ich nach Kategorie filtern und nach Titel, Thema oder Ausbilder
  suchen, um schnell den passenden Lehrgang zu finden.
- Als Angehöriger der Wehr möchte ich auf der Detailseite Programm, Inhalte und Ausbilder sehen, um
  einschätzen zu können, ob der Lehrgang etwas für mich ist.

## Acceptance Criteria

- [x] **AC-1:** Die Übersicht zeigt ausschließlich Lehrgänge, deren Enddatum heute oder später liegt,
      sortiert nach Beginn aufsteigend.
- [x] **AC-2:** Die Filterleiste besteht aus „Alle" plus den fünf Kategorien; ein Klick filtert die
      Liste, die Auswahl steht in der URL (`?kategorie=atemschutz`) und übersteht ein Neuladen.
- [x] **AC-3:** Die Suche filtert über Titel, Kurzbeschreibung und Ausbildername, unabhängig von
      Groß-/Kleinschreibung.
- [x] **AC-4:** Findet die Kombination aus Suche und Filter nichts, erscheint der Leerzustand
      „Kein Lehrgang gefunden…" mit einer Möglichkeit, die Filter zurückzusetzen.
- [x] **AC-5:** Jede Karte zeigt Kategorie, Format, Datumsblock, Titel, Kurzbeschreibung, Zeitraum,
      Uhrzeit, Ausbilder sowie den Belegungsstand „X von Y Plätzen".
- [x] **AC-6:** Sind alle Plätze durch **bestätigte** Anmeldungen belegt, trägt die Karte das Badge
      „ausgebucht"; die Schaltfläche zur Interessensbekundung bleibt trotzdem aktiv.
- [x] **AC-7:** Ein abgesagter Lehrgang wird mit dem Hinweis „abgesagt" dargestellt, die
      Interessensbekundung ist deaktiviert.
- [x] **AC-8:** Die Detailseite zeigt Beschreibung, Themenliste, Programm je Tag, Ausbilder mit Vita
      und die Faktenbox; leere Abschnitte werden vollständig ausgeblendet statt leer gerendert.
- [x] **AC-9:** `GET /api/courses/:id/cover.svg` liefert für dieselbe ID immer dasselbe SVG
      (deterministisch), Content-Type `image/svg+xml`, ohne `<script>` im Ausgabedokument.
- [x] **AC-10:** Ein Lehrgang ohne gesetztes Motiv bekommt eines aus dem Hash seiner ID – das Bild ist
      nie leer.
- [x] **AC-11:** `GET /api/courses` ist paginiert (Default 25, Max 100) und liefert ohne Session 401.
- [x] **AC-12:** Die Übersicht ist bei 375 px, 768 px und 1440 px ohne horizontales Scrollen bedienbar;
      alle Bedienelemente sind mindestens 44 px hoch.

## Edge Cases

- Lehrgang läuft gerade (Beginn in der Vergangenheit, Ende in der Zukunft) → bleibt sichtbar
- Lehrgang ohne Ausbilder → Ausbilderblock entfällt, Karte bleibt vollständig
- Lehrgang über einen Monatswechsel → Datumsblock zeigt den Startmonat, Zeitraum beide Daten
- Kapazität 0 oder nicht gesetzt → gilt als „unbegrenzt", kein Badge „ausgebucht"
- Sehr langer Titel → Umbruch statt Überlauf, Layout-Invariante im Visual-Test
- Unbekannte Kategorie in der URL → Filter fällt auf „Alle" zurück, kein Fehler

## Tech Design

### Database Schema (Drizzle / SQLite)

```ts
instructors = sqliteTable('instructors', {
  id, name, role, vita, motif, createdAt, updatedAt,
})

courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  summary: text('summary'),                                    // Kurzbeschreibung für die Karte
  description: text('description'),                            // Fließtext Detailseite
  topics: text('topics', { mode: 'json' }).$type<string[]>(),   // Themenliste
  category: text('category', { enum: CATEGORIES }).notNull(),
  format: text('format', { enum: FORMATS }).notNull(),
  startsOn: integer('starts_on', { mode: 'timestamp' }).notNull(),
  endsOn: integer('ends_on', { mode: 'timestamp' }).notNull(),
  timeLabel: text('time_label'),                               // "09:00 – 12:00"
  location: text('location'),
  capacity: integer('capacity').notNull().default(0),          // 0 = unbegrenzt
  instructorId: text('instructor_id').references(() => instructors.id, { onDelete: 'set null' }),
  motif: integer('motif'),                                     // 0–7, null = aus ID-Hash
  palette: integer('palette'),                                 // 0–3
  status: text('status', { enum: ['geplant', 'abgesagt'] }).notNull().default('geplant'),
  createdAt, updatedAt,
})

courseDays = sqliteTable('course_days', {
  id, courseId (cascade), dayNumber, date, timeLabel, title,
  bullets: text({ mode: 'json' }).$type<string[]>(),
})
```

Indizes: `courses(starts_on)`, `courses(category, starts_on)`, `course_days(course_id, day_number)`.
Migration: `0001_courses.sql`

### Konstanten (`shared/constants.ts`)

```ts
CATEGORIES = ['grundausbildung', 'atemschutz', 'technische-hilfeleistung',
              'fuehrung-organisation', 'erste-hilfe'] as const
FORMATS    = ['standortausbildung', 'kreisausbildung'] as const
```
Deutsche Beschriftungen als Mapping daneben – die Enum-Werte selbst bleiben englisch/technisch.

### API Routes (Nitro)

| Route | Auth | Zweck |
|-------|------|-------|
| `GET /api/courses` | angemeldet | Liste, Query: `kategorie`, `q`, `page`, `limit` |
| `GET /api/courses/:id` | angemeldet | Detail inkl. Programmtage und Ausbilder |
| `GET /api/courses/:id/cover.svg` | angemeldet | generiertes Titelbild (Karte oder Hero via `?variant=`) |

### Motiv-Generator (`server/utils/cover.ts`)

Reine Funktion `renderCover({ title, subtitle, category, motif, palette, variant })` → SVG-String.
Acht Motive (Sparren, konzentrische Kreise, Raster, Wellen, Diagonalen, Schlauchbogen, Leiter,
Punktmatrix) × vier Farbvarianten aus der Design-Palette. Variante `card` = 800×320 mit Textband,
`hero` = 1180×340 ohne Text. Ohne gesetztes Motiv entscheidet ein FNV-1a-Hash der Lehrgangs-ID.
Alle Textinhalte werden XML-escaped.

### Component Architecture (Nuxt)

```
app/pages/index.vue                     – Übersicht
├── courses/CourseFilterBar.vue         – Suche + Kategoriefilter (UInput, UButton)
├── courses/CourseCard.vue              – Karte (UCard, UBadge)
└── courses/CourseEmptyState.vue
app/pages/lehrgang/[id].vue             – Detailseite
├── courses/CourseHero.vue
├── courses/CourseProgram.vue           – Programm je Tag
├── courses/CourseInstructor.vue
└── courses/CourseFacts.vue
```

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/api/courses.list.spec.ts` | AC-1 bis AC-4, AC-6, AC-11 |
| `tests/api/courses.detail.spec.ts` | AC-8, AC-11 |
| `tests/api/courses.cover.spec.ts` | AC-9, AC-10, AC-11 |
| `tests/unit/cover.spec.ts` | AC-9, AC-10 |
| `tests/unit/capacity.spec.ts` | AC-6 |
| `tests/components/CourseCard.spec.ts` | AC-5, AC-6, AC-7 |
| `tests/e2e/verwaltung.spec.ts` | AC-2, AC-4, AC-7 |
| `tests/visual/katalog.layout.spec.ts` | AC-12 |

---

## Implementierungsnotizen (2026-08-10)

**Gebaut:** Übersicht mit Suche und Kategoriefiltern, Detailseite mit Programm/Themen/Ausbilder,
Motiv-Generator (8 Motive × 4 Paletten) als `/api/courses/:id/cover.svg`.

**Abweichungen gegenüber der Spec:**

1. **Belegung ist noch immer 0.** `confirmedCount` kommt aus den Anmeldungen, deren Schreib-API erst
   FV-5 baut. Die Tabelle `signups` existiert bereits, der Service liest sie aber noch nicht –
   AC-6 ist deshalb über Unit- und Komponententests abgedeckt, nicht über die API.
2. **„Interesse bekunden" zeigt vorerst einen Hinweis-Toast** statt des Formulars (FV-5).
3. **Importe aus `shared/` laufen über den `#shared`-Alias.** Relative Pfade aus den Seiten haben
   den Produktionsbuild gebrochen (`Could not resolve "../../../../../shared/constants.ts"`).
4. **Bedienelemente haben `min-h-11` (44px).** Der Layouttest zu AC-12 war rot: Suchfeld und
   Filterknöpfe waren auf 375px nur 36px hoch.

**Tests:** 10 API-Tests Übersicht, 4 API-Tests Detail, 8 API-Tests Titelbild, 10 Unit-Tests,
6 Komponententests, 4 Layouttests je Breakpoint.

---

## QA Test Results

**Getestet:** 2026-08-10 · Bildstrecke Übersicht, Detailseite, Leerzustand (Desktop + 375 px).

### Acceptance Criteria
AC-1 bis AC-12: bestanden (22 API-Tests, 10 Unit-Tests, 6 Komponententests, 4 Layouttests).

### Gefundene und behobene Fehler

**BUG-4: Datumsbereich mit doppeltem Punkt („22.08.. – 24.08.2026") · Severity: Medium**
- `Intl` liefert für `day/month` bereits „22.08.", der Code hängte einen weiteren Punkt an.
- Behoben in `useCourseFormat.dateRange`.

**BUG-5: Titelbild wiederholte Titel und Kategorie · Severity: Medium (UX)**
- Das generierte SVG trug ein Textband mit Titel und Ausbilder – beides steht direkt daneben
  noch einmal. Im Entwurf ersetzte dieser Text ein fehlendes Foto.
- Behoben: Titelbilder sind jetzt rein grafisch; der Titel bleibt als `aria-label` erhalten.
  Die betroffenen Tests wurden entsprechend angepasst (Begründung hier dokumentiert).

**BUG-6: Motive füllten die Fläche nicht · Severity: Low (Design)**
- Sparren, Kreise und Wellen waren auf feste Pixelwerte gesetzt und ließen im Hero-Format
  zwei Drittel leer. Behoben: alle Motive rechnen jetzt mit der Höhe.

**BUG-7: Ausbilder-Initiale aus dem Dienstgrad · Severity: Low**
- „Oberbrandmeisterin Vogt" ergab „O". Behoben: Initiale aus dem letzten Namensbestandteil.

**BUG-8: Bedienelemente auf 375 px nur 36 px hoch · Severity: Medium (a11y)**
- Vom Layouttest gefunden, behoben über `min-h-11` (44 px).

### Ergebnis
Keine offenen Fehler.
