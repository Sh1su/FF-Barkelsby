# FV-16: Mitgliedskonten anlegen & Zugangsdaten verteilen

**Status:** ✅ Approved (QA bestanden, noch nicht deployed)
**Created:** 2026-09-12
**Abhängigkeiten:** FV-15 (Rollenmodell `member`/`admin`), FV-7 (Benutzerverwaltung, dritter
Verwaltungstab). Schaltet FV-19 (Admin-Matrix) mit frei.

## Ziel

Die Wehrführung kann über die bestehende Benutzerverwaltung persönliche Mitgliedskonten anlegen
und die Zugangsdaten einmalig einsehen, um sie dem Mitglied mitzuteilen (persönlich, telefonisch
– nicht per Mail im Klartext). Ergänzt FV-15 um den fehlenden Baustein: FV-15 hat das Rollenmodell
umgestellt, aber keinen Weg geschaffen, tatsächlich neue `member`-Konten anzulegen (nur der
FV-15-Seed liefert bislang genau eines).

## User Stories

- Als Wehrführung möchte ich für ein neues Mitglied ein persönliches Konto anlegen, ohne die
  Kennung selbst zu vergeben – nur die E-Mail-Adresse und den Namen des Mitglieds eintragen.
- Als Wehrführung möchte ich das erzeugte Startpasswort einmalig sehen, um es dem Mitglied
  mitzuteilen – ein zweites Mal soll es nirgends abrufbar sein.
- Als Wehrführung möchte ich Mitglieder- und Verwaltungskonten in der Liste unterscheiden können.

## Acceptance Criteria

- [x] **AC-1:** `POST /api/admin/members` (nur Admin, 401/403 wie die übrigen Admin-Routen) legt
      ein Konto mit `email` und `displayName` an; die Rolle wird serverseitig fest auf `member`
      gesetzt und lässt sich nicht über den Request-Body umbiegen (dieselbe Regel wie bei
      `POST /api/admin/users` für `admin`, aber als eigene Route – kein gemeinsamer `role`-Parameter
      auf einer der beiden Routen).
- [x] **AC-2:** Wird kein `password` mitgeschickt, erzeugt der Server ein zufälliges Startpasswort
      (mindestens `PASSWORD_MIN_LENGTH` Zeichen) und gibt es **einmalig** in der Antwort zurück
      (`generatedPassword`); es wird an keiner weiteren Stelle gespeichert oder später erneut
      ausgegeben. Wird ein `password` mitgeschickt, gilt dasselbe Mindestlängen-Validierung wie bei
      `POST /api/admin/users`, und die Antwort enthält kein `generatedPassword`-Feld.
- [x] **AC-3:** Ein neu angelegtes Mitgliedskonto hat `mustChangePassword: true` (wie bei
      `POST /api/admin/users`).
- [x] **AC-4:** Eine bereits vergebene Kennung wird mit 409 abgelehnt (dieselbe Regel wie bei
      `POST /api/admin/users`).
- [x] **AC-5:** `GET /api/admin/users` akzeptiert einen optionalen Query-Parameter `role`
      (`member` oder `admin`) und filtert die Liste entsprechend; ohne den Parameter ändert sich
      nichts am bisherigen Verhalten (FV-7).
- [x] **AC-6:** Der dritte Verwaltungstab hat eine zweite Schaltfläche „Mitglied anlegen" neben
      „Admin anlegen"; deren Dialog fragt nur Kennung und Name ab (kein Passwortfeld – das
      Startpasswort wird immer serverseitig erzeugt).
- [x] **AC-7:** Nach dem Anlegen eines Mitgliedskontos zeigt die Oberfläche das erzeugte
      Startpasswort einmalig in einem eigenen Dialog (Kennung + Passwort, verdeckt mit
      Einblenden-Schalter wie beim bestehenden Passwortfeld), der erst nach ausdrücklicher
      Bestätigung schließt; die Kontenliste wird danach aktualisiert.
- [x] **AC-8:** Die Kontenliste zeigt weiterhin alle Konten (Mitglieder und Admins) zusammen,
      unterscheidbar über das bestehende Rollen-Badge; keine separate Ansicht/Route in dieser
      Spec (Filterung ist nur die API-Fähigkeit aus AC-5, eine UI-Filterung ist nicht Teil dieser
      Spec).

## Edge Cases

- `email` und `displayName` fehlen oder sind ungültig → 400 (Zod, wie bei `createUserSchema`).
- `password` kürzer als `PASSWORD_MIN_LENGTH` mitgeschickt → 400, kein Konto wird angelegt.
- Zwei aufeinanderfolgende Anlage-Vorgänge ohne eigenes Passwort → jedes Mal ein anderes,
  zufälliges Startpasswort (keine Wiederverwendung).
- Netzwerkfehler/Abbruch nach erfolgreicher Anlage, bevor der Dialog mit dem Passwort gesehen
  wurde → das Konto existiert, das Passwort ist nicht mehr abrufbar; Wehrführung muss
  `PATCH /api/admin/users/:id` (bestehende Route, FV-7) nutzen, um ein neues zu setzen. Kein
  Sonderfall dieser Spec, nur dokumentiertes Verhalten.

## Tech Design

- `shared/validation/user.ts`: neues `createMemberSchema` = `{ email, displayName, password?
  }` (Passwort optional, sonst identische Regeln wie `createUserSchema`).
- `server/utils/password.ts`: neue Funktion `generatePassword(length = 20)` – zufällige Zeichen
  aus `randomBytes`, base64url-kodiert, damit sie über `PASSWORD_MIN_LENGTH` liegt und ohne
  Sonderzeichen-Fallstricke kopierbar ist.
- `server/services/user-admin.service.ts`: neue Funktion `createMemberAccount(input: { email,
  displayName, password? })` – wie `createAdminAccount`, aber `role: 'member'` fest codiert;
  erzeugt bei fehlendem `password` eines über `generatePassword()` und gibt
  `{ account: AccountView, generatedPassword?: string }` zurück (nur gesetzt, wenn der Server es
  erzeugt hat). `listAccounts` bekommt einen optionalen `role`-Parameter in `AccountListQuery` und
  filtert per `where(eq(users.role, role))`, wenn gesetzt.
- `server/api/admin/members/index.post.ts` (neu): `requireAdmin`, `createMemberSchema.parse`,
  ruft `createMemberAccount`, Status 201, Antwortkörper `{ ...account, generatedPassword? }`.
- `server/api/admin/users/index.get.ts`: `querySchema` um `role: z.enum(['member',
  'admin']).optional()` erweitern, an `listAccounts` durchreichen.
- UI (`UserRegistry.vue`): zweiter Button „Mitglied anlegen" öffnet einen Dialog mit Kennung und
  Name (kein Passwortfeld); bei Erfolg öffnet sich unmittelbar ein zweiter, nicht wegklickbarer
  Dialog mit der Kennung und dem erzeugten Passwort (gleiche verdeckt/einblenden-Komponente wie
  beim bestehenden Passwortfeld), erst „Verstanden, Dialog schließen" schließt ihn und lädt die
  Liste neu.
- **Nicht Teil dieser Spec:** Voraussetzungen/Berechtigung pro Lehrgang (FV-17), Abschluss-Tracking
  (FV-18), Admin-Matrix (FV-19), Katalog-Sichtbarkeitsfilter (FV-20), Willkommens-E-Mail (bewusst
  weggelassen – ein Klartext-Passwort per Mail wäre ein vermeidbares Risiko, siehe
  `docs/PRD.md`/Architektur-Notizen zu FV-16 in `features/INDEX.md`).

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/api/admin.members.spec.ts` (neu) | AC-1 bis AC-4 |
| `tests/api/admin.users.spec.ts` | AC-5 |
| `tests/components/UserRegistry.spec.ts` | AC-6, AC-7 |
| `tests/e2e/04-benutzerverwaltung.spec.ts` | AC-6, AC-7 |
| `tests/api/authorization.matrix.spec.ts` | Selbst-Check: neue Route muss in der Matrix stehen |

---

## Implementierungsnotizen (2026-09-12)

**Gebaut:** wie in Tech Design beschrieben, ohne Abweichung. Zusätzlich in
`tests/api/authorization.matrix.spec.ts` einen Matrix-Eintrag für `POST /api/admin/members`
ergänzt – die Datei prüft per Selbst-Check, dass jede Route unter `server/api` dort auftaucht,
sonst schlägt die Suite fehl.

Der Anlegen-Dialog für Mitglieder ist bewusst getrennt von dem für Admins (eigener Button, eigenes
Formular ohne Passwortfeld) statt eines gemeinsamen Formulars mit Rollenauswahl – entspricht AC-1
(keine Rolle über den Request-Body) und macht in der Oberfläche sofort sichtbar, dass für
Mitglieder kein Passwort einzutragen ist.

Der Erfolgsdialog mit dem erzeugten Passwort ist über `:dismissible="false"` und `:close="false"`
(Nuxt UI `UModal`) so gebaut, dass er sich nur über den Bestätigen-Button schließen lässt.

**Komponententests:** Der Formular-Submit-Test musste zweimal nachgebessert werden – Nuxt UIs
`UModal` rendert seinen Inhalt per Teleport außerhalb des Komponenten-Wrappers, `component.find()`
findet dort nichts (deshalb wie in den bestehenden Tests `document.querySelector` verwenden);
und der Request gegen den gemockten Endpunkt braucht `vi.waitFor(...)` statt `flushPromises()`,
weil `registerEndpoint` einen echten (Test-)HTTP-Roundtrip macht.

**Tests:** `npm run verify` grün – 33 Testdateien, 366 Vitest-Tests, keine Abdeckungslücken.
`npm run test:e2e` grün (40 Playwright-Tests).

---

## QA Test Results

**Getestet:** 2026-09-12 · `npm run verify` (Lint/Typecheck/366 Vitest-Tests/Lückenprüfung),
`npm run test:e2e` (40 Playwright-Tests).

`/qa` existiert in diesem Repo nicht als Command (siehe FV-13) – dieser Durchgang wurde manuell
im Sinne des in `CLAUDE.md` beschriebenen Workflows durchgeführt.

### Acceptance Criteria
AC-1 bis AC-8: bestanden (siehe Testtabelle oben und automatisierte Läufe).

### Gefundene Befunde
Keine kritischen oder schwerwiegenden Befunde.

### Ergebnis
Keine kritischen oder schwerwiegenden Befunde.
