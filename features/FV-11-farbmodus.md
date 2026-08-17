# FV-11: Farbmodus hell/dunkel

**Status:** ✅ Approved (QA über Bildstrecke in beiden Modi)
**Created:** 2026-08-10
**Last Updated:** 2026-08-10
**Abhängigkeiten:** FV-1 bis FV-4 (die vorhandene Oberfläche)

## Ziel

Die gesamte Oberfläche funktioniert in einem hellen und einem dunklen Modus. Standard ist die
Systemeinstellung des Geräts; ein Umschalter in der Kopfzeile erlaubt die bewusste Wahl. Besonders
die Eingabefelder müssen in beiden Modi klar als Felder erkennbar und lesbar sein — im Gerätehaus
wird die Anwendung auch abends am Handy bedient.

## User Stories

- Als Angehöriger der Wehr möchte ich die Lehrgangsübersicht abends im dunklen Modus lesen können,
  ohne geblendet zu werden.
- Als Wehrführung möchte ich die Formulare der Verwaltung in beiden Modi sicher ausfüllen können.
- Als Nutzer möchte ich, dass die Anwendung ohne Zutun der Einstellung meines Geräts folgt.

## Acceptance Criteria

- [x] **AC-1:** Ohne eigene Wahl folgt die Anwendung der Systemeinstellung (`prefers-color-scheme`).
- [x] **AC-2:** Der Umschalter in der Kopfzeile wechselt zwischen hell und dunkel; die Wahl
      überlebt einen Seitenwechsel und ein Neuladen.
- [x] **AC-3:** In beiden Modi erreicht Fließtext gegenüber seinem Hintergrund mindestens ein
      Kontrastverhältnis von 4,5:1.
- [x] **AC-4:** Eingabefelder sind in beiden Modi als Felder erkennbar: sichtbarer Rahmen,
      lesbarer Text, vom Text unterscheidbarer Platzhalter.
- [x] **AC-5:** Native Bedienelemente (Datumsfelder mit Kalender-Popup) folgen dem Modus über
      `color-scheme`.
- [x] **AC-6:** Der Umschalter ist per Tastatur erreichbar und trägt eine sprechende Beschriftung.
- [x] **AC-7:** Der Umschalter erscheint auch auf der Anmeldeseite, also vor jeder Anmeldung.

## Edge Cases

- Serverseitig gerenderte Seite: kein Umspringen des Symbols nach dem Laden (Umschalter wird erst
  nach der Übernahme durch den Browser gezeichnet)
- Markenflächen (Anmeldeseite, Kopfzeile der Verwaltung) bleiben bewusst in beiden Modi dunkel —
  das ist die Farbsprache des Entwurfs, kein Fehler
- Generierte Titelbilder bleiben dunkel; sie sind Bildmaterial, kein Flächenelement

## Tech Design

- `@nuxtjs/color-mode` (kommt mit Nuxt UI), Voreinstellung `system`, Klassensuffix leer
- Farbflächen ausschließlich über die semantischen Nuxt-UI-Token: `bg-default`, `bg-muted`,
  `bg-elevated`, `bg-accented`, `text-highlighted`, `text-default`, `text-toned`, `text-muted`,
  `text-dimmed`, `border-default`, `border-accented`
- Neutralfarbe ist die Navy-Palette des Entwurfs (`app.config.ts`), damit beide Modi aus derselben
  Farbfamilie stammen
- `color-scheme: light|dark` in `main.css` für native Bedienelemente
- `app/components/ColorModeToggle.vue` in beiden Layouts und auf der Anmeldeseite

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/visual/farbmodus.spec.ts` | AC-1 bis AC-7 |

---

## Implementierungsnotizen und QA (2026-08-10)

**Gebaut:** Farbmodus über `@nuxtjs/color-mode` (Voreinstellung `system`), Umschalter in beiden
Layouts und auf der Anmeldeseite, alle Flächen auf semantische Nuxt-UI-Token umgestellt,
Neutralfarbe auf die Navy-Palette des Entwurfs gesetzt, `color-scheme` für native Bedienelemente.

**Beim Umbau gefundener Fehler**

**BUG-11: Die Bearbeitungsseite stürzte mit 500 ab · Severity: Critical**
- Ursache: Die Auswahl „Ohne Ausbilder" nutzte einen leeren String als Wert; Nuxt UI verbietet das
  (`A <SelectItem /> must have a value prop that is not an empty string`). Der Fehler trat nur mit
  vorhandenem Ausbilder-Datensatz auf und blieb deshalb bis zur Bildstrecke unentdeckt.
- Behoben: eigener Platzhalterwert `ohne`, der beim Speichern wieder zu `null` wird.
- Regressionstest: `tests/e2e/verwaltung.spec.ts` – „Bearbeitungsseite lädt auch mit
  zugeordnetem Ausbilder".

**BUG-12: Tests haben echte E-Mails verschickt · Severity: High**
- Der Testserver erbt die produktive `.env`; nach dem Anbinden von Gmail versendete ein Test
  tatsächlich über das Relay. Das verstößt gegen „kein Netzwerkzugriff in Tests".
- Behoben: `tests/helpers/server.ts` sowie beide Playwright-Konfigurationen leeren die
  `NUXT_SMTP_*`-Variablen grundsätzlich; nur der Relay-Fehlertest setzt bewusst ein totes Ziel.

**Bewusst unverändert:** Anmeldeseite und Kopfzeile der Verwaltung bleiben in beiden Modi dunkel,
ebenso die generierten Titelbilder – das ist die Farbsprache des Entwurfs.
