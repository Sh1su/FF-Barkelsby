# FV-4: E-Mail-Infrastruktur

**Status:** ✅ Approved (Relay angebunden und getestet)
**Created:** 2026-08-10
**Last Updated:** 2026-08-10
**Abhängigkeiten:** FV-3 (Lehrgänge und Absagen), Datenmodell `signups` (bereits vorhanden)

## Ziel

Die Anwendung kann E-Mails über ein SMTP-Relay versenden (PRD, Q3). Ohne konfiguriertes Relay läuft
sie vollständig weiter und protokolliert die Mails nur — der Offline-Betrieb bleibt damit intakt.
FV-4 liefert die Infrastruktur und die beiden Mails, für die es schon Auslöser gibt:
**Lehrgangsabsage** und **Terminänderung**. Die übrigen Mails der Matrix hängen an FV-5/FV-6.

## User Stories

- Als Interessent möchte ich erfahren, wenn ein Lehrgang abgesagt oder verschoben wurde, damit ich
  nicht umsonst am Gerätehaus stehe.
- Als Wehrführung möchte ich sehen, ob eine Mail rausgegangen ist, damit ich bei Zweifeln
  nachtelefonieren kann.
- Als Betreiber möchte ich die Anwendung auch ohne Mailserver betreiben können.

## Acceptance Criteria

- [x] **AC-1:** Ohne gesetzten `NUXT_SMTP_HOST` startet und arbeitet die Anwendung normal; jede Mail
      wird mit Status `nicht_versendet` protokolliert und kein Verbindungsversuch unternommen.
- [x] **AC-2:** Mit konfiguriertem Relay wird die Mail übergeben und mit Status `versendet` samt
      Zeitstempel protokolliert.
- [x] **AC-3:** Schlägt der Versand fehl, bleibt der auslösende Vorgang gültig (die Absage ist
      gesetzt); die Mail wird mit Status `fehlgeschlagen` und Fehlertext protokolliert.
- [x] **AC-4:** Jede Mail hat Absender aus der Konfiguration, einen deutschen Betreff und einen
      Textkörper mit Lehrgangstitel, Zeitraum und Absender-Organisation.
- [x] **AC-5:** Die Absage eines Lehrgangs erzeugt genau eine Mail je Interessent mit Status `offen`
      oder `bestätigt`; `abgelehnt` und `storniert` erhalten keine.
- [x] **AC-6:** Eine Änderung von Beginn oder Ende erzeugt je Interessent eine Mail; Änderungen an
      Titel, Beschreibung oder Kapazität lösen keine aus.
- [x] **AC-7:** Empfänger erfahren nichts voneinander — je Empfänger geht eine eigene Mail raus,
      niemals ein gemeinsames CC.
- [x] **AC-8:** `mail_log` enthält Empfänger, Vorlage, Betreff, Status, Fehlertext und Zeitpunkt und
      ist pro Lehrgang auswertbar.
- [x] **AC-9:** Weder SMTP-Passwort noch Zugangsdaten erscheinen in Logs, in `mail_log` oder in
      API-Antworten.
- [x] **AC-10:** Das Absagen antwortet auch dann in normaler Zeit, wenn das Relay nicht erreichbar
      ist (Zeitlimit für den Verbindungsversuch).

## Edge Cases

- Lehrgang ohne Interessenten → keine Mail, kein Fehler
- Interessent mit ungültiger Adresse → nur dieser Versand scheitert, die übrigen laufen weiter
- Absage zurückgenommen → keine automatische „doch wieder da"-Mail in v1 (bewusst)
- Zwei Absagen hintereinander → die zweite ist kein Statuswechsel und erzeugt keine zweite Mail
- Relay antwortet langsam → Zeitlimit greift, Vorgang bleibt gültig

## Tech Design

### Database Schema (Drizzle / SQLite)

```ts
mailLog = sqliteTable('mail_log', {
  id, courseId (nullable, set null), signupId (nullable),
  recipient, template, subject,
  status: 'versendet' | 'nicht_versendet' | 'fehlgeschlagen',
  error, sentAt, createdAt, updatedAt,
})
```
Migration: `0001_mail_log.sql`

### Bausteine

- `server/utils/mailer.ts` – Transport aus `runtimeConfig`, `isMailEnabled()`, `sendMail()` mit
  Zeitlimit; kapselt nodemailer vollständig
- `server/services/mail.service.ts` – Vorlagen und Versandlogik
  (`sendCourseCancelled`, `sendCourseRescheduled`), schreibt `mail_log`
- `shared/mail-templates.ts` – reine Funktionen `renderCourseCancelled(...)` → `{ subject, text }`,
  ohne Seiteneffekte und damit direkt testbar

### Neue Abhängigkeit

`nodemailer` – De-facto-Standard für SMTP in Node, keine Laufzeitabhängigkeit zu einem SaaS.
Alternative wäre ein selbstgeschriebener SMTP-Client; das wäre mehr Risiko als Nutzen.

### Umgebungsvariablen

Bereits in `.env.example` vorbereitet: `NUXT_SMTP_HOST`, `NUXT_SMTP_PORT`, `NUXT_SMTP_USER`,
`NUXT_SMTP_PASSWORD`, `NUXT_SMTP_FROM`, `NUXT_PUBLIC_BASE_URL`.

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/unit/mail-templates.spec.ts` | AC-4 |
| `tests/unit/mailer.spec.ts` | AC-1, AC-9 |
| `tests/api/admin.courses.mail.spec.ts` | AC-1, AC-3, AC-5, AC-6, AC-7, AC-8, AC-10 |

---

## Implementierungsnotizen (2026-08-10)

**Gebaut:** `mail_log`-Tabelle (Migration `0001_mail_log.sql`), SMTP-Versand über nodemailer,
Vorlagen für Absage und Terminänderung, Auslöser in `transitionCourse` und `updateCourse`,
Mailprotokoll je Lehrgang als API-Route und als Panel in der Bearbeitungsseite.

**Entscheidungen:**

1. **Der Name der Wehr wandert nach `runtimeConfig.public.organisation`.** `useAppConfig()` steht
   im Nitro-Server nicht zuverlässig zur Verfügung, und die Angabe soll ohnehin per
   Umgebungsvariable austauschbar sein (PRD, Q27). Die Oberfläche liest jetzt dieselbe Quelle.
2. **Der Versand blockiert nichts.** `notifyCourseRecipients` wirft nie; jeder Versuch landet im
   Protokoll. Verbindungs-, Begrüßungs- und Socket-Zeitlimit stehen auf 10 Sekunden.
3. **Ein Empfänger, eine Nachricht** – kein Sammel-CC, damit die Angehörigen der Wehr nicht
   gegenseitig ihre Adressen sehen.
4. **Testversand als eigenes Skript:** `npm run mail:test -- name@example.org` prüft das Relay,
   ohne die Anwendung zu starten.

**Relay-Anbindung (Nutzerangabe vom 2026-08-10):** zunächst Gmail als Übergang, später IONOS mit
eigener Domain. Beide sind reine SMTP-Relays und brauchen keine Codeänderung – nur Werte in `.env`.
Die Vorlagen für beide stehen in `.env.example`. Für Gmail ist ein App-Passwort nötig
(Zwei-Faktor-Anmeldung vorausgesetzt), und der Absender muss die eigene Gmail-Adresse sein.
Für IONOS ist der Benutzername die vollständige Postfachadresse; SPF und DKIM sollten aktiv sein.

**Relay verifiziert am 2026-08-10:** Testversand über Gmail (`smtp.gmail.com:587`) erfolgreich
zugestellt (`npm run mail:test`). Ab sofort gehen Absage- und Verschiebungsmails real raus –
eine Absage in der Verwaltung erreicht die Interessenten also tatsächlich.

**Noch offen:** Umstellung auf IONOS mit eigener Domain. Dafür sind nur die fünf `NUXT_SMTP_*`-Werte
zu tauschen; zusätzlich sollten SPF und DKIM der Domain aktiviert werden, damit die Nachrichten
nicht im Spam landen. Kein Codeänderungsbedarf.

## Tests

165 Vitest-Tests insgesamt, davon für FV-4: 8 Unit-Tests (Vorlagen, Konfiguration),
10 API-Tests ohne Relay, 3 API-Tests gegen ein absichtlich totes Relay.
