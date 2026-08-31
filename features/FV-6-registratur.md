# FV-6: Teilnehmer-Registratur & CSV-Export

**Status:** ✅ Approved (QA über Bildstrecke, hell und dunkel)
**Created:** 2026-08-10
**Last Updated:** 2026-08-10
**Abhängigkeiten:** FV-5 (Anmeldungen), FV-4 (Mailversand)

> **Hinweis (2026-09-01):** [FV-14](FV-14-plaetze-entfernen.md) hat die Platzzahl entfernt – AC-6
> („über Kapazität"-Kennzeichnung) ist damit historisch und spiegelt nicht mehr den aktuellen
> Stand.

## Ziel

Der zweite Tab der Verwaltung aus dem Entwurf: eine Tabelle aller Interessensbekundungen mit
Filtern, den Aktionen **Bestätigen**, **Ablehnen** und **Rückgängig** sowie einem CSV-Export für die
Anwesenheitsliste am Lehrgangstag. Jede Entscheidung löst die passende E-Mail aus.

## User Stories

- Als Wehrführung möchte ich sehen, wer sich gemeldet hat, und mit einem Klick zusagen oder absagen.
- Als Wehrführung möchte ich erkennen, wenn mehr Zusagen anstehen, als Plätze da sind.
- Als Ausbilder möchte ich die Teilnehmerliste eines Lehrgangs ausdrucken können.
- Als Interessent möchte ich per E-Mail erfahren, ob ich dabei bin.

## Acceptance Criteria

- [x] **AC-1:** Die Registratur zeigt Name, E-Mail, Lehrgang, Anmeldedatum und Status; sortiert nach
      Eingang, neueste zuerst.
- [x] **AC-2:** Die Filterleiste bietet „Alle", „Offen", „Bestätigt" und „Abgelehnt"; die Auswahl
      steht in der URL und übersteht ein Neuladen.
- [x] **AC-3:** „Bestätigen" setzt `offen → bestätigt`, „Ablehnen" setzt `offen → abgelehnt`,
      „Rückgängig" setzt beides zurück auf `offen`.
- [x] **AC-4:** Ein unzulässiger Übergang (etwa `storniert → bestätigt`) wird mit 422 abgelehnt.
- [x] **AC-5:** Eine Bestätigung verschickt die Zusage, eine Ablehnung die Absage; „Rückgängig"
      verschickt nichts. Jeder Versuch steht im Mailprotokoll.
- [x] AC-6 (entfällt seit FV-14, es gibt keine Platzzahl mehr): Bestätigungen über die Platzzahl
      hinaus sind möglich, werden aber als „über Kapazität" gekennzeichnet.
- [x] **AC-7:** Der CSV-Export eines Lehrgangs enthält alle nicht stornierten Anmeldungen mit
      Name, E-Mail, Status und Anmeldedatum; Trennzeichen Semikolon, UTF-8 mit BOM, damit Excel
      Umlaute korrekt anzeigt.
- [x] **AC-8:** Felder mit Semikolon, Anführungszeichen oder Zeilenumbruch werden im CSV korrekt
      maskiert.
- [x] **AC-9:** Alle Routen der Registratur sind Admin-only (401 ohne Anmeldung, 403 als Gast).
- [x] **AC-10:** Die Liste ist paginiert (Default 25, Max 100) und lässt sich auf einen Lehrgang
      einschränken.
- [x] **AC-11:** Die Zusammenfassung nennt die Zahl der angezeigten Anmeldungen je Status.

## Edge Cases

- Anmeldung, deren Lehrgang gelöscht wurde → Anmeldung verschwindet mit (Fremdschlüssel `cascade`)
- Teilnehmer storniert selbst, während die Wehrführung bestätigt → letzter Schreibvorgang gewinnt,
  der Übergang `storniert → bestätigt` ist unzulässig und wird mit 422 abgelehnt
- Lehrgang abgesagt → Anmeldungen bleiben sichtbar, Zusagen sind aber nicht mehr sinnvoll (Hinweis)
- CSV eines Lehrgangs ohne Anmeldungen → Datei nur mit Kopfzeile
- Mailversand aus → Statuswechsel gilt trotzdem, Mail steht als `nicht_versendet` im Protokoll

## Tech Design

### API Routes (Nitro)

| Route | Auth | Zweck |
|-------|------|-------|
| `GET /api/admin/signups` | admin | Liste, Query `status`, `lehrgang`, `page`, `limit` |
| `PATCH /api/admin/signups/:id` | admin | Statuswechsel (bestätigen, ablehnen, zurücksetzen) |
| `GET /api/admin/courses/:id/signups.csv` | admin | Anwesenheitsliste als CSV |

### Bausteine

- `server/services/signup-admin.service.ts` – Liste, Statusübergänge, Zusammenfassung
- `shared/csv.ts` – reine Funktionen `toCsv(rows)` und `escapeCsvValue(value)`
- Statusmaschine zentral: `offen → bestätigt | abgelehnt`, `bestätigt | abgelehnt → offen`;
  `storniert` ist eine Sackgasse für die Verwaltung (nur der Teilnehmer selbst kommt dort hin)

### Component Architecture

```
app/pages/verwaltung/index.vue
└── admin/SignupRegistry.vue       – Filter, Tabelle, Aktionen, Zusammenfassung
```

## Tests

| Datei | deckt ab |
|-------|----------|
| `tests/unit/signup-transitions.spec.ts` | AC-3, AC-4 |
| `tests/unit/csv.spec.ts` | AC-7, AC-8 |
| `tests/api/admin.signups.spec.ts` | AC-1 bis AC-6, AC-9 bis AC-11 |
| `tests/api/admin.signups.csv.spec.ts` | AC-7, AC-8, AC-9 |
| `tests/e2e/02-verwaltung.spec.ts` | AC-2, AC-3 |

---

## Implementierungsnotizen und QA (2026-08-10)

**Gebaut:** Registratur als zweiter Tab mit Filtern, Tabelle, den Aktionen Bestätigen/Ablehnen/
Rückgängig, Kennzeichnung „über Kapazität" und CSV-Export je Lehrgang. Zusage und Absage laufen
über die Vorlagen aus FV-4 und stehen im Mailprotokoll.

**Entscheidungen:**

1. **`storniert` ist eine Sackgasse für die Verwaltung.** Dorthin kommt nur der Teilnehmer selbst
   über seinen Abmelde-Link; aus einem Storno macht die Wehrführung keine Zusage (422).
2. **Zusagen über die Platzzahl hinaus sind erlaubt**, werden aber markiert – die Wehrführung
   entscheidet, nicht das System. Die Reihenfolge richtet sich nach dem Eingang.
3. **CSV mit Semikolon und BOM**, weil ein deutsches Excel die Datei sonst weder korrekt spaltet
   noch Umlaute richtig anzeigt.
4. **Rückgängig verschickt bewusst keine Mail** – sonst bekäme jemand eine Zusage und kurz darauf
   eine kommentarlose Rücknahme.

**Beim Bauen gefundene Fehler**

**BUG-13: Das BOM fehlte in der CSV-Datei · Severity: Medium**
- Die Konstante `CSV_BOM` enthielt beim Schreiben der Datei ein leeres Zeichen statt `\uFEFF`.
  Der erste Unit-Test hat das nicht bemerkt, weil `startsWith('')` immer wahr ist.
- Behoben: Konstante als `'\uFEFF'` geschrieben, Test prüft jetzt den Zeichencode und die Länge,
  der API-Test die rohen Bytes (`Response.text()` entfernt den BOM beim Dekodieren).

**BUG-14: Die Kennzeichnung „über Kapazität" traf alle Bestätigten · Severity: Low**
- `createdAt` hat nur Sekundenauflösung; bei gleichzeitigen Anmeldungen bekamen alle denselben
  Rang. Behoben durch einen Gleichstand-Entscheid über die ID.

## Tests

231 Vitest-Tests insgesamt, davon für FV-6: 9 Unit-Tests (Übergänge, CSV), 14 API-Tests zur
Registratur, 5 API-Tests zum Export, dazu ein E2E-Test über Filter und Entscheidung.
