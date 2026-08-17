# FV-5: Interessensbekundung & Storno

**Status:** ✅ Approved (QA über Bildstrecke, hell und dunkel)
**Created:** 2026-08-10
**Last Updated:** 2026-08-10
**Abhängigkeiten:** FV-2 (Detailseite), FV-4 (Mailversand); Tabelle `signups` liegt bereits vor

## Ziel

Das Herzstück des Entwurfs: Angehörige der Wehr bekunden ihr Interesse an einem Lehrgang mit drei
Feldern — Vorname, Nachname, E-Mail — ohne persönliches Konto. Sie erhalten eine
Eingangsbestätigung mit einem Abmelde-Link, die Wehrführung eine Benachrichtigung.

## User Stories

- Als Angehöriger der Wehr möchte ich mich in unter 15 Sekunden für einen Lehrgang melden, ohne ein
  Konto anzulegen.
- Als Angehöriger der Wehr möchte ich mich wieder abmelden können, wenn ich doch nicht kann.
- Als Wehrführung möchte ich sofort erfahren, wenn sich jemand gemeldet hat.

## Acceptance Criteria

- [x] **AC-1:** Die Detailseite öffnet ein Formular mit genau drei Feldern plus
      Einwilligungs-Checkbox; abgesendet wird mit einem Klick.
- [x] **AC-2:** Eine gültige Anmeldung wird mit Status `offen` gespeichert und mit 201 bestätigt.
- [x] **AC-3:** Ohne gesetzte Einwilligung antwortet der Server mit 400 und speichert nichts.
- [x] **AC-4:** Eine zweite Anmeldung derselben E-Mail für denselben Lehrgang wird mit 409 und einem
      verständlichen Hinweis abgelehnt; nach einem Storno ist eine Neuanmeldung wieder möglich.
- [x] **AC-5:** Auch ein ausgebuchter Lehrgang nimmt Interessensbekundungen an (Warteliste nach
      Eingangsreihenfolge).
- [x] **AC-6:** Ein abgesagter Lehrgang nimmt keine Anmeldung mehr an (422).
- [x] **AC-7:** Nach dem Absenden erhält der Interessent eine Eingangsbestätigung mit Abmelde-Link,
      die Wehrführung eine Benachrichtigung; beide Versuche stehen im Mailprotokoll.
- [x] **AC-8:** Der Abmelde-Link funktioniert **ohne Anmeldung** und setzt die Anmeldung auf
      `storniert`; ein unbekannter oder bereits verbrauchter Token führt zu einer verständlichen
      Seite statt zu einem Fehler.
- [x] **AC-9:** Der Abmelde-Link verrät ohne gültigen Token keine Daten (keine Namen, keine
      Adressen, kein Lehrgangstitel).
- [x] **AC-10:** Die Anmeldung ist rate-limitiert: mehr als 20 Versuche derselben IP in 15 Minuten
      werden mit 429 abgewiesen.
- [x] **AC-11:** Die Belegung auf Karte und Detailseite zählt ab jetzt echte bestätigte Anmeldungen.
- [x] **AC-12:** Die Einwilligung wird mit Zeitpunkt gespeichert (`consentAt`).

## Edge Cases

- Abmelde-Link zweimal geklickt → beim zweiten Mal freundliche Meldung „bereits abgemeldet"
- Anmeldung für einen gelöschten Lehrgang → 404
- Sehr lange Namen → serverseitig auf 80 Zeichen begrenzt, Fehlermeldung im Formular
- E-Mail mit Groß-/Kleinschreibung → wird normalisiert, damit die Dublettenprüfung greift
- Mailversand aus → Anmeldung gilt trotzdem, Mails stehen als `nicht_versendet` im Protokoll

## Tech Design

### API Routes (Nitro)

| Route | Auth | Zweck |
|-------|------|-------|
| `POST /api/courses/:id/signups` | angemeldet (Gast reicht) | Interesse bekunden |
| `GET /api/abmeldung/:token` | **öffentlich** | Anmeldung zum Token anzeigen |
| `POST /api/abmeldung/:token` | **öffentlich** | Anmeldung stornieren |

Die beiden Abmelde-Routen sind bewusst die einzige Ausnahme vom Login-Gate: der Empfänger einer
Mail hat keine Sitzung. Der Zufallstoken ist der Berechtigungsnachweis; ohne gültigen Token gibt es
keinerlei Auskunft.

### Vorlagen (FV-4)

`anmeldung-eingegangen` (an den Interessenten, mit Abmelde-Link) und `anmeldung-neu`
(an die Wehrführung).

### Component Architecture

```
app/pages/lehrgang/[id].vue
└── signups/SignupModal.vue      – drei Felder, Einwilligung, Erfolgszustand
app/pages/abmeldung/[token].vue  – öffentliche Bestätigungsseite
app/pages/datenschutz.vue        – statische Seite für den Einwilligungs-Link
```

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/api/signups.spec.ts` | AC-2 bis AC-7, AC-10, AC-11, AC-12 |
| `tests/api/abmeldung.spec.ts` | AC-8, AC-9 |
| `tests/e2e/anmeldung.spec.ts` | AC-1, AC-4 |

---

## Implementierungsnotizen (2026-08-10)

**Gebaut:** Anmeldeformular als Modal auf der Detailseite (drei Felder + Einwilligung),
`POST /api/courses/:id/signups`, öffentliche Abmeldeseite `/abmeldung/:token`, statische
Datenschutzseite, Eingangsbestätigung und Meldung an die Wehrführung über die Vorlagen aus FV-4.
Die Belegung auf Karte und Detailseite zählt jetzt echte bestätigte Anmeldungen.

**Entscheidungen und Abweichungen:**

1. **Zwei öffentliche Routen als bewusste Ausnahme vom Login-Gate:** `/api/abmeldung/:token`
   (lesen und stornieren). Wer eine Mail bekommt, hat keine Sitzung; der Zufallstoken
   (24 Byte, base64url) ist der Berechtigungsnachweis. Ohne gültigen Token gibt es 404 und
   keinerlei Auskunft – auch keine Namen oder Lehrgangstitel.
2. **Der Token verlässt den Server nur per E-Mail**, nie in einer API-Antwort.
3. **Eigenes Rate Limit** für Anmeldungen (20 pro IP und 15 Minuten), getrennt vom Login-Limit.
4. **Meldung an die Wehrführung** geht an die konfigurierte Absenderadresse (`NUXT_SMTP_FROM`).
   Ohne Relay entfällt sie, die Anmeldung selbst bleibt gültig.
5. **Die Datenschutzseite ist ein fachlicher Entwurf** und als solcher gekennzeichnet – die
   endgültige Fassung gehört vor den produktiven Betrieb durch die Gemeinde geprüft (FV-8).
6. **E2E-Dateien sind nummeriert** (`01-login`, `02-verwaltung`, `03-anmeldung`): der erzwungene
   Wechsel des Startpassworts lässt sich nur einmal prüfen, deshalb muss die Login-Datei zuerst
   laufen. Ohne die Nummerierung war die Suite von der alphabetischen Reihenfolge abhängig.

**Nachtrag 2026-08-10:** Mit FV-6 ist der Kreis geschlossen – Anmeldungen lassen sich in der
Registratur bestätigen oder ablehnen, die zugehörigen Mails gehen raus. Die QA-Bildstrecke deckt
Formular und Bestätigungszustand in beiden Farbmodi ab.

## Tests

194 Vitest-Tests insgesamt, davon für FV-5: 14 API-Tests zur Anmeldung, 6 API-Tests zur
Selbstabmeldung, dazu 3 E2E-Tests und die erweiterte Autorisierungsmatrix.
