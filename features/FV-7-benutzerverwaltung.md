# FV-7: Benutzerverwaltung

**Status:** 🟢 Approved
**Created:** 2026-08-11
**Last Updated:** 2026-08-11
**Abhängigkeiten:** FV-1 (Konten, Sessions, Passwort-Hashing)

## Ziel

Der dritte Tab der Verwaltung: die Wehrführung pflegt den geteilten Gast-Zugang und die
Admin-Konten selbst, ohne an die Umgebungsvariablen des Servers zu müssen. Das war die Bedingung
aus der Abstimmung (Q9/Q17) — inklusive der Regel, dass sich niemand versehentlich selbst
aussperren kann.

## User Stories

- Als Wehrführung möchte ich das Gast-Passwort wechseln können, wenn es zu weit herumgekommen ist.
- Als Wehrführung möchte ich eine Vertretung als zweiten Admin anlegen.
- Als Wehrführung möchte ich ein Konto deaktivieren können, wenn jemand die Wehr verlässt.
- Als Betreiber möchte ich sicher sein, dass immer mindestens ein Admin handlungsfähig bleibt.

## Acceptance Criteria

- [x] **AC-1:** Der dritte Tab listet alle Konten mit Kennung, Rolle, Zustand (aktiv/deaktiviert)
      und dem Hinweis, ob noch das Startpasswort gilt.
- [x] **AC-2:** Ein Admin kann ein weiteres Admin-Konto mit Kennung und Startpasswort anlegen;
      das neue Konto muss beim ersten Anmelden das Passwort wechseln.
- [x] **AC-3:** Ein Admin kann das Passwort des Gast-Zugangs ändern; danach gilt sofort das neue.
- [x] **AC-4:** Ein Admin kann die Kennung (E-Mail) des Gast-Zugangs ändern.
- [x] **AC-5:** Ein Admin kann andere Admin-Konten deaktivieren und wieder aktivieren.
- [x] **AC-6:** Der letzte aktive Admin kann nicht deaktiviert werden — auch nicht von sich selbst
      (422 mit Erklärung).
- [x] **AC-7:** Das Gast-Konto kann weder deaktiviert noch gelöscht werden (422); nur seine
      Zugangsdaten ändern sich.
- [x] **AC-8:** Eine bereits vergebene Kennung wird mit 409 abgelehnt.
- [x] **AC-9:** Ein deaktiviertes Konto kann sich nicht mehr anmelden, **und** seine bestehenden
      Sitzungen gelten sofort nicht mehr.
- [x] **AC-10:** Passwörter unter 12 Zeichen werden mit 400 abgelehnt; Hashes erscheinen niemals in
      einer API-Antwort.
- [x] **AC-11:** Alle Routen sind Admin-only (401 ohne Anmeldung, 403 als Gast).
- [x] **AC-12:** Setzt ein Admin das Passwort eines anderen Kontos, muss dieses Konto es beim
      nächsten Anmelden wechseln.

## Edge Cases

- Ein Admin deaktiviert sich selbst, obwohl ein zweiter aktiv ist → erlaubt, er fliegt sofort raus
- Zwei Admins deaktivieren sich gleichzeitig gegenseitig → die Prüfung zählt aktive Admins bei
  jedem Schreibvorgang neu, einer der beiden Versuche scheitert mit 422
- Gast-Passwort geändert, während Angehörige angemeldet sind → bestehende Sitzungen bleiben gültig
  (bewusst: sonst fliegt die halbe Wehr mitten in der Woche raus), neue Anmeldungen brauchen das
  neue Passwort
- Kennung mit anderer Groß-/Kleinschreibung → gilt als dieselbe Kennung

## Tech Design

### API Routes (Nitro)

| Route | Auth | Zweck |
|-------|------|-------|
| `GET /api/admin/users` | admin | Kontenliste ohne Hashes |
| `POST /api/admin/users` | admin | weiteres Admin-Konto anlegen |
| `PATCH /api/admin/users/:id` | admin | Kennung, Passwort oder Zustand ändern |

### Bausteine

- `server/services/user-admin.service.ts` — Liste, Anlegen, Ändern, Schutzregeln
- Schutzregeln als reine Funktionen (`darfDeaktivieren`), damit sie ohne HTTP prüfbar sind
- `server/middleware/auth.ts` prüft zusätzlich, ob das Konto der Sitzung noch existiert und aktiv
  ist — sonst bliebe eine laufende Sitzung nach dem Deaktivieren bis zu acht Stunden gültig

### Component Architecture

```
app/pages/verwaltung/index.vue
└── admin/UserRegistry.vue   – Kontenliste, Anlegen-Dialog, Passwort- und Zustandsaktionen
```

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/unit/user-rules.spec.ts` | AC-6, AC-7 |
| `tests/api/admin.users.spec.ts` | AC-1 bis AC-12, dazu BUG-7-3, BUG-7-4 und BUG-7-5 |
| `tests/api/authorization.matrix.spec.ts` | AC-11 (alle drei Routen gegen jede Rolle) |
| `tests/components/UserRegistry.spec.ts` | AC-1, AC-2, AC-5 bis AC-7, AC-10 – Zustände der Komponente |
| `tests/visual/verwaltung.layout.spec.ts` | AC-1, AC-3, AC-10 – Größen, Überlappung, verdecktes Passwort |
| `tests/e2e/04-benutzerverwaltung.spec.ts` | AC-1, AC-3, AC-12 |

## Umsetzungsnotizen

**Stand 2026-08-11 – implementiert, `npm run verify` grün.**

Keine Migration nötig: die Spalte `users.deactivated_at` steht schon seit `0000_init` im Schema,
FV-7 füllt sie erstmals.

Abweichungen und Entscheidungen gegenüber der Spec:

- Die E2E-Abdeckung liegt in einer eigenen Datei `tests/e2e/04-benutzerverwaltung.spec.ts` statt in
  `02-verwaltung.spec.ts`. Grund: Playwright arbeitet die Dateien alphabetisch gegen **eine**
  Datenbank ab, und der Test fasst das Gast-Passwort an. In der eigenen Datei am Ende der Reihe
  stört das niemanden; der Test stellt den Ausgangszustand über den erzwungenen Wechsel selbst
  wieder her.
- `countActiveAdmins()` zählt ohne Ausnahmeparameter: beim Deaktivieren zählt das eigene Konto mit,
  `<= 1` ist deshalb genau die Grenze „danach wäre keiner mehr übrig".
- Der Gast-Zeile fehlt die Deaktivieren-Schaltfläche vollständig (statt sie zu zeigen und den
  Fehler erst vom Server zu holen). Die Server-Regel greift trotzdem – die Oberfläche ist nur
  Bequemlichkeit, geprüft wird in `updateAccount`.
- Beim Ändern eines fremden Passworts wird `mustChangePassword` gesetzt (AC-12). Das wirkt auf die
  **nächste** Anmeldung; eine bereits laufende Sitzung des betroffenen Kontos behält ihr Recht,
  weil `mustChangePassword` in der Session steckt. Bewusst so: sonst müsste jede Anfrage zusätzlich
  das Konto neu laden.
- Fund während der Umsetzung: der API-Test zu AC-6 deaktivierte alle Admins ab Listenposition 2 –
  und traf damit das Konto der Testsitzung selbst, das durch die neue Prüfung in
  `server/middleware/auth.ts` sofort ausgesperrt wurde (401 statt 404/422). Der Test deaktiviert
  jetzt gezielt alle **anderen** Admins. Das Verhalten der Anwendung war korrekt, der Testaufbau
  nicht.

## QA-Ergebnis (2026-08-11)

**Urteil: keine kritischen und keine schwerwiegenden Befunde.** Gefunden wurden zwei mittlere und
vier leichte Befunde; **alle sechs sind am 2026-08-11 behoben** – siehe „Behebung der QA-Befunde"
weiter unten. Die Befundbeschreibungen bleiben als Fundstelle stehen.

### Durchgeführte Prüfungen

| Prüfung | Ergebnis |
|---------|----------|
| 12 Acceptance Criteria automatisiert | 12/12 bestanden |
| Gesamte Vitest-Suite (Regression FV-1 bis FV-11) | 258/258 grün |
| Playwright E2E + visuell | 33/33 grün |
| Lückenprüfung `scripts/check-coverage-gaps.ts` | keine Lücken, 92 AC über 8 Features |
| Abgeschwächte, übersprungene oder gelöschte Tests | keine (`git diff` auf `tests/`, kein `.skip`/`.only` im Bestand) |

### Sicherheitsaudit

Alle Prüfungen gegen die laufende API, Admin- und Gast-Sitzung sowie ohne Anmeldung:

| Angriff | Ergebnis |
|---------|----------|
| Rolle über den Request-Body setzen (`role: 'guest'` bei POST und PATCH) | abgewehrt, Zod verwirft das Feld, Rolle bleibt `admin` |
| `mustChangePassword`, `id`, `deactivatedAt` über den Body setzen | abgewehrt, serverseitig vergeben |
| Passwort-Hashes in Antworten | keine; die Antwort trägt nur id, email, role, displayName, mustChangePassword, createdAt, active |
| Zugriff ohne Anmeldung / als Gast | 401 bzw. 403 auf allen drei Routen (Autorisierungsmatrix) |
| SQL-Payload als Konto-ID (`' OR 1=1--`) | 404, keine Auswertung – Drizzle bindet Parameter |
| 500 Zeichen lange Konto-ID | 400 durch `userIdSchema` |
| Kaputtes JSON im Rumpf | 400; **im Produktionsbuild kein Stacktrace** in der Antwort (im Dev-Server schon – das ist Nitro-Standard und verlässt den Rechner nicht) |
| Skript-Payload im Namen | wird roh gespeichert und von Vue escaped; kein `v-html` in der gesamten Oberfläche |
| Konto löschen | keine DELETE-Route vorhanden (404) – AC-7 auch von dieser Seite erfüllt |
| Kennung mit Leerzeichen und Großschreibung | normalisiert zu Kleinschreibung, überlange Kennung 400 |

### Befunde

**BUG-7-1 (mittel) – Schaltflächen in der Kontenliste sind 28 px hoch.**
`.claude/rules/testing.md` verlangt Touch-Ziele von mindestens 44 px bei 375 px Breite. Gemessen:
`user-password`, `user-kennung`, `user-toggle` je 28 px, `user-new` 32 px. Zum Vergleich: der
Kalendertab liegt bei 32 px (`admin-new-course`), die öffentliche Übersicht hält die 44 px ein.
Der Verwaltungsbereich weicht also schon vorher ab, FV-7 setzt mit `size="sm"` den kleinsten Wert
im Projekt. *Reproduktion:* /verwaltung → Tab Benutzerverwaltung bei 375 px, `boundingBox().height`
der drei Zeilenschaltflächen. *Regressionstest fehlt:* Layout-Invariante für den Verwaltungsbereich
analog `tests/visual/katalog.layout.spec.ts`.

**BUG-7-2 (mittel) – keine Komponenten- und Layouttests für `UserRegistry.vue`.**
`.claude/rules/testing.md` verlangt je Komponente die Zustände leer, ladend, Fehler, gefüllt sowie
Layout-Invarianten je Breakpoint. Vorhanden sind nur API-, Unit- und zwei E2E-Tests. Dieselbe Lücke
hat `SignupRegistry.vue` aus FV-6 – im Projekt existiert bislang genau ein Komponententest
(`tests/components/CourseCard.spec.ts`). Kein Funktionsfehler, aber die Zustände der Kontenliste
sind derzeit nur über den Durchstich abgesichert.

**BUG-7-3 (leicht) – `/api/_auth/session` meldet ein deaktiviertes Konto weiter als angemeldet.**
Die Aktiv-Prüfung in `server/middleware/auth.ts` steht hinter dem `isPublicApiRoute`-Ausstieg, und
der Session-Endpunkt ist öffentlich. Folge: nach dem Deaktivieren wirkt die Oberfläche weiter
angemeldet, bis die erste Datenabfrage mit 401 scheitert – statt sauberer Rückleitung zur Anmeldung
sieht die Person Fehlermeldungen. Sicherheitlich unkritisch, alle echten Routen sind gesperrt.

**BUG-7-4 (leicht) – wer sein eigenes Passwort über die Kontenliste setzt, muss es beim nächsten
Anmelden erneut wechseln.** `updateAccount` setzt `mustChangePassword` bei jedem Passwortwechsel,
auch beim eigenen Konto. Belegt: nach dem Setzen antwortet `/api/auth/login` mit
`mustChangePassword: true`. AC-12 verlangt das nur für *andere* Konten. Für den eigenen Wechsel gibt
es ohnehin `/passwort-aendern`.

**BUG-7-5 (leicht) – `GET /api/admin/users` hat weder Pagination noch Limit.**
`.claude/rules/backend.md`: „Alle Listen-Endpunkte sind paginiert und haben ein hartes Limit
(Default 25, Max 100)". Praktisch harmlos, weil die Tabelle ein Gast-Konto plus eine Handvoll
Admins enthält. Präzedenz im Projekt: `courses` und `instructors` sind ebenfalls unpaginiert,
`signups` hält die Regel ein.

**BUG-7-6 (leicht, Rückfrage) – Startpasswort und neues Passwort stehen im Klartext auf dem
Bildschirm** (`type="text"` in beiden Dialogen). Vermutlich Absicht, weil die Wehrführung das
Passwort weitergeben muss. Sollte bewusst bestätigt werden – wer im Gerätehaus am Beamer arbeitet,
zeigt es dem ganzen Raum.

### Nicht FV-7 anzulasten (bei der Prüfung mitgefunden)

- **`/verwaltung` scrollt bei 375 px horizontal** (Dokumentbreite 441 px statt 375 px). Ursache ist
  die Tab-Leiste, nicht die Kontenliste: der Wert ist auf allen drei Tabs identisch, die Tabelle
  selbst scrollt sauber in ihrem eigenen Container. Die öffentliche Übersicht hält 375 px ein.
  Gehört zu FV-3.
- **Playwright fährt nur Desktop Chrome bei 1440 px.** Die QA-Vorgabe verlangt Firefox und Safari
  sowie 375/768/1440 als eigene Projekte. Betrifft das gesamte Projekt.
- **Container- und Backup-Prüfungen entfallen**: es gibt `ops/docker-compose.yml` und die
  Backup-Skripte, aber kein `Dockerfile` im Repo-Wurzelverzeichnis. Gehört zu FV-9 (Roadmap).

## Behebung der QA-Befunde (2026-08-11)

Alle sechs Befunde behoben, jeder mit einem Test abgesichert, der ohne den Fix fehlschlägt.

| Befund | Behebung | Test |
|--------|----------|------|
| BUG-7-1 Touch-Ziele 28 px | `min-h-11` (44 px) auf allen Schaltflächen und Eingabefeldern der Kontenliste und ihrer Dialoge – dieselbe Machart wie in `CourseFilterBar.vue` | `tests/visual/verwaltung.layout.spec.ts` |
| BUG-7-2 keine Komponententests | `tests/components/UserRegistry.spec.ts` mit acht Fällen; dafür hat die Komponente jetzt die fehlenden Zustände Laden, Fehler und Leer bekommen (`.claude/rules/frontend.md`) | ebenda + Layouttest |
| BUG-7-3 Session-Endpunkt meldet deaktiviertes Konto | Aktiv-Prüfung wandert in den bestehenden Block für abgelaufene und abgemeldete Sitzungen, also **vor** den Ausstieg für öffentliche Routen | `admin.users.spec.ts` „AC-9: … Session-Endpunkt" |
| BUG-7-4 Zwangswechsel beim eigenen Passwort | `updateAccount` bekommt die ID des handelnden Kontos; `mustChangePassword` wird nur für fremde Konten gesetzt | `admin.users.spec.ts` „AC-12: wer sein eigenes Passwort setzt …" |
| BUG-7-5 Liste ohne Limit | `page`/`limit` wie bei `signups` (Default 25, Max 100), Antwort trägt jetzt `items`, `total`, `page`, `limit` | `admin.users.spec.ts` „AC-1: … seitenweise …" |
| BUG-7-6 Passwörter im Klartext | Beide Felder starten als `type="password"` mit einem Augen-Schalter zum bewussten Einblenden | Komponenten- und Layouttest |

### Zwei Fallstricke beim Messen (BUG-7-1)

Der Layouttest fiel anfangs mit 41,8 px statt 44 px durch, obwohl das Feld korrekt
`min-height: 44px` hatte. Ursache war der Dialog selbst: er fährt von `scale-95` auf `scale-100`
hoch, und `boundingBox()` misst die **transformierte** Größe – wer sofort nach dem Öffnen misst,
sieht 95 % der Höhe. Der Test wartet jetzt mit `expect.poll`, bis der Wert steht. Kein Fehler in
der Komponente, sondern im Testaufbau.

Die Eingabefelder haben zusätzlich `size="lg"` bekommen. Das war nicht die Behebung von BUG-7-1
(`min-h-11` allein genügte), sondern folgt `CourseFilterBar.vue`: 16 px Schriftgröße verhindern
das automatische Hineinzoomen von iOS beim Antippen eines Feldes.

### Ein Fund bei der Behebung von BUG-7-3

Die Aktiv-Prüfung allein genügte nicht. `clearUserSession()` wirft nur den zwischengespeicherten
Zustand weg und setzt einen leeren Cookie in die **Antwort** – liest danach noch jemand im selben
Request die Sitzung, entsiegelt h3 den unveränderten Cookie aus der **Anfrage** erneut, und die
gerade verworfene Sitzung ist wieder da. Genau das tut der Endpunkt `/api/_auth/session`.

Deshalb gibt es `server/utils/session-cookie.ts`: `forgetRequestSessionCookie()` streicht den
Sitzungs-Cookie aus den Anfrage-Headern, bevor die Middleware weiterläuft.

Abgrenzung, gegengeprüft durch Abschalten des Fixes: betroffen war **nur** der Fall des
deaktivierten Kontos. Abmelden (FV-1, AC-12) und Ablauf meldeten auch vorher korrekt kein Konto
mehr – die entsprechenden Tests bleiben grün, wenn man `forgetRequestSessionCookie()` entfernt.

### Auswirkung auf andere Stellen

- Die Antwort von `GET /api/admin/users` hat sich von `{ items }` auf
  `{ items, total, page, limit }` geändert. Einziger Aufrufer ist `UserRegistry.vue`; er fragt
  jetzt mit `limit: 100` an, damit die Liste vollständig bleibt.
- `server/middleware/auth.ts` fragt weiterhin einmal je Anfrage den Kontozustand ab, jetzt auch für
  die öffentlichen Routen, sofern eine Sitzung mitgeschickt wird. Bei SQLite auf derselben Maschine
  ist das eine Primärschlüsselabfrage und fällt nicht ins Gewicht.
