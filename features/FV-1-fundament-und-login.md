# FV-1: Fundament & Login-Gate

**Status:** ✅ Approved (QA bestanden, noch nicht deployed)
**Created:** 2026-08-10
**Last Updated:** 2026-08-10 (Implementierung)
**Abhängigkeiten:** keine (erstes Feature)

## Ziel

Das Projektgerüst (Nuxt 4, Drizzle/SQLite, Nuxt UI mit Design-Tokens, Testaufbau) steht, und vor der
gesamten Anwendung liegt ein Login-Gate. Es gibt genau zwei Kontotypen: ein geteiltes **Gast-Konto**
für die Angehörigen der Wehr und persönliche **Admin-Konten** für die Wehrführung.

## User Stories

- Als Angehöriger der Wehr möchte ich mich mit den ausgehängten Zugangsdaten anmelden, um die
  Lehrgänge zu sehen, ohne ein eigenes Konto anlegen zu müssen.
- Als Wehrführung möchte ich mich mit meinen persönlichen Zugangsdaten anmelden, um in die Verwaltung
  zu gelangen.
- Als Betreiber möchte ich, dass ohne Anmeldung keine Seite und keine Schnittstelle erreichbar ist,
  weil der Server öffentlich im Internet steht.

## Acceptance Criteria

- [x] **AC-1:** Der Aufruf einer beliebigen Seite ohne gültige Session leitet auf `/login` um; API-Routen
      antworten mit 401.
- [x] **AC-2:** Anmeldung mit korrekten Gast-Zugangsdaten führt auf die Lehrgangsübersicht `/`.
- [x] **AC-3:** Anmeldung mit korrekten Admin-Zugangsdaten führt direkt auf `/verwaltung`.
- [x] **AC-4:** Falsche Zugangsdaten erzeugen die generische Meldung „E-Mail oder Passwort ist falsch" –
      unabhängig davon, ob das Konto existiert.
- [x] **AC-5:** Ab dem 11. Fehlversuch derselben IP innerhalb von 15 Minuten antwortet
      `POST /api/auth/login` mit 429; ein erfolgreicher Login setzt den Zähler zurück.
- [x] **AC-6:** Kein Konto wird jemals gesperrt – auch nicht nach beliebig vielen Fehlversuchen
      (Schutz gegen Aussperren der gesamten Wehr).
- [x] **AC-7:** Passwörter liegen ausschließlich als scrypt-Hash in der Datenbank; weder Klartext noch
      Hash erscheinen in Logs oder API-Antworten.
- [x] **AC-8:** Die Gast-Session gilt 30 Tage, die Admin-Session 8 Stunden; nach Ablauf greift AC-1.
- [x] **AC-9:** Beim ersten Start legt der Seed genau ein Gast- und ein Admin-Konto aus den
      Umgebungsvariablen an; ein erneuter Start ändert bestehende Konten nicht (idempotent).
- [x] **AC-10:** Solange das Admin-Passwort noch dem Startwert aus der Umgebungsvariable entspricht,
      leitet jede Seite außer `/passwort-aendern` und `/login` dorthin um.
- [x] **AC-11:** Ein Gast-Konto erhält auf jeder `/api/admin/**`-Route 403.
- [x] **AC-12:** Abmelden verwirft die Session serverseitig; ein anschließender Seitenaufruf greift AC-1.
- [x] **AC-13:** Passwörter unter 12 Zeichen weist der Server mit 400 zurück.
- [x] **AC-14:** `GET /api/health` ist ohne Anmeldung erreichbar und prüft die Datenbankverbindung.

## Edge Cases

- Sessioncookie manipuliert oder abgelaufen → wie „nicht angemeldet", keine Fehlermeldung mit Details
- Gleiche IP hinter Reverse Proxy → Client-IP wird aus `x-forwarded-for` gelesen, aber nur wenn der
  Proxy als vertrauenswürdig konfiguriert ist; sonst Socket-IP
- Admin ruft `/login` auf, obwohl er angemeldet ist → Weiterleitung auf `/verwaltung`
- Fehlende Pflicht-Umgebungsvariablen (`NUXT_SESSION_PASSWORD`, Startpasswörter) → Abbruch beim Start
  mit klarer Meldung, nicht mit stillem Default
- Zwei parallele Anmeldungen mit demselben Gast-Konto → beide gültig, das Konto ist bewusst geteilt

## Tech Design

### Database Schema (Drizzle / SQLite)

```ts
users = sqliteTable('users', {
  id: text('id').primaryKey(),                       // UUID
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['guest', 'admin'] }).notNull(),
  displayName: text('display_name').notNull(),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
  deactivatedAt: integer('deactivated_at', { mode: 'timestamp' }),
  createdAt, updatedAt,
})
```

Migration: `0000_init_users.sql`

### API Routes (Nitro)

| Route | Auth | Zweck |
|-------|------|-------|
| `POST /api/auth/login` | öffentlich (rate-limited) | Anmeldung, setzt Session |
| `POST /api/auth/logout` | angemeldet | Session verwerfen |
| `POST /api/auth/password` | angemeldet | eigenes Passwort ändern |
| `GET /api/health` | öffentlich | Healthcheck für Docker |

Server-Middleware `server/middleware/auth.ts` sperrt alles außer der obigen Ausnahmeliste.
Rollenprüfungen zentral in `server/utils/authorization.ts` (`requireAdmin`, `requireAuth`).

### Component Architecture (Nuxt)

```
app/layouts/gast.vue          – Kopfzeile Wehr + Admin-Link
app/layouts/admin.vue         – Kopfzeile Verwaltung + Tabs + Abmelden
app/pages/login.vue           – wiederverwendeter Design-Screen „Admin-Anmeldung"
app/pages/passwort-aendern.vue
app/middleware/auth.global.ts – Client-seitige Weiterleitung (UX, nicht die Absicherung)
```

### Design-Tokens

Aus dem Design übernommen: `#131C2C` (Navy), `#C1121F` (Rot), `#F6F7F9` (Grund), `#0F172A` (Text),
`#E2E8F0` (Rahmen), Fokusring `#93B4F5`. Schrift IBM Plex Sans, lokal als woff2 unter
`public/fonts/` – kein Abruf von Google Fonts.

### Umgebungsvariablen

| Variable | Pflicht | Zweck |
|----------|---------|-------|
| `NUXT_SESSION_PASSWORD` | ja | Versiegelung des Session-Cookies (min. 32 Zeichen) |
| `NUXT_ADMIN_EMAIL` | ja | E-Mail des Erst-Admins |
| `NUXT_ADMIN_PASSWORD` | ja | Startpasswort des Erst-Admins (Wechsel erzwungen) |
| `NUXT_GUEST_EMAIL` | ja | Kennung des Gast-Zugangs |
| `NUXT_GUEST_PASSWORD` | ja | Startpasswort des Gast-Zugangs |
| `NUXT_DB_PATH` | nein | Standard `/data/app.db`, lokal `./data/app.db` |

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/api/auth.login.spec.ts` | AC-2 bis AC-6 |
| `tests/api/auth.session.spec.ts` | AC-1, AC-7, AC-8, AC-12, AC-13, AC-14 |
| `tests/api/authorization.matrix.spec.ts` | AC-1, AC-11 |
| `tests/unit/password.spec.ts` | AC-7 |
| `tests/unit/rate-limit.spec.ts` | AC-5, AC-6 |
| `tests/unit/seed.spec.ts` | AC-9, AC-10 |
| `tests/e2e/login.spec.ts` | AC-1 bis AC-4, AC-10, AC-11, AC-12 |

---

## Implementierungsnotizen (2026-08-10)

**Gebaut:** Projektgerüst (Nuxt 4.5, Nuxt UI 4, Drizzle/better-sqlite3, Vitest, Playwright),
Login-Gate mit Gast- und Admin-Konto, Rate Limit, erzwungener Passwortwechsel, Healthcheck.

**Migration:** `server/assets/migrations/0000_init.sql` (Tabellen `users`, `revoked_sessions`,
`instructors`, `courses`, `course_days`, `signups`).

**Abweichungen und Ergänzungen gegenüber der Spec:**

1. **Serverseitige Sperrliste für Sessions (`revoked_sessions`).** Der erste Test zu AC-12 war rot:
   `clearUserSession` löscht nur das Cookie im Browser – wer den Cookie-Wert kopiert hat, blieb
   angemeldet. `.claude/rules/security.md` verlangt aber ein serverseitiges Verwerfen. Jede Session
   hat jetzt eine `sid`, die beim Abmelden in `revoked_sessions` landet und in
   `server/middleware/auth.ts` sowie im `fetch`-Hook von nuxt-auth-utils geprüft wird. Bewusst pro
   Session und nicht pro Konto: das Gast-Konto ist geteilt, ein kontoweites Verwerfen würde die
   ganze Wehr abmelden.
2. **Eigener Migrator statt `drizzle-orm/migrator`.** Der Produktionsbuild fand die
   Migrationsdateien nicht (`Can't find meta/_journal.json`), weil der gebündelte Nitro-Server kein
   Dateisystem-Layout des Projekts mehr hat – im Container wäre derselbe Fehler aufgetreten. Die
   Migrationen liegen deshalb unter `server/assets/migrations` und werden über den
   Nitro-Asset-Storage gelesen (`server/database/migrate.ts`).
3. **Passwort-Hashing als eigene Hülle um `node:crypto`** (`server/utils/password.ts`), weil Seed
   und Unit-Tests ohne Nitro-Auto-Imports laufen. Format `scrypt$<salt>$<hash>`.
4. **Rate Limit liest `x-forwarded-for`**, weil die Anwendung hinter einem Reverse Proxy läuft
   (PRD, Q2). Ohne vertrauenswürdigen Proxy davor ließe sich das Limit durch einen gefälschten
   Header umgehen – der Proxy muss den Header also setzen und nicht durchreichen.

**Tests:** 8 API-Tests Anmeldung, 8 API-Tests Session, 15 Autorisierungsmatrix-Fälle,
12 Unit-Tests, 8 E2E-Tests. `npm run verify` grün.

---

## QA Test Results

**Getestet:** 2026-08-10 · **Verfahren:** automatisierte Suiten + Bildstrecke aller Seiten
(`playwright.qa.config.ts`) bei 1440 px und 375 px, visuell gegen `Fortbildungsverwaltung.dc.html`
abgeglichen.

### Acceptance Criteria
AC-1 bis AC-14: bestanden (8 API-Tests Anmeldung, 8 API-Tests Session, 15 Matrixfälle,
12 Unit-Tests, 8 E2E-Tests).

### Gefundene und behobene Fehler

**BUG-1: Alle Bedienelemente waren pillenförmig · Severity: High (Design)**
- Ursache: `--ui-radius` ist in Nuxt UI eine *Basiseinheit*, die intern multipliziert wird
  (md = 1,5×, lg = 2×). Der gesetzte Wert 10px ergab 20px Radius.
- Behoben: `--ui-radius: 0.375rem` → 9px für Knöpfe, 12px für Flächen; Filterchips und Badges
  bewusst als Pillen, weil der Entwurf dort `border-radius: 999px` verwendet.

**BUG-2: Primärfarbe zu hell · Severity: Medium (Design)**
- Nuxt UI nimmt standardmäßig die 500er-Stufe (#E34455); der Entwurf verlangt #C1121F.
- Behoben: `--ui-primary: var(--color-fire-600)`.

**BUG-3: Logo-Kachel rund statt quadratisch · Severity: Low (Design)**
- Behoben: fester Radius von 10px wie im Entwurf.

### Ergebnis
Keine offenen Fehler. `npm run verify` grün, `npm run test:e2e` grün.
