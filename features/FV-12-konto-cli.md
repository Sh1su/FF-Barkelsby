# FV-12: Konto-CLI (Kennung & Passwort)

**Status:** 🟡 In Progress
**Created:** 2026-08-12
**Last Updated:** 2026-08-12
**Abhängigkeiten:** FV-1 (Konten, Passwort-Hashing), FV-7 (Regeln der Benutzerverwaltung)

## Ziel

Ein Betriebswerkzeug für die Kommandozeile, mit dem Kennung (E-Mail) und Passwort des Gast-Zugangs
und der Admin-Konten direkt in der SQLite-Datei gesetzt werden – ohne Anmeldung, ohne laufende
Anwendung.

FV-7 kann das bereits in der Oberfläche, setzt aber voraus, dass man sich noch anmelden kann. Genau
das ist im Störungsfall nicht gegeben: Admin-Passwort vergessen, Kennung vertippt, niemand kommt
mehr in die Verwaltung. Der Weg über `NUXT_ADMIN_*`/`NUXT_GUEST_*` in `.env` hilft dann nicht –
`seedAccounts()` ist bewusst idempotent und rührt ein bestehendes Konto nie wieder an (FV-1, AC-9).

## User Stories

- Als Betreiber möchte ich das Admin-Passwort zurücksetzen können, wenn sich niemand mehr anmelden
  kann.
- Als Betreiber möchte ich die Kennung eines Kontos korrigieren, wenn sie beim Aufsetzen falsch
  gesetzt wurde.
- Als Betreiber möchte ich sehen, welche Konten es gibt und in welchem Zustand sie sind, ohne die
  Datenbank von Hand zu öffnen.
- Als Betreiber möchte ich, dass ein Passwort dabei niemals in der Shell-Historie oder in der
  Prozessliste landet.

## Acceptance Criteria

- [x] **AC-1:** `list` zeigt alle Konten mit Kennung, Rolle, Zustand (aktiv/deaktiviert) und dem
      Hinweis, ob ein Passwortwechsel fällig ist.
- [x] **AC-2:** `set-email` ändert die Kennung eines Kontos; Leerzeichen und Großschreibung werden
      normalisiert (wie in der Anwendung).
- [x] **AC-3:** Eine bereits vergebene Kennung wird abgelehnt (Exit-Code 1), beide Datensätze
      bleiben unverändert.
- [x] **AC-4:** Das Passwort wird verdeckt abgefragt und zur Kontrolle wiederholt; `--passwort-stdin`
      liest es stattdessen aus der Standardeingabe. Ein Passwort als Kommandozeilenargument wird
      abgelehnt.
- [x] **AC-5:** Passwörter unter 12 Zeichen werden abgelehnt, das Konto bleibt unverändert.
- [x] **AC-6:** Nach `set-password` gilt sofort das neue Passwort und `mustChangePassword` ist
      `false`; mit `--wechsel-erzwingen` ist es `true`.
- [x] **AC-7:** Konten sind über ihre Kennung ansprechbar, dazu über die Kurzformen `guest` und
      `admin`; `admin` bricht mit einer Auflistung ab, wenn es mehr als ein Admin-Konto gibt.
- [x] **AC-8:** Ein unbekannter Befehl oder ein unbekanntes Konto führt zu Exit-Code 1 mit
      Hilfetext; es wird nichts geschrieben.
- [x] **AC-9:** Passwörter und Hashes erscheinen in keiner Ausgabe, auch nicht im Fehlerfall.
- [x] **AC-10:** Fehlt die Tabelle `users`, bricht die CLI mit dem Hinweis auf `npm run db:migrate`
      ab.

## Edge Cases

- Kennung mit anderer Groß-/Kleinschreibung → dieselbe Kennung (gleiche Regel wie FV-7)
- Passwortwechsel per CLI beendet **keine** laufenden Sitzungen – bewusst gleiches Verhalten wie in
  FV-7. Wer eine Sitzung wirklich beenden will, deaktiviert das Konto in der Oberfläche
- Zwei Prozesse schreiben gleichzeitig → SQLite serialisiert, `busy_timeout` aus
  `createConnection()` greift
- Datenbankdatei existiert noch nicht → `createConnection()` legt eine leere an, die Tabellenprüfung
  schlägt an und verweist auf `db:migrate` (AC-10)
- Bestätigung stimmt nicht mit der ersten Eingabe überein → Abbruch ohne Schreibung

## Tech Design

### Aufbau

```
scripts/user-cli.ts               dünner Einstieg: Verbindung, echtes CliIO, Exit-Code
└── server/database/account-cli.ts  gesamtes Verhalten, bekommt db und CliIO hereingereicht
```

Diese Aufteilung folgt `server/database/seed.ts` + `scripts/seed-cli.ts`. Sie ist der Grund, warum
sich alles – inklusive Passwortabfrage und Ausgabe – im Unit-Test prüfen lässt, ohne einen Prozess
zu starten.

`server/services/user-admin.service.ts` (FV-7) ist bewusst **nicht** wiederverwendet: der Service
ruft die Nitro-Auto-Imports `useDatabase()` und `createError()` auf, die es in einem `tsx`-Skript
nicht gibt. Geteilt bleibt die fachliche Wahrheit: das Zod-Schema aus `shared/validation/user.ts`,
`createPasswordHash()` aus `server/utils/password.ts` und der Unique-Index `users_email_unique`.

### Befehle

```
npm run user -- list
npm run user -- set-email    <konto> <neue-kennung>
npm run user -- set-password <konto> [--wechsel-erzwingen] [--passwort-stdin]
```

`<konto>` ist eine Kennung, `guest` oder `admin`.
Die Datenbank kommt aus `NUXT_DB_PATH` (Vorgabe `./data/app.db`).

### Nicht im Umfang

Konten anlegen, deaktivieren oder löschen. Das kann FV-7 in der Oberfläche samt Schutzregeln
(`darfDeaktivieren`), die hier doppelt gepflegt werden müssten.

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/unit/account-cli.spec.ts` | AC-1 bis AC-10, dazu der Rauchtest über `scripts/user-cli.ts` |

## Umsetzungsnotizen

**Stand 2026-08-12 – implementiert, `npm run verify` grün** (289 Vitest-Tests, davon 19 neu; keine
Abdeckungslücken, FV-12 mit 10/10 Acceptance Criteria; 0 Lint-Fehler, keine neue Warnung).

Keine Migration, kein Schema-Eingriff, keine neue Umgebungsvariable, keine neue Abhängigkeit.

Neue Dateien: `server/database/account-cli.ts`, `scripts/user-cli.ts`,
`tests/unit/account-cli.spec.ts`. Geändert: `package.json` (npm-Skript `user`), `CLAUDE.md`
(Befehlsübersicht), `docs/docker-deployment.md` (Abschnitt „Zugangsdaten im Betrieb ändern").

Abweichungen und Entscheidungen gegenüber der Spec:

- **Die verdeckte Eingabe läuft nicht über `readline`.** Der erste Entwurf benutzte
  `rl.question()` mit stummgeschaltetem `_writeToOutput`. Im Test gegen ein echtes Terminal (`script
  -qec …`) blieb die **zweite** Frage („Zur Kontrolle wiederholen") dauerhaft hängen: `rl.close()`
  beendet auch `process.stdin`, und ein über beide Fragen geteiltes Interface lieferte die zweite
  Antwort nie aus. Gelöst ohne readline – `stdin` im Raw-Modus, Zeichen einzeln, Enter/Strg-C/
  Rücktaste von Hand. Was nach dem Zeilenende im selben Block ankommt, wird per `stdin.unshift()`
  für die nächste Frage zurückgelegt. Nachgemessen: bei realistischem Tippzeitpunkt erscheint das
  Passwort **null Mal** auf dem Bildschirm.
- **Ohne Terminal bricht die interaktive Abfrage mit einem Hinweis ab** statt zu hängen (Meldung
  verweist auf `--passwort-stdin`). Fiel beim Durchstich selbst auf, als das Flag fehlte.
- **`admin` als Kurzform ist absichtlich streng:** bei mehreren Verwaltungskonten wird nicht
  geraten, sondern mit der Liste der Kennungen abgebrochen (AC-7). FV-7 erlaubt mehrere Admins
  ausdrücklich.
- **`--wechsel-erzwingen` statt Vorgabe „immer Wechsel"** (Abweichung zu FV-7, AC-12). Grund: der
  Betreiber setzt das Passwort bewusst und gibt es so heraus; beim geteilten Gast-Zugang wäre ein
  Zwangswechsel sogar schädlich, weil der erste Anmelder es für die ganze Wehr ändern würde.
- **Der Rauchtest ruft `scripts/user-cli.ts` per `execFileSync` auf.** Ohne ihn wäre die Verdrahtung
  Skript ↔ Modul ↔ npm-Eintrag ungetestet – die Unit-Tests reichen `db` und `CliIO` selbst herein.
- `SETUP.md` wurde **nicht** ergänzt: dessen Skriptliste ist eine Kit-Vorlage und weicht schon vor
  FV-12 von `package.json` ab (`db:migrate` zeigt dort auf einen alten Pfad). Der Befehl steht
  stattdessen in `CLAUDE.md`, der gelebten Referenz.

Im Container gibt es die CLI noch nicht: sie braucht `tsx`, und das Produktionsimage enthält nur
`.output` und die Laufzeitabhängigkeiten. Wie sie ins Image kommt, entscheidet **FV-9** zusammen mit
dem Dockerfile; bis dahin läuft sie vom Host aus gegen die Datei im Volume. In
`docs/docker-deployment.md` steht genau das.

### Durchstich (2026-08-12)

Gegen eine **Kopie** der Entwicklungsdatenbank, `data/app.db` blieb unangetastet:

| Prüfung | Ergebnis |
|---------|----------|
| `list`, `set-email`, `set-password` über `npm run user` | Exit-Code 0, erwartete Ausgabe |
| Kennung normalisiert (`"  GAST@Example.ORG "`) | gespeichert als `gast@example.org` |
| Kennung bereits vergeben / unbekannter Befehl / Passwort zu kurz | je Exit-Code 1, deutsche Meldung |
| Passwort als Argument | abgelehnt mit Begründung und Hinweis auf `--passwort-stdin` |
| Verdeckte Eingabe im echten Terminal, zwei Fragen | beide Fragen bedient, Eingabe unsichtbar |
| Abweichende Bestätigung | Abbruch, Hash unverändert |
| Anmeldung mit dem gesetzten Passwort gegen `POST /api/auth/login` | HTTP 200, `mustChangePassword: false` |
| Anmeldung mit dem alten Passwort | HTTP 401 |
| dasselbe mit `--wechsel-erzwingen` | HTTP 200, `mustChangePassword: true` |
